// SOLO LECTURA: muestra qué hay hoy en el almacén (inventario del otro sistema) para una orden, para saber qué escritura rechaza (403) un envío.
// Lee: el registro de material con el id que usa el Worker para esa orden, los registros de material de ese cliente (por si hay otro id) y el equipo por su serial.
// No escribe nada. Uso (los mismos datos de acceso que scripts/corregir-tecnico-inventario.mjs):
//   set TELECOM_EMAIL=...&& set TELECOM_PASSWORD=...&& set TELECOM_API_KEY=...&& set TELECOM_PROJECT_ID=almaceninventario&& set TELECOM_APP_ID=app-telecom
//   node scripts/diagnosticar-envio-inventario.mjs <idDeLaOrden> <finalizadoEn> <serial> "<cliente>"
//   (AO225: node scripts/diagnosticar-envio-inventario.mjs SnOcensR5BqHCvdct1bj 1792524558324 ZXICC9BA671A "Gerardo Antonio Garcia Garcia")
const [ticketId, finalizadoEn, serial, cliente] = process.argv.slice(2);
if (!ticketId || !finalizadoEn || !serial || !cliente) { console.error('Faltan argumentos: <idDeLaOrden> <finalizadoEn> <serial> "<cliente>".'); process.exit(1); }
const env = Object.fromEntries(['TELECOM_EMAIL', 'TELECOM_PASSWORD', 'TELECOM_API_KEY', 'TELECOM_PROJECT_ID', 'TELECOM_APP_ID'].map((k) => [k, process.env[k]]));
const faltan = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
if (faltan.length) { console.error(`Faltan estas variables: ${faltan.join(', ')}.`); process.exit(1); }

// El mismo id que calcula el Worker (cf-worker/src/inventario.js, idRegistro).
let h = 2166136261;
for (const c of String(ticketId)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
const idMaterial = Number(finalizadoEn) + (h % 1000) / 1000;

const sesion = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.TELECOM_API_KEY)}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.TELECOM_EMAIL, password: env.TELECOM_PASSWORD, returnSecureToken: true }),
})).json();
if (!sesion.idToken) { console.error(`No se pudo iniciar sesión (${sesion.error?.message || 'sin detalle'}).`); process.exit(1); }

const raiz = `projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents`;
const ruta = `artifacts/${env.TELECOM_APP_ID}/public/data`;
const cab = { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.idToken}` };
const valor = (v) => ('stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : v);
const plano = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, valor(v)]));
const consulta = async (coleccion, where) => (await (await fetch(`https://firestore.googleapis.com/v1/${raiz}/${ruta}:runQuery`, {
  method: 'POST', headers: cab, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: coleccion }], where, limit: 20 } }),
})).json()).filter((x) => x.document).map((x) => ({ id: x.document.name.split('/').pop(), ...plano(x.document.fields) }));

console.log(`\nId de material que usaría el Worker: ${idMaterial}`);
const res = await fetch(`https://firestore.googleapis.com/v1/${raiz}/${ruta}/materialLogs/${idMaterial}`, { headers: cab });
console.log(res.status === 404 ? 'materialLogs con ese id: NO existe (el Worker lo crearía)' : res.ok ? `materialLogs con ese id: YA EXISTE\n${JSON.stringify(plano((await res.json()).fields), null, 1)}` : `materialLogs con ese id: error ${res.status}`);

const porCliente = await consulta('materialLogs', { compositeFilter: { op: 'AND', filters: [
  { fieldFilter: { field: { fieldPath: 'cliente' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cliente } } },
  { fieldFilter: { field: { fieldPath: 'cliente' }, op: 'LESS_THAN', value: { stringValue: `${cliente}` } } },
] } });
console.log(`\nRegistros de material cuyo cliente empieza con "${cliente}": ${porCliente.length}`);
porCliente.forEach((r) => console.log(JSON.stringify(r)));

const equipo = await consulta('inventory', { fieldFilter: { field: { fieldPath: 'serial' }, op: 'EQUAL', value: { stringValue: serial } } });
console.log(`\nEquipo con serial ${serial}: ${equipo.length}`);
equipo.forEach((r) => console.log(JSON.stringify(r)));
