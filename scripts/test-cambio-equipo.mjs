// Prueba el tipo de visita "Cambio de equipo" (serial del equipo nuevo, obligatorio) y "Drop atenuado"
// (src/utils/tipoVisita.js). No necesita el emulador. Uso: `npm run test:equipo`.
import {
  ETIQUETA_TIPO_VISITA, TIPOS_VISITA, TIPO_CAMBIO_EQUIPO, TIPO_DROP_ATENUADO, TIPO_RECABLEADO,
  datosSerialEquipo, errorTipoEquipoNuevo, esCambioEquipo, etiquetaTipoVisita, llevaConectores, parseSerialEquipo,
} from '../src/utils/tipoVisita.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- Opciones del tipo de visita ---
check('las dos opciones nuevas están en la lista, con su nombre',
  TIPOS_VISITA.filter(t => [TIPO_CAMBIO_EQUIPO, TIPO_DROP_ATENUADO].includes(t.value)).map(t => t.label), ['Cambio de equipo', 'Drop atenuado']);
check('etiqueta de cada una', [etiquetaTipoVisita(TIPO_CAMBIO_EQUIPO), etiquetaTipoVisita(TIPO_DROP_ATENUADO)], ['Cambio de equipo', 'Drop atenuado']);
check('todas las opciones con valor tienen etiqueta', TIPOS_VISITA.filter(t => t.value).every(t => ETIQUETA_TIPO_VISITA[t.value] === t.label), true);
check('solo el cambio de equipo pide serial', [TIPO_CAMBIO_EQUIPO, TIPO_DROP_ATENUADO, TIPO_RECABLEADO, ''].map(esCambioEquipo), [true, false, false, false]);
check('ninguna de las dos lleva conectores', [TIPO_CAMBIO_EQUIPO, TIPO_DROP_ATENUADO].map(llevaConectores), [false, false]);

// --- Serial del equipo nuevo ---
check('serial válido: se pasa a mayúsculas y sin espacios', parseSerialEquipo(' hwtc 1a2b3c4d '), { valor: 'HWTC1A2B3C4D' });
check('serial vacío: es obligatorio', parseSerialEquipo('   '), { error: 'Escribe el serial del equipo nuevo.' });
check('serial muy corto: error', typeof parseSerialEquipo('AB12').error, 'string');
check('serial con símbolos: error', typeof parseSerialEquipo('ABC#12345').error, 'string');
check('serial muy largo: error', typeof parseSerialEquipo('A'.repeat(25)).error, 'string');

// --- Lo que se guarda en la orden ---
check('cambio de equipo guarda el serial normalizado y el tipo del equipo nuevo', datosSerialEquipo(TIPO_CAMBIO_EQUIPO, 'hwtc1a2b3c4d', 'MRTV'), { serialEquipo: 'HWTC1A2B3C4D', tipoEquipoNuevo: 'MRTV' });
check('cualquier otro tipo lo deja vacío (borra uno anterior)', [TIPO_DROP_ATENUADO, TIPO_RECABLEADO, ''].map(t => datosSerialEquipo(t, 'HWTC1A2B3C4D', 'MRTV')), [{ serialEquipo: '', tipoEquipoNuevo: '' }, { serialEquipo: '', tipoEquipoNuevo: '' }, { serialEquipo: '', tipoEquipoNuevo: '' }]);


// --- Tipo del equipo nuevo: obligatorio en un cambio de equipo, de la lista MRTV, MTV, MR o SM ---
check('el tipo del equipo nuevo es obligatorio en un cambio de equipo', [errorTipoEquipoNuevo(TIPO_CAMBIO_EQUIPO, ''), errorTipoEquipoNuevo(TIPO_CAMBIO_EQUIPO, undefined)], ['Elige el tipo del equipo nuevo.', 'Elige el tipo del equipo nuevo.']);
check('solo vale uno de la lista (MRTV, MTV, MR, SM)', ['MRTV', 'MTV', 'MR', 'SM'].map((t) => errorTipoEquipoNuevo(TIPO_CAMBIO_EQUIPO, t)), ['', '', '', '']);
check('un tipo que no está en la lista no vale', [errorTipoEquipoNuevo(TIPO_CAMBIO_EQUIPO, 'ROUTER'), errorTipoEquipoNuevo(TIPO_CAMBIO_EQUIPO, 'mr')], ['Elige el tipo del equipo nuevo.', 'Elige el tipo del equipo nuevo.']);
check('en otro tipo de visita no se pide', [TIPO_DROP_ATENUADO, TIPO_RECABLEADO, ''].map((t) => errorTipoEquipoNuevo(t, '')), ['', '', '']);
check('una orden vieja sin tipo se puede editar sin obligar a ponerlo (exigir = false)', errorTipoEquipoNuevo(TIPO_CAMBIO_EQUIPO, '', false), '');
check('un tipo inválido no se guarda', datosSerialEquipo(TIPO_CAMBIO_EQUIPO, 'HWTC1A2B3C4D', 'ROUTER'), { serialEquipo: 'HWTC1A2B3C4D', tipoEquipoNuevo: '' });

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
