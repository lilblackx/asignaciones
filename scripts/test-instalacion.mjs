// Prueba los datos que el técnico llena al instalar (src/utils/instalacion.js) y cómo se escriben en
// la plantilla de la promotora (src/utils/whatsapp.js). No necesita el emulador. Uso: `npm run test:instalacion`.
import {
  detalleInstalacion, esInstalacion, faltantesInstalacion, instalacionCompleta, limpiarPostes, metrajeInstalacion, napConPuerto, parseMetraje, parseSerial, parseVlan, tieneDatosInstalacion, validarInstalacion,
} from '../src/utils/instalacion.js';
import { readFileSync } from 'node:fs';
import { conectoresDeInstalacion, errorConectoresInstalacion, normalizarConectoresInstalacion, parseConectoresInstalacion, textoConectoresInstalacion } from '../src/utils/conectoresInstalacion.js';
import { datosAutorizacion } from '../src/utils/datosAutorizacion.js';
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

// --- Metraje (los metros de cable del drop; obligatorio) ---
check('metraje válido: metros enteros', ['1', '120', ' 0150 ', '9999'].map(m => parseMetraje(m).valor), [1, 120, 150, 9999]);
check('metraje vacío no da error de formato (que sea obligatorio lo exige validarInstalacion)', [parseMetraje('').valor, parseMetraje(undefined).valor, parseMetraje('   ').valor], [null, null, null]);
check('metraje en cero, con decimales, negativo, con letras o de más de 4 cifras no es válido', ['0', '12.5', '-3', '12m', 'abc', '10000'].map(m => Boolean(parseMetraje(m).error)), [true, true, true, true, true, true]);
check('metrajeInstalacion: el número de metros o null si no hay',
  [{ instalacion: { metraje: 120 } }, { instalacion: { metraje: '85' } }, { instalacion: { metraje: null } }, { instalacion: { metraje: 0 } }, { instalacion: {} }, {}, null].map(metrajeInstalacion), [120, 85, null, null, null, null, null]);

// --- Postes y NAP ---
check('postes: se quitan los vacíos y los espacios de más', limpiarPostes(['  DM SN  N01B01 ', '', '   ', 'DM SN N01B02']), ['DM SN N01B01', 'DM SN N01B02']);
check('postes: máximo 10', limpiarPostes(Array.from({ length: 14 }, (_, i) => `P${i + 1}`)).length, 10);
check('NAP y puerto se juntan en un texto', [napConPuerto('M05F11', '3'), napConPuerto(' NAP 08 ', ''), napConPuerto('', '3'), napConPuerto('', '')], ['M05F11 - Puerto 3', 'NAP 08', 'Puerto 3', '']);

// --- Lo que se guarda ---
const datos = validarInstalacion({ serial: 'hwtc1a2b3c4d', vlan: '100', postes: ['DM SN N01B01', ' ', 'DM SN N01B02'], metraje: ' 120 ', nap: ' M05F11 ', puerto: '3', puertosDisponibles: ' 6 ' });
check('se guarda normalizado', datos, {
  datos: { serial: 'HWTC1A2B3C4D', vlan: '100', posteadura: ['DM SN N01B01', 'DM SN N01B02'], metraje: 120, nap: 'M05F11', puerto: '3', puertosDisponibles: '6' }, errores: {}, error: false,
});
check('puertos disponibles: texto libre, con espacios limpios y un máximo de 30', [validarInstalacion({ puertosDisponibles: '3,  5 ,8' }).datos.puertosDisponibles, validarInstalacion({ puertosDisponibles: '9'.repeat(40) }).datos.puertosDisponibles.length], ['3, 5 ,8', 30]);
check('un dato inválido se informa por campo',
  (({ errores, error }) => ({ campos: Object.keys(errores), error }))(validarInstalacion({ serial: 'xx', vlan: '9999', postes: ['P1'], metraje: '120', puertosDisponibles: '6' })), { campos: ['serial', 'vlan'], error: true });
check('el serial, la VLAN, al menos un poste, el metraje y los puertos disponibles son obligatorios',
  validarInstalacion({ nap: 'M05F11', puerto: '3', postes: ['  ', ''] }).errores,
  { serial: 'Escribe el serial de la ONU.', vlan: 'Escribe la VLAN.', posteadura: 'Agrega al menos un poste.', metraje: 'Indica el metraje de cable usado en la instalación.', puertosDisponibles: 'Indica los puertos disponibles de la NAP. Si no queda ninguno, escribe 0.' });
check('con serial, VLAN, un poste, el metraje y los puertos disponibles no falta nada', validarInstalacion({ serial: 'HWTC1A2B3C4D', vlan: '100', postes: ['P1'], metraje: '120', puertosDisponibles: '6' }).error, false);
check('sin metraje (o en 0) la instalación no está completa', ['', '0', undefined].map(m => validarInstalacion({ serial: 'HWTC1A2B3C4D', vlan: '100', postes: ['P1'], metraje: m, puertosDisponibles: '6' }).errores.metraje), ['Indica el metraje de cable usado en la instalación.', 'El metraje debe ser mayor a 0.', 'Indica el metraje de cable usado en la instalación.']);
check('"0" cuenta como llenado (no queda ningún puerto); vacío o solo espacios, no',
  ['0', ' 0 ', '', '   ', undefined].map(p => validarInstalacion({ serial: 'HWTC1A2B3C4D', vlan: '100', postes: ['P1'], metraje: '120', puertosDisponibles: p }).error), [false, false, true, true, true]);
check('un 0 se guarda como "0" y sale en la plantilla', [validarInstalacion({ puertosDisponibles: 0 }).datos.puertosDisponibles, validarInstalacion({ puertosDisponibles: '0' }).datos.puertosDisponibles], ['0', '0']);
check('instalación completa: serial, VLAN, postes, metraje, NAP real y puerto',
  [datos.datos, { ...datos.datos, nap: 'SN' }, { ...datos.datos, nap: '' }, { ...datos.datos, puerto: '' }, { ...datos.datos, posteadura: [] }, { ...datos.datos, vlan: '' }, { ...datos.datos, puertosDisponibles: '' }, { ...datos.datos, puertosDisponibles: '0' }, { ...datos.datos, metraje: null }, { ...datos.datos, metraje: 0 }, (({ metraje, ...sinMetraje }) => sinMetraje)(datos.datos)].map(d => instalacionCompleta({ instalacion: d })).concat([instalacionCompleta({}), instalacionCompleta(null)]),
  [true, false, false, false, false, false, false, true, false, false, false, false, false]);
check('revalidar lo ya guardado da lo mismo (la clave guardada es "posteadura")', validarInstalacion(datos.datos).datos, datos.datos);
check('hay datos si se llenó algo', [{}, { posteadura: [] }, { posteadura: ['P1'] }, { puerto: '3' }, { puertosDisponibles: '6' }, { metraje: 120 }, { metraje: null }, null].map(tieneDatosInstalacion), [false, false, true, true, true, true, false, false]);
check('historial', detalleInstalacion(datos.datos), ' | Serial: HWTC1A2B3C4D | VLAN: 100 | Posteadura: DM SN N01B01, DM SN N01B02 | Metraje: 120 m | Puerto: 3 | Puertos disponibles: 6');
check('historial sin datos', detalleInstalacion(null), '');

// --- Conectores usados en la instalación (externos e internos, por color; obligatorio al pre-finalizar) ---
const conectoresOk = { externo: { verde: 1 }, interno: { verde: 1, azul: 2 } };
check('conectores: lo que escribe el técnico se guarda como externo (verde) e interno (verde y azul)', parseConectoresInstalacion({ externoVerde: '1', internoVerde: '1', internoAzul: '2' }).valor, conectoresOk);
check('conectores: un campo vacío cuenta como 0 y basta con uno', [parseConectoresInstalacion({ externoVerde: '', internoVerde: '', internoAzul: '1' }).valor, parseConectoresInstalacion({ externoVerde: '2' }).valor],
  [{ externo: { verde: 0 }, interno: { verde: 0, azul: 1 } }, { externo: { verde: 2 }, interno: { verde: 0, azul: 0 } }]);
check('conectores: sin ninguno (todo en 0 o vacío) no es válido, es obligatorio al menos 1', [{}, { externoVerde: '0', internoVerde: '0', internoAzul: '0' }, { externoVerde: ' ' }].map(c => Boolean(parseConectoresInstalacion(c).error)), [true, true, true]);
check('conectores: con letras, decimales, negativos o más de 10 por color no es válido y dice qué campo',
  [{ externoVerde: 'a' }, { internoVerde: '1.5' }, { internoAzul: '-1' }, { externoVerde: '11' }, { internoAzul: '123' }].map(c => parseConectoresInstalacion(c).campo), ['externoVerde', 'internoVerde', 'internoAzul', 'externoVerde', 'internoAzul']);
check('conectores: 10 por color es el tope', parseConectoresInstalacion({ externoVerde: '10', internoVerde: '10', internoAzul: '10' }).valor, { externo: { verde: 10 }, interno: { verde: 10, azul: 10 } });
check('conectores: la comprobación de lo ya guardado exige al menos 1 y rechaza lo que falta o está mal',
  [conectoresOk, { externo: { verde: 0 }, interno: { verde: 0, azul: 0 } }, undefined, null, 'x', { externo: { verde: 11 }, interno: {} }].map((c) => Boolean(errorConectoresInstalacion(c))), [false, true, true, true, true, true]);
check('conectores: normalizar deja siempre la misma forma y descarta lo que no sea un entero de 0 a 10',
  [normalizarConectoresInstalacion(undefined), normalizarConectoresInstalacion({ externo: { verde: 3 }, interno: { azul: '2', verde: -1 } }), normalizarConectoresInstalacion({ externo: { verde: 99 } })],
  [{ externo: { verde: 0 }, interno: { verde: 0, azul: 0 } }, { externo: { verde: 3 }, interno: { verde: 0, azul: 0 } }, { externo: { verde: 10 }, interno: { verde: 0, azul: 0 } }]);
check('conectores: por color suman externo e interno; una instalación anterior (sin el dato) cuenta 0',
  [conectoresDeInstalacion({ instalacion: { conectores: conectoresOk } }), conectoresDeInstalacion({ instalacion: { serial: 'X' } }), conectoresDeInstalacion({}), conectoresDeInstalacion(null)],
  [{ verde: 2, azul: 2 }, { verde: 0, azul: 0 }, { verde: 0, azul: 0 }, { verde: 0, azul: 0 }]);
check('conectores: el texto dice el tipo y el color, solo de lo usado', [textoConectoresInstalacion(conectoresOk), textoConectoresInstalacion({ externo: { verde: 2 }, interno: { verde: 0, azul: 0 } }), textoConectoresInstalacion({ externo: { verde: 0 }, interno: { verde: 0, azul: 1 } }), textoConectoresInstalacion(undefined)],
  ['Externo: 1 verde · Interno: 1 verde, 2 azules', 'Externo: 2 verdes', 'Interno: 1 azul', '']);
check('conectores: validarInstalacion no los exige (las instalaciones anteriores no los tienen y no quedan bloqueadas)', [validarInstalacion(datos.datos).error, instalacionCompleta({ instalacion: datos.datos })], [false, true]);
check('conectores: no alteran los datos obligatorios ya guardados', instalacionCompleta({ instalacion: { ...datos.datos, conectores: conectoresOk } }), true);
check('conectores: cuentan como "hay datos" y salen en el historial', [tieneDatosInstalacion({ conectores: conectoresOk }), tieneDatosInstalacion({ conectores: { externo: { verde: 0 }, interno: { verde: 0, azul: 0 } } }), detalleInstalacion({ ...datos.datos, conectores: conectoresOk })],
  [true, false, ' | Serial: HWTC1A2B3C4D | VLAN: 100 | Posteadura: DM SN N01B01, DM SN N01B02 | Metraje: 120 m | Puerto: 3 | Puertos disponibles: 6 | Conectores: Externo: 1 verde · Interno: 1 verde, 2 azules']);

// --- Qué le falta a una instalación (el aviso al finalizar o aprobar) ---
const instalacionOk = { tipoTrabajo: 'INSTALACIÓN', instalacion: datos.datos };
check('una instalación completa no tiene faltantes', faltantesInstalacion(instalacionOk), []);
check('una instalación sin nada registrado lista todo, con los nombres y el orden de la revisión',
  faltantesInstalacion({ tipoTrabajo: 'INSTALACIÓN' }), ['Serial', 'VLAN', 'NAP', 'Puerto', 'Drop', 'Posteadura', 'Puertos disponibles']);
check('solo lista lo que falta', [
  faltantesInstalacion({ ...instalacionOk, instalacion: { ...datos.datos, metraje: null } }),
  faltantesInstalacion({ ...instalacionOk, instalacion: { ...datos.datos, serial: '', vlan: '' } }),
  faltantesInstalacion({ ...instalacionOk, instalacion: { ...datos.datos, nap: 'SN', puerto: '' } }),
  faltantesInstalacion({ ...instalacionOk, instalacion: { ...datos.datos, posteadura: [], puertosDisponibles: '' } }),
], [['Drop'], ['Serial', 'VLAN'], ['NAP', 'Puerto'], ['Posteadura', 'Puertos disponibles']]);
check('una instalación anterior al metraje (sin drop) lo marca', faltantesInstalacion({ ...instalacionOk, instalacion: (({ metraje, ...resto }) => resto)(datos.datos) }), ['Drop']);
check('un dato inválido cuenta como faltante', faltantesInstalacion({ ...instalacionOk, instalacion: { ...datos.datos, vlan: '9999' } }), ['VLAN']);
check('una orden que no es instalación nunca tiene faltantes', [faltantesInstalacion({ tipoTrabajo: 'AVERÍA' }), faltantesInstalacion({}), faltantesInstalacion(null)], [[], [], []]);

// --- Plantilla de la promotora ---
// La plantilla tiene que seguir siendo, siempre, la de la promotora: lo único que cambia es que sus
// campos vacíos (serial, VLAN, posteadura, metraje en "Drop", NAP, puerto y puertos disponibles) se completan con lo que
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
  [{ instalacion: null }, { instalacion: {} }, { instalacion: { serial: '', vlan: '', posteadura: [], metraje: null, nap: '', puerto: '', puertosDisponibles: '' } }].map(extra => generarMensajeWhatsAppInstalacion({ ...orden, ...extra })),
  [COMO_SIEMPRE, COMO_SIEMPRE, COMO_SIEMPRE]);

// Con todo lo que llenó el técnico: la misma plantilla, solo con esos siete campos completos (el metraje va en "Drop:").
const LLENA = COMO_SIEMPRE
  .replace('*Mac:*\n', '*Mac:* HWTC1A2B3C4D\n')
  .replace('*Vlan:*\n', '*Vlan:* 100\n')
  .replace('*Posteadura:*\n', '*Posteadura:* DM SN N01B01, DM SN N01B02\n')
  .replace('*Nap:*\n', '*Nap:* M05F11\n')
  .replace('*Cliente conecta en el puerto N°:*\n', '*Cliente conecta en el puerto N°:* 3\n')
  .replace('*PUERTOS DISPONIBLES:*\n', '*PUERTOS DISPONIBLES:* 6\n')
  .replace('*Drop:*\n', '*Drop:* 120 m\n');
const completa = generarMensajeWhatsAppInstalacion({ ...orden, instalacion: datos.datos });
check('con los datos del técnico se completan los campos vacíos y nada más', completa, LLENA);
check('las líneas que cambian son solo las siete de esos campos',
  completa.split('\n').map((l, i) => (l !== COMO_SIEMPRE.split('\n')[i] ? i : null)).filter(i => i !== null), [1, 2, 3, 4, 7, 9, 19]);
check('mismo número de líneas, sin agregar ni quitar ninguna', completa.split('\n').length, COMO_SIEMPRE.split('\n').length);
check('la plantilla completa (así la copia el técnico)', completa.split('\n').slice(0, 10), ['IS0042', '*Mac:* HWTC1A2B3C4D', '*Vlan:* 100', '*Posteadura:* DM SN N01B01, DM SN N01B02', '*Nap:* M05F11', '', '', '*Cliente conecta en el puerto N°:* 3', '', '*PUERTOS DISPONIBLES:* 6']);

// Antes de pre-finalizar (o si la devuelven al técnico) la plantilla es la original, con los campos vacíos,
// aunque la orden conserve datos de antes; desde que se pre-finaliza (y ya finalizada) lleva los del técnico.
check('mientras no esté pre-finalizada sale la plantilla original, con los campos vacíos',
  ['PENDIENTE', 'CANCELADO', undefined].map(estado => generarMensajeWhatsAppInstalacion({ ...orden, estado, instalacion: datos.datos })),
  Array(3).fill(COMO_SIEMPRE));
check('pre-finalizada o finalizada la plantilla lleva los datos del técnico',
  ['PRE-FINALIZADO', 'PRE-FINALIZADA', 'FINALIZADO'].map(estado => generarMensajeWhatsAppInstalacion({ ...orden, estado, instalacion: datos.datos })),
  Array(3).fill(LLENA));
check('la copia desde otro tipo de mensaje (reconexión/plantilla) sigue la misma regla',
  [generarMensajeDesdePlantilla({ ...orden, estado: 'PENDIENTE', instalacion: datos.datos }), generarMensajeDesdePlantilla({ ...orden, instalacion: datos.datos })], [COMO_SIEMPRE, LLENA]);

// Solo lo que el técnico llenó: lo demás queda vacío, como lo mandó la promotora.
const soloNapYPuerto = generarMensajeDesdePlantilla({ ...orden, instalacion: { serial: '', vlan: '', posteadura: [], metraje: null, nap: 'N10D14', puerto: '12', puertosDisponibles: '' } });
check('lo que el técnico no llenó se queda vacío', soloNapYPuerto,
  COMO_SIEMPRE.replace('*Nap:*\n', '*Nap:* N10D14\n').replace('*Cliente conecta en el puerto N°:*\n', '*Cliente conecta en el puerto N°:* 12\n'));

// Lo que la promotora ya escribió se respeta: solo se completan los campos vacíos.
const conValoresDeLaPromotora = PLANTILLA.replace(/\*Vlan:\* *(?=\r?\n)/, '*Vlan:* 55').replace(/\*Nap:\* *(?=\r?\n)/, '*Nap:* O10H37');
const respetada = generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: conValoresDeLaPromotora, instalacion: datos.datos }).split('\n');
check('un valor que la promotora ya escribió no se toca', [respetada[1], respetada[2], respetada[3], respetada[4]], ['*Mac:* HWTC1A2B3C4D', '*Vlan:* 55', '*Posteadura:* DM SN N01B01, DM SN N01B02', '*Nap:* O10H37']);

// El metraje se escribe solo en la línea "Drop:": no existe otra ("Metraje", "Metros") que se llene.
const soloMetraje = (plantilla, metraje = 120) => generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: plantilla, instalacion: { metraje } });
check('el metraje se escribe en "Drop:" con la unidad', soloMetraje(PLANTILLA).split('\n')[19], '*Drop:* 120 m');
check('un "Drop:" que la promotora ya llenó no se toca', soloMetraje(PLANTILLA.replace('*Drop:*', '*Drop:* 80m')).split('\n')[19], '*Drop:* 80m');
check('con el valor de "Drop" en la línea de abajo tampoco se toca', soloMetraje('X1\n*Drop:*\n80m\n*Instalador:*'), 'IS0042\n*Drop:*\n80m\n*Instalador:* LUIS PEREZ');
check('sin línea "Drop:" no se agrega nada', soloMetraje('X1\n*Mac:*\n*Instalador:*'), 'IS0042\n*Mac:*\n*Instalador:* LUIS PEREZ');
check('"Metraje" y "Metros" no son la línea del metraje: no se completan', soloMetraje('X1\n*Metraje:*\n*Metros:*\n*Instalador:*'), 'IS0042\n*Metraje:*\n*Metros:*\n*Instalador:* LUIS PEREZ');
check('sin metraje guardado "Drop:" queda como lo mandó la promotora', soloMetraje(PLANTILLA, null).split('\n')[19], '*Drop:*');

const valorAbajo = generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: 'X1\n*Mac:*\nA4BB6D1C2E3F\n*Vlan:*\n*Nap:*\n*Instalador:*', instalacion: datos.datos });
check('si la promotora escribió el valor en la línea de abajo, se respeta', valorAbajo, 'IS0042\n*Mac:*\nA4BB6D1C2E3F\n*Vlan:* 100\n*Nap:* M05F11\n*Instalador:* LUIS PEREZ');

const conSerialEnSuLinea = generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: PLANTILLA.replace('*Mac:*', '*Serial:*'), instalacion: { serial: 'HWTC1A2B3C4D' } }).split('\n');
check('si la promotora nombra la línea "Serial", ahí se completa', conSerialEnSuLinea[1], '*Serial:* HWTC1A2B3C4D');

// Nunca se agregan líneas: si la plantilla no trae el campo, no sale en el mensaje.
const sinEtiquetas = 'X1\n*Nombres Completos:* Ana\n*Instalador:*';
check('si la plantilla no trae esas líneas no se agrega ninguna',
  generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: sinEtiquetas, instalacion: datos.datos }),
  generarMensajeWhatsAppInstalacion({ ...orden, plantillaOriginal: sinEtiquetas }));

// Una instalación sin la plantilla de la promotora pegada no tiene plantilla que copiar: la app nunca arma una por su cuenta (se evitan
// errores con las plantillas) y el botón de copiar queda deshabilitado. Una reconexión sin ella sí se copia, en el formato de la app.
check('instalación sin plantilla pegada: no hay plantilla (botón deshabilitado)',
  [
    { tipoTrabajo: 'INSTALACIÓN' }, { tipoTrabajo: 'INSTALACIÓN', plantillaOriginal: '' }, { tipoTrabajo: 'INSTALACIÓN', plantillaOriginal: '  \n ' }, { tipoTrabajo: 'instalacion', plantillaOriginal: null },
  ].map(ordenSinPlantilla), [true, true, true, true]);
check('reconexión sin la plantilla de la promotora: se puede copiar (sale en el formato de la app)',
  [{ tipoTrabajo: 'RECONEXIÓN' }, { tipoTrabajo: 'RECONEXIÓN', plantillaOriginal: '  ' }, { tipoTrabajo: 'reconexion' }].map(ordenSinPlantilla), [false, false, false]);
check('instalación o reconexión con la plantilla pegada: se puede copiar', [{ tipoTrabajo: 'INSTALACIÓN', plantillaOriginal: PLANTILLA }, { tipoTrabajo: 'RECONEXIÓN', plantillaOriginal: PLANTILLA }].map(ordenSinPlantilla), [false, false]);
check('los demás tipos de orden no dependen de la plantilla de la promotora',
  ['AVERÍA', 'MUDANZA', 'GARANTIA', 'VALIDACION NAP', ''].map(tipoTrabajo => ordenSinPlantilla({ tipoTrabajo })), [false, false, false, false, false]);
check('el mensaje de una instalación sin plantilla pegada sale vacío: nunca se inventa una',
  [{ tipoTrabajo: 'INSTALACIÓN', codigo: 'IO66', nombre: 'Ana', tecnico: 'X' }, { plantillaOriginal: '   ', codigo: 'IO66', estado: 'PRE-FINALIZADO', instalacion: datos.datos }].map(generarMensajeWhatsAppInstalacion), ['', '']);
check('hay un texto que explica por qué no se puede copiar', typeof TEXTO_SIN_PLANTILLA === 'string' && TEXTO_SIN_PLANTILLA.length > 20, true);

// Las reconexiones no cambian.
const reconexion = { plantillaOriginal: 'RS5\n*Nombres Completos:* Pedro\n*Observación:* reconexión\n*Instalador:*', codigo: 'RS5', tecnico: 'ANA' };
check('una reconexión no cambia', generarMensajeDesdePlantilla({ ...reconexion, instalacion: datos.datos }), generarMensajeDesdePlantilla(reconexion));

// --- El formulario del técnico, el modal de revisión y el salto del cursor siguen el mismo orden ---
// Si se mueve un campo en un lado hay que moverlo en los otros: aquí se vigila (los tres se leen del código).
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const formulario = leer('../src/components/modals/DatosInstalacion.jsx');
const enFormulario = Object.entries({
  serial: formulario.indexOf('id="pf-serial"'), vlan: formulario.indexOf('id="pf-vlan"'), nap: formulario.indexOf('<NapPuertoCampos'),
  metraje: formulario.indexOf('id="pf-metraje"'), posteadura: formulario.indexOf('id="pf-postes-etiqueta"'), puertosDisponibles: formulario.indexOf('id="pf-puertos-disponibles"'),
}).sort((x, y) => x[1] - y[1]).map(([k]) => k);
const ORDEN = ['serial', 'vlan', 'nap', 'metraje', 'posteadura', 'puertosDisponibles']; // el puerto va junto a la NAP
check('formulario del técnico: orden de los campos', enFormulario, ORDEN);

const enRevision = datosAutorizacion({ ...instalacionOk, nombre: 'Ana', codigo: 'IO1' }).equipo.map(d => d.clave)
  .filter(c => c !== 'puerto').map(c => (c === 'drop' ? 'metraje' : c));
check('modal de revisión: mismo orden que el formulario', enRevision, ORDEN);

const NOMBRE_A_CLAVE = { 'Serial': 'serial', VLAN: 'vlan', NAP: 'nap', Puerto: 'puerto', Drop: 'metraje', Posteadura: 'posteadura', 'Puertos disponibles': 'puertosDisponibles' };
check('aviso de lo que falta: mismo orden',
  faltantesInstalacion({ tipoTrabajo: 'INSTALACIÓN' }).map(n => NOMBRE_A_CLAVE[n]).filter(c => c !== 'puerto'), ORDEN);

const modal = leer('../src/components/modals/PreFinalizarModal.jsx');
const cadena = modal.slice(modal.indexOf('El campo queda arriba'), modal.indexOf('if (faltaObs ||'));
const ID_A_CLAVE = { 'pf-serial': 'serial', 'pf-vlan': 'vlan', 'pf-nap': 'nap', 'pf-puerto': 'puerto', 'pf-metraje': 'metraje', 'pf-poste-1': 'posteadura', 'pf-puertos-disponibles': 'puertosDisponibles' };
const foco = [...cadena.matchAll(/getElementById\('([^']+)'\)/g)].map(m => ID_A_CLAVE[m[1]]).filter(Boolean);
check('salto del cursor al validar: mismo orden (con el puerto detrás de la NAP)', foco, ['serial', 'vlan', 'nap', 'puerto', 'metraje', 'posteadura', 'puertosDisponibles']);

// Rótulos: el serial se llama "Serial" en el formulario y en la revisión; el drop conserva su nombre en cada lugar
check('rótulo del serial en el formulario', /SERIAL <span/.test(formulario), true);
check('el rótulo del drop en el formulario no cambia', /METRAJE DEL DROP <span/.test(formulario), true);
check('rótulos en el modal de revisión', datosAutorizacion({ ...instalacionOk, nombre: 'Ana' }).equipo.map(d => d.etiqueta).slice(0, 5), ['Serial', 'VLAN', 'NAP', 'Puerto del cliente', 'Drop']);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
