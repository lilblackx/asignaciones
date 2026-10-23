// Prueba el tipo de visita "Cambio de equipo" (serial del equipo nuevo, obligatorio) y "Drop atenuado"
// (src/utils/tipoVisita.js). No necesita el emulador. Uso: `npm run test:equipo`.
import {
  ETIQUETA_TIPO_VISITA, TIPOS_VISITA, TIPOS_VISITA_OBLIGATORIO, TIPO_CAMBIO_EQUIPO, TIPO_CONECTOR_EXTERNO, TIPO_CONECTOR_INTERNO, TIPO_DROP_ATENUADO, TIPO_RECABLEADO,
  TIPO_CONFIG_ROUTER, TIPO_FUENTE_AVERIADA,
  datosSerialEquipo, errorNapPuertoVisita, errorTipoEquipoNuevo, errorTipoVisita, esCambioEquipo, etiquetaTipoVisita, generaCobro, llevaConectores, parseSerialEquipo, pideNapPuertoVisita,
} from '../src/utils/tipoVisita.js';
import { readFileSync } from 'node:fs';

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
check('configuración de router y fuente averiada: en la lista, con etiqueta, sin serial ni conectores ni cobro',
  [TIPO_CONFIG_ROUTER, TIPO_FUENTE_AVERIADA].map(v => [TIPOS_VISITA.find(t => t.value === v)?.label, etiquetaTipoVisita(v), esCambioEquipo(v), llevaConectores(v), generaCobro(v)]),
  [['Configuración de router', 'Configuración de router', false, false, false], ['Fuente averiada', 'Fuente averiada', false, false, false]]);
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

// --- El tipo de visita es obligatorio al pre-finalizar (menos en instalaciones) ---
const FALTA = 'Elige el tipo de visita.';
check('sin tipo de visita no se puede pre-finalizar una avería ni una mudanza', [errorTipoVisita('AVERÍA', ''), errorTipoVisita('AVERÍA', undefined), errorTipoVisita('MUDANZA', '')], [FALTA, FALTA, FALTA]);
check('con cualquiera de los siete tipos sí', [TIPO_CONECTOR_EXTERNO, TIPO_CONECTOR_INTERNO, TIPO_RECABLEADO, TIPO_CAMBIO_EQUIPO, TIPO_DROP_ATENUADO, TIPO_CONFIG_ROUTER, TIPO_FUENTE_AVERIADA].map((t) => errorTipoVisita('AVERÍA', t)), ['', '', '', '', '', '', '']);
check('un valor inventado no vale', errorTipoVisita('AVERÍA', 'OTRA_COSA'), FALTA);
check('las instalaciones no llevan tipo de visita: no se les pide', [errorTipoVisita('INSTALACIÓN', ''), errorTipoVisita('Instalacion', undefined)], ['', '']);
check('el técnico ve los siete tipos, sin "Ninguno"', TIPOS_VISITA_OBLIGATORIO.map((t) => t.value), ['CONECTOR_EXTERNO', 'CONECTOR_INTERNO', 'RECABLEADO', 'CAMBIO_EQUIPO', 'DROP_ATENUADO', 'CONFIG_ROUTER', 'FUENTE_AVERIADA']);
check('la oficina conserva "Ninguno" al corregir una orden vieja', TIPOS_VISITA[0], { value: '', label: 'Ninguno' });

// --- NAP y puerto solo donde hacen falta ---
check('piden NAP y puerto el conector externo, el drop atenuado y el recableado, y ningún otro', [TIPO_CONECTOR_EXTERNO, TIPO_DROP_ATENUADO, TIPO_RECABLEADO, TIPO_CONECTOR_INTERNO, TIPO_CAMBIO_EQUIPO, TIPO_CONFIG_ROUTER, TIPO_FUENTE_AVERIADA, ''].map(pideNapPuertoVisita), [true, true, true, false, false, false, false, false]);
const SIN_NAP = 'Indica la NAP y el puerto.';
check('drop atenuado sin NAP, sin puerto o con "SN" no pasa', [errorNapPuertoVisita(TIPO_DROP_ATENUADO, ''), errorNapPuertoVisita(TIPO_DROP_ATENUADO, 'NAP M10A02'), errorNapPuertoVisita(TIPO_DROP_ATENUADO, 'SN - Puerto 5'), errorNapPuertoVisita(TIPO_DROP_ATENUADO, ' - Puerto 5')], [SIN_NAP, SIN_NAP, SIN_NAP, SIN_NAP]);
check('drop atenuado y conector externo con NAP real y puerto pasan', [errorNapPuertoVisita(TIPO_DROP_ATENUADO, 'NAP M10A02 - Puerto 5'), errorNapPuertoVisita(TIPO_CONECTOR_EXTERNO, 'DM-SN-01 - Puerto 12')], ['', '']);
check('recableado sin NAP o sin puerto no pasa, con NAP real y puerto sí', [errorNapPuertoVisita(TIPO_RECABLEADO, ''), errorNapPuertoVisita(TIPO_RECABLEADO, 'NAP M10A02'), errorNapPuertoVisita(TIPO_RECABLEADO, 'NAP M10A02 - Puerto 5')], [SIN_NAP, SIN_NAP, '']);
check('un conector interno, cambio de equipo, configuración de router y fuente averiada no piden NAP ni puerto', [TIPO_CONECTOR_INTERNO, TIPO_CAMBIO_EQUIPO, TIPO_CONFIG_ROUTER, TIPO_FUENTE_AVERIADA].map((t) => errorNapPuertoVisita(t, '')), ['', '', '', '']);

// --- Lo que vigila el código del formulario y del guardado ---
const modal = readFileSync(new URL('../src/components/modals/PreFinalizarModal.jsx', import.meta.url), 'utf8');
check('el formulario pone los dos campos separados solo en las visitas que lo piden, ya no hay campo suelto y el tipo es obligatorio',
  [/\) : visitaConNapPuerto \? \(\s+<NapPuertoCampos/.test(modal), !modal.includes('NAP / CAJA / PUERTO'), /items=\{TIPOS_VISITA_OBLIGATORIO\}/.test(modal), /TIPO DE VISITA <span[^>]*>\(obligatorio\)/.test(modal)], [true, true, true, true]);
const hook = readFileSync(new URL('../src/hooks/useTickets.js', import.meta.url), 'utf8');
check('al guardar también se exige el tipo de visita y la NAP con el puerto', /errorTipoVisita\(ticket\.tipoTrabajo, tipoVisita\) \|\| errorNapPuertoVisita\(tipoVisita, nap\)/.test(hook), true);
const contadores = readFileSync(new URL('../src/components/modals/ConectoresRecableado.jsx', import.meta.url), 'utf8');
check('los contadores de conectores se alinean abajo aunque una etiqueta ocupe dos líneas', /min-w-\[9\.5rem\] flex flex-col justify-between/.test(contadores), true);


console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
