// Mide cuánto pesa cada colección de Firestore y qué campos de las órdenes y los reportes pesan más, para decidir dónde recortar descargas.
// Solo LEE. Cuenta los documentos con una consulta de conteo (no cuesta una lectura por documento) y mide el tamaño sobre una MUESTRA
// (por defecto 150 documentos por colección, los más recientes cuando se puede ordenar), así que gasta pocas lecturas de la cuota diaria (50 000).
// El tamaño es el del JSON del documento: una aproximación de lo que se descarga, no el tamaño exacto que cobra Firestore.
//
// Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/medir-tamano-datos.mjs C:\ruta\a\llave.json [--muestra=150]
//   o: set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave.json && node scripts/medir-tamano-datos.mjs
// Opcional: APP_ID (por defecto "default-app-id"). Con el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (no hace falta llave).
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const llave = args.find((a) => a.toLowerCase().endsWith('.json'));
const muestra = Number(args.find((a) => a.startsWith('--muestra='))?.split('=')[1]) || 150;
initializeApp(process.env.FIRESTORE_EMULATOR_HOST
  ? { projectId: 'seguimientons-f2026' }
  : { credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(), projectId: 'seguimientons-f2026' });
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;

const bytes = (valor) => Buffer.byteLength(JSON.stringify(valor ?? null), 'utf8');
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const promedio = (lista) => (lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : 0);
const percentil = (lista, p) => { const o = [...lista].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.floor(o.length * p))] || 0; };

// Lo más reciente primero cuando la colección tiene un campo de fecha conocido; si no, los primeros que devuelva Firestore.
const ORDEN = { tickets: 'createdAt', reports: 'createdAt', pagosTecnicos: 'creadoEn', adelantosTecnicos: 'creadoEn', descuentosTecnicos: 'creadoEn', ajustesTecnicos: 'creadoEn', historialInstalaciones: 'archivadoEn', telecomEnvios: 'actualizadoEn' };

async function leerMuestra(col) {
  const campo = ORDEN[col.id];
  if (campo) {
    try { return (await col.orderBy(campo, 'desc').limit(muestra).get()).docs; } catch { /* sin ese campo o sin índice: se toma sin orden */ }
  }
  return (await col.limit(muestra).get()).docs;
}

// Por campo: cuánto pesa en promedio y cuánto del documento representa.
function pesoPorCampo(docs) {
  const porCampo = new Map();
  for (const d of docs) for (const [k, v] of Object.entries(d.data())) porCampo.set(k, (porCampo.get(k) || 0) + bytes(v));
  const total = [...porCampo.values()].reduce((a, b) => a + b, 0) || 1;
  return [...porCampo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ campo: k, 'prom. por doc': kb(n / docs.length), '% del doc': `${((n / total) * 100).toFixed(0)} %` }));
}

const colecciones = await db.doc(base).listCollections();
const filas = [];
const detalle = {};
for (const col of colecciones) {
  const [conteo, docs] = await Promise.all([col.count().get().then((s) => s.data().count), leerMuestra(col)]);
  const tamanos = docs.map((d) => bytes(d.data()));
  filas.push({ coleccion: col.id, documentos: conteo, 'muestra': docs.length, 'prom.': kb(promedio(tamanos)), 'p90': kb(percentil(tamanos, 0.9)), 'máx.': kb(Math.max(0, ...tamanos)), 'total estimado': kb(promedio(tamanos) * conteo) });
  if (['tickets', 'reports'].includes(col.id) && docs.length) detalle[col.id] = pesoPorCampo(docs);
  // Cuánto pesa solo el historial de ediciones y cuántas entradas lleva, que crece con cada cambio.
  if (col.id === 'tickets' && docs.length) {
    const entradas = docs.map((d) => (d.data().historialEdiciones || []).length);
    detalle['tickets: entradas de historialEdiciones'] = [{ promedio: promedio(entradas).toFixed(1), p90: percentil(entradas, 0.9), 'máx.': Math.max(...entradas) }];
  }
}
filas.sort((a, b) => parseFloat(b['total estimado']) - parseFloat(a['total estimado']));
console.log(`\nColecciones de ${base} (muestra de hasta ${muestra} documentos por colección, ordenadas por tamaño total estimado):`);
console.table(filas);
for (const [nombre, tabla] of Object.entries(detalle)) { console.log(`\nQué pesa más en ${nombre}:`); console.table(tabla); }
process.exit(0);
