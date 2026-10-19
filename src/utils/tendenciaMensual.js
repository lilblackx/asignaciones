// Tendencia mensual: instalaciones y averías LOS finalizadas y canceladas, mes contra mes. Lo cerrado sale de los totales del mes
// (estadisticasMensuales, que suma el cierre del día) y lo de hoy que todavía no se cierra, de las órdenes vivas (ver totalesMes.js).
import { mesDe, mesesRecientes, totalesDelMes } from './totalesMes.js';
import { csvReporte } from './csvReporte.js';
import { porcentaje } from './gestionTecnicos.js';

// Cuántos meses se pueden mostrar en la tendencia.
export const VENTANAS_MESES = [3, 6, 12];

// "oct 26" de "2026-10".
export function etiquetaMesCorta(mes) {
  const [anio, numero] = mes.split('-').map(Number);
  const nombre = new Intl.DateTimeFormat('es-VE', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(anio, numero - 1, 15))).replace('.', '');
  return `${nombre} ${String(anio).slice(2)}`;
}

// Los meses del gráfico, del más viejo al más nuevo: los últimos `cuantos`, empezando en el primero que tiene datos (o el actual).
export function mesesDeLaTendencia(contadores, ahora = Date.now(), cuantos = 6) {
  const ventana = mesesRecientes(ahora, cuantos).reverse();
  const primero = ventana.findIndex((m) => contadores[m] || m === mesDe(ahora));
  return ventana.slice(Math.max(0, primero));
}

// Una fila por mes: { mes, etiqueta, instalaciones: { finalizadas, canceladas }, los: { finalizadas, canceladas }, finalizadas, canceladas, pctCancelacion }.
export function tendenciaMensual(contadores, vivas, meses, ahora = Date.now()) {
  return meses.map((mes) => {
    const t = totalesDelMes(contadores[mes] || null, vivas, mes, ahora);
    const finalizadas = t.instalaciones.finalizadas + t.los.finalizadas;
    const canceladas = t.instalaciones.canceladas + t.los.canceladas;
    return {
      mes,
      etiqueta: etiquetaMesCorta(mes),
      enCurso: mes === mesDe(ahora),
      instalaciones: { finalizadas: t.instalaciones.finalizadas, canceladas: t.instalaciones.canceladas },
      los: { finalizadas: t.los.finalizadas, canceladas: t.los.canceladas },
      finalizadas,
      canceladas,
      pctCancelacion: porcentaje(canceladas, finalizadas + canceladas),
    };
  });
}

// Cambio de un mes contra el anterior: { diferencia, pct } (pct null si el anterior fue cero).
export function variacion(actual, anterior) {
  return { diferencia: actual - anterior, pct: anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null };
}

// "+3 (+12%) vs sep 26", "igual que sep 26".
export function textoVariacion(actual, anterior, etiquetaAnterior) {
  const { diferencia, pct } = variacion(actual, anterior);
  if (diferencia === 0) return `igual que ${etiquetaAnterior}`;
  return `${diferencia > 0 ? '+' : ''}${diferencia}${pct === null ? '' : ` (${pct > 0 ? '+' : ''}${pct}%)`} vs ${etiquetaAnterior}`;
}

export function csvTendencia(filas) {
  return csvReporte(['Tendencia mensual', 'Instalaciones y averías LOS finalizadas y canceladas, por mes'], [{
    titulo: 'Por mes',
    cabecera: ['Mes', 'Instalaciones finalizadas', 'Instalaciones canceladas', 'LOS resueltas', 'LOS canceladas', 'Total finalizadas', 'Total canceladas', '% cancelación'],
    filas: filas.map((f) => [f.enCurso ? `${f.etiqueta} (en curso)` : f.etiqueta, f.instalaciones.finalizadas, f.instalaciones.canceladas, f.los.finalizadas, f.los.canceladas, f.finalizadas, f.canceladas, f.pctCancelacion === null ? '' : `${f.pctCancelacion}%`]),
  }]);
}
