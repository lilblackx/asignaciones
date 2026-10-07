import { auth, TOMODAT_WORKER_URL } from './firebase';

// POST autenticado (token de Firebase) a una ruta del Worker de integraciones
// (/cf-worker-tomodat: Tomodat y SmartOLT). Devuelve el JSON o lanza Error.
// Sin tope, una petición colgada (servicio lento, red caída) deja el "Buscando..."
// girando para siempre: pasado este tiempo se corta y se pide llenar a mano.
const TIMEOUT_MS = 15000;

export async function consultarWorker(ruta, cuerpo, signal, servicio) {
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
    if (!res.ok) throw new Error(`${servicio} no respondió (${res.status}).`);
    return await res.json();
  } catch (err) {
    if (vencio) throw new Error(`${servicio} tardó demasiado en responder.`, { cause: err });
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelar);
  }
}
