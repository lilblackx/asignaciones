// Prueba la corrección, desde Editar orden, de lo que el técnico cargó (src/utils/edicionDatosTecnico.js): qué datos trae el
// formulario, qué se valida y qué se guarda en una instalación y en las demás órdenes, y las líneas del historial.
// No necesita el emulador. Uso: `npm run test:edicion`.
import {
  cambiosDatosTecnico, formularioDatosTecnico, formularioModificado, tieneDatosDelTecnico, validarDatosTecnico,
} from '../src/utils/edicionDatosTecnico.js';
import { payloadEnvioInventario } from '../src/utils/envioInventario.js';
import { errorSerialCaja, esSerialOlt, evaluarSerialCaja, serialParaOlt } from '../src/utils/serialOlt.js';
import { generarMensajeWhatsAppInstalacion } from '../src/utils/whatsapp.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const instalacionCompleta = {
  id: 'i1', codigo: 'IO77', nombre: 'Leonardo Pineda', tecnico: 'ABRAHAM', tipoTrabajo: 'INSTALACIÓN', estado: 'FINALIZADO', finalizadoEn: 1,
  nap: 'M05F11 - Puerto 3',
  instalacion: { serial: 'HWTC1A2B3C4D', vlan: '100', posteadura: ['DM SN N01B01', 'DM SN N01B02'], metraje: 120, nap: 'M05F11', puerto: '3', puertosDisponibles: '6', conectores: { externo: { verde: 1 }, interno: { verde: 1, azul: 1 } } },
};
// Una instalación anterior a que se pidieran el metraje y los conectores.
const instalacionVieja = { ...instalacionCompleta, instalacion: { serial: 'HWTC1A2B3C4D', vlan: '100', posteadura: ['DM SN N01B01'], nap: 'M05F11', puerto: '3', puertosDisponibles: '6' } };

// --- Cuándo se muestra ---
check('se muestra en órdenes pre-finalizadas y finalizadas, no en las pendientes ni canceladas', ['PRE-FINALIZADO', 'FINALIZADO', 'PENDIENTE', 'CANCELADO', undefined].map((estado) => tieneDatosDelTecnico({ estado })), [true, true, false, false, false]);

// --- El formulario trae lo que tiene la orden ---
const f = formularioDatosTecnico(instalacionCompleta);
check('instalación: el formulario trae lo que cargó el técnico, como texto', [f.serial, f.vlan, f.nap, f.puerto, f.metraje, f.postes, f.puertosDisponibles, f.extVerde, f.intVerde, f.intAzul],
  ['HWTC1A2B3C4D', '100', 'M05F11', '3', '120', ['DM SN N01B01', 'DM SN N01B02'], '6', '1', '1', '1']);
check('instalación sin NAP ni puerto propios: se toman del texto de la orden', (({ nap, puerto }) => ({ nap, puerto }))(formularioDatosTecnico({ ...instalacionCompleta, instalacion: undefined })), { nap: 'M05F11', puerto: '3' });
check('una instalación sin datos: un poste vacío y todo lo demás vacío', (({ serial, postes, metraje, extVerde }) => ({ serial, postes, metraje, extVerde }))(formularioDatosTecnico({ tipoTrabajo: 'INSTALACIÓN', estado: 'FINALIZADO' })), { serial: '', postes: [''], metraje: '', extVerde: '' });
check('sin tocar nada el formulario no cuenta como modificado', formularioModificado(f, formularioDatosTecnico(instalacionCompleta)), false);
check('cambiar un campo (o un poste) lo marca como modificado', [formularioModificado(f, { ...f, serial: 'ZTEG11112222' }), formularioModificado(f, { ...f, postes: ['A', 'B'] })], [true, true]);

// --- Instalación: corregir el serial ---
let r = validarDatosTecnico(instalacionCompleta, { ...f, serial: 'ztegc0123456' });
check('corregir el serial: se guarda en mayúsculas y el resto de la instalación queda igual', [r.error, r.datos.instalacion, 'nap' in r.datos], [false, { ...instalacionCompleta.instalacion, serial: 'ZTEGC0123456' }, false]);
check('lo corregido llega al inventario del almacén con el serial nuevo', payloadEnvioInventario({ ...instalacionCompleta, ...r.datos }).serial, 'ZTEGC0123456');
check('y a la plantilla de la promotora, donde el serial va en "Mac"', generarMensajeWhatsAppInstalacion({ ...instalacionCompleta, ...r.datos, plantillaOriginal: 'IS1\n*Mac:*\n*Instalador:*' }).includes('ZTEGC0123456'), true);
check('un serial inválido da error en ese campo y lleva el cursor a él', (({ error, errores, primerCampo, datos }) => ({ error, campos: Object.keys(errores), primerCampo, datos }))(validarDatosTecnico(instalacionCompleta, { ...f, serial: 'AB1' })),
  { error: true, campos: ['serial'], primerCampo: 'ed-serial', datos: null });

// --- Instalación: NAP y puerto ---
r = validarDatosTecnico(instalacionCompleta, { ...f, nap: 'D13P01', puerto: '7' });
check('cambiar la NAP o el puerto reescribe el texto de la NAP de la orden y los de la instalación', [r.datos.nap, r.datos.instalacion.nap, r.datos.instalacion.puerto], ['D13P01 - Puerto 7', 'D13P01', '7']);
check('sin tocar la NAP ni el puerto, el texto de la NAP de la orden no se reescribe', 'nap' in validarDatosTecnico({ ...instalacionCompleta, nap: 'M05F11 PUERTO 3 (a mano)' }, { ...formularioDatosTecnico({ ...instalacionCompleta, nap: 'M05F11 PUERTO 3 (a mano)' }), vlan: '200' }).datos, false);

// --- Instalación: lo que ya estaba completo no se puede vaciar ---
const vaciar = (campos) => (({ errores }) => Object.keys(errores))(validarDatosTecnico(instalacionCompleta, { ...f, ...campos }));
check('lo completo no se puede dejar vacío: serial, VLAN, metraje, postes, puertos disponibles', [vaciar({ serial: '' }), vaciar({ vlan: '' }), vaciar({ metraje: '' }), vaciar({ postes: ['  ', ''] }), vaciar({ puertosDisponibles: ' ' })],
  [['serial'], ['vlan'], ['metraje'], ['posteadura'], ['puertosDisponibles']]);
check('ni la NAP real ("SN" no vale) ni el puerto', [vaciar({ nap: 'SN' }), vaciar({ puerto: '' })], [['nap'], ['puerto']]);
check('ni los conectores (al menos 1 en total)', [vaciar({ extVerde: '', intVerde: '', intAzul: '' }), vaciar({ extVerde: '0', intVerde: '0', intAzul: '0' })], [['conectores'], ['conectores']]);
check('el puertos disponibles "0" cuenta como lleno', vaciar({ puertosDisponibles: '0' }), []);
check('el cursor va al primer campo con error, en el orden del formulario', validarDatosTecnico(instalacionCompleta, { ...f, metraje: '', vlan: '', puertosDisponibles: '' }).primerCampo, 'ed-vlan');
check('un error en los conectores lleva el cursor al campo que falló', [
  validarDatosTecnico(instalacionCompleta, { ...f, extVerde: '', intVerde: '', intAzul: '' }).primerCampo,
  validarDatosTecnico(instalacionCompleta, { ...f, intAzul: '12' }).primerCampo,
  validarDatosTecnico(instalacionCompleta, { ...f, intVerde: '11' }).primerCampo,
], ['ed-cant-ext-verde', 'ed-cant-int-azul', 'ed-cant-int-verde']);

// --- Instalación anterior: se corrige sin inventar lo que nunca tuvo ---
const fv = formularioDatosTecnico(instalacionVieja);
r = validarDatosTecnico(instalacionVieja, { ...fv, serial: 'ZTEGC0123456' });
check('una instalación anterior (sin metraje ni conectores) se corrige sin obligar a llenarlos', [r.error, r.datos.instalacion.serial, r.datos.instalacion.metraje, r.datos.instalacion.conectores], [false, 'ZTEGC0123456', null, { externo: { verde: 0 }, interno: { verde: 0, azul: 0 } }]);
check('pero lo que sí escribe en ella debe ser válido', [validarDatosTecnico(instalacionVieja, { ...fv, metraje: '12m' }).errores.metraje !== undefined, validarDatosTecnico(instalacionVieja, { ...fv, intVerde: 'x' }).errores.conectores !== undefined], [true, true]);
r = validarDatosTecnico(instalacionVieja, { ...fv, metraje: '85', extVerde: '1' });
check('y puede completar el metraje y los conectores', [r.error, r.datos.instalacion.metraje, r.datos.instalacion.conectores.externo.verde], [false, 85, 1]);
check('lo que la orden anterior sí tenía (la VLAN) no se puede vaciar', validarDatosTecnico(instalacionVieja, { ...fv, vlan: '' }).errores.vlan !== undefined, true);

// --- Otras órdenes: tipo de visita ---
const visita = { id: 'v1', codigo: 'AS5', tipoTrabajo: 'AVERÍA', estado: 'FINALIZADO', nap: 'NAP 08 - Puerto 3' };
const cambioEquipo = { ...visita, tipoVisita: 'CAMBIO_EQUIPO', serialEquipo: 'ZTEG99887766' };
const fc = formularioDatosTecnico(cambioEquipo);
check('cambio de equipo: el formulario trae el serial del equipo nuevo', [fc.tipoVisita, fc.serialEquipo], ['CAMBIO_EQUIPO', 'ZTEG99887766']);
r = validarDatosTecnico(cambioEquipo, { ...fc, serialEquipo: 'zteg00112233' });
check('cambio de equipo: corregir el serial del equipo nuevo', [r.error, r.datos.tipoVisita, r.datos.serialEquipo], [false, 'CAMBIO_EQUIPO', 'ZTEG00112233']);
check('lo corregido llega al inventario del almacén', payloadEnvioInventario({ ...cambioEquipo, finalizadoEn: 1, ...r.datos }).serial, 'ZTEG00112233');
check('cambio de equipo sin serial o con uno inválido: error y cursor en el campo', [validarDatosTecnico(cambioEquipo, { ...fc, serialEquipo: '' }).primerCampo, validarDatosTecnico(cambioEquipo, { ...fc, serialEquipo: 'x' }).error], ['pf-serial-equipo', true]);

const recableado = { ...visita, tipoVisita: 'RECABLEADO', metrosCable: 40, conectorExterno: 'VERDE', conectorInterno: '' };
const fr = formularioDatosTecnico(recableado);
r = validarDatosTecnico(recableado, { ...fr, metros: '55', colorInterno: 'AZUL' });
check('recableado: corregir los metros y los conectores', [r.error, r.datos.metrosCable, r.datos.conectorExterno, r.datos.conectorInterno], [false, 55, 'VERDE', 'AZUL']);
check('recableado sin metros o con metros inválidos: error y cursor en el campo', [validarDatosTecnico(recableado, { ...fr, metros: '' }).primerCampo, validarDatosTecnico(recableado, { ...fr, metros: '0' }).error], ['pf-metros', true]);

const visitaInterna = { ...visita, tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 2, azul: 1 }, conectorInterno: '' };
const fi = formularioDatosTecnico(visitaInterna);
check('visita de conector: el formulario trae las cantidades por color', [fi.cantVerde, fi.cantAzul], ['2', '1']);
r = validarDatosTecnico(visitaInterna, { ...fi, cantVerde: '3', cantAzul: '' });
check('visita de conector interno: corregir las cantidades (el color único se deduce)', [r.error, r.datos.conectoresUsados, r.datos.conectorInterno], [false, { verde: 3, azul: 0 }, 'VERDE']);
check('visita de conector sin ninguno: error y cursor en el campo', [validarDatosTecnico(visitaInterna, { ...fi, cantVerde: '', cantAzul: '' }).primerCampo, validarDatosTecnico(visitaInterna, { ...fi, cantVerde: '', cantAzul: '' }).error], ['pf-cant-verde', true]);
const visitaVieja = { ...visita, tipoVisita: 'CONECTOR_EXTERNO', conectorExterno: 'VERDE' };
check('una visita anterior (solo con el color) se lee como 1 conector', formularioDatosTecnico(visitaVieja).cantVerde, '1');

// --- Cambiar el tipo de visita borra los datos del anterior ---
r = validarDatosTecnico(recableado, { ...fr, tipoVisita: 'DROP_ATENUADO' });
check('pasar de recableado a drop atenuado borra los metros y los conectores', [r.error, r.datos.tipoVisita, r.datos.metrosCable, r.datos.conectorExterno, r.datos.conectorInterno, r.datos.conectoresUsados], [false, 'DROP_ATENUADO', null, '', '', null]);
r = validarDatosTecnico(cambioEquipo, { ...fc, tipoVisita: '' });
check('pasar de cambio de equipo a ninguno borra el serial', [r.error, r.datos.tipoVisita, r.datos.serialEquipo], [false, '', '']);
// Tipo del equipo nuevo (MRTV, MTV, MR o SM): obligatorio al convertir una orden en cambio de equipo; la orden vieja sin tipo se puede seguir editando.
r = validarDatosTecnico(visita, { ...formularioDatosTecnico(visita), tipoVisita: 'CAMBIO_EQUIPO', serialEquipo: 'ZTEG00112233' });
check('pasar una orden a cambio de equipo exige el tipo del equipo nuevo', [r.error, r.errores.tipoEquipoNuevo, r.primerCampo], [true, 'Elige el tipo del equipo nuevo.', 'pf-tipo-equipo']);
r = validarDatosTecnico(visita, { ...formularioDatosTecnico(visita), tipoVisita: 'CAMBIO_EQUIPO', serialEquipo: 'ZTEG00112233', tipoEquipoNuevo: 'SM' });
check('con el tipo elegido se guarda junto al serial', [r.error, r.datos.serialEquipo, r.datos.tipoEquipoNuevo], [false, 'ZTEG00112233', 'SM']);
r = validarDatosTecnico(cambioEquipo, formularioDatosTecnico(cambioEquipo));
check('una orden vieja de cambio de equipo sin tipo se edita sin obligar a ponerlo', [r.error, r.datos?.tipoEquipoNuevo], [false, '']);
r = validarDatosTecnico({ ...cambioEquipo, tipoEquipoNuevo: 'MR' }, { ...formularioDatosTecnico({ ...cambioEquipo, tipoEquipoNuevo: 'MR' }), tipoEquipoNuevo: '' });
check('si la orden ya tenía el tipo, no se puede dejar vacío', [r.error, r.errores.tipoEquipoNuevo], [true, 'Elige el tipo del equipo nuevo.']);
check('el historial dice el tipo nuevo del equipo', cambiosDatosTecnico({ ...cambioEquipo, tipoEquipoNuevo: 'MR' }, { ...cambioEquipo, tipoEquipoNuevo: 'SM' }), ['Tipo de equipo nuevo: SM']);
r = validarDatosTecnico(visita, { ...formularioDatosTecnico(visita), tipoVisita: 'DROP_ATENUADO' });
check('una orden sin datos de visita no suma campos vacíos al elegir un tipo sin datos', Object.keys(r.datos), ['tipoVisita']);

// --- Serial como lo ve la OLT (el de la caja de TP-Link viene en hexadecimal) ---
check('TP-Link: GOPN + fabricante en hexadecimal + 8 caracteres -> como lo ve la OLT', serialParaOlt('GOPN54504C47BDAA8DE0'), 'TPLGBDAA8DE0');
check('la regla sirve para cualquier fabricante (V-SOL, Huawei, ZTE)', ['GOPN56534F4C00E65D25', 'GOPN48575443C1A2B3C4', 'GOPN5A544547C0123456'].map(serialParaOlt), ['VSOL00E65D25', 'HWTCC1A2B3C4', 'ZTEGC0123456']);
check('BT-PON: la caja trae GPON + el serial de la OLT en texto -> se quita el GPON (también si se anotó GOPN)', ['GPONBTPTDD9BA416', 'GOPNBTPTDD9BA416', 'gpon btptdd9ba416'].map(serialParaOlt), ['BTPTDD9BA416', 'BTPTDD9BA416', 'BTPTDD9BA416']);
check('GPON también vale como prefijo del código hexadecimal (TP-Link)', ['GPON54504C47BDAA8DE0', 'GPON54504C47BDA9EC40'].map(serialParaOlt), ['TPLGBDAA8DE0', 'TPLGBDA9EC40']);
check('un serial de 12 caracteres que empieza por GPON no se toca', serialParaOlt('GPON05161510'), 'GPON05161510');
check('minúsculas y espacios no estorban', serialParaOlt(' gopn54504c47 bdaa8de0 '), 'TPLGBDAA8DE0');
check('TP-Link sin la G (TPLBDAA8C10) o con otra letra en su lugar (TPLHBDAA8C10): se envía con TPLG', ['TPLBDAA8C10', 'TPLHBDAA8C10', ' tplh bdaa8c10 ', 'TPLGBDAA8C10'].map(serialParaOlt), ['TPLGBDAA8C10', 'TPLGBDAA8C10', 'TPLGBDAA8C10', 'TPLGBDAA8C10']);
check('lo que no es TP-Link no cambia aunque se parezca (TPL con menos o más caracteres, otros fabricantes)', ['TPLBDAA8C1', 'TPLHHBDAA8C10', 'VSOL00E65D25', 'HWTC1A2B3C4D'].map(serialParaOlt), ['TPLBDAA8C1', 'TPLHHBDAA8C10', 'VSOL00E65D25', 'HWTC1A2B3C4D']);
check('un serial que ya es de OLT no se toca (V-SOL trae el PON S/N en su etiqueta)', ['TPLGBDAA8DE0', 'VSOL00E65D25', 'hwtc1a2b3c4d'].map(serialParaOlt), ['TPLGBDAA8DE0', 'VSOL00E65D25', 'HWTC1A2B3C4D']);
check('lo que no tiene el formato de caja queda como está (MAC, S/N de fábrica, fabricante que no son letras, largo distinto)', ['B46415E65D24', 'LP20250731266', 'GOPN00000000BDAA8DE0', 'GOPN54504C47BDAA8D', 'GOPN54504C47BDAA8DE0FF', ''].map(serialParaOlt), ['B46415E65D24', 'LP20250731266', 'GOPN00000000BDAA8DE0', 'GOPN54504C47BDAA8D', 'GOPN54504C47BDAA8DE0FF', '']);
check('serial de OLT: 4 letras y 8 caracteres hexadecimales; la MAC y el S/N de fábrica no lo son', ['TPLGBDAA8DE0', 'VSOL00E65D25', 'B46415E65D24', 'LP20250731266', 'GOPN54504C47BDAA8DE0', ''].map(esSerialOlt), [true, true, false, false, false, false]);
const cajaTpLink = { ...instalacionCompleta, instalacion: { ...instalacionCompleta.instalacion, serial: 'GOPN54504C47BDAA8DE0' } };
check('al almacén se envía el serial de la OLT y la orden guarda el de la caja', [payloadEnvioInventario(cajaTpLink).serial, cajaTpLink.instalacion.serial], ['TPLGBDAA8DE0', 'GOPN54504C47BDAA8DE0']);
check('también en el cambio de equipo', payloadEnvioInventario({ ...cambioEquipo, finalizadoEn: 1, serialEquipo: 'GOPN56534F4C00E65D25' }).serial, 'VSOL00E65D25');
check('la plantilla lleva el serial tal como lo escribió el técnico', generarMensajeWhatsAppInstalacion({ ...cajaTpLink, plantillaOriginal: 'IS1\n*Mac:*\n*Instalador:*' }).includes('*Mac:* GOPN54504C47BDAA8DE0'), true);

// --- Verificación del serial del técnico (recuadro verde/rojo y bloqueo al pre-finalizar) ---
const estadoSerial = (s) => (({ estado, codigo }) => [estado, codigo])(evaluarSerialCaja(s));
check('verde: PON S/N de la etiqueta y las dos formas de caja con GPON', ['VSOL00E65D25', 'BTPTDD004F58', 'TPLGBDAA8DE0', 'GPONBTPTDD9BA588', 'GPON54504C47BDA9EC40', 'hwtc1a2b3c4d'].map(estadoSerial),
  [['ok', ''], ['ok', ''], ['ok', ''], ['ok', ''], ['ok', ''], ['ok', '']]);
check('rojo: "GOPN" mal escrito (aunque lo demás esté bien)', ['GOPN54504C47BDAA8DE0', 'GOPNBTPTDD9BA588'].map(estadoSerial), [['error', 'GOPN'], ['error', 'GOPN']]);
check('rojo: la MAC y lo que no tiene el formato', ['B46415E65D24', 'LP20250731266', 'AB1234', 'GPON00000000BDAA8DE0'].map(estadoSerial), [['error', 'MAC'], ['error', 'FORMATO'], ['error', 'FORMATO'], ['error', 'FORMATO']]);
check('vacío no es verde ni rojo (que sea obligatorio lo exige el formulario)', [estadoSerial(''), estadoSerial('   '), errorSerialCaja('')], [['vacio', ''], ['vacio', ''], '']);
check('errorSerialCaja: el mensaje que bloquea el pre-finalizar, o vacío si está bien', [errorSerialCaja('GOPN54504C47BDAA8DE0'), errorSerialCaja('VSOL00E65D25')], ['Dice GOPN: debe ser GPON. Revisa el serial de la caja.', '']);

// --- Historial ---
check('el historial dice qué se corrigió, con el valor nuevo', cambiosDatosTecnico(instalacionCompleta, { ...instalacionCompleta, ...validarDatosTecnico(instalacionCompleta, { ...f, serial: 'ZTEGC0123456', metraje: '95', postes: ['P1'], vlan: '200', puertosDisponibles: '4', intAzul: '0' }).datos }),
  ['Serial: ZTEGC0123456', 'VLAN: 200', 'Posteadura: P1', 'Metraje: 95 m', 'Puertos disponibles: 4', 'Conectores: Externo: 1 verde · Interno: 1 verde']);
check('si no cambió nada de estos datos no agrega líneas', cambiosDatosTecnico(instalacionCompleta, { ...instalacionCompleta, nombre: 'Otro nombre' }), []);
check('el historial de un cambio de equipo y de un recableado',
  [cambiosDatosTecnico(cambioEquipo, { ...cambioEquipo, serialEquipo: 'ZTEG00112233' }), cambiosDatosTecnico(recableado, { ...recableado, metrosCable: 55 }), cambiosDatosTecnico(recableado, { ...recableado, tipoVisita: 'DROP_ATENUADO', metrosCable: null, conectorExterno: '' })],
  [['Serial del equipo nuevo: ZTEG00112233'], ['Recableado: 55 m de cable, Conector externo: Verde'], ['Tipo de visita: Drop atenuado', 'Recableado: Sin datos']]);
check('el historial de una visita de conector con otras cantidades', cambiosDatosTecnico(visitaInterna, { ...visitaInterna, conectoresUsados: { verde: 3, azul: 0 } }), ['Conectores: 3 verdes']);

if (failures > 0) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las pruebas pasaron.');
