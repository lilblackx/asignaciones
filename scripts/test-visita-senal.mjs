// Prueba la devolución de órdenes, NAP/puerto y la potencia de SmartOLT (utils + Worker
// con SmartOLT simulado). No necesita el emulador ni la llave. Uso: `npm run test:visita`.
import { devolucionPendiente } from '../src/utils/devolucion.js';
import { separarNapPuerto, unirNapPuerto } from '../src/utils/napPuerto.js';
import { calidadSenal, puedeCapturarPotencia, valorSenal } from '../src/utils/senalOnu.js';
import { buscarOnus, completarSenal, mapearSenal } from '../cf-worker-tomodat/src/index.js';

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

check('une NAP y puerto', unirNapPuerto(' NAP 08 ', '3'), 'NAP 08 - Puerto 3');
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

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
