// LA fecha de una orden, la misma en todos los módulos (totales del mes de ventas, historial de órdenes, lista de ventas, reportes): el momento en que
// se finalizó (`finalizadoEn`) o, si se canceló, el momento en que se canceló (`canceladaEn`). Una orden abierta cuenta el día que se creó.
// Así una orden pertenece a un solo día y a un solo mes, y los números de un módulo se pueden comparar con los de otro.
//
// Una orden vieja puede no traer esa fecha (se finalizó antes de que se guardara). Entonces cuenta en el día de cierre que la archivó (`diaCierreMs`:
// un instante de ese día; no es la hora en que se hizo el cierre, que puede ser al día siguiente) y, si tampoco hay, en cuando se archivó o se creó.
// Una fecha que no es creíble (futura, o de más de 40 días antes de archivarse) se trata como si no estuviera.
// El Worker repite esta regla para sus totales (mesDeCierre en cf-worker/src/index.js); mantener las dos iguales: lo comprueba `npm run test:resumen`.
const VENTANA_MS = 40 * 24 * 60 * 60 * 1000;

//   estado: el de la orden (por defecto el suyo); sirve para contar como finalizada u cancelada lo que un cierre archiva con ese estado.
//   ahoraMs: hasta cuándo es creíble la fecha: cuando se archivó (por defecto `archivadoEn`, o ahora si sigue abierta).
export function fechaDeOrden(t, { estado = t?.estado, diaCierreMs = 0, ahoraMs = Number(t?.archivadoEn) || Date.now() } = {}) {
  if (estado === 'FINALIZADO' || estado === 'CANCELADO') {
    const ms = Number(estado === 'CANCELADO' ? t?.canceladaEn : t?.finalizadoEn);
    if (ms > ahoraMs - VENTANA_MS && ms <= ahoraMs) return ms;
    return diaCierreMs || Number(t?.archivadoEn) || Number(t?.createdAt) || Number(t?.creadaEn) || 0;
  }
  return Number(t?.createdAt) || Number(t?.creadaEn) || 0;
}
