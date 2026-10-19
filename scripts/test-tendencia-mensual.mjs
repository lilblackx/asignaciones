// Prueba la tendencia mensual (src/utils/tendenciaMensual.js): qué meses se muestran, las cifras de cada mes (lo cerrado más lo de hoy que
// no se cierra), la variación contra el mes anterior y el CSV. No necesita el emulador. Uso: `npm run test:tendencia`.
import { csvTendencia, etiquetaMesCorta, mesesDeLaTendencia, tendenciaMensual, textoVariacion, variacion } from '../src/utils/tendenciaMensual.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const AHORA = Date.parse('2026-12-10T12:00:00-04:00');
const contadores = {
  '2026-10': { instalacionesFinalizadas: 10, instalacionesCanceladas: 2, losResueltas: 4, losCanceladas: 1 },
  '2026-11': { instalacionesFinalizadas: 14, instalacionesCanceladas: 1, losResueltas: 6 },
  '2026-12': { instalacionesFinalizadas: 3 },
};

check('etiqueta corta del mes', etiquetaMesCorta('2026-10'), 'oct 26');
check('los meses van del más viejo al más nuevo, desde el primero con datos', mesesDeLaTendencia(contadores, AHORA, 6), ['2026-10', '2026-11', '2026-12']);
check('si hay menos meses de los pedidos, se recorta a la ventana', mesesDeLaTendencia(contadores, AHORA, 2), ['2026-11', '2026-12']);
check('sin ningún dato muestra solo el mes actual', mesesDeLaTendencia({}, AHORA, 6), ['2026-12']);
check('un mes sin documento entre dos con datos se muestra en cero', mesesDeLaTendencia({ '2026-09': { losResueltas: 1 }, '2026-12': { losResueltas: 2 } }, AHORA, 6), ['2026-09', '2026-10', '2026-11', '2026-12']);

const vivas = [
  { id: 'a', tipoTrabajo: 'INSTALACIÓN', estado: 'FINALIZADO', finalizadoEn: Date.parse('2026-12-10T09:00:00-04:00') },
  { id: 'b', tipoTrabajo: 'AVERÍA', falla: 'LOS', estado: 'CANCELADO', finalizadoEn: Date.parse('2026-12-10T09:30:00-04:00') },
  { id: 'c', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', createdAt: AHORA },
];
const filas = tendenciaMensual(contadores, vivas, ['2026-10', '2026-11', '2026-12'], AHORA);
check('octubre: lo cerrado, separado por tipo', [filas[0].instalaciones, filas[0].los, filas[0].finalizadas, filas[0].canceladas], [{ finalizadas: 10, canceladas: 2 }, { finalizadas: 4, canceladas: 1 }, 14, 3]);
check('solo el mes actual figura en curso', filas.map((f) => f.enCurso), [false, false, true]);
check('porcentaje de cancelación del mes', [filas[0].pctCancelacion, filas[1].pctCancelacion], [18, 5]);
check('el mes actual suma lo de hoy que aún no se cierra', [filas[2].instalaciones.finalizadas, filas[2].los.canceladas, filas[2].finalizadas, filas[2].canceladas], [4, 1, 4, 1]);
check('un mes sin nada cerrado ni vivo da ceros y sin porcentaje', tendenciaMensual({}, [], ['2026-11'], AHORA)[0].pctCancelacion, null);

check('variación contra el mes anterior', [variacion(14, 10), variacion(5, 10), variacion(3, 0)], [{ diferencia: 4, pct: 40 }, { diferencia: -5, pct: -50 }, { diferencia: 3, pct: null }]);
check('texto de la variación', [textoVariacion(14, 10, 'oct 26'), textoVariacion(5, 10, 'oct 26'), textoVariacion(10, 10, 'oct 26'), textoVariacion(3, 0, 'oct 26')], ['+4 (+40%) vs oct 26', '-5 (-50%) vs oct 26', 'igual que oct 26', '+3 vs oct 26']);

const csv = csvTendencia(filas);
check('el CSV lleva una fila por mes con BOM', [csv.charCodeAt(0), csv.split('\r\n').filter((l) => l.startsWith('oct 26') || l.startsWith('nov 26') || l.startsWith('dic 26')).length], [0xFEFF, 3]);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas de la tendencia mensual pasaron.');
