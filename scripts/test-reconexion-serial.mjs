// Prueba que una visita de Reconexión pide el serial del equipo y que es obligatorio (src/utils/tipoVisita.js): el mismo serial y la misma verificación que el cambio de equipo (sin el tipo de equipo),
// cómo se guarda, qué se muestra al confirmar, en los datos para autorizar y en Editar orden, y que no genera cobro ni envío al inventario. No necesita el emulador.
// Uso: `node scripts/test-reconexion-serial.mjs`.
import { readFileSync } from 'node:fs';
import {
  TIPO_CAMBIO_EQUIPO, TIPO_DROP_ATENUADO, TIPO_RECONEXION, datosSerialEquipo, errorTipoEquipoNuevo, esCambioEquipo, esReconexion, generaCobro, llevaConectores, parseSerialEquipo, pideNapPuertoVisita, pideSerialEquipo,
} from '../src/utils/tipoVisita.js';
import { datosParaConfirmar } from '../src/utils/confirmarPreFinalizar.js';
import { datosAutorizacion } from '../src/utils/datosAutorizacion.js';
import { cambiosDatosTecnico, formularioDatosTecnico, validarDatosTecnico } from '../src/utils/edicionDatosTecnico.js';
import { payloadEnvioInventario } from '../src/utils/envioInventario.js';
import { errorSerialCaja } from '../src/utils/serialOlt.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

// --- Quién pide el serial ---
check('la reconexión y el cambio de equipo piden el serial del equipo; ningún otro tipo', ['RECONEXION', 'CAMBIO_EQUIPO', 'DROP_ATENUADO', 'CONFIG_ROUTER', 'RECABLEADO', 'CONFIG_VLAN', 'MUDANZA_INTERNA', ''].map(pideSerialEquipo), [true, true, false, false, false, false, false, false]);
check('esReconexion solo es verdadero para la reconexión', [esReconexion(TIPO_RECONEXION), esReconexion(TIPO_CAMBIO_EQUIPO), esCambioEquipo(TIPO_RECONEXION)], [true, false, false]);
check('la reconexión sigue sin cobro, sin conectores ni NAP', [generaCobro(TIPO_RECONEXION), llevaConectores(TIPO_RECONEXION), pideNapPuertoVisita(TIPO_RECONEXION)], [false, false, false]);
check('y no pide el tipo del equipo (eso es del cambio de equipo)', [errorTipoEquipoNuevo(TIPO_RECONEXION, ''), errorTipoEquipoNuevo(TIPO_CAMBIO_EQUIPO, '')], ['', 'Elige el tipo del equipo nuevo.']);

// --- El serial: obligatorio y con el mismo formato ---
check('en una reconexión el serial vacío es obligatorio y el mensaje no dice "nuevo"', [parseSerialEquipo('', TIPO_RECONEXION), parseSerialEquipo('   ', TIPO_RECONEXION)], [{ error: 'Escribe el serial del equipo.' }, { error: 'Escribe el serial del equipo.' }]);
check('en un cambio de equipo el mensaje sigue diciendo "equipo nuevo" (también sin indicar el tipo)', [parseSerialEquipo('', TIPO_CAMBIO_EQUIPO), parseSerialEquipo('')], [{ error: 'Escribe el serial del equipo nuevo.' }, { error: 'Escribe el serial del equipo nuevo.' }]);
check('un serial válido se pasa a mayúsculas y sin espacios', parseSerialEquipo(' hwtc 1a2b3c4d ', TIPO_RECONEXION), { valor: 'HWTC1A2B3C4D' });
check('un serial muy corto, con símbolos o muy largo es un error', ['AB12', 'ABC#12345', 'A'.repeat(25)].map((s) => typeof parseSerialEquipo(s, TIPO_RECONEXION).error), ['string', 'string', 'string']);
check('además del formato, debe ser el de la etiqueta: la MAC y el "GOPN" mal escrito se rechazan', ['CCBABDAA8E40', 'GOPNBTPTDD2CF3A0'].map((s) => errorSerialCaja(s) !== ''), [true, true]);
check('el de la captura de la oficina (GponBTPTDD2CF3A0) es válido', [parseSerialEquipo('GponBTPTDD2CF3A0', TIPO_RECONEXION).valor, errorSerialCaja('GPONBTPTDD2CF3A0')], ['GPONBTPTDD2CF3A0', '']);

// --- Lo que se guarda ---
check('la reconexión guarda el serial normalizado y deja vacío el tipo de equipo', datosSerialEquipo(TIPO_RECONEXION, 'hwtc1a2b3c4d', 'MRTV'), { serialEquipo: 'HWTC1A2B3C4D', tipoEquipoNuevo: '' });
check('el cambio de equipo sigue guardando serial y tipo', datosSerialEquipo(TIPO_CAMBIO_EQUIPO, 'hwtc1a2b3c4d', 'MRTV'), { serialEquipo: 'HWTC1A2B3C4D', tipoEquipoNuevo: 'MRTV' });
check('al cambiar a otro tipo de visita el serial se borra', datosSerialEquipo(TIPO_DROP_ATENUADO, 'HWTC1A2B3C4D', 'MRTV'), { serialEquipo: '', tipoEquipoNuevo: '' });

// --- Confirmación antes de enviar ---
check('la confirmación muestra el serial del equipo (destacado) y no el tipo de equipo nuevo', datosParaConfirmar({ tipoVisita: 'RECONEXION', serialEquipo: 'GPONBTPTDD2CF3A0', observacionTecnico: 'ok' }), [{ etiqueta: 'Serial del equipo', valor: 'GPONBTPTDD2CF3A0', destacado: true }, { etiqueta: 'Observación', valor: 'ok', destacado: false }]);

// --- Datos para autorizar (la oficina los copia a SmartOLT) ---
const visita = { codigo: 'AN71', nombre: 'Ana', tipoTrabajo: 'RECONEXIÓN', tipoVisita: 'RECONEXION', serialEquipo: 'GPONBTPTDD2CF3A0' };
check('los datos para autorizar traen el serial de la reconexión', datosAutorizacion(visita).equipo.map((x) => [x.clave, x.etiqueta, x.valor]), [['serialEquipo', 'Serial del equipo', 'GPONBTPTDD2CF3A0']]);

// --- Editar orden (la oficina corrige lo que cargó el técnico) ---
const orden = { id: 'x', codigo: 'AN71', tipoTrabajo: 'RECONEXIÓN', estado: 'PRE-FINALIZADO', tecnico: 'REINEL', nap: '', tipoVisita: 'RECONEXION', serialEquipo: 'GPONBTPTDD2CF3A0', observacionTecnico: 'ok' };
const formulario = formularioDatosTecnico(orden);
check('el formulario de Editar orden trae el serial de la reconexión', [formulario.tipoVisita, formulario.serialEquipo], ['RECONEXION', 'GPONBTPTDD2CF3A0']);
let r = validarDatosTecnico(orden, { ...formulario, serialEquipo: '' });
check('en Editar orden la reconexión sin serial no se guarda y dice qué falta', [r.error, r.errores?.serialEquipo], [true, 'Escribe el serial del equipo.']);
r = validarDatosTecnico(orden, { ...formulario, serialEquipo: 'hwtc1a2b3c4d' });
check('corregir el serial de una reconexión guarda el serial normalizado', [r.error, r.datos.tipoVisita, r.datos.serialEquipo, r.datos.tipoEquipoNuevo], [false, 'RECONEXION', 'HWTC1A2B3C4D', '']);
check('el historial dice "Serial del equipo" (sin "nuevo") para una reconexión y "nuevo" para un cambio de equipo', [
  cambiosDatosTecnico(orden, { ...orden, serialEquipo: 'HWTC1A2B3C4D' }).filter((c) => c.startsWith('Serial')),
  cambiosDatosTecnico({ ...orden, tipoVisita: 'CAMBIO_EQUIPO' }, { ...orden, tipoVisita: 'CAMBIO_EQUIPO', serialEquipo: 'HWTC1A2B3C4D' }).filter((c) => c.startsWith('Serial')),
], [['Serial del equipo: HWTC1A2B3C4D'], ['Serial del equipo nuevo: HWTC1A2B3C4D']]);
r = validarDatosTecnico(orden, { ...formulario, tipoVisita: 'DROP_ATENUADO', serialEquipo: '', nap: 'NAP 08 - Puerto 3' });
check('pasar la orden a otro tipo de visita ya no pide el serial', r.errores?.serialEquipo, undefined);

// --- No genera envío al inventario ---
check('con serial y todo, una reconexión no se envía al inventario (solo el cambio de equipo y las instalaciones)', payloadEnvioInventario({ ...orden, estado: 'FINALIZADO', tipoTrabajo: 'VISITA' }), null);

// --- Conexión: el formulario del técnico y el guardado lo exigen ---
const modal = leer('../src/components/modals/PreFinalizarModal.jsx');
const hook = leer('../src/hooks/useTickets.js');
check('el Pre-finalizar muestra el campo del serial (con escáner y verificación) también en una reconexión, sin el tipo de equipo', [
  modal.includes('const pideSerial = pideSerialEquipo(tipoVisita);'), modal.includes('{pideSerial && ('), modal.includes('nuevo={cambioEquipo}'), modal.includes('onTipoEquipo={cambioEquipo ?'),
], [true, true, true, true]);
check('el Pre-finalizar valida el serial de la reconexión (obligatorio) antes de enviar', modal.includes('const serialEquipoLeido = pideSerial ? parseSerialEquipo(serialEquipo, tipoVisita) : null;'), true);
check('al guardar, useTickets vuelve a exigirlo (un cliente modificado no lo evita)', [hook.includes('const serialEquipoParseado = pideSerialEquipo(tipoVisita) ? parseSerialEquipo(serialEquipo, tipoVisita) : null;'), hook.includes('(pideSerialEquipo(tipoVisita) || ticket.serialEquipo)')], [true, true]);
check('el serial de la reconexión va al historial de la orden', hook.includes('` | Serial del equipo: ${serialEquipoParseado.valor}`'), true);
const reglas = leer('../firestore.rules');
check('las reglas del técnico ya permiten guardar serialEquipo (no hace falta tocarlas)', /hasOnly\(\[[^\]]*'serialEquipo'/.test(reglas), true);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
