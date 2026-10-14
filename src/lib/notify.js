import { NOTIFY_WORKER_URL } from './firebase';

// Dispara un push a través del Cloudflare Worker (ver /cf-worker). El cliente
// nunca ve tokens ajenos: solo le dice al Worker a quién avisar (técnico por
// nombre, o "aprobadores") y el Worker resuelve los tokens y llama a FCM.
// Si el push no sale, la orden ya se guardó igual; por eso el aviso no rompe nada,
// pero sí devuelve el resultado para que quien asigna sepa que el técnico no se enteró:
//   { ok: true, sent: N }  -> el Worker respondió; N dispositivos recibieron el push
//   { ok: false, sent: 0 } -> no se pudo (red, Worker caído, sin permiso), tras reintentar
//   { ok: true, sent: null } -> push no configurado en este entorno (no hay nada que avisar)
const REINTENTOS_MS = [800, 2500]; // 3 intentos en total
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendPush(firebaseUser, { target, title, body, tipo, ticketId }) {
  if (!firebaseUser || NOTIFY_WORKER_URL === 'PENDIENTE_DEPLOY_WORKER') return { ok: true, sent: null };

  for (let intento = 0; intento <= REINTENTOS_MS.length; intento++) {
    try {
      // Tras un 401 se pide un token nuevo: el anterior pudo vencer justo ahora.
      const idToken = await firebaseUser.getIdToken(intento > 0);
      const res = await fetch(NOTIFY_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ target, title, body, tipo, ticketId }),
        // El aviso termina de enviarse aunque se cierre o recargue la pestaña justo después.
        keepalive: true,
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: true, sent: Number.isFinite(data.sent) ? data.sent : null };
      }
      // 4xx (salvo 401 y 429) no mejora reintentando: sin permiso, datos inválidos.
      if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) {
        console.error(`El Worker de notificaciones respondió ${res.status}`);
        return { ok: false, sent: 0 };
      }
    } catch (err) {
      console.error('No se pudo enviar la notificación push:', err);
    }
    if (intento < REINTENTOS_MS.length) await esperar(REINTENTOS_MS[intento]);
  }
  return { ok: false, sent: 0 };
}
