// Un texto que viene guardado en mayúsculas (estado, tipo de trabajo...) para mostrarlo con mayúscula inicial: "AVERÍA" -> "Avería",
// "PRE-FINALIZADO" -> "Pre-finalizado". Las siglas se quedan como siglas ("VALIDACION NAP" -> "Validacion NAP").
// Solo cambia la presentación: los datos y las comparaciones siguen usando el valor guardado.
const SIGLAS = new Set(['NAP', 'LOS', 'OLT', 'ONU', 'ONT', 'VLAN', 'BCV', 'RIF', 'TA', 'VN', 'NR', 'SN', 'GPON', 'PON', 'WIFI', 'USB', 'CPE']);

export const oracion = (texto) => {
  const t = String(texto ?? '');
  if (!t) return '';
  const minuscula = t.toLowerCase();
  const conSiglas = minuscula.replace(/[\p{L}\d]+/gu, (palabra) => (SIGLAS.has(palabra.toUpperCase()) ? palabra.toUpperCase() : palabra));
  return conSiglas.charAt(0).toUpperCase() + conSiglas.slice(1);
};
