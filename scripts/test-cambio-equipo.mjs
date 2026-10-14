// Prueba el tipo de visita "Cambio de equipo" (serial del equipo nuevo, obligatorio) y "Drop atenuado"
// (src/utils/tipoVisita.js). No necesita el emulador. Uso: `npm run test:equipo`.
import {
  ETIQUETA_TIPO_VISITA, TIPOS_VISITA, TIPO_CAMBIO_EQUIPO, TIPO_DROP_ATENUADO, TIPO_RECABLEADO,
  datosSerialEquipo, esCambioEquipo, etiquetaTipoVisita, llevaConectores, parseSerialEquipo,
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
check('cambio de equipo guarda el serial normalizado', datosSerialEquipo(TIPO_CAMBIO_EQUIPO, 'hwtc1a2b3c4d'), { serialEquipo: 'HWTC1A2B3C4D' });
check('cualquier otro tipo lo deja vacío (borra uno anterior)', [TIPO_DROP_ATENUADO, TIPO_RECABLEADO, ''].map(t => datosSerialEquipo(t, 'HWTC1A2B3C4D')), [{ serialEquipo: '' }, { serialEquipo: '' }, { serialEquipo: '' }]);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
