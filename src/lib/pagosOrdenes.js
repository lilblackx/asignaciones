import { collection, doc, getDoc, runTransaction, setDoc, writeBatch } from 'firebase/firestore';
import { db, appId } from './firebase';
import { armarConciliacion, armarCorreccion, armarDevolucion, armarPagoPendiente, armarPagoRegistrado, armarSinCobrar, claveReferencia } from '../utils/pagoCliente';

// Lo que se lee y se escribe de los pagos que los clientes hacen por las órdenes (ver utils/pagoCliente y las reglas de pagosOrdenes y referenciasPago).
const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
export const coleccionPagos = () => datos('pagosOrdenes');
const docPago = (ticketId) => doc(datos('pagosOrdenes'), String(ticketId));
const docReferencia = (clave) => doc(datos('referenciasPago'), clave);

// ¿Quién tiene ya esa referencia? { estado: 'libre' } | { estado: 'propia' } (es de esta misma orden) | { estado: 'ajena', ticketId, codigo, por }.
export async function estadoReferencia(clave, ticketId) {
  if (!clave) return { estado: 'libre' };
  const snap = await getDoc(docReferencia(clave));
  if (!snap.exists()) return { estado: 'libre' };
  const { ticketId: dueno, codigo, por } = snap.data();
  return String(dueno) === String(ticketId) ? { estado: 'propia' } : { estado: 'ajena', ticketId: dueno, codigo, por };
}

const reservaDe = (clave, doc, por, ahora) => ({ ticketId: doc.ticketId, codigo: doc.codigo, por, en: ahora });

// El técnico registra el pago del cliente: el pago y la reserva de su referencia en un solo lote (las reglas no dejan guardar el pago sin la reserva ni reservar una
// referencia que ya tiene otra orden). Devuelve { ok: true } o { repetida: { ticketId, codigo } } si la referencia ya está en otra orden.
export async function registrarPagoCliente(ticket, valor, { por, ahora = Date.now(), cobro }) {
  const documento = armarPagoRegistrado(ticket, valor, { por, ahora, cobro });
  const clave = documento.referenciaClave;
  const previa = await estadoReferencia(clave, ticket.id);
  if (previa.estado === 'ajena') return { repetida: { ticketId: previa.ticketId, codigo: previa.codigo } };
  const lote = writeBatch(db);
  lote.set(docPago(ticket.id), documento);
  if (clave) lote.set(docReferencia(clave), reservaDe(clave, documento, por, ahora));
  try {
    await lote.commit();
  } catch (error) {
    // Otro técnico la registró justo ahora: la reserva ya existe y las reglas rechazaron el lote.
    if (clave && error?.code === 'permission-denied') {
      const ahoraAjena = await estadoReferencia(clave, ticket.id);
      if (ahoraAjena.estado === 'ajena') return { repetida: { ticketId: ahoraAjena.ticketId, codigo: ahoraAjena.codigo } };
    }
    throw error;
  }
  return { ok: true, documento };
}

// El técnico dice que el cliente paga después (o que pagó junto con otra orden): el pago queda pendiente de cobro y pasa a Administración.
export async function registrarPagoPendiente(ticket, { nota, compartidoCon = null }, { por, ahora = Date.now(), cobro }) {
  const documento = armarPagoPendiente(ticket, { nota, compartidoCon }, { por, ahora, cobro });
  await setDoc(docPago(ticket.id), documento);
  return { ok: true, documento };
}

// --- Administración ---

// Concilia, cobra, marca sin cobrar o corrige un pago. Todo dentro de una transacción que vuelve a leer el pago (dos personas a la vez no se pisan). Si la
// referencia nueva ya está en otra orden, solo Administración puede repetirla y la nota es obligatoria; si es libre se reserva, y la vieja se libera.
// accion: 'conciliar' | 'sinCobrar' | 'corregir' | 'devolver'. Devuelve { ok: true } o { error, campo }.
export async function trabajarPago(ticketId, accion, { valor = null, nota = '' } = {}, { por, ahora = Date.now() }) {
  const previo = await getDoc(docPago(ticketId));
  if (!previo.exists()) return { error: 'Este pago ya no existe.' };
  const claveNueva = valor ? claveReferencia(valor.pago.forma, valor.pago.banco, valor.pago.referencia) : '';
  let repiteReferencia = false;
  if (claveNueva && claveNueva !== previo.data().referenciaClave) repiteReferencia = (await estadoReferencia(claveNueva, ticketId)).estado === 'ajena';

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(docPago(ticketId));
    if (!snap.exists()) return { error: 'Este pago ya no existe.' };
    const actual = snap.data();
    const resultado = accion === 'sinCobrar' ? armarSinCobrar(actual, { nota }, { por, ahora })
      : accion === 'devolver' ? armarDevolucion(actual, { nota }, { por, ahora })
      : accion === 'corregir' ? armarCorreccion(actual, { valor, nota, repiteReferencia }, { por, ahora })
        : armarConciliacion(actual, { valor, nota, repiteReferencia }, { por, ahora });
    if (resultado.error) return resultado;
    const { cambios } = resultado;
    const claveVieja = actual.referenciaClave || '';
    const claveFinal = cambios.referenciaClave ?? claveVieja;
    const nueva = claveFinal && claveFinal !== claveVieja && !repiteReferencia ? await tx.get(docReferencia(claveFinal)) : null;
    const vieja = claveVieja && claveVieja !== claveFinal ? await tx.get(docReferencia(claveVieja)) : null;
    tx.update(docPago(ticketId), cambios);
    if (nueva && !nueva.exists()) tx.set(docReferencia(claveFinal), { ticketId: String(ticketId), codigo: actual.codigo, por, en: ahora });
    if (vieja?.exists() && String(vieja.data().ticketId) === String(ticketId)) tx.delete(docReferencia(claveVieja));
    return { ok: true, repiteReferencia };
  });
}
