// Potencia óptica que reporta SmartOLT ("-19.45", a veces con unidad: "-19.45 dBm").
// Devuelve el texto numérico para el campo de potencia, o null si no es un número.
export function valorSenal(texto) {
  const m = String(texto ?? '').match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : null;
}

// Con la ONU fuera de línea (Offline, Power fail, LOS...) SmartOLT devuelve la última señal
// guardada, no la actual: no sirve como medición. Sin dato de estado se asume en línea.
export const onuEnLinea = (estado) => !String(estado ?? '').trim() || /^online$/i.test(String(estado).trim());

// Clasificación de SmartOLT ("Very good", "Warning", "Critical") en español.
const CALIDAD = {
  'very good': 'Muy buena',
  warning: 'Advertencia',
  critical: 'Crítica',
};
export const calidadSenal = (texto) => CALIDAD[String(texto || '').trim().toLowerCase()] || String(texto || '').trim();

// ¿Puede la consulta a SmartOLT escribir su valor en el campo de potencia? Solo si está vacío o
// si lo que tiene lo puso la propia consulta anterior (`ultimaCaptura`) y nadie lo tocó: así se
// puede volver a consultar, pero nunca se pisa lo que alguien escribió.
export const puedeCapturarPotencia = (actual, ultimaCaptura) => {
  const texto = String(actual ?? '').trim();
  return texto === '' || (Boolean(ultimaCaptura) && texto === ultimaCaptura);
};
