import { collection, doc, getDoc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { db, appId } from './firebase';
import { armarCarga, armarCobro, armarConfirmacionCambio, armarDevolucionCobro, sincronizarCobro } from '../utils/cobrosClientes';

// Lo que se lee y se escribe del cobro de cada orden para Administración (ver utils/cobrosClientes y las reglas de cobrosClientes).
export const coleccionCobros = () => collection(db, 'artifacts', appId, 'public', 'data', 'cobrosClientes');
const docCobro = (ticketId) => doc(coleccionCobros(), String(ticketId));

// Al finalizarse la orden: emite su cobro (pendiente). Si la orden no lleva cobro o ya tiene el suyo, no hace nada. Devuelve el cobro emitido o null.
export async function emitirCobro(ticket, { por, ahora = Date.now() }) {
  const cobro = armarCobro(ticket, { por, ahora });
  if (!cobro) return null;
  if ((await getDoc(docCobro(ticket.id))).exists()) return null;
  await setDoc(docCobro(ticket.id), cobro);
  return cobro;
}

// Después de editar o cancelar una orden: el cobro sigue a la orden (ver sincronizarCobro). Sin cobro emitido o sin cambios, no escribe nada.
export async function sincronizarCobroDeOrden(ticket, { por, ahora = Date.now() }) {
  const snap = await getDoc(docCobro(ticket.id));
  if (!snap.exists()) return null;
  const r = sincronizarCobro(snap.data(), ticket, { por, ahora });
  if (!r) return null;
  await updateDoc(docCobro(ticket.id), r.cambios);
  return r.cambios;
}

// Administración marca el cobro como cargado, lo devuelve a pendiente o confirma que corrigió un cambio de monto, todo en una transacción que vuelve a leerlo (dos personas a la vez
// no se pisan). accion: 'cargar' | 'devolver' | 'confirmar'. Devuelve { ok: true } o { error, campo }.
export async function trabajarCobro(ticketId, accion, datos = {}, { por, ahora = Date.now() }) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(docCobro(ticketId));
    if (!snap.exists()) return { error: 'Este cobro ya no existe.' };
    const actual = snap.data();
    const r = accion === 'devolver' ? armarDevolucionCobro(actual, { por, ahora })
      : accion === 'confirmar' ? armarConfirmacionCambio(actual, { por, ahora })
        : armarCarga(actual, datos, { por, ahora });
    if (r.error) return r;
    tx.update(docCobro(ticketId), r.cambios);
    return { ok: true };
  });
}

// El cobro de una orden (una lectura), o null si no tiene.
export async function leerCobro(ticketId) {
  const snap = await getDoc(docCobro(ticketId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
