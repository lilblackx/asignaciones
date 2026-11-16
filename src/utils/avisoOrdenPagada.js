// Aviso para Finanzas cuando una orden que pudo haberse pagado al técnico se cancela o cambia de tipo. Exonerar una orden NO avisa: el cobro al cliente no cambia lo que se le paga al técnico.
// Lo escribe la oficina al guardar el cambio (colección avisosOrdenPagada, un documento por cambio) y Finanzas lo ve solo si la orden de verdad ya estaba pagada cuando cambió (ver avisosVigentes).
//   { ticketId, clave, codigo, tecnico, tipo: 'CANCELADA' | 'TIPO', antes, despues, por, en, resuelto, resueltoPor?, resueltoEn? }
import { claveOrden } from './finanzas.js';

export const TIPO_AVISO = { CANCELADA: 'CANCELADA', TIPO: 'TIPO' };
const MAX_TEXTO = 120;
const texto = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO);

// "AVERÍA", "AVERÍA - Visita técnica": el tipo de la orden como lo ve la oficina (tipo de trabajo y, si lo tiene, tipo de visita).
export const tipoDeOrden = (orden) => [orden?.tipoTrabajo, orden?.tipoVisita].map(texto).filter(Boolean).join(' - ');

// Una orden que alguna vez se finalizó (`finalizadoEn` se conserva aunque la devuelvan) pudo haberse pagado. Una que nunca se finalizó no.
export const pudoHaberSePagado = (orden) => orden?.estado === 'FINALIZADO' || Number(orden?.finalizadoEn) > 0;

// Qué pasó con la orden al guardar: { tipo, antes, despues } o null si no hay nada que avisar (no se cancela ni cambia de tipo, o nunca estuvo finalizada).
export function cambioQueAvisa(original, nueva) {
  if (!original || !nueva || !pudoHaberSePagado(original)) return null;
  if (nueva.estado === 'CANCELADO' && original.estado !== 'CANCELADO') return { tipo: TIPO_AVISO.CANCELADA, antes: original.estado, despues: 'CANCELADO' };
  const antes = tipoDeOrden(original);
  const despues = tipoDeOrden(nueva);
  if (antes !== despues) return { tipo: TIPO_AVISO.TIPO, antes, despues };
  return null;
}

// El documento del aviso, listo para guardar (o null si no hay nada que avisar).
export function armarAviso(original, nueva, { por, ahora }) {
  const cambio = cambioQueAvisa(original, nueva);
  if (!cambio) return null;
  return {
    ticketId: String(original.id),
    clave: claveOrden(original),
    codigo: texto(original.codigo),
    tecnico: texto(original.tecnico),
    tipo: cambio.tipo,
    antes: texto(cambio.antes),
    despues: texto(cambio.despues),
    por: texto(por) || 'oficina',
    en: ahora,
    resuelto: false,
  };
}

// La hora (ms) a la que se hizo un pago: el id del pago empieza con ella (ver idDePago en finanzas.js).
export const horaDelPago = (pagoId) => Number(String(pagoId || '').split('-')[0]) || 0;

// Los avisos que Finanzas debe ver: los sin resolver de órdenes que YA estaban pagadas cuando cambiaron. `pagoDe`: clave de la orden -> pagoId vigente ('' o sin dato si no está pagada).
// Si la orden se pagó después del cambio, ya se pagó con su tipo nuevo y no hay nada que avisar.
export function avisosVigentes(avisos, pagoDe) {
  return (avisos || [])
    .filter((a) => a && !a.resuelto)
    .map((a) => ({ ...a, pagoId: pagoDe[a.clave] || '' }))
    .filter((a) => a.pagoId && horaDelPago(a.pagoId) > 0 && horaDelPago(a.pagoId) < Number(a.en))
    .sort((a, b) => Number(b.en) - Number(a.en));
}

export const textoDelAviso = (a) => (a.tipo === TIPO_AVISO.CANCELADA
  ? `${a.codigo || 'Una orden'} (${a.tecnico || 'sin técnico'}) se canceló después de pagarse.`
  : `${a.codigo || 'Una orden'} (${a.tecnico || 'sin técnico'}) cambió de tipo después de pagarse: «${a.antes || '-'}» → «${a.despues || '-'}».`);
