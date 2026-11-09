// El periodo que se elige arriba en Reportes y vale para todos los reportes. Los días son "YYYY-MM-DD" en hora de Caracas.
import { diaDe } from './totalesMes.js';

const DIA_MS = 24 * 60 * 60 * 1000;

export const PERIODOS = [
  ['HOY', 'Hoy'],
  ['7_DIAS', '7 días'],
  ['MES', 'Este mes'],
  ['RANGO', 'Rango'],
];

// { desde, hasta } (días, ambos incluidos) del periodo elegido. `personalizado` es el rango escrito a mano ({ desde, hasta }).
export function rangoDe(periodo, personalizado, ahora = Date.now()) {
  const hoy = diaDe(ahora);
  if (periodo === 'HOY') return { desde: hoy, hasta: hoy };
  if (periodo === '7_DIAS') return { desde: diaDe(ahora - 6 * DIA_MS), hasta: hoy };
  if (periodo === 'MES') return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  const { desde, hasta } = personalizado || {};
  if (desde && hasta && desde <= hasta) return { desde, hasta };
  return { desde: desde || hasta || hoy, hasta: hasta || desde || hoy };
}

// "19/10/2026" de "2026-10-19".
export const diaLegible = (dia) => dia.split('-').reverse().join('/');

// "19/10 – 25/10/2026" (o un solo día).
export function etiquetaRango({ desde, hasta }) {
  if (desde === hasta) return diaLegible(desde);
  return `${diaLegible(desde).slice(0, 5)} – ${diaLegible(hasta)}`;
}

export const enRango = (dia, { desde, hasta }) => dia >= desde && dia <= hasta;

// La ventana más chica que cubre la que ya se leía (`ventana`, o null si todavía no hay ninguna) y el periodo pedido (`rango`), sin huecos. Con ella una pantalla puede leer una sola vez de Firestore
// y filtrar el periodo en pantalla: cada vez que lo que se lee cambia, Firestore cobra otra vez todos sus documentos.
export function ensancharRango(ventana, rango) {
  if (!ventana) return { desde: rango.desde, hasta: rango.hasta };
  return { desde: rango.desde < ventana.desde ? rango.desde : ventana.desde, hasta: rango.hasta > ventana.hasta ? rango.hasta : ventana.hasta };
}
