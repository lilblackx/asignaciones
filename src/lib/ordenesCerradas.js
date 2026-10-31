import { collection, doc, limit, orderBy, query, where } from 'firebase/firestore';
import { setDoc, runTransaction } from './medidorFirestore.js';
import { getDoc, getDocs } from './medidorFirestore';
import { db, appId } from './firebase';

// Leer y corregir una orden que ya salió de la lista: el cierre del día la mueve a `ticketsDetalle` de un reporte de cierre.
// Una orden que aún está en la lista (finalizada pero sin cerrar el día) se lee y se guarda como siempre.
const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const REPORTES_A_MIRAR = 6;

// { origen: 'activa', ticket } | { origen: 'archivada', ticket, reporteId, fechaCierre } | null.
// `desdeMs`: cuándo se finalizó (el reporte de cierre se creó después): así solo se miran los primeros reportes desde esa fecha.
export async function leerOrdenParaCorregir(ticketId, desdeMs = 0) {
  const activa = await getDoc(doc(datos('tickets'), String(ticketId)));
  if (activa.exists()) return { origen: 'activa', ticket: { id: activa.id, ...activa.data() } };
  if (!(desdeMs > 0)) return null;
  const snap = await getDocs(query(datos('reports'), where('createdAt', '>=', Math.floor(desdeMs)), orderBy('createdAt', 'asc'), limit(REPORTES_A_MIRAR)));
  for (const reporte of snap.docs) {
    const ticket = (reporte.data().ticketsDetalle || []).find((t) => String(t?.id) === String(ticketId));
    if (ticket) return { origen: 'archivada', ticket, reporteId: reporte.id, fechaCierre: reporte.data().fechaCierre || '' };
  }
  return null;
}

// Guarda la orden corregida donde estaba. Una archivada se reemplaza dentro de su reporte, en una transacción que vuelve a leerlo (si dos
// personas corrigen a la vez, o el reporte cambió, no se pisan). Devuelve { ok: true } o { error }.
export async function guardarOrdenCorregida(lectura, ticketNuevo) {
  if (lectura.origen === 'activa') {
    await setDoc(doc(datos('tickets'), String(ticketNuevo.id)), ticketNuevo);
    return { ok: true };
  }
  const ref = doc(datos('reports'), lectura.reporteId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const lista = snap.exists() ? snap.data().ticketsDetalle || [] : [];
    const posicion = lista.findIndex((t) => String(t?.id) === String(ticketNuevo.id));
    if (posicion < 0) return { error: 'La orden ya no está en ese reporte de cierre.' };
    tx.update(ref, { ticketsDetalle: lista.map((t, i) => (i === posicion ? ticketNuevo : t)) });
    return { ok: true };
  });
}
