// La OLT de la que depende el cliente de una orden (campo `olt`, el nombre tal como lo da SmartOLT: "JMTV CONEXIONES").
// Finanzas y la Revisión de órdenes marcan con "JM" las del cliente que depende de la OLT de JMTV; es solo informativo.
export const OLT_JM = 'JMTV CONEXIONES';

const normalizar = (texto) => String(texto ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

export const esOltJM = (olt) => normalizar(olt) === OLT_JM;

// Las OLT que traen las ONU de una cédula (lista que devuelve el Worker). Si todas están en la misma, esa; si no hay ninguna con OLT o
// están en OLT distintas, '' (no se adivina: el cliente puede tener otra ONU de antes en otra OLT).
export function oltUnica(onus) {
  const nombres = [...new Set((Array.isArray(onus) ? onus : []).map((o) => String(o?.olt ?? '').trim()).filter(Boolean))];
  return nombres.length === 1 ? nombres[0] : '';
}

// Qué se puede decir de la OLT de una cédula a partir de sus ONU en SmartOLT (para el script que llena las órdenes ya existentes):
//   { estado: 'ok', olt }            una OLT, o varias ONU en la misma
//   { estado: 'varias', nombres }    ONU en OLT distintas: no se adivina
//   { estado: 'sin_olt' }            hay ONU pero SmartOLT no dice su OLT
//   { estado: 'no_encontrada' }      SmartOLT no tiene ninguna ONU con esa cédula
export function clasificarOlt(onus) {
  const lista = Array.isArray(onus) ? onus : [];
  if (lista.length === 0) return { estado: 'no_encontrada' };
  const nombres = [...new Set(lista.map((o) => String(o?.olt ?? '').trim()).filter(Boolean))];
  if (nombres.length === 0) return { estado: 'sin_olt' };
  return nombres.length === 1 ? { estado: 'ok', olt: nombres[0] } : { estado: 'varias', nombres };
}
