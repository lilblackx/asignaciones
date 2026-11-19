// Prueba el resumen de avisos al volver a la app (src/utils/resumenAlVolver.js): cuándo se resume y cómo queda el aviso. No necesita el emulador. Uso: `npm run test:resumenalvolver`.
import { ESPERA_RESUMEN_MS, UMBRAL_RESUMEN_MS, construirResumen, crearResumenAlVolver, debeResumir } from '../src/utils/resumenAlVolver.js';

let failures = 0;
function check(name, actual, esperado) {
  const ok = JSON.stringify(actual) === JSON.stringify(esperado);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log('      esperado:', JSON.stringify(esperado), '\n      recibido:', JSON.stringify(actual));
}

const ahora = 10_000_000;
check('sin punto de partida (primera vez en el teléfono) no se resume', [debeResumir(0, ahora), debeResumir(undefined, ahora)], [false, false]);
check('con poco tiempo fuera no se resume', debeResumir(ahora - UMBRAL_RESUMEN_MS, ahora), false);
check('pasado el umbral sí', debeResumir(ahora - UMBRAL_RESUMEN_MS - 1, ahora), true);

check('sin avisos no hay resumen', [construirResumen([]), construirResumen(null), construirResumen([{ type: 'x' }])], [null, null, null]);
const nueva = { type: 'nuevaAsignacion', text: 'Te asignaron 3 órdenes nuevas.', duration: 6000 };
const devuelta = { type: 'devuelto', text: 'AN5 fue devuelta: falta el serial.', duration: 9000 };
const aprobada = { type: 'aprobado', text: 'AN6 fue aprobada y finalizada.', duration: 6000 };
const prioridad = { type: 'prioridad', text: 'AN7 tiene prioridad alta. Atiéndela primero.', duration: 9000 };
check('un solo aviso se muestra tal cual, con su sonido', construirResumen([nueva]), { toast: nueva, sonido: 'nuevaAsignacion' });
const dos = construirResumen([aprobada, devuelta]);
check('con varios sale uno solo, con el más urgente y cuántos son', [dos.toast.type, dos.toast.text, dos.sonido], ['devuelto', 'Mientras no estabas llegaron 2 avisos. AN5 fue devuelta: falta el serial. Hay otro más en la campana.', 'devuelta']);
const cuatro = construirResumen([aprobada, nueva, devuelta, prioridad]);
check('la prioridad alta va primero, y se cuentan los demás', [cuatro.toast.type, cuatro.toast.text.startsWith('Mientras no estabas llegaron 4 avisos. AN7 tiene prioridad alta.'), cuatro.toast.text.endsWith('Hay 3 más en la campana.'), cuatro.sonido], ['prioridad', true, true, 'prioridad']);
check('el orden de llegada no cambia cuál es el más urgente', construirResumen([prioridad, devuelta, aprobada]).toast.type, construirResumen([aprobada, devuelta, prioridad]).toast.type);
check('un tipo desconocido va al final', construirResumen([{ type: 'raro', text: 'Algo.' }, aprobada]).toast.type, 'aprobado');
check('el aviso resumido dura más para dar tiempo a leerlo', construirResumen([nueva, aprobada]).toast.duration, 10000);

// El que junta los avisos (con el temporizador y los sonidos de mentira)
function armar() {
  const reg = { toasts: [], sonidos: [], silencio: [], temporizador: null, cancelados: 0 };
  const r = crearResumenAlVolver({
    mostrar: (t) => reg.toasts.push(t), silenciar: (v) => reg.silencio.push(v), sonar: (c) => reg.sonidos.push(c),
    programar: (fn, ms) => { reg.temporizador = { fn, ms }; return 1; }, cancelar: () => { reg.cancelados++; },
  });
  return { r, reg };
}
let { r, reg } = armar();
check('antes de iniciar no junta nada: el aviso se muestra solo', [r.agregar(nueva), r.activo, reg.silencio], [false, false, []]);
r.iniciar();
check('al iniciar silencia los sonidos y programa la espera', [r.activo, reg.silencio, reg.temporizador.ms], [true, [true], ESPERA_RESUMEN_MS]);
check('junta los avisos, pero no los errores', [r.agregar(nueva), r.agregar(devuelta), r.agregar({ type: 'error', text: 'No se pudieron cargar las órdenes.' })], [true, true, false]);
check('no se muestra nada hasta terminar', reg.toasts, []);
r.terminar();
check('al terminar muestra uno solo, suena una vez, vuelve a los sonidos y cancela la espera', [reg.toasts.length, reg.toasts[0].type, reg.sonidos, reg.silencio, reg.cancelados], [1, 'devuelto', ['devuelta'], [true, false], 1]);
check('después de terminar ya no junta, y terminar de más no repite', [r.activo, r.agregar(nueva), (r.terminar(), reg.toasts.length)], [false, false, 1]);
({ r, reg } = armar());
r.iniciar(); r.iniciar();
check('iniciar dos veces no duplica el silencio ni el temporizador', reg.silencio, [true]);
r.terminar();
check('sin avisos juntados no muestra ni suena nada, pero sí devuelve los sonidos', [reg.toasts, reg.sonidos, reg.silencio], [[], [], [true, false]]);
({ r, reg } = armar());
r.iniciar(); r.agregar(nueva);
reg.temporizador.fn();
check('si pasa la espera sin lectura del servidor, resume lo que haya', [reg.toasts[0]?.text, reg.sonidos, r.activo], [nueva.text, ['nuevaAsignacion'], false]);

if (failures) { console.log(`\n${failures} pruebas fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
