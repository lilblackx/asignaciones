// Consulta del cobro de un recableado: el técnico indica cuántos metros de drop va a usar y le pregunta a la oficina cuánto
// se cobra (no hay tarifa por metro: la oficina lo decide caso por caso).
//
// En la orden se guardan dos campos aparte, para que el técnico pueda preguntar pero no responder:
//   consultaCobro: { metros, pedidaEn, pedidaPor }                              lo escribe el técnico
//   respuestaCobro: { metros, exonerado, valor, monto, moneda, por, en }        lo escribe la oficina
// Cada consulta nueva (otros metros, o un recordatorio) deja sin vigencia la respuesta anterior: la oficina responde de nuevo.

import { COBRO_EXONERADO, COBRO_OTRO, MONEDA_BS, MONEDA_USD, formatoMontoBs, parseMontoBs, textoMonto } from './cobro.js';

export const consultaCobroDe = (t) => (t?.consultaCobro && Number.isInteger(t.consultaCobro.metros) ? t.consultaCobro : null);

// Consulta enviada y todavía sin respuesta (o con una respuesta anterior a la última consulta).
export function consultaPendiente(t) {
  const consulta = consultaCobroDe(t);
  if (!consulta) return false;
  return !t.respuestaCobro || (t.respuestaCobro.en || 0) < consulta.pedidaEn;
}

// La respuesta de la oficina a la última consulta (null si no hay o si quedó atrás).
export function respuestaVigente(t) {
  const consulta = consultaCobroDe(t);
  const respuesta = t?.respuestaCobro;
  if (!consulta || !respuesta || (respuesta.en || 0) < consulta.pedidaEn) return null;
  return respuesta;
}

export const construirConsulta = (metros, usuario, ahora = Date.now()) => ({ metros, pedidaEn: ahora, pedidaPor: usuario || '' });

// "5.000 Bs", "30 $" o "Exonerado".
export const textoRespuesta = (r) => (r?.exonerado ? 'Exonerado, sin cobro' : textoMonto(r?.monto, r?.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS));

// Lo que escribe la oficina -> { respuesta } listo para guardar, o { error }.
//   seleccion: { exonerado: boolean, otro: texto del monto, moneda: 'BS' | 'USD' }
export function construirRespuesta(consulta, seleccion, usuario, ahora = Date.now()) {
  if (!consulta) return { error: 'La consulta ya no está disponible.' };
  const base = { metros: consulta.metros, por: usuario || '', en: ahora };
  if (seleccion?.exonerado) return { respuesta: { ...base, exonerado: true, valor: null, monto: null, moneda: MONEDA_BS } };
  const monto = parseMontoBs(seleccion?.otro);
  if (monto.error) return { error: monto.error };
  return {
    respuesta: { ...base, exonerado: false, valor: monto.valor, monto: formatoMontoBs(monto.valor), moneda: seleccion?.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS },
  };
}

// Cobro con el que se abre el modal de aprobar o finalizar: lo que respondió la oficina, listo para confirmar.
// null si no hay respuesta vigente o si el técnico terminó usando otros metros que los consultados.
export function cobroPrecargado(t) {
  const respuesta = respuestaVigente(t);
  if (!respuesta || (Number.isInteger(t.metrosCable) && t.metrosCable !== respuesta.metros)) return null;
  if (respuesta.exonerado) return { modo: COBRO_EXONERADO, otro: '', moneda: MONEDA_BS };
  return { modo: COBRO_OTRO, otro: String(respuesta.valor).replace('.', ','), moneda: respuesta.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS };
}
