import { NOTIFY_WORKER_URL } from './firebase';

// Dispara un push a través del Cloudflare Worker (ver /cf-worker). El cliente
// nunca ve tokens ajenos: solo le dice al Worker a quién avisar (técnico por
// nombre, o "aprobadores") y el Worker resuelve los tokens y llama a FCM.
// Falla en silencio: si el push no sale, la orden ya se guardó igual — solo
// se pierde el aviso (queda la notificación in-app si la otra persona tiene
// la app abierta).
export async function sendPush(firebaseUser, { target, title, body }) {
  if (!firebaseUser || NOTIFY_WORKER_URL === 'PENDIENTE_DEPLOY_WORKER') return;
  try {
    const idToken = await firebaseUser.getIdToken();
    await fetch(NOTIFY_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ target, title, body }),
    });
  } catch (err) {
    console.error('No se pudo enviar la notificación push:', err);
  }
}
