import { auth, TOMODAT_WORKER_URL } from './firebase';

// POST autenticado (token de Firebase) a una ruta del Worker de integraciones
// (/cf-worker-tomodat: Tomodat y SmartOLT). Devuelve el JSON o lanza Error.
// Sin tope, una petición colgada (servicio lento, red caída) deja el "Buscando..."
// girando para siempre: pasado este tiempo se corta y se pide llenar a mano.
// Si vence, se reintenta una vez: el Worker une el reintento a la consulta que sigue
// en curso, así que suele responder enseguida.
// Si el servicio externo (SmartOLT, Tomodat) falla en ese momento (el Worker responde 502), también se reintenta una vez
// tras una pausa corta: suele ser un tropiezo pasajero y el segundo intento sale bien, igual que al tocar el botón de buscar de nuevo.
const TIMEOUT_MS = 20000;
const PAUSA_REINTENTO_MS = 1500;

export async function consultarWorker(ruta, cuerpo, signal, servicio) {
  try {
    return await consultarUnaVez(ruta, cuerpo, signal, servicio);
  } catch (err) {
    if (signal?.aborted) throw err;
    if (err.cause?.name === 'AbortError') return consultarUnaVez(ruta, cuerpo, signal, servicio);
    if (!err.servicioFallo) throw err;
    await new Promise((resolve) => setTimeout(resolve, PAUSA_REINTENTO_MS));
    if (signal?.aborted) throw err;
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
      // Si el Worker lo explicó, se muestra eso solo (sin repetir el código); si no, el código que devolvió.
      const texto = motivo && motivo.length <= 200 ? motivo.replace(/\.$/, '') : `${servicio} no respondió (${res.status})`;
      throw Object.assign(new Error(`${texto}.`), { servicioFallo: res.status === 502 });
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
