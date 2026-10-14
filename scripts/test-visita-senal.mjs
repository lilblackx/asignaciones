// Prueba la devolución de órdenes, NAP/puerto y la potencia de SmartOLT (utils + Worker
// con SmartOLT simulado). No necesita el emulador ni la llave. Uso: `npm run test:visita`.
import { devolucionPendiente } from '../src/utils/devolucion.js';
import { separarNapPuerto, unirNapPuerto } from '../src/utils/napPuerto.js';
import { calidadSenal, valorSenal } from '../src/utils/senalOnu.js';
import { buscarOnus, mapearSenal } from '../cf-worker-tomodat/src/index.js';

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

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
