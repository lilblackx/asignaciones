// Uso de Firestore de todo el proyecto para la pantalla de Estaciones (src/components/EstacionesView.jsx): cada 15 minutos lee de Google Cloud
// Monitoring las lecturas, escrituras, borrados y rechazos de las reglas de las últimas 24 horas y del día de la cuota, y los escuchadores y
// conexiones abiertos ahora, y lo guarda en estadoFirestore/actual (un solo documento: 96 escrituras al día). Leer las métricas de Google es
// gratis. La cuenta de servicio necesita el rol "Monitoring Viewer" (roles/monitoring.viewer); sin él, el documento lo dice en `error`.
import { armarEstado, inicioDiaCuota } from '../../src/utils/usoFirestore.js';

const MONITORING = 'https://monitoring.googleapis.com/v3/projects';
const HORA_S = 3600;
const MINUTOS_ENTRE_RESUMENES = 15;

const FILTROS = {
  lecturas: 'metric.type="firestore.googleapis.com/document/read_count" AND resource.type="firestore_instance"',
  escrituras: 'metric.type="firestore.googleapis.com/document/write_count" AND resource.type="firestore_instance"',
  borrados: 'metric.type="firestore.googleapis.com/document/delete_count" AND resource.type="firestore_instance"',
  rechazos: 'metric.type="firestore.googleapis.com/rules/evaluation_count" AND resource.type="firestore.googleapis.com/Database" AND metric.labels.result!="ALLOW"',
  escuchadores: 'metric.type="firestore.googleapis.com/network/snapshot_listeners" AND resource.type="firestore_instance"',
  conexiones: 'metric.type="firestore.googleapis.com/network/active_connections" AND resource.type="firestore_instance"',
};

const iso = (ms) => new Date(ms).toISOString();

// Los puntos de una métrica sumada por periodos de `alineacionS` segundos entre `desde` y `hasta`: [{ hasta, valor }] del más viejo al más nuevo.
async function serie(env, token, filtro, desde, hasta, alineacionS, { alineador = 'ALIGN_SUM' } = {}) {
  const parametros = new URLSearchParams({
    filter: filtro, 'interval.startTime': iso(desde), 'interval.endTime': iso(hasta),
    'aggregation.alignmentPeriod': `${Math.max(60, Math.round(alineacionS))}s`, 'aggregation.perSeriesAligner': alineador, 'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  });
  const res = await fetch(`${MONITORING}/${env.FIREBASE_PROJECT_ID}/timeSeries?${parametros}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const error = new Error(`Monitoring respondió ${res.status}`);
    error.status = res.status;
    throw error;
  }
  const datos = await res.json();
  const puntos = (datos.timeSeries || []).flatMap((t) => t.points || []);
  return puntos.map((p) => ({ hasta: Date.parse(p.interval.endTime), valor: Number(Object.values(p.value)[0]) || 0 })).sort((a, b) => a.hasta - b.hasta);
}

// JS -> valor de Firestore (REST).
function aValor(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(aValor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, aValor(x)])) } };
}

// Lee las métricas y arma el estado. `deps.getGoogleAccessToken`: el token del Worker (con el alcance de Monitoring).
export async function calcularUsoFirestore(env, deps, ahoraMs = Date.now()) {
  const inicioDia = inicioDiaCuota(ahoraMs);
  try {
    const token = await deps.getGoogleAccessToken(env);
    const hace24h = ahoraMs - 24 * HORA_S * 1000;
    const delDia = (filtro) => serie(env, token, filtro, inicioDia, ahoraMs, (ahoraMs - inicioDia) / 1000).then((p) => p.reduce((s, x) => s + x.valor, 0));
    const porHora = (filtro) => serie(env, token, filtro, hace24h, ahoraMs, HORA_S);
    const ultimo = (filtro) => serie(env, token, filtro, ahoraMs - 15 * 60 * 1000, ahoraMs, 300, { alineador: 'ALIGN_MEAN' }).then((p) => (p.length ? p[p.length - 1].valor : null));
    const [hoyL, hoyE, hoyB, hL, hE, hB, hR, escuchadores, conexiones] = await Promise.all([
      delDia(FILTROS.lecturas), delDia(FILTROS.escrituras), delDia(FILTROS.borrados),
      porHora(FILTROS.lecturas), porHora(FILTROS.escrituras), porHora(FILTROS.borrados), porHora(FILTROS.rechazos),
      ultimo(FILTROS.escuchadores).catch(() => null), ultimo(FILTROS.conexiones).catch(() => null),
    ]);
    // Una fila por hora, con lo que tenga cada métrica en esa hora (una métrica sin datos en una hora cuenta 0).
    const horas = [...new Set([hL, hE, hB, hR].flatMap((s) => s.map((p) => p.hasta)))].sort((a, b) => a - b);
    const valorEn = (s, t) => s.find((p) => p.hasta === t)?.valor || 0;
    const filas = horas.map((t) => ({ hasta: t, lecturas: valorEn(hL, t), escrituras: valorEn(hE, t), borrados: valorEn(hB, t), rechazos: valorEn(hR, t) }));
    return armarEstado({ ahoraMs, inicioDia, hoy: { lecturas: hoyL, escrituras: hoyE, borrados: hoyB }, porHora: filas, escuchadores, conexiones });
  } catch (err) {
    const error = err.status === 403
      ? 'El Worker no tiene permiso para leer las métricas de Google Cloud: falta el rol "Monitoring Viewer" en su cuenta de servicio.'
      : `No se pudieron leer las métricas de Google Cloud: ${String(err.message).slice(0, 200)}`;
    return armarEstado({ ahoraMs, inicioDia, error });
  }
}

// Cron: cada 15 minutos (el cron corre cada 5).
export async function actualizarUsoFirestore(env, deps, ahoraMs = Date.now()) {
  if (new Date(ahoraMs).getUTCMinutes() % MINUTOS_ENTRE_RESUMENES >= 5) return { actualizado: false };
  const estado = await calcularUsoFirestore(env, deps, ahoraMs);
  const token = await deps.getGoogleAccessToken(env);
  await deps.commitFirestore(env, token, [{
    update: { name: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${deps.rutaDatos(env)}/estadoFirestore/actual`, fields: aValor(estado).mapValue.fields },
  }]);
  return { actualizado: true, error: estado.error };
}
