import { doc, setDoc } from 'firebase/firestore';
import { auth, appId, db, NOTIFY_WORKER_URL } from './firebase';

// Envío al inventario del otro sistema (ver cf-worker/src/inventario.js y utils/envioInventario). Al aprobar una orden la app
// deja una marca mínima "pendiente" y le avisa al Worker. Si el aviso no llega (red, pestaña cerrada) la marca la recoge el
// Worker solo, en unos minutos: por eso un fallo aquí nunca se le muestra a quien aprobó ni frena la aprobación.

// Marca mínima { ticketId, estado: PENDIENTE, intentos: 0 }: sin datos de la orden (el Worker la lee él mismo). Las reglas solo
// dejan crearla una vez; si ya existe, se ignora.
export async function marcarEnvioInventario(ticketId) {
  try {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'telecomEnvios', String(ticketId)), { ticketId: String(ticketId), estado: 'PENDIENTE', intentos: 0 });
  } catch (error) {
    console.warn('No se pudo dejar la marca de envío al inventario (el Worker lo enviará igual al llamarlo):', error?.code || error);
  }
}

const REINTENTOS_MS = [800, 2500]; // 3 intentos en total
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// POST autenticado al Worker: '/inventario/enviar' (al aprobar) o '/inventario/reintentar' (desde la alerta).
// Devuelve { ok, estado, mensaje }: `estado` es lo que contestó el Worker (ENVIADO, PENDIENTE, SERIAL_NO_ENCONTRADO...).
export async function llamarInventario(ruta, ticketId) {
  if (NOTIFY_WORKER_URL === 'PENDIENTE_DEPLOY_WORKER') return { ok: false, estado: '', mensaje: '' };
  for (let intento = 0; intento <= REINTENTOS_MS.length; intento++) {
    try {
      const usuario = auth.currentUser;
      if (!usuario) return { ok: false, estado: '', mensaje: 'Sin sesión.' };
      const idToken = await usuario.getIdToken(intento > 0);
      const res = await fetch(`${NOTIFY_WORKER_URL}${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ ticketId: String(ticketId) }),
        // Termina de enviarse aunque se cierre o recargue la pestaña justo después.
        keepalive: true,
      });
      if (res.ok) {
        const datos = await res.json().catch(() => ({}));
        return { ok: true, estado: datos.estado || '', mensaje: datos.mensaje || '' };
      }
      // 4xx (salvo 401 y 429) no mejora reintentando: sin permiso, datos inválidos, orden inexistente.
      if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) {
        return { ok: false, estado: '', mensaje: `El Worker respondió ${res.status}.` };
      }
    } catch (error) {
      console.warn('No se pudo llamar al envío al inventario:', error);
    }
    if (intento < REINTENTOS_MS.length) await esperar(REINTENTOS_MS[intento]);
  }
  return { ok: false, estado: '', mensaje: 'No se pudo conectar con el servidor.' };
}

// Los técnicos que tiene el inventario del almacén (para elegir con cuál se corresponde cada técnico de la app). Solo la
// contestan los usuarios del módulo. Devuelve { ok, tecnicos: [{ nombre, activo }], mensaje }.
export async function listarTecnicosInventario() {
  if (NOTIFY_WORKER_URL === 'PENDIENTE_DEPLOY_WORKER') return { ok: false, tecnicos: [], mensaje: '' };
  try {
    const usuario = auth.currentUser;
    if (!usuario) return { ok: false, tecnicos: [], mensaje: 'Sin sesión.' };
    const res = await fetch(`${NOTIFY_WORKER_URL}/inventario/tecnicos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await usuario.getIdToken()}` },
      body: '{}',
    });
    if (!res.ok) return { ok: false, tecnicos: [], mensaje: `El Worker respondió ${res.status}.` };
    const datos = await res.json().catch(() => ({}));
    if (datos.estado === 'DESHABILITADO') return { ok: false, tecnicos: [], mensaje: 'El envío al inventario está apagado.' };
    return { ok: true, tecnicos: Array.isArray(datos.tecnicos) ? datos.tecnicos : [], mensaje: '' };
  } catch (error) {
    console.warn('No se pudo leer la lista de técnicos del inventario:', error);
    return { ok: false, tecnicos: [], mensaje: 'No se pudo conectar con el servidor.' };
  }
}
