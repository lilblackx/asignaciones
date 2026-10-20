// Prueba la prioridad alta de las órdenes (src/utils/prioridad.js): quién cuenta como prioritaria, el
// orden de la lista y cómo se detecta que le marcaron una al técnico. No necesita el emulador.
// Uso: `npm run test:prioridad`.
import { esPrioritaria, mapaPrioridad, prioridadNueva, prioritariasPrimero, puedeCambiarPrioridad, textoAvisoPrioridad } from '../src/utils/prioridad.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- Quién cuenta como prioritaria ---
const pendiente = { id: 'a', estado: 'PENDIENTE', prioridadAlta: true };
check('una orden pendiente con prioridad marcada es prioritaria', esPrioritaria(pendiente), true);
check('sin la marca, o con la marca quitada, no lo es', [{ id: 'b', estado: 'PENDIENTE' }, { id: 'c', estado: 'PENDIENTE', prioridadAlta: false }].map(esPrioritaria), [false, false]);
check('pre-finalizada o cerrada ya no cuenta, aunque conserve la marca',
  ['PRE-FINALIZADO', 'FINALIZADO', 'CANCELADO'].map(estado => esPrioritaria({ ...pendiente, estado })), [false, false, false]);
check('sin orden no es prioritaria', [esPrioritaria(null), esPrioritaria(undefined)], [false, false]);
check('la prioridad solo se cambia mientras la orden está pendiente',
  ['PENDIENTE', 'PRE-FINALIZADO', 'FINALIZADO', 'CANCELADO'].map(estado => puedeCambiarPrioridad({ estado })), [true, false, false, false]);

// --- Orden de la lista ---
const lista = [
  { id: '1', estado: 'PENDIENTE' },
  { id: '2', estado: 'PENDIENTE', prioridadAlta: true },
  { id: '3', estado: 'PRE-FINALIZADO', prioridadAlta: true },
  { id: '4', estado: 'PENDIENTE', prioridadAlta: true },
  { id: '5', estado: 'PENDIENTE' },
];
check('las prioritarias van primero y el resto conserva su orden', prioritariasPrimero(lista).map(t => t.id), ['2', '4', '1', '3', '5']);
check('sin prioritarias la lista queda igual', prioritariasPrimero([lista[0], lista[4]]).map(t => t.id), ['1', '5']);
check('no modifica la lista original', lista.map(t => t.id), ['1', '2', '3', '4', '5']);

// --- Aviso al técnico ---
check('texto del aviso', textoAvisoPrioridad({ codigo: 'AS184', nombre: 'Ana Pérez' }), 'La orden AS184 — Ana Pérez es PRIORIDAD ALTA. Atiéndela primero.');
check('texto del aviso sin código ni nombre', textoAvisoPrioridad({}), 'La orden S/C es PRIORIDAD ALTA. Atiéndela primero.');

// --- Detectar la prioridad que le marcaron ---
const antes = mapaPrioridad([{ id: 'a', estado: 'PENDIENTE' }, { id: 'b', estado: 'PENDIENTE', prioridadAlta: true }, { id: 'c', estado: 'PRE-FINALIZADO' }, { id: 'd', estado: 'PENDIENTE' }]);
check('el punto de partida guarda quién tenía la marca', [...antes], [['a', ''], ['b', 1], ['c', ''], ['d', '']]);
const ahora = [
  { id: 'a', estado: 'PENDIENTE', prioridadAlta: true },          // le marcaron la prioridad: se avisa
  { id: 'b', estado: 'PENDIENTE', prioridadAlta: true },          // ya la tenía: no
  { id: 'c', estado: 'PRE-FINALIZADO', prioridadAlta: true },     // no está pendiente: no
  { id: 'e', estado: 'PENDIENTE', prioridadAlta: true },          // orden nueva: se avisa como asignación, no aquí
  { id: 'd', estado: 'PENDIENTE' },
];
check('solo se avisa de la orden pendiente a la que se le acaba de marcar', prioridadNueva(ahora, antes).map(t => t.id), ['a']);
check('quitar la prioridad no avisa', prioridadNueva([{ id: 'b', estado: 'PENDIENTE', prioridadAlta: false }], antes), []);
check('una orden devuelta que ya tenía la marca no vuelve a avisar', prioridadNueva([{ id: 'b', estado: 'PENDIENTE', prioridadAlta: true }], mapaPrioridad([{ id: 'b', estado: 'PRE-FINALIZADO', prioridadAlta: true }])), []);
check('sin punto de partida no se sabe qué cambió y no se avisa', [prioridadNueva(ahora, null), prioridadNueva(ahora, undefined)], [[], []]);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
