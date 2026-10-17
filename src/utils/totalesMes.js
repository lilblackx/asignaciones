// Totales del mes que ventas lleva de instalaciones y averías LOS: cuántas están en proceso, cuántas se finalizaron y cuántas se
// cancelaron. Lo ya cerrado sale del documento del mes (estadisticasMensuales, lo suma el cierre del día en el Worker); lo de hoy
// que todavía no se cerró, de las órdenes en vivo que la pantalla ya tiene. Así no hace falta leer todo el historial.
import { esAveriaLos, esInstalacionDeLista } from './estadoInstalacion.js';

const ZONA_HORARIA = 'America/Caracas';

// "2026-10" de una fecha, en hora de Caracas (como cuenta el cierre en el Worker).
export function mesDe(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}`;
}

// "octubre 2026"
export function etiquetaMes(mes) {
  const [anio, numero] = mes.split('-').map(Number);
  const nombre = new Intl.DateTimeFormat('es-VE', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(anio, numero - 1, 15)));
  return `${nombre} ${anio}`;
}

// Los últimos `cuantos` meses, el actual primero.
export function mesesRecientes(ahora = Date.now(), cuantos = 6) {
  const [anio, numero] = mesDe(ahora).split('-').map(Number);
  return Array.from({ length: cuantos }, (_, i) => {
    const d = new Date(Date.UTC(anio, numero - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

const CERO = { enProceso: 0, finalizadas: 0, canceladas: 0 };

// { instalaciones: { enProceso, finalizadas, canceladas }, los: { ... } } del mes pedido.
//   contador: el documento del mes ({} o null si todavía no se cerró nada).
//   vivas: las órdenes que están ahora en la lista (se ignora lo que no es de ventas).
// `enProceso` es de este momento: solo se muestra en el mes actual (de un mes pasado no tiene sentido y queda en null).
export function totalesDelMes(contador, vivas, mes, ahora = Date.now()) {
  const esActual = mes === mesDe(ahora);
  const c = contador || {};
  const grupo = (finalizadas, canceladas) => ({ ...CERO, finalizadas: Number(c[finalizadas]) || 0, canceladas: Number(c[canceladas]) || 0, enProceso: esActual ? 0 : null });
  const resultado = { instalaciones: grupo('instalacionesFinalizadas', 'instalacionesCanceladas'), los: grupo('losResueltas', 'losCanceladas') };
  for (const t of vivas) {
    const destino = esAveriaLos(t) ? resultado.los : esInstalacionDeLista(t) ? resultado.instalaciones : null;
    if (!destino) continue;
    if (t.estado === 'PENDIENTE' || t.estado === 'PRE-FINALIZADO') {
      if (esActual) destino.enProceso++;
    } else if (t.estado === 'FINALIZADO' || t.estado === 'CANCELADO') {
      // Lo que se finalizó o canceló y el cierre del día aún no archivó: cuenta en el mes en que se cerró.
      if (mesDe(t.finalizadoEn || t.createdAt || ahora) === mes) destino[t.estado === 'FINALIZADO' ? 'finalizadas' : 'canceladas']++;
    }
  }
  return resultado;
}

// --- El cierre manual (desde la app) suma lo mismo que el automático (cf-worker/src/index.js, incrementosMensuales) ---
const VENTANA_FINALIZACION_MS = 40 * 24 * 60 * 60 * 1000;

// { '2026-10': { instalacionesFinalizadas: 3, losResueltas: 1 }, ... } de las órdenes que se archivan con este estado. Cada una cuenta en
// el mes en que se finalizó; sin una fecha de finalización creíble (las canceladas no la tienen), en el mes del cierre.
export function incrementosMensuales(ordenes, estado, ahoraMs = Date.now()) {
  const porMes = {};
  for (const t of ordenes) {
    const esLos = esAveriaLos(t);
    if (!esLos && !esInstalacionDeLista(t)) continue;
    const campo = estado === 'FINALIZADO' ? (esLos ? 'losResueltas' : 'instalacionesFinalizadas') : (esLos ? 'losCanceladas' : 'instalacionesCanceladas');
    const fin = Number(t.finalizadoEn);
    const mes = mesDe(fin > ahoraMs - VENTANA_FINALIZACION_MS && fin <= ahoraMs ? fin : ahoraMs);
    porMes[mes] = { ...porMes[mes], [campo]: (porMes[mes]?.[campo] || 0) + 1 };
  }
  return porMes;
}
