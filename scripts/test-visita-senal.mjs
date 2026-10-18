// Prueba la devolución de órdenes, NAP/puerto y la potencia de SmartOLT (utils + Worker
// con SmartOLT simulado). No necesita el emulador ni la llave. Uso: `npm run test:visita`.
import { devolucionPendiente, reporteTecnicoInicial } from '../src/utils/devolucion.js';
import { separarNapPuerto, unirNapPuerto } from '../src/utils/napPuerto.js';
import { calidadSenal, puedeCapturarPotencia, valorSenal } from '../src/utils/senalOnu.js';
import { ErrorSmartOlt, buscarOnus, completarSenal, mapearOnu, mapearSenal, puertoDeOdb } from '../cf-worker-tomodat/src/index.js';
import { camposDeOnu, napDeOnu } from '../src/utils/clienteSmartolt.js';
import { extraerCodigoNap } from '../src/utils/codigoNap.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

const devuelta = { tipo: 'devuelto', motivo: 'falta potencia', operador: 'admin', fecha: '1/1' };
const pre = { tipo: 'prefinalizado', detalle: 'x' };
check('devolución vigente: PENDIENTE con "devuelto" después de pre-finalizar',
  devolucionPendiente({ estado: 'PENDIENTE', historialEdiciones: [pre, devuelta] }), { motivo: 'falta potencia', operador: 'admin', fecha: '1/1' });
check('al pre-finalizar de nuevo la devolución desaparece', devolucionPendiente({ estado: 'PENDIENTE', historialEdiciones: [devuelta, pre] }), null);
check('solo cuenta en PENDIENTE', devolucionPendiente({ estado: 'PRE-FINALIZADO', historialEdiciones: [devuelta] }), null);
check('sin historial no hay devolución', devolucionPendiente({ estado: 'PENDIENTE' }), null);

// El reporte del técnico al volver a pre-finalizar: si le devolvieron la orden empieza vacío, para no mezclarlo con el anterior.
const reporte = { observacionTecnico: 'Se cambió el conector.' };
check('con la orden devuelta el reporte nuevo empieza vacío', reporteTecnicoInicial({ estado: 'PENDIENTE', ...reporte, historialEdiciones: [pre, devuelta] }), '');
check('sin devolución se conserva lo escrito', reporteTecnicoInicial({ estado: 'PENDIENTE', ...reporte, historialEdiciones: [] }), 'Se cambió el conector.');
check('si ya volvió a pre-finalizar tras la devolución, se conserva su último reporte', reporteTecnicoInicial({ estado: 'PENDIENTE', ...reporte, historialEdiciones: [devuelta, pre] }), 'Se cambió el conector.');
check('sin reporte guardado empieza vacío', [reporteTecnicoInicial({ estado: 'PENDIENTE', historialEdiciones: [] }), reporteTecnicoInicial(null)], ['', '']);

check('une NAP y puerto', unirNapPuerto(' NAP 08 ', '3'), 'NAP 08 - Puerto 3');

// --- Puerto de la NAP que trae SmartOLT (odb_port) junto con la NAP (odb_name) ---
check('el puerto de SmartOLT es un número mayor a 0', ['3', 3, 'Port 12', ' 7 ', '0', '', null, undefined, '-', 'sin puerto'].map(puertoDeOdb), ['3', '3', '12', '7', null, null, null, null, null, null]);
check('la ONU trae NAP y puerto', (({ nap, puerto }) => [nap, puerto])(mapearOnu({ odb_name: 'O10H37', odb_port: '5' })), ['O10H37', '5']);
check('sin puerto en SmartOLT la ONU trae solo la NAP', (({ nap, puerto }) => [nap, puerto])(mapearOnu({ odb_name: 'O10H37', odb_port: '' })), ['O10H37', null]);
check('la orden nueva lleva la NAP con su puerto, igual que el formulario de NAP y puerto', camposDeOnu({ nap: 'o10h37', puerto: '5' }, '123').nap, 'O10H37 - Puerto 5');
check('el texto se separa de nuevo en NAP y puerto (el técnico lo recibe ya lleno)', separarNapPuerto(napDeOnu({ nap: 'o10h37', puerto: '5' })), { nap: 'O10H37', puerto: '5' });
check('sin puerto queda solo la NAP, y sin NAP no se escribe un puerto suelto', [napDeOnu({ nap: 'O10H37' }), napDeOnu({ puerto: '5' })], ['O10H37', '']);
check('el código de la NAP se sigue encontrando con el puerto al lado (coordenadas de Tomodat)', extraerCodigoNap(napDeOnu({ nap: 'O10H37', puerto: '5' })), 'O10H37');
check('separa NAP y puerto', separarNapPuerto('NAP 08 - Puerto 3'), { nap: 'NAP 08', puerto: '3' });
check('separa aunque la NAP lleve guion', separarNapPuerto('NAP O07D05-2 - puerto 12'), { nap: 'NAP O07D05-2', puerto: '12' });
check('texto libre queda entero en la NAP', separarNapPuerto('caja de la esquina'), { nap: 'caja de la esquina', puerto: '' });

check('valor de señal con unidad y 3 decimales', valorSenal('-24.134 dBm'), '-24.13');
check('valor de señal con coma', valorSenal('-19,5'), '-19.5');
check('señal vacía o sin número', [valorSenal(null), valorSenal('N/A')], [null, null]);

// La consulta a SmartOLT nunca pisa lo que alguien escribió en la potencia.
check('campo vacío (o solo espacios): SmartOLT puede escribir', [puedeCapturarPotencia('', ''), puedeCapturarPotencia('  ', ''), puedeCapturarPotencia(null, '')], [true, true, true]);
check('algo escrito a mano: SmartOLT no lo pisa', [puedeCapturarPotencia('-20.1', ''), puedeCapturarPotencia('-20.1', '-19.4')], [false, false]);
check('lo que dejó la consulta anterior sin tocar se puede actualizar', puedeCapturarPotencia('-19.4', '-19.4'), true);
check('si el técnico corrigió lo capturado, ya no se pisa', puedeCapturarPotencia('-19.5', '-19.4'), false);
check('calidad en español', [calidadSenal('Very good'), calidadSenal('Warning'), calidadSenal('Critical')], ['Muy buena', 'Advertencia', 'Crítica']);

// Worker con SmartOLT simulado: pide los campos de señal y filtra por cédula exacta.
const pedidos = [];
globalThis.fetch = async (url) => {
  pedidos.push(new URL(url));
  const onus = [
    { unique_external_id: 'A', name: 'JUAN PEREZ CI 12.345.678', address: 'Calle 1', zone_name: 'Z1', status: 'Power fail', signal: 'Very good', signal_1310: '-19.456', signal_1490: null },
    { unique_external_id: 'B', name: 'OTRO CI 912.345.678', zone_name: 'Z2', signal: 'Warning', signal_1310: '-28' },
  ];
  return new Response(JSON.stringify({ status: true, onus }), { status: 200 });
};
const env = { SMARTOLT_API_KEY: 'k', SMARTOLT_BASE_URL: 'https://smartolt.test' };
const CAMPOS = 'unique_external_id,name,address,zone_name,status,signal,signal_1310,signal_1490';
const res = await buscarOnus(env, '12345678', CAMPOS, mapearSenal);
check('solo la ONU con esa cédula, con su señal',
  res, [{ idExterno: 'A', nombre: 'JUAN PEREZ CI 12.345.678', direccion: 'Calle 1', zona: 'Z1', estado: 'Power fail', senal1310: '-19.456', senal1490: null, calidad: 'Very good' }]);
check('pide los campos de señal a SmartOLT', pedidos[0].searchParams.get('fields'), CAMPOS);

// --- Señal en vivo: si al listado le falta un valor, se completa con la consulta en vivo de SmartOLT ---
let vivo; let llamadasVivo; // vivo: lista de respuestas (o 'error') que se van entregando
globalThis.fetch = async (url) => {
  const u = String(url);
  if (!u.includes('/get_onu_signal/')) throw new Error(`Llamada inesperada: ${u}`);
  llamadasVivo.push(decodeURIComponent(u.split('/get_onu_signal/')[1]));
  const r = vivo.length > 1 ? vivo.shift() : vivo[0];
  if (r === 'error') return new Response('boom', { status: 500 });
  return new Response(JSON.stringify({ status: true, response_code: 'success', ...r }), { status: 200 });
};
const base = { idExterno: 'ONU1', estado: 'Online', senal1310: '-27.8', senal1490: null, calidad: 'Very good' };
const completar = (onu, respuestas) => { vivo = respuestas; llamadasVivo = []; return completarSenal(env, onu, { pausa: 0 }); };
const OK = { onu_signal_1310: '-27.8 dBm', onu_signal_1490: '-22.84 dBm' };
const NADA = { onu_signal_1310: '-', onu_signal_1490: '-' };

let o = await completar(base, [OK]);
check('al listado le falta el 1490: se completa con la consulta en vivo', [o.senal1310, o.senal1490, llamadasVivo], ['-27.8', '-22.84', ['ONU1']]);
check('lo demás de la ONU no cambia', [o.calidad, o.estado, o.idExterno], ['Very good', 'Online', 'ONU1']);
o = await completar({ ...base, senal1490: '-23.1' }, [OK]);
check('con los dos valores no se hace ninguna consulta extra', [o.senal1310, o.senal1490, llamadasVivo.length], ['-27.8', '-23.1', 0]);
o = await completar(base, [{ onu_signal_1310: '-30.00 dBm', onu_signal_1490: '-22.84 dBm' }]);
check('lo que trajo el listado no se pisa con el valor en vivo', [o.senal1310, o.senal1490], ['-27.8', '-22.84']);
o = await completar({ ...base, senal1310: null, senal1490: '-22.1' }, [OK]);
check('también completa el 1310 si es el que falta', [o.senal1310, o.senal1490], ['-27.8', '-22.1']);
o = await completar(base, [NADA, OK]);
check('si responde "-" reintenta una vez y lo completa', [o.senal1490, llamadasVivo.length], ['-22.84', 2]);
o = await completar(base, [NADA]);
check('si sigue en "-" se queda como estaba (3 intentos)', [o.senal1310, o.senal1490, llamadasVivo.length], ['-27.8', null, 3]);
o = await completar(base, ['error']);
check('si SmartOLT falla no se rompe: devuelve lo del listado', [o.senal1310, o.senal1490, llamadasVivo.length], ['-27.8', null, 3]);
o = await completar(base, ['error', OK]);
check('un fallo y luego respuesta buena: se completa', o.senal1490, '-22.84');
o = await completar({ ...base, estado: 'Power fail', senal1310: null }, [OK]);
check('ONU fuera de línea: no se consulta (la app ya lo avisa)', [o.senal1490, llamadasVivo.length], [null, 0]);
o = await completar({ ...base, idExterno: null }, [OK]);
check('sin id de ONU no se puede consultar', llamadasVivo.length, 0);
o = await completar({ ...base, estado: null }, [OK]);
check('sin dato de estado se asume en línea (igual que la app)', o.senal1490, '-22.84');
o = await completar(base, [{ onu_signal_1310: '-27.8 dBm', onu_signal_1490: '-' }, OK]);
check('si en vivo falta el 1490 reintenta hasta tenerlo', [o.senal1490, llamadasVivo.length], ['-22.84', 2]);
o = await completar(base, [NADA, NADA, OK]);
check('puede necesitar hasta el tercer intento', [o.senal1490, llamadasVivo.length], ['-22.84', 3]);
o = await completar({ ...base, senal1310: null, senal1490: null }, [OK]);
check('si faltan los dos se completan los dos', [o.senal1310, o.senal1490], ['-27.8', '-22.84']);

// --- Cuando SmartOLT falla: un tropiezo rápido se reintenta una vez; el resto se explica en palabras claras ---
const ONU_OK = { unique_external_id: 'A', name: 'JUAN PEREZ CI 12.345.678', signal_1310: '-19.4', signal_1490: '-22.1' };
let respuestasSmartOlt; let llamadasSmartOlt;
globalThis.fetch = async () => {
  llamadasSmartOlt++;
  const r = respuestasSmartOlt.shift();
  return r === 'ok' ? new Response(JSON.stringify({ status: true, onus: [ONU_OK] }), { status: 200 }) : new Response('', { status: r });
};
const intentar = async (respuestas) => {
  respuestasSmartOlt = [...respuestas]; llamadasSmartOlt = 0;
  const t0 = Date.now();
  try { return { onus: await buscarOnus(env, '12345678', CAMPOS, mapearSenal), llamadas: llamadasSmartOlt, ms: Date.now() - t0 }; }
  catch (err) { return { error: err.message, claro: err instanceof ErrorSmartOlt, llamadas: llamadasSmartOlt, ms: Date.now() - t0 }; }
};
let r = await intentar([503, 'ok']);
check('un 503 de un momento se reintenta una vez y sale bien', [r.onus?.length, r.llamadas], [1, 2]);
r = await intentar([502, 504]);
check('si el reintento también falla, avisa con palabras claras (sin repetir en bucle)', [r.error, r.claro, r.llamadas], ['SmartOLT no está respondiendo en este momento (error 504). Intenta en unos minutos.', true, 2]);
r = await intentar([522, 'ok']);
check('un 522 (SmartOLT no contestó) no se reintenta: cada intento tardaría otro tanto', [r.error, r.claro, r.llamadas], ['SmartOLT no está respondiendo en este momento (error 522). Intenta en unos minutos.', true, 1]);
r = await intentar([524]);
check('tampoco el 524', [r.llamadas, r.claro], [1, true]);
r = await intentar([404]);
check('un error del lado nuestro (4xx) no se dice "SmartOLT no responde" y no se reintenta', [r.error, r.claro, r.llamadas], ['SmartOLT respondió 404', false, 1]);
r = await intentar(['ok']);
check('con SmartOLT bien no se demora ni se repite nada', [r.onus?.length, r.llamadas, r.ms < 500], [1, 1, true]);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
