// Prueba la prioridad alta de las órdenes (src/utils/prioridad.js): quién cuenta como prioritaria, el
// orden de la lista y cómo se detecta que le marcaron una al técnico. No necesita el emulador.
// Uso: `npm run test:prioridad`.
import { readFileSync } from 'node:fs';
import { esPreFinalizada, nuevasPreFinalizadas, preFinalizadasPrimero } from '../src/utils/preFinalizadas.js';
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

// --- Pre-finalizadas arriba (la oficina las aprueba sin buscarlas) ---
check('pre-finalizada con las dos ortografías, y solo ella', [{ estado: 'PRE-FINALIZADO' }, { estado: 'PRE-FINALIZADA' }, { estado: 'PENDIENTE' }, { estado: 'FINALIZADO' }, undefined].map(esPreFinalizada), [true, true, false, false, false]);
check('las pre-finalizadas van primero y el resto conserva su orden', preFinalizadasPrimero(lista).map(t => t.id), ['3', '1', '2', '4', '5']);
check('con prioridad: primero lo que espera aprobación, luego las prioritarias y luego el resto', preFinalizadasPrimero(prioritariasPrimero(lista)).map(t => t.id), ['3', '2', '4', '1', '5']);
check('sin pre-finalizadas la lista queda igual', preFinalizadasPrimero([lista[0], lista[4]]).map(t => t.id), ['1', '5']);
// Cuáles acaban de quedar pre-finalizadas (para animar su subida): ya estaban en la lista y antes no lo estaban.
const estadoPrevio = new Map([['1', false], ['2', false], ['3', true], ['4', false]]);
check('la que pasa a pre-finalizada sube; la que ya lo era, no', nuevasPreFinalizadas(estadoPrevio, [{ id: '1', estado: 'PRE-FINALIZADO' }, { id: '2', estado: 'PENDIENTE' }, { id: '3', estado: 'PRE-FINALIZADO' }]), ['1']);
check('una orden que llega nueva ya pre-finalizada no se anima como subida', nuevasPreFinalizadas(estadoPrevio, [{ id: '9', estado: 'PRE-FINALIZADO' }]), []);
check('sin cambios de estado no sube ninguna', nuevasPreFinalizadas(estadoPrevio, [{ id: '1', estado: 'PENDIENTE' }, { id: '3', estado: 'PRE-FINALIZADA' }]), []);
const gancho = readFileSync(new URL('../src/hooks/useDeslizarPreFinalizadas.js', import.meta.url), 'utf8');
const tabla = readFileSync(new URL('../src/components/TicketsTable.jsx', import.meta.url), 'utf8');
check('el deslizamiento solo corre en PC y respeta "reducir movimiento"', [/min-width: 1024px/.test(gancho), /prefers-reduced-motion: reduce/.test(gancho)], [true, true]);
check('la tabla de PC lo usa y marca sus filas', [/useDeslizarPreFinalizadas\(cuerpo, filteredTickets\)/.test(tabla), /data-fila=\{ticket\.id\}/.test(tabla), /<tbody ref=\{cuerpo\}>/.test(tabla)], [true, true, true]);
const hook = readFileSync(new URL('../src/hooks/useFilteredTickets.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
check('solo la oficina (ADMIN y USUARIO) ve las pre-finalizadas arriba; el técnico no', [/preFinalizadasArriba: canEditTickets/.test(app), /if \(preFinalizadasArriba\) result = preFinalizadasPrimero\(result\)/.test(hook)], [true, true]);
check('si se pide otro orden (técnico, tipo, programadas) manda ese orden', /!\['TECNICO', 'TIPO_TRABAJO', 'PROGRAMADA'\]\.includes\(sortBy\)\) \{\s+result = prioritariasPrimero\(result\);\s+if \(preFinalizadasArriba\)/.test(hook), true);

// --- Aviso al técnico ---
check('texto del aviso', textoAvisoPrioridad({ codigo: 'AS184', nombre: 'Ana Pérez' }), 'La orden AS184 - Ana Pérez es PRIORIDAD ALTA. Atiéndela primero.');
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
