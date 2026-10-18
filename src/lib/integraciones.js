import { auth, TOMODAT_WORKER_URL } from './firebase';

// POST autenticado (token de Firebase) a una ruta del Worker de integraciones
// (/cf-worker-tomodat: Tomodat y SmartOLT). Devuelve el JSON o lanza Error.
// Sin tope, una petición colgada (servicio lento, red caída) deja el "Buscando..."
// girando para siempre: pasado este tiempo se corta y se pide llenar a mano.
// Si vence, se reintenta una vez: el Worker une el reintento a la consulta que sigue
// en curso, así que suele responder enseguida.
const TIMEOUT_MS = 20000;

export async function consultarWorker(ruta, cuerpo, signal, servicio) {
  try {
    return await consultarUnaVez(ruta, cuerpo, signal, servicio);
  } catch (err) {
    if (err.cause?.name !== 'AbortError' || signal?.aborted) throw err;
    return consultarUnaVez(ruta, cuerpo, signal, servicio);
  }
}

async function consultarUnaVez(ruta, cuerpo, signal, servicio) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sin sesión.');

  const controller = new AbortController();
  let vencio = false;
  const timer = setTimeout(() => { vencio = true; controller.abort(); }, TIMEOUT_MS);
  const cancelar = () => controller.abort();
  if (signal?.aborted) cancelar();
  signal?.addEventListener('abort', cancelar);

  try {
    const idToken = await user.getIdToken();
    const res = await fetch(`${TOMODAT_WORKER_URL}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(cuerpo),
      signal: controller.signal,
    });
    if (!res.ok) {
      // El Worker explica el motivo en el cuerpo ("SmartOLT limitó las consultas...", "tardó demasiado...").
      const motivo = (await res.text().catch(() => '')).trim();
      throw new Error(`${servicio} no respondió (${res.status})${motivo && motivo.length <= 160 ? `: ${motivo}` : ''}.`);
    }
    return await res.json();
  } catch (err) {
    if (vencio) throw new Error(`${servicio} tardó demasiado en responder.`, { cause: err });
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelar);
  }
}
