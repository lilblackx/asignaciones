// Prueba los datos que el técnico llena al instalar (src/utils/instalacion.js) y cómo se escriben en
// la plantilla de la promotora (src/utils/whatsapp.js). No necesita el emulador. Uso: `npm run test:instalacion`.
import {
  detalleInstalacion, esInstalacion, instalacionCompleta, limpiarPostes, napConPuerto, parseSerial, parseVlan, tieneDatosInstalacion, validarInstalacion,
} from '../src/utils/instalacion.js';
import { TEXTO_SIN_PLANTILLA, generarMensajeDesdePlantilla, generarMensajeWhatsAppInstalacion, ordenSinPlantilla } from '../src/utils/whatsapp.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- Tipo de trabajo ---
check('instalación se reconoce por el tipo de trabajo', ['INSTALACIÓN', 'instalacion', 'AVERÍA', '', undefined].map(esInstalacion), [true, true, false, false, false]);

// --- Serial ---
check('serial: se guarda en mayúsculas y sin espacios', ['hwtc1a2b3c4d', ' HWTC 1A2B 3C4D ', 'ZTEG-C0123456'].map(s => parseSerial(s).valor), ['HWTC1A2B3C4D', 'HWTC1A2B3C4D', 'ZTEG-C0123456']);
check('serial vacío no da error de formato (que sea obligatorio lo exige validarInstalacion)', parseSerial('').valor, '');
check('serial muy corto, muy largo o con símbolos no es válido', ['AB12', 'A'.repeat(25), 'HWTC1A2B3C4D!', 'ñandú1234', 'A4:BB:6D:1C:2E:3F'].map(s => Boolean(parseSerial(s).error)), [true, true, true, true, true]);

// --- VLAN ---
check('VLAN válida', ['1', '100', '4094', ' 0100 '].map(v => parseVlan(v).valor), ['1', '100', '4094', '100']);
check('VLAN vacía no da error de formato (que sea obligatoria lo exige validarInstalacion)', parseVlan('').valor, '');
check('VLAN fuera de 1-4094 o no numérica no es válida', ['0', '4095', '12345', 'abc', '10.5'].map(v => Boolean(parseVlan(v).error)), [true, true, true, true, true]);

// --- Postes y NAP ---
check('postes: se quitan los vacíos y los espacios de más', limpiarPostes(['  DM SN  N01B01 ', '', '   ', 'DM SN N01B02']), ['DM SN N01B01', 'DM SN N01B02']);
check('postes: máximo 10', limpiarPostes(Array.from({ length: 14 }, (_, i) => `P${i + 1}`)).length, 10);
check('NAP y puerto se juntan en un texto', [napConPuerto('M05F11', '3'), napConPuerto(' NAP 08 ', ''), napConPuerto('', '3'), napConPuerto('', '')], ['M05F11 - Puerto 3', 'NAP 08', 'Puerto 3', '']);

// --- Lo que se guarda ---
const datos = validarInstalacion({ serial: 'hwtc1a2b3c4d', vlan: '100', postes: ['DM SN N01B01', ' ', 'DM SN N01B02'], nap: ' M05F11 ', puerto: '3', puertosDisponibles: ' 6 ' });
check('se guarda normalizado', datos, {
  datos: { serial: 'HWTC1A2B3C4D', vlan: '100', posteadura: ['DM SN N01B01', 'DM SN N01B02'], nap: 'M05F11', puerto: '3', puertosDisponibles: '6' }, errores: {}, error: false,
});
check('puertos disponibles: texto libre, con espacios limpios y un máximo de 30', [validarInstalacion({ puertosDisponibles: '3,  5 ,8' }).datos.puertosDisponibles, validarInstalacion({ puertosDisponibles: '9'.repeat(40) }).datos.puertosDisponibles.length], ['3, 5 ,8', 30]);
check('un dato inválido se informa por campo',
  (({ errores, error }) => ({ campos: Object.keys(errores), error }))(validarInstalacion({ serial: 'xx', vlan: '9999', postes: ['P1'], puertosDisponibles: '6' })), { campos: ['serial', 'vlan'], error: true });
check('el serial, la VLAN, al menos un poste y los puertos disponibles son obligatorios',
  validarInstalacion({ nap: 'M05F11', puerto: '3', postes: ['  ', ''] }).errores,
  { serial: 'Escribe el serial de la ONU.', vlan: 'Escribe la VLAN.', posteadura: 'Agrega al menos un poste.', puertosDisponibles: 'Indica los puertos disponibles de la NAP. Si no queda ninguno, escribe 0.' });
check('con serial, VLAN, un poste y los puertos disponibles no falta nada', validarInstalacion({ serial: 'HWTC1A2B3C4D', vlan: '100', postes: ['P1'], puertosDisponibles: '6' }).error, false);
check('"0" cuenta como llenado (no queda ningún puerto); vacío o solo espacios, no',
  ['0', ' 0 ', '', '   ', undefined].map(p => validarInstalacion({ serial: 'HWTC1A2B3C4D', vlan: '100', postes: ['P1'], puertosDisponibles: p }).error), [false, false, true, true, true]);
check('un 0 se guarda como "0" y sale en la plantilla', [validarInstalacion({ puertosDisponibles: 0 }).datos.puertosDisponibles, validarInstalacion({ puertosDisponibles: '0' }).datos.puertosDisponibles], ['0', '0']);
check('instalación completa: serial, VLAN, postes, NAP real y puerto',
  [datos.datos, { ...datos.datos, nap: 'SN' }, { ...datos.datos, nap: '' }, { ...datos.datos, puerto: '' }, { ...datos.datos, posteadura: [] }, { ...datos.datos, vlan: '' }, { ...datos.datos, puertosDisponibles: '' }, { ...datos.datos, puertosDisponibles: '0' }].map(d => instalacionCompleta({ instalacion: d })).concat([instalacionCompleta({}), instalacionCompleta(null)]),
  [true, false, false, false, false, false, false, true, false, false]);
check('revalidar lo ya guardado da lo mismo (la clave guardada es "posteadura")', validarInstalacion(datos.datos).datos, datos.datos);
check('hay datos si se llenó algo', [{}, { posteadura: [] }, { posteadura: ['P1'] }, { puerto: '3' }, { puertosDisponibles: '6' }, null].map(tieneDatosInstalacion), [false, false, true, true, true, false]);
check('historial', detalleInstalacion(datos.datos), ' | Serial: HWTC1A2B3C4D | VLAN: 100 | Posteadura: DM SN N01B01, DM SN N01B02 | Puerto: 3 | Puertos disponibles: 6');
check('historial sin datos', detalleInstalacion(null), '');

// --- Plantilla de la promotora ---
// La plantilla tiene que seguir siendo, siempre, la de la promotora: lo único que cambia es que sus
// campos vacíos (serial, VLAN, posteadura, NAP, puerto y puertos disponibles) se completan con lo que
// el técnico llenó al pre-finalizar. Esta es la de ejemplo de la operación, tal como la pega la promotora.
const PLANTILLA = `I000000
*Mac:*
*Vlan:*
*Posteadura:*
*Nap:*


*Cliente conecta en el puerto N°:*

*PUERTOS DISPONIBLES:*

*Nombres  Completos:*  Daniel José Santana Gonzales
*C.I:* 13529838
*NRO de teléfono:* 04146649644
*Correo electrónico:*  bordays@gmail.com
*Dirección completa:* Barrio pedregal calle 92 casa  #82A-12
*Servicio a Contratar:* MR
*Condición*
*Plan a contratar:* 200mg x 17$
*Drop:*
*Forma de pago:* 45$
*Promotora:* sariana
*Fuente:*  Sariana
*Instalador:*
*Observación:* La clienta cancela 45$ Por la Instalación, le toca Cancelar Nuevamente Entre los Primeros 5 días del mes de Noviembre  17$
*NOTA:* Se puede hacer del M05F11 a 150m con 6 puertos libres
`;
// El técnico ya pre-finalizó: desde ahí la plantilla lleva sus datos.
const orden = { plantillaOriginal: PLANTILLA, codigo: 'IS0042', tecnico: 'LUIS PEREZ', estado: 'PRE-FINALIZADO' };

// Lo que sale hoy sin datos del técnico: es exactamente lo que salía antes de existir estos campos
// (con su correlativo, el instalador y el formato de negritas ya normalizado). No debe cambiar nunca.
const COMO_SIEMPRE = 'IS0042\n*Mac:*\n*Vlan:*\n*Posteadura:*\n*Nap:*\n\n\n*Cliente conecta en el puerto N°:*\n\n*PUERTOS DISPONIBLES:*\n\n*Nombres  Completos:*  Daniel José Santana Gonzales\n*C.I:* 13529838\n*NRO de teléfono:* 04146649644\n*Correo electrónico:*  bordays@gmail.com\n*Dirección completa:* Barrio pedregal calle 92 casa  #82A-12\n*Servicio a Contratar:* MR\n*Condición:*\n*Plan a contratar:* 200mg x 17$\n*Drop:*\n*Forma de pago:* 45$\n*Promotora:* sariana\n*Fuente:*  Sariana\n*Instalador:* LUIS PEREZ\n*Observación:* La clienta cancela 45$ Por la Instalación, le toca Cancelar Nuevamente Entre los Primeros 5 días del mes de Noviembre  17$\n*NOTA:* Se puede hacer del M05F11 a 150m con 6 puertos libres\n';
check('sin datos del técnico la plantilla sale exactamente como siempre', generarMensajeWhatsAppInstalacion(orden), COMO_SIEMPRE);
check('con instalacion vacía o sin llenar tampoco cambia nada',
  [{ instalacion: null }, { instalacion: {} }, { instalacion: { serial: '', vlan: '', posteadura: [], nap: '', puerto: '', puertosDisponibles: '' } }].map(extra => generarMensajeWhatsAppInstalacion({ ...orden, ...extra })),
  [COMO_SIEMPRE, COMO_SIEMPRE, COMO_SIEMPRE]);

// Con todo lo que llenó el técnico: la misma plantilla, solo con esos seis campos completos.
const LLENA = COMO_SIEMPRE
  .replace('*Mac:*\n', '*Mac:* HWTC1A2B3C4D\n')
  .replace('*Vlan:*\n', '*Vlan:* 100\n')
  .replace('*Posteadura:*\n', '*Posteadura:* DM SN N01B01, DM SN N01B02\n')
  .replace('*Nap:*\n', '*Nap:* M05F11\n')
  .replace('*Cliente conecta en el puerto N°:*\n', '*Cliente conecta en el puerto N°:* 3\n')
  .replace('*PUERTOS DISPONIBLES:*\n', '*PUERTOS DISPONIBLES:* 6\n');
const completa = generarMensajeWhatsAppInstalacion({ ...orden, instalacion: datos.datos });
check('con los datos del técnico se completan los campos vacíos y nada más', completa, LLENA);
check('las líneas que cambian son solo las seis de esos campos',
  completa.split('\n').map((l, i) => (l !== COMO_SIEMPRE.split('\n')[i] ? i : null)).filter(i => i !== null), [1, 2, 3, 4, 7, 9]);
check('mismo número de líneas, sin agregar ni quitar ninguna', completa.split('\n').length, COMO_SIEMPRE.split('\n').length);
check('la plantilla completa (así la copia el técnico)', completa.split('\n').slice(0, 10), ['IS0042', '*Mac:* HWTC1A2B3C4D', '*Vlan:* 100', '*Posteadura:* DM SN N01B01, DM SN N01B02', '*Nap:* M05F11', '', '', '*Cliente conecta en el puerto N°:* 3', '', '*PUERTOS DISPONIBLES:* 6']);

// Antes de pre-finalizar (o si la devuelven al técnico) la plantilla es la original, con los campos vacíos,
// aunque la orden conserve datos de antes; desde que se pre-finaliza (y ya finalizada) lleva los del técnico.
check('mientras no esté pre-finalizada sale la plantilla original, con los campos vacíos',
  ['PENDIENTE', 'CANCELADO', 'ELIMINADO', undefined].map(estado => generarMensajeWhatsAppInstalacion({ ...orden, estado, instalacion: datos.datos })),
  Array(4).fill(COMO_SIEMPRE));
check('pre-finalizada o finalizada la plantilla lleva los datos del técnico',
  ['PRE-FINALIZADO', 'PRE-FINALIZADA', 'FINALIZADO'].map(estado => generarMensajeWhatsAppInstalacion({ ...orden, estado, instalacion: datos.datos })),
  Array(3).fill(LLENA));
check('la copia desde otro tipo de mensaje (reconexión/plantilla) sigue la misma regla',
  [generarMensajeDesdePlantilla({ ...orden, estado: 'PENDIENTE', instalacion: datos.datos }), generarMensajeDesdePlantilla({ ...orden, instalacion: datos.datos })], [COMO_SIEMPRE, LLENA]);

// Solo lo que el técnico llenó: lo demás queda vacío, como lo mandó la promotora.
const soloNapYPuerto = generarMensajeDesdePlantilla({ ...orden, instalacion: { serial: '', vlan: '', posteadura: [], nap: 'N10D14', puerto: '12', puertosDisponibles: '' } });
check('lo que el técnico no llenó se queda vacío', soloNapYPuerto,
  COMO_SIEMPRE.replace('*Nap:*\n', '*Nap:* N10D14\n').replace('*Cliente conecta en el puerto N°:*\n', '*Cliente conecta en el puerto N°:* 12\n'));

// Lo que la promotora ya escribió se respeta: solo se completan los campos vacíos.
const conValoresDeLaPromotora = PLANTILLA.replace(/\*Vlan:\* *(?=\r?\n)/, '*Vlan:* 55').replace(/\*Nap:\* *(?=\r?\n)/, '*Nap:* O10H37');
const respetada = generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: conValoresDeLaPromotora, instalacion: datos.datos }).split('\n');
check('un valor que la promotora ya escribió no se toca', [respetada[1], respetada[2], respetada[3], respetada[4]], ['*Mac:* HWTC1A2B3C4D', '*Vlan:* 55', '*Posteadura:* DM SN N01B01, DM SN N01B02', '*Nap:* O10H37']);

const valorAbajo = generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: 'X1\n*Mac:*\nA4BB6D1C2E3F\n*Vlan:*\n*Nap:*\n*Instalador:*', instalacion: datos.datos });
check('si la promotora escribió el valor en la línea de abajo, se respeta', valorAbajo, 'IS0042\n*Mac:*\nA4BB6D1C2E3F\n*Vlan:* 100\n*Nap:* M05F11\n*Instalador:* LUIS PEREZ');

const conSerialEnSuLinea = generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: PLANTILLA.replace('*Mac:*', '*Serial:*'), instalacion: { serial: 'HWTC1A2B3C4D' } }).split('\n');
check('si la promotora nombra la línea "Serial", ahí se completa', conSerialEnSuLinea[1], '*Serial:* HWTC1A2B3C4D');

// Nunca se agregan líneas: si la plantilla no trae el campo, no sale en el mensaje.
const sinEtiquetas = 'X1\n*Nombres Completos:* Ana\n*Instalador:*';
check('si la plantilla no trae esas líneas no se agrega ninguna',
  generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: sinEtiquetas, instalacion: datos.datos }),
  generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: sinEtiquetas }));

// Sin la plantilla de la promotora pegada no hay plantilla que copiar (instalaciones y reconexiones): la app nunca
// arma una por su cuenta (se evitan errores con las plantillas) y el botón de copiar queda deshabilitado.
check('instalación o reconexión sin plantilla pegada: no hay plantilla (botón deshabilitado)',
  [
    { tipoTrabajo: 'INSTALACIÓN' }, { tipoTrabajo: 'INSTALACIÓN', plantillaOriginal: '' }, { tipoTrabajo: 'INSTALACIÓN', plantillaOriginal: '  \n ' }, { tipoTrabajo: 'instalacion', plantillaOriginal: null },
    { tipoTrabajo: 'RECONEXIÓN' }, { tipoTrabajo: 'RECONEXIÓN', plantillaOriginal: '  ' },
  ].map(ordenSinPlantilla), [true, true, true, true, true, true]);
check('instalación o reconexión con la plantilla pegada: se puede copiar', [{ tipoTrabajo: 'INSTALACIÓN', plantillaOriginal: PLANTILLA }, { tipoTrabajo: 'RECONEXIÓN', plantillaOriginal: PLANTILLA }].map(ordenSinPlantilla), [false, false]);
check('los demás tipos de orden no dependen de la plantilla de la promotora',
  ['AVERÍA', 'MUDANZA', 'GARANTIA', 'VALIDACION NAP', ''].map(tipoTrabajo => ordenSinPlantilla({ tipoTrabajo })), [false, false, false, false, false]);
check('el mensaje de una instalación sin plantilla pegada sale vacío: nunca se inventa una',
  [{ tipoTrabajo: 'INSTALACIÓN', codigo: 'IO66', nombre: 'Ana', tecnico: 'X' }, { plantillaOriginal: '   ', codigo: 'IO66', estado: 'PRE-FINALIZADO', instalacion: datos.datos }].map(generarMensajeWhatsAppInstalacion), ['', '']);
check('hay un texto que explica por qué no se puede copiar', typeof TEXTO_SIN_PLANTILLA === 'string' && TEXTO_SIN_PLANTILLA.length > 20, true);

// Las reconexiones no cambian.
const reconexion = { plantillaOriginal: 'RS5\n*Nombres Completos:* Pedro\n*Observación:* reconexión\n*Instalador:*', codigo: 'RS5', tecnico: 'ANA' };
check('una reconexión no cambia', generarMensajeDesdePlantilla({ ...reconexion, instalacion: datos.datos }), generarMensajeDesdePlantilla(reconexion));

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
