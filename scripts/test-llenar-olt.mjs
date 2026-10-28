// Prueba el script que llena la OLT de las órdenes ya existentes (scripts/llenar-olt-ordenes.mjs) contra el emulador de Firestore y un SmartOLT de mentira:
// que en modo prueba no escriba nada, que con --aplicar llene las activas y las copias de los reportes de cierre, y que respete lo que ya tenía OLT,
// las órdenes de antes del corte, las cédulas dudosas y las que SmartOLT no encuentra. Necesita el emulador (`npm run emulators`); BORRA sus datos.
// Uso: `node scripts/test-llenar-olt.mjs`.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIRESTORE_EMULATOR_HOST = HOST;
const PROYECTO = 'seguimientons-f2026';
const base = 'artifacts/default-app-id/public/data';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

await fetch(`http://${HOST}/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`, { method: 'DELETE' });
initializeApp({ projectId: PROYECTO });
const db = getFirestore();

// --- Un SmartOLT de mentira: busca por nombre (con los puntos de miles) ---
const CLIENTES = {
  '11.111.111': [{ unique_external_id: 'A1', name: 'UNO C.I 11.111.111', olt_name: 'JMTV CONEXIONES' }],
  '22.222.222': [{ unique_external_id: 'B1', name: 'DOS C.I 22.222.222', olt_name: 'OTRA OLT' }],
  '33.333.333': [{ unique_external_id: 'C1', name: 'TRES C.I 33.333.333', olt_name: 'JMTV CONEXIONES' }, { unique_external_id: 'C2', name: 'TRES C.I 33.333.333', olt_name: 'OTRA OLT' }],
  '55.555.555': [{ unique_external_id: 'E1', name: 'CINCO C.I 55.555.555', olt_name: 'JMTV CONEXIONES' }],
  '66.666.666': [{ unique_external_id: 'F1', name: 'SEIS C.I 66.666.666', olt_name: 'JMTV CONEXIONES' }],
  '77.777.777': [{ unique_external_id: 'G1', name: 'SIETE C.I 77.777.777', olt_name: 'OTRA OLT' }],
};
const consultas = [];
const smartolt = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const nombre = url.searchParams.get('name') || '';
  consultas.push(nombre);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ status: true, onus: CLIENTES[nombre] || [] }));
});
await new Promise((r) => smartolt.listen(0, '127.0.0.1', r));
const urlSmartOlt = `http://127.0.0.1:${smartolt.address().port}`;

// --- Las órdenes ---
const DIA = (d, h = 16) => Date.UTC(2026, 9, d, h, 0, 0);
const averia = (id, codigo, cedula, extra = {}) => ({
  id, codigo, nombre: `Cliente ${codigo}`, cedula, estado: 'FINALIZADO', tecnico: 'GERARDO', tipoTrabajo: 'AVERÍA', falla: 'LOS', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA',
  createdAt: DIA(27), finalizadoEn: DIA(28), ...extra,
});
const activas = [
  averia('t1', 'AO1', '11.111.111'), // JM
  averia('t2', 'AO2', '22.222.222'), // otra OLT: se guarda el nombre
  averia('t3', 'AO3', '33.333.333'), // ONU en OLT distintas: no se llena
  averia('t4', 'AO4', '44.444.444'), // SmartOLT no la tiene
  averia('t5', 'AO5', '66.666.666', { olt: 'YA TENIA' }), // ya tiene OLT: no se toca
  averia('t6', 'AO6', ''), // sin cédula
  averia('t7', 'AO7', '77.777.777', { createdAt: DIA(20), finalizadoEn: DIA(21) }), // de antes del corte: no la ve Finanzas
];
// Una orden ya archivada en un reporte de cierre (la ve Finanzas) y una de la lista de excepciones (antes del corte, JOSE).
const archivada = averia('r1', 'AO8', '11.111.111');
const excepcion = averia('r2', 'AO268', '55.555.555', { tecnico: 'JOSE', createdAt: DIA(22, 15), finalizadoEn: DIA(22, 18) });
for (const t of activas) await db.doc(`${base}/tickets/${t.id}`).set(t);
await db.doc(`${base}/reports/cierre-1`).set({ createdAt: DIA(28), ticketsDetalle: [archivada, excepcion] });

function correr(args) {
  return new Promise((resolve) => {
    const salida = [];
    const hijo = spawn(process.execPath, [fileURLToPath(new URL('./llenar-olt-ordenes.mjs', import.meta.url)), ...args], {
      env: { ...process.env, SMARTOLT_API_KEY: 'llave-de-prueba', SMARTOLT_BASE_URL: urlSmartOlt, PAUSA_MS: '1' },
    });
    hijo.stdout.on('data', (d) => salida.push(String(d)));
    hijo.stderr.on('data', (d) => salida.push(String(d)));
    hijo.on('close', (codigo) => resolve({ codigo, texto: salida.join('') }));
  });
}
const olts = async () => {
  const tickets = Object.fromEntries((await db.collection(`${base}/tickets`).get()).docs.map((d) => [d.id, d.data().olt ?? null]));
  const detalle = (await db.doc(`${base}/reports/cierre-1`).get()).data().ticketsDetalle;
  return { tickets, reporte: Object.fromEntries(detalle.map((t) => [t.id, t.olt ?? null])) };
};

// --- Modo prueba: cuenta y no escribe ---
const prueba = await correr([]);
check('el modo prueba termina bien', prueba.codigo, 0);
check('el modo prueba no escribe nada', await olts(), {
  tickets: { t1: null, t2: null, t3: null, t4: null, t5: 'YA TENIA', t6: null, t7: null },
  reporte: { r1: null, r2: null },
});
check('dice cuántas son JM y lista las dudosas y las no encontradas', [/JM \(JMTV CONEXIONES\): 3/.test(prueba.texto), /Varias ONU en OLT distintas \(no se llenan\): 1/.test(prueba.texto), /Cédula no encontrada en SmartOLT: 1/.test(prueba.texto), /Cédula inválida o vacía en la orden: 1/.test(prueba.texto)], [true, true, true, true]);
check('ve las órdenes de Finanzas: las 6 activas desde el corte, la archivada y la de la excepción (no la de antes del corte)', /Órdenes que ven Finanzas y la Revisión: 8\./.test(prueba.texto), true);
check('consulta cada cédula distinta (con los puntos de miles), y ni la que ya tenía OLT ni la de antes del corte', [...new Set(consultas.filter((n) => n.includes('.')))].sort(), ['11.111.111', '22.222.222', '33.333.333', '44.444.444', '55.555.555'].sort());

// --- Con --aplicar ---
const aplicada = await correr(['--aplicar']);
check('con --aplicar termina bien', aplicada.codigo, 0);
check('llena las activas y las copias de los reportes, y solo donde faltaba', await olts(), {
  tickets: { t1: 'JMTV CONEXIONES', t2: 'OTRA OLT', t3: null, t4: null, t5: 'YA TENIA', t6: null, t7: null },
  reporte: { r1: 'JMTV CONEXIONES', r2: 'JMTV CONEXIONES' },
});

// --- Repetirlo no cambia nada ---
const antes = await olts();
const otraVez = await correr(['--aplicar']);
check('repetirlo no cambia lo ya llenado', [otraVez.codigo, await olts()], [0, antes]);

smartolt.close();
if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
process.exit(0);
