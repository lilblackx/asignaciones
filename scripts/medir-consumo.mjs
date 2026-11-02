// SOLO LECTURA. Muestra el consumo diario real de Firestore (lecturas, escrituras, borrados) y del hosting de los últimos días, junto con las órdenes cerradas ese día
// y las lecturas por orden cerrada: sirve para vigilar el consumo con los años y para comparar con la proyección (unas 1.400 lecturas fijas del Worker + ~400 por orden cerrada).
// Los días son de Caracas (UTC-4). El día de hoy sale incompleto.
//
// Uso (con la llave de una cuenta de servicio con permiso de lectura en Firestore y en Cloud Monitoring, nunca dentro del repo):
//   node scripts/medir-consumo.mjs C:\ruta\a\llave.json [--dias=30]
// Opcional: APP_ID (por defecto "default-app-id"). Si la llave no puede leer Cloud Monitoring, el script lo dice y solo muestra las órdenes.
import { readFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const llave = args.find((a) => a.toLowerCase().endsWith('.json'));
const dias = Number(args.find((a) => a.startsWith('--dias='))?.split('=')[1]) || 30;
if (!llave) { console.error('Uso: node scripts/medir-consumo.mjs <llave.json> [--dias=30]'); process.exit(1); }

const PROYECTO = 'seguimientons-f2026';
const HORA = 3600e3;
const diaCaracas = (ms) => new Date(ms - 4 * HORA).toISOString().slice(0, 10);

// Los días se alinean a la medianoche de Caracas (04:00 UTC): el final del último día completo es la 04:00Z de hoy... o de mañana, para incluir hoy.
const ahora = Date.now();
const finDeHoy = Date.parse(`${diaCaracas(ahora)}T04:00:00Z`) + 24 * HORA;
const inicio = finDeHoy - dias * 24 * HORA;

const auth = new GoogleAuth({ keyFile: llave, scopes: ['https://www.googleapis.com/auth/monitoring.read'] });
async function serie(metrica) {
  const cliente = await auth.getClient();
  const url = `https://monitoring.googleapis.com/v3/projects/${PROYECTO}/timeSeries?${new URLSearchParams({
    filter: `metric.type="${metrica}"`,
    'interval.startTime': new Date(inicio).toISOString(), 'interval.endTime': new Date(finDeHoy).toISOString(),
    'aggregation.alignmentPeriod': '86400s', 'aggregation.perSeriesAligner': 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  })}`;
  const { data } = await cliente.request({ url });
  const porDia = {};
  for (const p of data.timeSeries?.[0]?.points || []) porDia[diaCaracas(Date.parse(p.interval.endTime) - 12 * HORA)] = Number(p.value.int64Value || 0);
  return porDia;
}

initializeApp({ credential: cert(JSON.parse(readFileSync(llave, 'utf8'))), projectId: PROYECTO });
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;

// Órdenes cerradas por día: las archivadas en los reportes de cierre y las que siguen vivas (finalizadas o canceladas, sin cierre todavía).
const cerradas = {};
const contar = (t) => { const ms = Number(t.finalizadoEn) || Number(t.canceladaEn) || 0; if (ms) { const d = diaCaracas(ms); cerradas[d] = (cerradas[d] || 0) + 1; } };
for (const r of (await db.collection(`${base}/reports`).get()).docs) (r.data().ticketsDetalle || []).forEach(contar);
for (const t of (await db.collection(`${base}/tickets`).where('estado', 'in', ['FINALIZADO', 'CANCELADO']).get()).docs) contar(t.data());

let lecturas = {}, escrituras = {}, borrados = {}, hosting = {};
try {
  [lecturas, escrituras, borrados, hosting] = await Promise.all([
    serie('firestore.googleapis.com/document/read_count'), serie('firestore.googleapis.com/document/write_count'),
    serie('firestore.googleapis.com/document/delete_count'), serie('firebasehosting.googleapis.com/network/sent_bytes_count'),
  ]);
} catch (e) {
  console.error(`No se pudo leer Cloud Monitoring (${e.response?.status || e.message}): la llave necesita el rol "Visor de Monitoring". Solo se muestran las órdenes.`);
}

const dias_ = [...new Set([...Object.keys(lecturas), ...Object.keys(cerradas)])].filter((d) => d >= diaCaracas(inicio)).sort();
const pad = (v, n) => String(v ?? '-').padStart(n);
console.log('día         lecturas  escrituras  borrados  hosting MB  órdenes cerradas  lecturas/orden');
let sumaLec = 0;
for (const d of dias_) {
  const o = cerradas[d] || 0;
  if (lecturas[d] !== undefined && d !== diaCaracas(ahora)) sumaLec += lecturas[d];
  console.log(`${d}  ${pad(lecturas[d], 8)}  ${pad(escrituras[d], 10)}  ${pad(borrados[d], 8)}  ${pad(hosting[d] === undefined ? undefined : Math.round(hosting[d] / 1e6), 10)}  ${pad(o, 16)}  ${pad(o && lecturas[d] ? Math.round(lecturas[d] / o) : undefined, 14)}`);
}
const completos = dias_.filter((d) => lecturas[d] !== undefined && d !== diaCaracas(ahora));
if (completos.length) {
  const valores = completos.map((d) => lecturas[d]).sort((a, b) => a - b);
  console.log(`\nDías completos: ${completos.length} · lecturas por día: promedio ${Math.round(sumaLec / completos.length)}, máximo ${valores.at(-1)} (cuota gratis: 50.000/día)`);
  const porOrden = completos.filter((d) => cerradas[d]).map((d) => lecturas[d] / cerradas[d]).sort((a, b) => a - b);
  // La mediana, no el promedio: un solo día con un fallo (como los 85.000 del 31/10) no debe decidir la cifra.
  if (porOrden.length) console.log(`Lecturas por orden cerrada: mediana ${Math.round(porOrden[Math.floor(porOrden.length / 2)])} (la proyección usa ~400 más ~1.400 fijas al día; hoy sale incompleto y con lo que se haya consultado a mano)`);
}
process.exit(0);
