// Registro de VN y TA (validación de NAP y trabajos adicionales de infraestructura): la pestaña VN/TA de la hoja de cálculo del departamento. A
// diferencia de las otras hojas del Registro de estadísticas, ESTA SE LLENA A MANO: cada fila la escribe una persona de la oficina (el trabajo,
// el técnico, la fecha y la observación) y queda su nombre como operador. Se guarda en la colección registroVnTa, un documento por fila:
//   { codigo, trabajo: 'VN' | 'TA', tecnico, fecha: 'AAAA-MM-DD', observacion, operador, creadoPor, creadoEn, actualizadoEn }
// El código (ODT) lo pone la app: VAN01, VAN02... para las validaciones de NAP y TA01, TA02... para los trabajos adicionales, con la cuenta
// reiniciada cada mes (como la hoja de cada mes). Ver useRegistroVnTa para cómo se numera sin repetir códigos.

export const TRABAJOS_VNTA = {
  VN: { nombre: 'VALIDACION DE NAP', prefijo: 'VAN' },
  TA: { nombre: 'TRABAJO ADICIONAL', prefijo: 'TA' },
};
export const MAX_LARGO_OBSERVACION = 500;
export const MAX_LARGO_TECNICO = 100;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const dosDigitos = (n) => String(n).padStart(2, '0');

export const esFechaValida = (texto) => {
  if (!FECHA.test(texto || '')) return false;
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
};

// "2026-10" de "2026-10-11".
export const mesDeFecha = (fecha) => String(fecha || '').slice(0, 7);

// "VAN01" / "TA07" (a partir de 100, "VAN100").
export const codigoDe = (trabajo, numero) => `${TRABAJOS_VNTA[trabajo].prefijo}${dosDigitos(numero)}`;

// El contador que numera ese tipo de trabajo en ese mes (documento de la colección counters): "VNTA_VAN_2026-10".
export const idContador = (trabajo, fecha) => `VNTA_${TRABAJOS_VNTA[trabajo].prefijo}_${mesDeFecha(fecha)}`;

// Lo que escribe la persona -> { valor } listo para guardar, o { error, campo }. El técnico y la observación son opcionales (en la hoja muchas
// filas de validación de NAP van sin técnico ni observación).
export function parseRegistro({ trabajo, tecnico, fecha, observacion } = {}) {
  if (!TRABAJOS_VNTA[trabajo]) return { error: 'Elige si es una validación de NAP o un trabajo adicional.', campo: 'trabajo' };
  if (!esFechaValida(fecha)) return { error: 'Escribe la fecha del trabajo.', campo: 'fecha' };
  const tecnicoLimpio = String(tecnico ?? '').replace(/\s+/g, ' ').trim();
  if (tecnicoLimpio.length > MAX_LARGO_TECNICO) return { error: 'El nombre del técnico es demasiado largo.', campo: 'tecnico' };
  const observacionLimpia = String(observacion ?? '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  if (observacionLimpia.length > MAX_LARGO_OBSERVACION) return { error: `La observación es demasiado larga (máximo ${MAX_LARGO_OBSERVACION} caracteres).`, campo: 'observacion' };
  return { valor: { trabajo, tecnico: tecnicoLimpio, fecha, observacion: observacionLimpia } };
}

// El número del código ("VAN07" -> 7) para ordenar; 0 si no se entiende.
const numeroDe = (codigo) => Number(String(codigo || '').replace(/^\D+/, '')) || 0;

// Las filas de la hoja, en el orden en que se llevan: validaciones de NAP primero y trabajos adicionales después, cada grupo por su número.
export function ordenarRegistros(registros) {
  const grupo = (r) => (r.trabajo === 'VN' ? 0 : 1);
  return [...registros].sort((a, b) => grupo(a) - grupo(b) || a.fecha.localeCompare(b.fecha) || numeroDe(a.codigo) - numeroDe(b.codigo));
}

// { vn, ta, total } de las filas.
export function estadisticaRegistros(registros) {
  const vn = registros.filter((r) => r.trabajo === 'VN').length;
  const ta = registros.filter((r) => r.trabajo === 'TA').length;
  return { vn, ta, total: vn + ta };
}

// "11/10/2026" de "2026-10-11".
export const fechaLegible = (fecha) => (esFechaValida(fecha) ? fecha.split('-').reverse().join('/') : '');

// --- Textos (los usan la pantalla, el PDF, el Word y el CSV) ---
export const columnasVnTa = () => [{ titulo: 'ODT', sinSalto: true }, { titulo: 'Trabajo realizado', sinSalto: true }, { titulo: 'Técnico', sinSalto: true }, { titulo: 'Fecha', sinSalto: true }, { titulo: 'Observación' }, { titulo: 'Operador', sinSalto: true }];
export const filaVnTa = (r) => [r.codigo || '', TRABAJOS_VNTA[r.trabajo]?.nombre || '', r.tecnico || '', fechaLegible(r.fecha), r.observacion || '', r.operador || ''];

export const columnasEstadisticaVnTa = () => [{ titulo: 'Tipo' }, { titulo: 'Concepto' }, { titulo: 'Cantidad', derecha: true }];
export const filasEstadisticaVnTa = (e) => [
  ['VN', 'Validación de NAP', String(e.vn)],
  ['TA', 'Trabajos adicionales (infra)', String(e.ta)],
  ['', 'TOTAL VN + TA', String(e.total)],
];

export const cifrasVnTa = (e) => [
  { etiqueta: 'Validación de NAP (VN)', valor: e.vn, detalle: 'en el periodo' },
  { etiqueta: 'Trabajos adicionales (TA)', valor: e.ta, detalle: 'a infraestructura' },
  { etiqueta: 'Total VN + TA', valor: e.total, detalle: 'en el periodo' },
];

export const NOTA_VNTA = 'Esta hoja se llena a mano: cada fila la registra una persona de la oficina y queda su nombre como operador. El código lo pone la app (VAN01... para validaciones de NAP y TA01... para trabajos adicionales, desde 01 cada mes). Las demás hojas se arman solas con las órdenes.';
