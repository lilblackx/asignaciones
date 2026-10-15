// Prueba los valores de señal del cliente que guarda la oficina (src/utils/valoresCliente.js): en qué órdenes son
// obligatorios, la escala Bueno / Regular / Crítico y cómo se leen los campos. No necesita el emulador.
// Uso: `npm run test:valores`.
import { TIPOS_POR_TRABAJO, TIPOS_TRABAJO } from '../src/constants.js';
import { calidadValor, detalleValoresCliente, exigeValoresCliente, parseValoresCliente, textoValoresCliente, valoresGuardados } from '../src/utils/valoresCliente.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

// --- Obligatorios solo donde hay una ONU que medir y el técnico ve el cobro ---
const nivel = (v) => calidadValor(v)?.nivel;
check('obligatorios en avería, reconexión, mudanza, garantía y low signal',
  ['AVERÍA', 'RECONEXIÓN', 'MUDANZA', 'GARANTIA', 'LOW SIGNAL'].map((tipoTrabajo) => exigeValoresCliente({ tipoTrabajo })), [true, true, true, true, true]);
check('el cambio de equipo es un trabajo más, con los mismos tipos de equipo que las instalaciones, y mide la ONU',
  [TIPOS_TRABAJO.includes('CAMBIO DE EQUIPO'), TIPOS_POR_TRABAJO['CAMBIO DE EQUIPO'], TIPOS_POR_TRABAJO['CAMBIO DE EQUIPO'].join() === TIPOS_POR_TRABAJO['INSTALACIÓN'].join(), exigeValoresCliente({ tipoTrabajo: 'CAMBIO DE EQUIPO' })],
  [true, ['MRTV', 'MTV', 'MR', 'SM'], true, true]);
check('no se exigen en retiro de equipo ni en validación NAP', ['RETIRO EQUIPO', 'VALIDACION NAP'].map((tipoTrabajo) => exigeValoresCliente({ tipoTrabajo })), [false, false]);
check('no se exigen en instalaciones (no pasan por el cobro)', exigeValoresCliente({ tipoTrabajo: 'INSTALACIÓN' }), false);
check('sin orden no se exigen', exigeValoresCliente(null), false);

// --- Escala ---
check('Bueno: de -15 a -28', [-15, -19.85, -22.84, -28].map(nivel), ['bueno', 'bueno', 'bueno', 'bueno']);
check('Regular: de -29 a -31 (y el hueco entre -28 y -29)', [-28.5, -29, -30, -31].map(nivel), ['regular', 'regular', 'regular', 'regular']);
check('Crítico: de -31 a -33 y por debajo', [-31.01, -32, -33, -38].map(nivel), ['critico', 'critico', 'critico', 'critico']);
check('por encima de -15 sobrepasa la escala', [-14.9, -8].map(nivel), ['alta', 'alta']);
check('sin valor no hay calidad', [calidadValor(null), calidadValor(''), calidadValor('x')], [null, null, null]);

// --- Campos ---
check('valores válidos (coma o punto, sin signo se toma negativo)', parseValoresCliente({ olt: '-19,85', onu: '22.84' }), { valor: { olt1310Dbm: -19.85, onu1490Dbm: -22.84 } });
check('vacíos: se pide cada uno', parseValoresCliente({ olt: '', onu: ' ' }).errores, { olt: 'Escribe la potencia OLT Rx (1310 nm).', onu: 'Escribe la señal ONU Rx (1490 nm).' });
check('uno vacío: solo ese da error', Object.keys(parseValoresCliente({ olt: '-20', onu: '' }).errores), ['onu']);
check('formato inválido da error', Object.keys(parseValoresCliente({ olt: 'abc', onu: '-20' }).errores), ['olt']);
check('más allá de -40 dBm da error', Object.keys(parseValoresCliente({ olt: '-45', onu: '-20' }).errores), ['olt']);

// --- Guardados ---
check('guardados: dos números', valoresGuardados({ valoresCliente: { olt1310Dbm: -20, onu1490Dbm: -22 } }), true);
check('guardados: falta uno, está vacío o no hay', [valoresGuardados({ valoresCliente: { olt1310Dbm: -20 } }), valoresGuardados({ valoresCliente: { olt1310Dbm: null, onu1490Dbm: -22 } }), valoresGuardados({})], [false, false, false]);

// --- Textos ---
const v = { olt1310Dbm: -19.85, onu1490Dbm: -29.4 };
check('historial', detalleValoresCliente(v), 'OLT Rx 1310 nm: -19.85 dBm (Bueno) | ONU Rx 1490 nm: -29.4 dBm (Regular)');
check('texto para copiar', textoValoresCliente(v), '*Valores del cliente*\nOLT Rx (1310 nm): -19.85 dBm (Bueno)\nONU Rx (1490 nm): -29.4 dBm (Regular)');

if (failures > 0) { console.log(`\n${failures} falla(s)`); process.exit(1); }
console.log('\nTodo bien.');
