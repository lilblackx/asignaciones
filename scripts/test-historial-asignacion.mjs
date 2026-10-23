// Prueba cómo el historial de una orden marca las asignaciones de técnico (src/utils/historial.js): quién la asignó, a quién y de quién a quién.
import { construirLineaDeTiempo, lineaTecnico, tituloDeAsignacion } from '../src/utils/historial.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

check('la línea dice de quién a quién', [lineaTecnico('', 'GERARDO'), lineaTecnico('GERARDO', 'REINEL'), lineaTecnico('REINEL', '')], ['Técnico: Sin asignar → GERARDO', 'Técnico: GERARDO → REINEL', 'Técnico: REINEL → Sin asignar']);
check('el título según lo que pasó', [['Técnico: Sin asignar → GERARDO'], ['Técnico: GERARDO → REINEL'], ['Técnico: REINEL → Sin asignar'], ['Técnico: GERARDO'], ['Estado: CANCELADO']].map(tituloDeAsignacion), ['Orden asignada', 'Orden reasignada', 'Técnico retirado', null, null]);

const orden = {
  createdAt: Date.UTC(2026, 9, 20, 16), codigo: 'AO1', creado: 'usuario',
  historialEdiciones: [
    { fecha: '20/10/2026 12:00', operador: 'usuario', detalle: 'Técnico: Sin asignar → GERARDO' },
    { fecha: '20/10/2026 13:00', operador: 'admin', detalle: 'Estado: PENDIENTE | Técnico: GERARDO → REINEL | Obs. modificada' },
    { fecha: '20/10/2026 14:00', operador: 'admin', detalle: 'Técnico: REINEL' },
    { fecha: '20/10/2026 15:00', operador: 'admin', detalle: 'Obs. modificada' },
  ],
};
const eventos = construirLineaDeTiempo(orden);
check('cada asignación sale con su título y quién la hizo (la más reciente primero)', eventos.map((e) => [e.tipo, e.titulo ?? null, e.operador]), [['edicion', null, 'admin'], ['tecnico', null, 'admin'], ['tecnico', 'Orden reasignada', 'admin'], ['tecnico', 'Orden asignada', 'usuario'], ['creada', null, 'usuario']]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
