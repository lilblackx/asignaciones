// La barrera entre las órdenes y Finanzas: un administrador revisa lo que se va a pagar y solo lo aprobado llega a Finanzas. Funciones puras (las usan el módulo Revisión de
// pagos, Finanzas y las pruebas). Se guarda en la colección revisionPagos, un documento por orden (el id es la clave de la orden, la misma de ordenesPagadas):
//   { estado, motivo, firma, dia, codigo, tecnico, concepto, tecnicoCorregido?, conceptoCorregido?, descuento?, descuentoDe?, garantiaSinDescuento?, por, en, historial: [{ estado, por, en, motivo }] }
//   Garantía de otro técnico (ver garantia.js y ajustes.js): una orden con `garantiaDe` no se puede aprobar hasta decidir. `descuento` son los dólares que se descuentan de la orden original (`descuentoDe`:
//   { id, codigo, tecnico }) y se le pagan al técnico de la garantía; `garantiaSinDescuento` es el motivo de no descontar nada. Con descuento la garantía no se paga como orden.
//   estado: 'PENDIENTE' (solo con una corrección guardada), 'APROBADA' (pasa a Finanzas), 'RETENIDA' (no pasa por ahora, con motivo) o 'EXCLUIDA' (no se paga, con motivo).
//   firma: huella de lo que decide el pago de esa orden (técnico, tipo de trabajo, cobro, estado, día y concepto). Si la orden cambia después, la firma ya no coincide y la
//   aprobación (y las correcciones) dejan de valer: vuelve a "Pendiente".
import { CONCEPTOS_PAGO, SIN_TECNICO, mudanzasSinTipo, ordenesPagables } from './finanzas.js';
import { ajustesDeOrden, idsAjustesDeOrden } from './ajustes.js';

export const ESTADOS_REVISION = ['PENDIENTE', 'APROBADA', 'RETENIDA', 'EXCLUIDA'];
export const ETIQUETA_REVISION = { PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', RETENIDA: 'Retenida', EXCLUIDA: 'Excluida' };
export const MAX_MOTIVO_REVISION = 300;
export const MAX_HISTORIAL_REVISION = 30;
// Un documento de revisión por orden: un lote de Firestore admite 500 escrituras.
export const MAX_REVISIONES_POR_LOTE = 450;

const limpiar = (texto) => String(texto ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

// Retener y excluir piden un motivo.
export function parseMotivoRevision(raw) {
  const texto = limpiar(raw);
  if (!texto) return { error: 'Escribe el motivo.' };
  if (texto.length > MAX_MOTIVO_REVISION) return { error: `El motivo es demasiado largo (máximo ${MAX_MOTIVO_REVISION} caracteres).` };
  return { valor: texto };
}

// Una huella corta y estable de un texto (no es para seguridad: solo para notar que la orden cambió).
function huella(texto) {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// La firma de una orden o de una fila de VN y TA: lo que decide si se paga, a quién y con qué precio.
export function firmaDeItem(item) {
  const o = item.orden || {};
  const partes = item.registro
    ? ['R', item.registro.trabajo, item.registro.tecnico, item.registro.fecha, item.registro.id]
    : ['O', o.tecnico, o.estado, o.tipoTrabajo, o.falla, o.tipoVisita, o.cobroTipo, o.cobroBs, o.cobroMoneda, item.dia];
  return huella([...partes, item.concepto ?? ''].map((v) => String(v ?? '')).join('|'));
}

// Lo que se revisa: lo que hoy llegaría a Finanzas más las mudanzas finalizadas que todavía no tienen tipo (el administrador les elige el concepto al corregirlas).
// `registros`: filas de VN y TA del periodo; `tiposMudanza`: lo que Finanzas ya eligió para mudanzas de un cierre.
export function itemsParaRevisar({ ordenes, rango, tecnico = '', registros = [], tiposMudanza = null }) {
  const pagables = ordenesPagables(ordenes, rango, { tecnico, registros, tiposMudanza });
  const sinTipo = mudanzasSinTipo(ordenes, rango, { tecnico, tiposMudanza }).map((i) => ({ ...i, concepto: null }));
  return [...pagables, ...sinTipo].sort((a, b) => a.dia.localeCompare(b.dia) || String(a.orden.codigo).localeCompare(String(b.orden.codigo)));
}

// Cada item con su estado de revisión y con las correcciones del administrador aplicadas (técnico y concepto efectivos). `revisiones`: { [clave]: documento }.
// El item trae además: tecnicoOriginal, conceptoOriginal, firma, revision (el documento vigente o null), estadoRevision, cambioDespues (tenía revisión pero la orden cambió) y corregida.
export function revisar(items, revisiones = {}) {
  return items.map((item) => {
    const firma = firmaDeItem(item);
    const rev = revisiones[item.clave] || null;
    const vigente = Boolean(rev) && rev.firma === firma;
    return {
      ...item,
      tecnico: vigente && rev.tecnicoCorregido ? rev.tecnicoCorregido : item.tecnico,
      concepto: vigente && rev.conceptoCorregido ? rev.conceptoCorregido : item.concepto,
      tecnicoOriginal: item.tecnico,
      conceptoOriginal: item.concepto,
      firma,
      revision: vigente ? rev : null,
      // El documento aunque ya no valga (la orden cambió): sirve para borrar los ajustes de una aprobación que ya no vale.
      revisionAnterior: rev,
      estadoRevision: vigente && ESTADOS_REVISION.includes(rev.estado) ? rev.estado : 'PENDIENTE',
      cambioDespues: Boolean(rev) && !vigente,
      corregida: vigente && Boolean(rev.tecnicoCorregido || rev.conceptoCorregido),
      // Garantía de otro técnico: la orden original que dejó marcada la oficina y lo que decidió el administrador (descontar de ella o no descontar, con motivo).
      garantiaDe: item.orden?.garantiaDe?.id ? item.orden.garantiaDe : null,
      descuento: vigente ? Number(rev.descuento) || 0 : 0,
      descuentoDe: vigente && Number(rev.descuento) > 0 ? rev.descuentoDe || null : null,
      garantiaSinDescuento: vigente ? rev.garantiaSinDescuento || '' : '',
      garantiaResuelta: vigente && (Number(rev.descuento) > 0 || Boolean(rev.garantiaSinDescuento)),
    };
  });
}

// ¿Se puede aprobar? Necesita un técnico y un concepto de pago (una mudanza sin tipo todavía no tiene).
export function motivoNoAprobable(item) {
  if (item.garantiaDe?.id && !item.garantiaResuelta) return 'Es una garantía de otro técnico: decide si se descuenta de la orden original antes de aprobarla.';
  if (!item.concepto) return 'Elige el concepto con que se paga (Corregir).';
  if (!item.tecnico || item.tecnico === SIN_TECNICO) return 'La orden no tiene técnico: corrígelo antes de aprobarla.';
  return '';
}

// Lo que ve Finanzas: lo aprobado y lo que ya se pagó (las ya pagadas siguen a la vista de los reportes). `pagadas`: Set de claves de ordenesPagadas. Una orden aprobada con descuento
// no se paga como orden a nadie: Finanzas solo ve su descuento y su bono (ajustes).
export const paraFinanzas = (revisados, pagadas = new Set()) => revisados
  .filter((i) => pagadas.has(i.clave) || (i.estadoRevision === 'APROBADA' && i.concepto && !motivoNoAprobable(i) && !(i.descuento > 0)))
  .map((i) => (pagadas.has(i.clave) ? { ...i, tecnico: i.tecnicoOriginal, concepto: i.conceptoOriginal } : i));

// Cuántas y cuánto suman, por estado (las ya pagadas no cuentan: ya salieron de la revisión). `precio(item)`: lo que se paga por esa orden en dólares.
export function resumenRevision(revisados, precio = () => 0, pagadas = new Set()) {
  const resumen = Object.fromEntries(ESTADOS_REVISION.map((e) => [e, { cantidad: 0, total: 0 }]));
  for (const i of revisados) {
    if (pagadas.has(i.clave)) continue;
    resumen[i.estadoRevision].cantidad += 1;
    resumen[i.estadoRevision].total = Math.round((resumen[i.estadoRevision].total + (precio(i) || 0)) * 100) / 100;
  }
  return resumen;
}

// ¿Esa revisión aprobó una orden con descuento (o sea, creó ajustes)?
const ajustesVigentes = (rev) => rev?.estado === 'APROBADA' && Number(rev.descuento) > 0 && Boolean(rev.descuentoDe?.id);

// El documento que se guarda al revisar una orden. accion: 'APROBAR' | 'RETENER' | 'EXCLUIR' | 'PENDIENTE' (deshacer). `correccion`: { tecnico, concepto } (se guarda aparte; vacío la quita).
// `garantia` (decisión sobre una garantía de otro técnico): { descuento, origen: { id, codigo, tecnico }, tope? } para descontar `descuento` dólares de la orden original (`tope`: lo que cobra esa
// original; el descuento no puede pasar de ahí) o { sinDescuento: 'motivo' } para no descontar. Sin `garantia` se conserva la decisión anterior. Devuelve { error } o
// { id, datos, ajustes, borrarAjustes }: los ajustes que hay que crear al aprobar y los que hay que borrar porque la orden ya no está aprobada.
export function armarRevision(item, accion, { por, ahora, motivo = '', correccion, garantia } = {}) {
  const estado = { APROBAR: 'APROBADA', RETENER: 'RETENIDA', EXCLUIR: 'EXCLUIDA', PENDIENTE: 'PENDIENTE' }[accion];
  if (!estado) return { error: 'Acción desconocida.' };
  const previo = item.revision;
  const tecnicoCorregido = correccion ? (correccion.tecnico && correccion.tecnico !== item.tecnicoOriginal ? correccion.tecnico : '') : previo?.tecnicoCorregido || '';
  const conceptoCorregido = correccion ? (correccion.concepto && correccion.concepto !== item.conceptoOriginal ? correccion.concepto : '') : previo?.conceptoCorregido || '';
  if (correccion?.concepto && !CONCEPTOS_PAGO.some((c) => c.id === correccion.concepto)) return { error: 'Ese concepto no existe.' };
  const tecnicoEfectivo = tecnicoCorregido || item.tecnicoOriginal;
  // La decisión de la garantía: lo nuevo, o lo que ya estaba guardado.
  let descuento = garantia ? 0 : Number(previo?.descuento) || 0;
  let descuentoDe = garantia ? null : (descuento > 0 ? previo?.descuentoDe || null : null);
  let sinDescuento = garantia ? '' : previo?.garantiaSinDescuento || '';
  if (garantia?.sinDescuento !== undefined) {
    const m = parseMotivoRevision(garantia.sinDescuento);
    if (m.error) return { error: 'Escribe por qué no se descuenta nada.' };
    sinDescuento = m.valor;
  } else if (garantia) {
    const monto = Math.round(Number(garantia.descuento) * 100) / 100;
    if (!(monto > 0)) return { error: 'Escribe el monto a descontar.' };
    if (!garantia.origen?.id) return { error: 'Elige la orden original de la que se descuenta.' };
    if (garantia.origen.id === item.clave) return { error: 'La orden original no puede ser la misma garantía.' };
    if (!garantia.origen.tecnico || garantia.origen.tecnico === SIN_TECNICO) return { error: 'La orden original no tiene técnico: no hay a quién descontarle.' };
    if (String(garantia.origen.tecnico).trim().toUpperCase() === String(tecnicoEfectivo || '').trim().toUpperCase()) return { error: 'La orden original es del mismo técnico que hizo la garantía.' };
    if (garantia.tope > 0 && monto > garantia.tope) return { error: `El descuento no puede pasar de lo que cobra la orden original (${garantia.tope} $).` };
    descuento = monto;
    descuentoDe = { id: String(garantia.origen.id).slice(0, 200), codigo: String(garantia.origen.codigo || '').slice(0, 40), tecnico: String(garantia.origen.tecnico).slice(0, 100) };
  }
  const efectivo = { ...item, tecnico: tecnicoEfectivo, concepto: conceptoCorregido || item.conceptoOriginal, descuento, descuentoDe, garantiaResuelta: descuento > 0 || Boolean(sinDescuento) };
  let texto = '';
  if (estado === 'RETENIDA' || estado === 'EXCLUIDA') {
    const m = parseMotivoRevision(motivo);
    if (m.error) return { error: m.error };
    texto = m.valor;
  }
  if (estado === 'APROBADA') {
    const problema = motivoNoAprobable(efectivo);
    if (problema) return { error: problema };
  }
  const ajustes = estado === 'APROBADA' ? ajustesDeOrden(efectivo, { por, ahora, sinTecnico: SIN_TECNICO }) : [];
  const anterior = item.revisionAnterior || previo;
  const viejos = ajustesVigentes(anterior) ? idsAjustesDeOrden(item.clave, anterior.firma) : [];
  const anotacion = { estado, por, en: ahora, ...(texto && { motivo: texto }), ...(correccion && { correccion: [tecnicoCorregido && `técnico ${tecnicoCorregido}`, conceptoCorregido && `concepto ${conceptoCorregido}`].filter(Boolean).join(', ') || 'sin cambios' }), ...(garantia && { garantia: descuento > 0 ? `descuento ${descuento} $ de ${descuentoDe.codigo} (${descuentoDe.tecnico})` : `sin descuento: ${sinDescuento}` }) };
  return {
    id: item.clave,
    datos: {
      estado,
      motivo: texto,
      firma: item.firma,
      dia: item.dia,
      codigo: String(item.orden.codigo || '').slice(0, 40),
      tecnico: String(item.tecnicoOriginal || '').slice(0, 100),
      concepto: item.conceptoOriginal || '',
      tecnicoCorregido,
      conceptoCorregido,
      descuento,
      ...(descuento > 0 && { descuentoDe }),
      ...(sinDescuento && { garantiaSinDescuento: sinDescuento }),
      por,
      en: ahora,
      historial: [...(previo?.historial || []), anotacion].slice(-MAX_HISTORIAL_REVISION),
    },
    ajustes,
    // Los de una aprobación anterior (aunque la orden haya cambiado después) ya no valen.
    borrarAjustes: viejos.filter((id) => !ajustes.some((a) => a.id === id)),
  };
}

// Aprobar de golpe las pendientes que se pueden aprobar: { documentos: [{ id, datos }], omitidas } (omitidas: las que no se pueden aprobar todavía y por qué).
export function aprobarPendientes(revisados, { por, ahora }) {
  const documentos = [];
  const omitidas = [];
  for (const item of revisados) {
    if (item.estadoRevision !== 'PENDIENTE') continue;
    const r = armarRevision(item, 'APROBAR', { por, ahora });
    if (r.error) omitidas.push({ item, motivo: r.error }); else documentos.push(r);
  }
  return { documentos, omitidas };
}

// Lo que hay que borrar al deshacer la revisión de una orden: el documento de revisión y, si estaba aprobada con descuento, sus ajustes.
export const borrarAlDeshacer = (item) => ({
  id: item.clave,
  borrarAjustes: ajustesVigentes(item.revisionAnterior || item.revision) ? idsAjustesDeOrden(item.clave, (item.revisionAnterior || item.revision).firma) : [],
});

// Las garantías de otro técnico que todavía esperan la decisión del administrador (descontar de la original o no descontar). Las retenidas o excluidas no cuentan.
export const garantiasPorResolver = (revisados) => revisados.filter((i) => i.garantiaDe?.id && !i.garantiaResuelta && (i.estadoRevision === 'PENDIENTE' || i.estadoRevision === 'APROBADA'));
