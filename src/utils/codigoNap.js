// Código de NAP tal como lo nombra Tomodat: letra, 2 dígitos, letra, 2 dígitos
// (ej. N10D14), con sufijo opcional para cajas gemelas ("O07D05-2"). También
// acepta las cajas sin numeración oficial, nombradas por zona + "SN" + número
// ("DM-SN-01", "DM - SN01", "12M SN01", "G-SN03", "NAP SN 04").
// Módulo sin dependencias: lo usa también scripts/scan-tomodat.mjs.
const SEP = '(?:\\s*-\\s*|\\s+)?';
export const CODIGO_NAP = `(?:[A-Z]\\d{2}[A-Z]\\d{2}(?:-\\d)?|[A-Z0-9]{1,4}${SEP}SN${SEP}\\d{1,3}(?:-\\d)?)`;

// La NAP de una orden SIN el puerto, para contar la misma caja una sola vez: en la orden la NAP y el puerto viven en un solo texto ("NAP O02D10 - Puerto 3"),
// y sin esto cada puerto se contaría como una NAP distinta. Con código de Tomodat da el código ("O02D10"); si no, el texto en mayúsculas sin el
// "NAP" de adelante ni el puerto ("EDIF MIRANDA"). null si no hay NAP.
export function napSinPuerto(texto) {
  const limpio = String(texto || '').trim();
  if (!limpio) return null;
  const codigo = extraerCodigoNap(limpio);
  if (codigo) return codigo;
  const nombre = limpio.toUpperCase().replace(/\s*[-–,]?\s*PUERTO\b.*$/, '').replace(/^NAP\s+/, '').trim();
  return nombre || limpio.toUpperCase();
}

// Código de NAP dentro de un texto libre ("NAP O10H37", "n10d14 - puerto 2"), o null.
export function extraerCodigoNap(texto) {
  const m = String(texto || '').match(new RegExp(`(?<![A-Z0-9])${CODIGO_NAP}(?![A-Z0-9])`, 'i'));
  return m ? m[0].toUpperCase() : null;
}
