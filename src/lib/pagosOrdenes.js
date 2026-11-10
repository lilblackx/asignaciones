import { arrayUnion, collection, doc } from 'firebase/firestore';
import { getDoc, runTransaction, updateDoc, writeBatch } from './medidorFirestore.js';
import { db, appId } from './firebase';
import { armarCorreccionAdmin, armarPagoPendiente, armarPagoRegistrado, claveReferencia } from '../utils/pagoCliente';
import { entradaHistorialPago, lineaDePago, resumenDePago } from '../utils/pagoEnOrden';
import { esperarConLimite } from '../utils/tiempoLimite';

// Lo que se lee y se escribe de los pagos que los clientes hacen por las órdenes (ver utils/pagoCliente, utils/pagoEnOrden y las reglas de pagosOrdenes, referenciasPago, tickets y cobrosClientes).
// El pago manda en `pagosOrdenes` (con la reserva de su referencia); además se guarda una copia resumida (`pagoCliente`) en la orden y en el cobro, para que Revisión, Finanzas y Administración la lean
// junto a ellos. El pago, su referencia y la copia en la orden se guardan en un solo lote (o queda todo, o nada); la copia en el cobro va aparte (ver copiarAlCobro).
const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const docPago = (ticketId) => doc(datos('pagosOrdenes'), String(ticketId));
const docReferencia = (clave) => doc(datos('referenciasPago'), clave);
const docOrden = (ticketId) => doc(datos('tickets'), String(ticketId));
const docCobro = (ticketId) => doc(datos('cobrosClientes'), String(ticketId));

const fechaCorta = () => new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });

// ¿Quién tiene ya esa referencia? { estado: 'libre' } | { estado: 'propia' } (es de esta misma orden) | { estado: 'ajena', ticketId, codigo, por }.
export async function estadoReferencia(clave, ticketId) {
  if (!clave) return { estado: 'libre' };
  const snap = await getDoc(docReferencia(clave));
  if (!snap.exists()) return { estado: 'libre' };
  const { ticketId: dueno, codigo, por } = snap.data();
  return String(dueno) === String(ticketId) ? { estado: 'propia' } : { estado: 'ajena', ticketId: dueno, codigo, por };
}

const reservaDe = (doc, por, ahora) => ({ ticketId: doc.ticketId, codigo: doc.codigo, por, en: ahora });

// La copia del pago en el cobro de la orden (los técnicos no leen los cobros, así que no se sabe si ya existe): va aparte y sin esperar, y si el cobro todavía no existe (una instalación se registra al pre-finalizar,
// antes de que la oficina emita el cobro; entonces el cobro nace con la copia que trae la orden) o no se pudo escribir, no pasa nada: el pago ya quedó en la orden. Nunca falla hacia afuera.
function copiarAlCobro(ticketId, resumen) {
  updateDoc(docCobro(ticketId), { pagoCliente: resumen }).catch((error) => {
    if (error?.code !== 'not-found' && error?.code !== 'permission-denied') console.error('No se pudo copiar el pago al cobro:', error);
  });
}

// Guarda el pago en un solo lote: el documento de pago, la reserva de su referencia (si la hay) y la copia en la orden (con su entrada en el historial); después copia el pago al cobro, si ya está emitido.
// Devuelve { ok: true, documento, enCola } (enCola: sin respuesta del servidor en 15 s; queda en cola y se aplica al volver la conexión) o lanza el error.
async function guardarPago(ticket, documento, { por, ahora }) {
  const clave = documento.referenciaClave;
  const resumen = resumenDePago(documento);
  const lote = writeBatch(db);
  lote.set(docPago(ticket.id), documento);
  if (clave) lote.set(docReferencia(clave), reservaDe(documento, por, ahora));
  lote.update(docOrden(ticket.id), { pagoCliente: resumen, historialEdiciones: arrayUnion(entradaHistorialPago(resumen, { fecha: fechaCorta(), operador: por })) });
  const aTiempo = await esperarConLimite(lote.commit());
  copiarAlCobro(ticket.id, resumen);
  return { ok: true, documento, enCola: !aTiempo };
}

// El técnico registra el pago del cliente. Devuelve { ok: true, documento, enCola } o { repetida: { ticketId, codigo } } si la referencia ya está en otra orden.
export async function registrarPagoCliente(ticket, valor, { por, ahora = Date.now(), cobro }) {
  const documento = armarPagoRegistrado(ticket, valor, { por, ahora, cobro });
  const clave = documento.referenciaClave;
  const previa = await estadoReferencia(clave, ticket.id);
  if (previa.estado === 'ajena') return { repetida: { ticketId: previa.ticketId, codigo: previa.codigo } };
  try {
    return await guardarPago(ticket, documento, { por, ahora });
  } catch (error) {
    // Otro técnico la registró justo ahora: la reserva ya existe y las reglas rechazaron el lote.
    if (clave && error?.code === 'permission-denied') {
      const ahoraAjena = await estadoReferencia(clave, ticket.id);
      if (ahoraAjena.estado === 'ajena') return { repetida: { ticketId: ahoraAjena.ticketId, codigo: ahoraAjena.codigo } };
    }
    throw error;
  }
}

// El técnico dice que el cliente paga después (o que pagó junto con otra orden): queda anotado en la orden y en el cobro, sin datos de pago.
export async function registrarPagoPendiente(ticket, { nota, compartidoCon = null }, { por, ahora = Date.now(), cobro }) {
  const documento = armarPagoPendiente(ticket, { nota, compartidoCon }, { por, ahora, cobro });
  return guardarPago(ticket, documento, { por, ahora });
}

// El ADMIN registra el pago de una orden a nombre del técnico (Revisión: la orden espera el pago y el técnico no lo registra). `valor` es lo que devuelve parsePagoCliente (con la nota que explica por qué) o, con `pagaDespues`,
// solo la nota. Queda a nombre del técnico de la orden, marcado como registrado por la oficina. La orden puede estar ya archivada en un Cierre: entonces solo se guarda el documento de pago (la orden ya no está para
// llevar la copia; Revisión lo lee de aquí). Devuelve { ok: true, documento, resumen, enCola } o { repetida } si la referencia ya está en otra orden.
export async function registrarPagoPorAdmin(ticket, { valor = null, nota = '', pagaDespues = false }, { por, ahora = Date.now() }) {
  const documento = pagaDespues
    ? armarPagoPendiente(ticket, { nota }, { por, ahora, aNombreDelTecnico: true })
    : armarPagoRegistrado(ticket, { ...valor, nota: nota || valor?.nota || '' }, { por, ahora, aNombreDelTecnico: true });
  const clave = documento.referenciaClave;
  const previa = await estadoReferencia(clave, ticket.id);
  if (previa.estado === 'ajena') return { repetida: { ticketId: previa.ticketId, codigo: previa.codigo } };
  const resumen = resumenDePago(documento);
  const orden = await getDoc(docOrden(ticket.id));
  const lote = writeBatch(db);
  lote.set(docPago(ticket.id), documento);
  if (clave) lote.set(docReferencia(clave), reservaDe(documento, por, ahora));
  if (orden.exists()) lote.update(docOrden(ticket.id), { pagoCliente: resumen, historialEdiciones: arrayUnion(entradaHistorialPago(resumen, { fecha: fechaCorta(), operador: por })) });
  const aTiempo = await esperarConLimite(lote.commit());
  copiarAlCobro(ticket.id, resumen);
  return { ok: true, documento, resumen, enCola: !aTiempo };
}

// El pago que hay guardado de una orden (el resumen que ven las pantallas) o null si no hay. Revisión lo usa para las órdenes archivadas, cuya copia no se actualiza.
export async function leerResumenDePago(ticketId) {
  const snap = await getDoc(docPago(ticketId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return resumenDePago(d, d.corregidoPor ? { corregidoPor: d.corregidoPor, corregidoEn: d.corregidoEn } : {});
}

// El ADMIN corrige el pago de una orden (o registra el que el técnico dejó como "paga después"). Todo dentro de una transacción que vuelve a leer el pago (dos personas a la vez no se pisan): actualiza el
// documento de pago, la reserva de su referencia (si cambió: la nueva se reserva y la vieja se libera; si ya está en otra orden se puede repetir porque la nota explica por qué), la copia en la orden y la
// del cobro. Una orden ya archivada en un Cierre conserva su copia anterior. Devuelve { ok: true } o { error, campo }.
export async function corregirPagoCliente(ticketId, { valor, nota = '' }, { por, ahora = Date.now() }) {
  const previo = await getDoc(docPago(ticketId));
  if (!previo.exists()) return { error: 'Este pago ya no existe.' };
  const claveNueva = claveReferencia(valor.pago.forma, valor.pago.banco, valor.pago.referencia);
  let repiteReferencia = false;
  if (claveNueva && claveNueva !== previo.data().referenciaClave) repiteReferencia = (await estadoReferencia(claveNueva, ticketId)).estado === 'ajena';

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(docPago(ticketId));
    if (!snap.exists()) return { error: 'Este pago ya no existe.' };
    const actual = snap.data();
    const resultado = armarCorreccionAdmin(actual, { valor, nota, repiteReferencia }, { por, ahora });
    if (resultado.error) return resultado;
    const { cambios } = resultado;
    const claveVieja = actual.referenciaClave || '';
    const claveFinal = cambios.referenciaClave ?? claveVieja;
    const nueva = claveFinal && claveFinal !== claveVieja && !repiteReferencia ? await tx.get(docReferencia(claveFinal)) : null;
    const vieja = claveVieja && claveVieja !== claveFinal ? await tx.get(docReferencia(claveVieja)) : null;
    const orden = await tx.get(docOrden(ticketId));
    const cobro = await tx.get(docCobro(ticketId));

    const resumen = resumenDePago({ ...actual, ...cambios }, { corregidoPor: por, corregidoEn: ahora });
    tx.update(docPago(ticketId), cambios);
    if (nueva && !nueva.exists()) tx.set(docReferencia(claveFinal), { ticketId: String(ticketId), codigo: actual.codigo, por, en: ahora });
    if (vieja?.exists() && String(vieja.data().ticketId) === String(ticketId)) tx.delete(docReferencia(claveVieja));
    if (orden.exists()) {
      const entrada = entradaHistorialPago(resumen, { fecha: fechaCorta(), operador: por, corregido: true, motivo: nota });
      tx.update(docOrden(ticketId), { pagoCliente: resumen, historialEdiciones: [...(orden.data().historialEdiciones || []), entrada] });
    }
    if (cobro.exists()) {
      const entrada = { en: ahora, por, detalle: `Pago del cliente corregido: ${lineaDePago(resumen)} | ${nota}` };
      tx.update(docCobro(ticketId), { pagoCliente: resumen, actualizadoEn: ahora, historial: [...(cobro.data().historial || []), entrada] });
    }
    return { ok: true, repiteReferencia };
  });
}
