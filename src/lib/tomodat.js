import { auth, TOMODAT_WORKER_URL } from './firebase';

// Busca en Tomodat, a través del Worker (ver /cf-worker-tomodat), las cajas cuyo
// nombre corresponde al código de NAP. Devuelve [{ nombre, tipo, lat, lng }] o
// lanza Error si el Worker o Tomodat no respondieron.
// Sin tope, una petición colgada (Tomodat lento, red caída) deja el "Buscando..."
// girando para siempre: pasado este tiempo se corta y se pide pegar a mano.
const TIMEOUT_MS = 15000;

export async function buscarNapTomodat(codigo, signal) {
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
    const res = await fetch(`${TOMODAT_WORKER_URL}/nap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ codigo }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Tomodat no respondió (${res.status}).`);
    const { resultados } = await res.json();
    return Array.isArray(resultados) ? resultados : [];
  } catch (err) {
    if (vencio) throw new Error('Tomodat tardó demasiado en responder.', { cause: err });
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelar);
  }
}
