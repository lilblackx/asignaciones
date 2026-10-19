// Prueba el registro de activación de técnicos (src/utils/logTecnico.js): el evento que se guarda, cuánto tiempo estuvo
// activo cada técnico por día (hora de Caracas) y las filas del reporte. No necesita el emulador.
// Uso: `npm run test:logtecnico`.
import { duracionActivaPorDia, eventoActivacion, filasDuracionDiaria, filasLogTecnico, formatoDuracion } from '../src/utils/logTecnico.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const HORA = 3600000;
const MIN = 60000;
// Caracas es UTC-4: 08:00 en Caracas = 12:00 UTC.
const caracas = (dia, hora, min = 0) => Date.parse(`${dia}T${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}:00-04:00`);
const ev = (tecnico, activo, en) => ({ tecnico, activo, en });

check('el evento guarda técnico, estado, hora, día de Caracas, quién y su rol',
  eventoActivacion({ tecnicoId: 'G', tecnico: 'GERARDO', activo: true, por: 'lfernandez', rol: 'ADMIN' }, caracas('2026-10-19', 23, 30)),
  { tecnicoId: 'G', tecnico: 'GERARDO', activo: true, en: caracas('2026-10-19', 23, 30), dia: '2026-10-19', por: 'lfernandez', rol: 'ADMIN' });
check('a las 21:00 de Caracas ya es otro día en UTC pero el evento queda en el día de Caracas',
  eventoActivacion({ tecnico: 'G', activo: false }, caracas('2026-10-19', 21)).dia, '2026-10-19');

check('un tramo activo dentro del día', duracionActivaPorDia([ev('G', true, caracas('2026-10-19', 8)), ev('G', false, caracas('2026-10-19', 12, 30))], caracas('2026-10-19', 20)),
  { G: { '2026-10-19': 4.5 * HORA } });
check('varios tramos del mismo día se suman', duracionActivaPorDia([
  ev('G', true, caracas('2026-10-19', 8)), ev('G', false, caracas('2026-10-19', 10)),
  ev('G', true, caracas('2026-10-19', 14)), ev('G', false, caracas('2026-10-19', 15, 15)),
], caracas('2026-10-19', 20)), { G: { '2026-10-19': 3.25 * HORA } });
check('si sigue activo suma hasta ahora', duracionActivaPorDia([ev('G', true, caracas('2026-10-19', 8))], caracas('2026-10-19', 9, 20)), { G: { '2026-10-19': 80 * MIN } });
check('un tramo que cruza la medianoche se reparte entre los dos días', duracionActivaPorDia([ev('G', true, caracas('2026-10-19', 22)), ev('G', false, caracas('2026-10-20', 1))], caracas('2026-10-20', 12)),
  { G: { '2026-10-19': 2 * HORA, '2026-10-20': 1 * HORA } });
check('activo varios días seguidos cuenta los días completos', duracionActivaPorDia([ev('G', true, caracas('2026-10-18', 18))], caracas('2026-10-20', 6)),
  { G: { '2026-10-18': 6 * HORA, '2026-10-19': 24 * HORA, '2026-10-20': 6 * HORA } });
check('activar dos veces seguidas no reinicia el reloj', duracionActivaPorDia([ev('G', true, caracas('2026-10-19', 8)), ev('G', true, caracas('2026-10-19', 9)), ev('G', false, caracas('2026-10-19', 10))], caracas('2026-10-19', 20)),
  { G: { '2026-10-19': 2 * HORA } });
check('desactivar sin una activación registrada no suma nada', duracionActivaPorDia([ev('G', false, caracas('2026-10-19', 8))], caracas('2026-10-19', 20)), { G: {} });
check('los eventos desordenados dan lo mismo', duracionActivaPorDia([ev('G', false, caracas('2026-10-19', 12)), ev('G', true, caracas('2026-10-19', 8))], caracas('2026-10-19', 20)),
  { G: { '2026-10-19': 4 * HORA } });
check('un evento posterior a "hasta" no cuenta', duracionActivaPorDia([ev('G', true, caracas('2026-10-19', 8)), ev('G', false, caracas('2026-10-19', 18))], caracas('2026-10-19', 10)),
  { G: { '2026-10-19': 2 * HORA } });
check('cada técnico va por separado', duracionActivaPorDia([
  ev('G', true, caracas('2026-10-19', 8)), ev('R', true, caracas('2026-10-19', 9)), ev('G', false, caracas('2026-10-19', 10)), ev('R', false, caracas('2026-10-19', 13)),
], caracas('2026-10-19', 20)), { G: { '2026-10-19': 2 * HORA }, R: { '2026-10-19': 4 * HORA } });
check('sin eventos no hay duraciones', [duracionActivaPorDia([]), duracionActivaPorDia(null)], [{}, {}]);

check('formato de duración', [formatoDuracion(0), formatoDuracion(35 * MIN), formatoDuracion(125 * MIN), formatoDuracion(2 * HORA)], ['0 min', '35 min', '2 h 05 min', '2 h 00 min']);

const log = [
  { id: 'b', ...eventoActivacion({ tecnico: 'GERARDO', activo: false, por: 'luis', rol: 'USUARIO' }, caracas('2026-10-19', 12)) },
  { id: 'a', ...eventoActivacion({ tecnico: 'GERARDO', activo: true, por: 'gerardo', rol: 'TECNICO' }, caracas('2026-10-19', 8)) },
  { id: 'c', ...eventoActivacion({ tecnico: 'REINEL', activo: true, por: 'luis', rol: 'USUARIO' }, caracas('2026-10-20', 7)) },
];
check('filas de movimientos: de más antiguo a más nuevo, con acción y quién', filasLogTecnico(log).map(f => [f.tecnico, f.accion, f.fechaHora, f.por]), [
  ['GERARDO', 'ACTIVADO', '19/10/2026 08:00', 'gerardo'],
  ['GERARDO', 'DESACTIVADO', '19/10/2026 12:00', 'luis'],
  ['REINEL', 'ACTIVADO', '20/10/2026 07:00', 'luis'],
]);
check('filtra por rango de días y por técnico', filasLogTecnico(log, { desde: '2026-10-20' }).length + filasLogTecnico(log, { tecnico: 'GERARDO' }).length, 3);
check('filas de duración diaria', filasDuracionDiaria(log, { ahora: caracas('2026-10-20', 9) }).map(f => [f.tecnico, f.dia, f.duracion]), [
  ['GERARDO', '2026-10-19', '4 h 00 min'],
  ['REINEL', '2026-10-20', '2 h 00 min'],
]);
check('la duración diaria respeta el rango', filasDuracionDiaria(log, { desde: '2026-10-20', ahora: caracas('2026-10-20', 9) }).length, 1);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas del registro de técnicos pasaron.');
