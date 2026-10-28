// Prueba la OLT del cliente: que el Worker la pida a SmartOLT y la entregue, que se llene en la orden junto con el resto de los datos, la regla de la
// marca "JM" y la elección de la OLT cuando una cédula tiene varias ONU. No necesita el emulador. Uso: `npm run test:olt`.
import { buscarOnus } from '../cf-worker-tomodat/src/index.js';
import { camposDeOnu, camposParaRellenar } from '../src/utils/clienteSmartolt.js';
import { OLT_JM, clasificarOlt, esOltJM, oltUnica } from '../src/utils/olt.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- La marca JM ---
check('la OLT de JMTV es "JMTV CONEXIONES"', OLT_JM, 'JMTV CONEXIONES');
check('se reconoce sin importar mayúsculas ni espacios de más', ['JMTV CONEXIONES', 'jmtv conexiones', '  JMTV   Conexiones '].map(esOltJM), [true, true, true]);
check('otra OLT, vacía o sin dato no es JM', ['OTRA OLT', 'JMTV', '', null, undefined].map(esOltJM), [false, false, false, false, false]);

// --- Elegir la OLT de una cédula con varias ONU ---
check('una sola ONU: su OLT', oltUnica([{ olt: 'JMTV CONEXIONES' }]), 'JMTV CONEXIONES');
check('varias ONU en la misma OLT: esa', oltUnica([{ olt: 'JMTV CONEXIONES' }, { olt: 'JMTV CONEXIONES' }]), 'JMTV CONEXIONES');
check('varias ONU en OLT distintas: no se adivina', oltUnica([{ olt: 'JMTV CONEXIONES' }, { olt: 'OTRA' }]), '');
check('las ONU sin OLT no cuentan', oltUnica([{ olt: null }, { olt: 'JMTV CONEXIONES' }, {}]), 'JMTV CONEXIONES');
check('sin ONU o sin OLT: vacío', [oltUnica([]), oltUnica(null), oltUnica([{ olt: null }])], ['', '', '']);

// --- Qué se sabe de la OLT de una cédula (para el script que llena las órdenes ya existentes) ---
check('una OLT, o varias ONU en la misma', [clasificarOlt([{ olt: 'JMTV CONEXIONES' }]), clasificarOlt([{ olt: 'A' }, { olt: 'A' }])], [{ estado: 'ok', olt: 'JMTV CONEXIONES' }, { estado: 'ok', olt: 'A' }]);
check('ONU en OLT distintas: se avisa y no se elige', clasificarOlt([{ olt: 'A' }, { olt: 'B' }]), { estado: 'varias', nombres: ['A', 'B'] });
check('hay ONU pero sin OLT, o no hay ONU', [clasificarOlt([{ olt: null }]), clasificarOlt([]), clasificarOlt(undefined)], [{ estado: 'sin_olt' }, { estado: 'no_encontrada' }, { estado: 'no_encontrada' }]);

// --- El Worker pide la OLT y la entrega ---
const pedidos = [];
globalThis.fetch = async (url) => {
  pedidos.push(new URL(url));
  const onus = [{ unique_external_id: 'TPLGBDAA8EF8', name: 'EYBEHTT SANCHEZ C.I 16.456.391', address: 'Calle 1', zone_name: 'Barrio Cujicito', olt_name: 'JMTV CONEXIONES', odb_name: '', odb_port: '', contact: '0414-1234567' }];
  return new Response(JSON.stringify({ status: true, onus }), { status: 200 });
};
const env = { SMARTOLT_API_KEY: 'k', SMARTOLT_BASE_URL: 'https://smartolt.test' };
const encontradas = await buscarOnus(env, '16456391');
check('el Worker pide el nombre de la OLT a SmartOLT', pedidos[0].searchParams.get('fields').split(',').includes('olt_name'), true);
check('y lo entrega en cada ONU', encontradas.map((o) => o.olt), ['JMTV CONEXIONES']);

globalThis.fetch = async () => new Response(JSON.stringify({ status: true, onus: [{ unique_external_id: 'X', name: 'ALGUIEN C.I 11.111.111', olt_name: '' }] }), { status: 200 });
check('una ONU sin OLT en SmartOLT la entrega como null', (await buscarOnus(env, '11111111')).map((o) => o.olt), [null]);

// --- Se llena en la orden junto con el resto de los datos ---
const onu = { idExterno: 'A', nombre: 'JUAN PEREZ C.I 12.345.678', direccion: 'Calle 1', telefono: '0414-1234567', nap: 'N10D14', puerto: '3', olt: 'JMTV CONEXIONES', latitud: null, longitud: null };
check('los datos de la ONU incluyen la OLT', camposDeOnu(onu, '12345678').olt, 'JMTV CONEXIONES');
check('una ONU sin OLT no escribe nada en ese campo', 'olt' in camposDeOnu({ ...onu, olt: null }, '12345678'), false);
check('se llena en un formulario vacío', camposParaRellenar(onu, '12345678', { olt: '' }).campos.olt, 'JMTV CONEXIONES');
check('no se pisa una OLT ya puesta', 'olt' in camposParaRellenar(onu, '12345678', { olt: 'OTRA' }).campos, false);
check('la OLT no aparece en la lista de datos "llenados" que ve quien crea la orden', camposParaRellenar(onu, '12345678', {}).etiquetas.includes('olt'), false);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
