// Prueba los teléfonos de la orden (src/utils/telefono.js): el teléfono del cliente es obligatorio en toda orden
// (al crearla y al editarla) y los guiones "bonitos" que escribe WhatsApp se vuelven un guion normal. También
// vigila que el formulario de crear, el de editar y el guardado sigan exigiéndolo. No necesita el emulador.
// Uso: `npm run test:telefono`.
import { readFileSync } from 'node:fs';
import { errorTelefono, limpiarTelefono, MENSAJE_TELEFONO_OBLIGATORIO, normalizarGuiones, parseTelefonos, tieneTelefono } from '../src/utils/telefono.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- Obligatorio: hay teléfono cuando al menos una de las filas trae un número ---
for (const vacio of ['', '   ', ' / ', '/ /', undefined, null]) {
  check(`sin teléfono: ${JSON.stringify(vacio)}`, tieneTelefono(vacio), false);
}
check('con un teléfono', tieneTelefono('0414-1234567'), true);
check('con dos teléfonos', tieneTelefono('0414-1234567 / 0424-7654321'), true);
check('con un teléfono extranjero', tieneTelefono('+1 305 555 1234'), true);
check('con el número solo en la segunda fila', tieneTelefono(' / 0414-1234567'), true);
check('con espacios alrededor', tieneTelefono('  0414-1234567  '), true);
check('parseTelefonos y tieneTelefono coinciden', tieneTelefono('0414-1234567 / '), parseTelefonos('0414-1234567 / ').length > 0);
check('mensaje de teléfono obligatorio', MENSAJE_TELEFONO_OBLIGATORIO, 'Teléfono: es obligatorio, escribe el número del cliente.');

// --- Guiones que no son el "-" normal (los escribe WhatsApp, Word, etc.) ---
const GUIONES = { 'guion (U+2010)': '\u2010', 'guion no separable (U+2011)': '\u2011', 'guion de figura (U+2012)': '\u2012', 'raya corta (U+2013)': '\u2013', 'raya larga (U+2014)': '\u2014', 'barra horizontal (U+2015)': '\u2015', 'signo menos (U+2212)': '\u2212' };
for (const [nombre, g] of Object.entries(GUIONES)) {
  check(`normalizarGuiones: ${nombre}`, normalizarGuiones(`0414${g}1234567`), '0414-1234567');
  check(`limpiarTelefono: ${nombre}`, limpiarTelefono(`+58 414${g}3505086`), '+58 414-3505086');
}
check('normalizarGuiones deja igual lo que no es un guion', normalizarGuiones('+58 (414) 123-4567 / 0424.7654321'), '+58 (414) 123-4567 / 0424.7654321');
check('normalizarGuiones sin valor', [normalizarGuiones(undefined), normalizarGuiones(null), normalizarGuiones('')], ['', '', '']);
check('limpiarTelefono sigue quitando letras y símbolos', limpiarTelefono('tlf: 0414#123-4567 ext'), ' 0414123-4567 ');
check('limpiarTelefono deja igual un número normal', limpiarTelefono('+58 (414) 123-4567'), '+58 (414) 123-4567');
check('un número pegado desde WhatsApp es válido en el formulario', errorTelefono(limpiarTelefono('+58 414\u20113505086')), '');
check('un número incompleto sigue siendo inválido', errorTelefono(limpiarTelefono('0414\u2011123')) !== '', true);

// --- Los formularios y el guardado lo exigen (se leen del código, como el orden de la instalación) ---
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const campo = (codigo, id) => codigo.match(new RegExp(`<TelefonosField[^>]*id="${id}"[\\s\\S]*?/>`))?.[0] || '';
const etiqueta = (codigo, id) => codigo.match(new RegExp(`htmlFor="${id}"[^>]*>([^<]*)<span className="text-red-600 dark:text-red-400"> \\*</span>`))?.[1];

const crear = leer('../src/components/modals/CreateTicketModal.jsx');
check('crear orden: el campo teléfono es obligatorio', /\srequired[\s/>]/.test(campo(crear, 'tk-telefono')), true);
check('crear orden: el rótulo lleva el asterisco rojo', etiqueta(crear, 'tk-telefono'), 'TELÉFONO');

const editar = leer('../src/components/modals/EditTicketModal.jsx');
check('editar orden: el campo teléfono es obligatorio', /\srequired[\s/>]/.test(campo(editar, 'ed-telefono')), true);
check('editar orden: el rótulo lleva el asterisco rojo', etiqueta(editar, 'ed-telefono'), 'TELÉFONO');
check('editar orden: el técnico no puede editarlo, así que no se le exige', /disabled=\{isTecnico\}/.test(campo(editar, 'ed-telefono')), true);

const campoTel = leer('../src/components/modals/TelefonosField.jsx');
check('el campo exige al menos un número (también sin solo espacios)', /setCustomValidity\(falta && i === 0/.test(campoTel) && /!filas\.some\(f => f\.trim\(\)\)/.test(campoTel), true);
check('un campo deshabilitado no se exige', /required && !disabled/.test(campoTel), true);

const hook = leer('../src/hooks/useTickets.js');
const crearHook = hook.slice(hook.indexOf('const createTicket = async'), hook.indexOf('const crearTicketSinGuardia'));
check('al guardar una orden nueva se vuelve a comprobar el teléfono', /!tieneTelefono\(formData\.telefono\)[\s\S]*return false/.test(crearHook), true);
check('la comprobación va antes de bloquear el doble clic', crearHook.indexOf('tieneTelefono') < crearHook.indexOf('creandoRef.current = true'), true);
const editarHook = hook.slice(hook.indexOf('const updateTicket = async'), hook.indexOf('const originalTicket = base'));
check("al editar, la oficina debe dejar el teléfono (el técnico no)", /role !== 'TECNICO' && !tieneTelefono\(editingTicket\.telefono\)[\s\S]*return false/.test(editarHook), true);

const app = leer('../src/App.jsx');
const crearApp = app.slice(app.indexOf('const handleCreateSubmit'), app.indexOf('const handleEditChange'));
check('si falta el teléfono el formulario de crear se queda abierto', crearApp.indexOf('nuevoTicket === false') !== -1 && crearApp.indexOf('nuevoTicket === false') < crearApp.indexOf('setIsCreateModalOpen(false)'), true);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
