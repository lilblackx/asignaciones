// Prueba el resumen de uso de Firestore del proyecto (src/utils/usoFirestore.js y cf-worker/src/usoFirestore.js) con métricas simuladas.
// No necesita el emulador ni Google Cloud. Uso: `node scripts/test-uso-firestore.mjs`.
import { readFileSync } from 'node:fs';
import { CUOTA_GRATIS, UMBRALES_PROYECTO, alertasProyecto, armarEstado, inicioDiaCuota } from '../src/utils/usoFirestore.js';
import { actualizarUsoFirestore, calcularUsoFirestore } from '../cf-worker/src/usoFirestore.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- El día de la cuota empieza a medianoche del Pacífico ---
check('31/10/2026 (horario de verano del Pacífico): empieza a las 07:00 UTC (03:00 en Caracas)', new Date(inicioDiaCuota(Date.parse('2026-10-31T16:00:00Z'))).toISOString(), '2026-10-31T07:00:00.000Z');
check('antes de esa hora todavía cuenta el día anterior', new Date(inicioDiaCuota(Date.parse('2026-10-31T06:59:00Z'))).toISOString(), '2026-10-30T07:00:00.000Z');
check('en invierno (horario estándar del Pacífico) empieza a las 08:00 UTC', new Date(inicioDiaCuota(Date.parse('2026-12-15T12:00:00Z'))).toISOString(), '2026-12-15T08:00:00.000Z');

// --- Alertas del proyecto ---
check('un día normal: sin alertas', alertasProyecto({ ultimaHora: { lecturas: 900, escrituras: 60, borrados: 20, rechazos: 5 }, hoy: { lecturas: 12000, escrituras: 400, borrados: 100 } }), []);
const incidente = alertasProyecto({ ultimaHora: { lecturas: 21000, escrituras: 35, borrados: 2, rechazos: 21000 }, hoy: { lecturas: 81779, escrituras: 350, borrados: 69 } });
check('el incidente del 31/10: cuota pasada, lecturas por hora y rechazos de las reglas', [incidente.length, incidente[0].startsWith('Hoy ya se pasó la cuota gratis de lecturas'), incidente.some((a) => a.includes('lecturas en la última hora')), incidente.some((a) => a.startsWith('Las reglas rechazaron'))], [3, true, true, true]);
check(`al ${UMBRALES_PROYECTO.cuotaPorcentaje}% de la cuota avisa antes de que se pase`, alertasProyecto({ hoy: { lecturas: 0.85 * CUOTA_GRATIS.lecturas } }), ['Hoy va el 85% de la cuota gratis de lecturas (42.500 de 50.000)']);
check('escrituras y borrados anómalos', alertasProyecto({ ultimaHora: { escrituras: 1001, borrados: 501 } }).length, 2);
check('los umbrales son los mismos de las alertas por correo (5.000 lecturas, 1.000 escrituras y 500 borrados por hora)', [UMBRALES_PROYECTO.lecturasHora, UMBRALES_PROYECTO.escriturasHora, UMBRALES_PROYECTO.borradosHora], [5000, 1000, 500]);
check('con error no inventa alertas', armarEstado({ ahoraMs: 1, inicioDia: 0, error: 'sin permiso' }).alertas, []);

// --- El Worker: lee las métricas y arma el estado ---
const AHORA = Date.parse('2026-10-31T16:55:00Z');
const llamadas = [];
globalThis.fetch = async (url) => {
  const u = new URL(url);
  const filtro = u.searchParams.get('filter');
  llamadas.push(filtro);
  const periodo = Number(u.searchParams.get('aggregation.alignmentPeriod').replace('s', ''));
  const valor = filtro.includes('read_count') ? 1000 : filtro.includes('write_count') ? 50 : filtro.includes('delete_count') ? 5 : filtro.includes('evaluation_count') ? 2 : filtro.includes('snapshot_listeners') ? 40.4 : 8;
  // Una sola franja para el día de la cuota; 24 franjas de una hora para las últimas 24 horas; una para los medidores de "ahora".
  const franjas = periodo === 3600 ? 24 : 1;
  const points = Array.from({ length: franjas }, (_, i) => ({ interval: { endTime: new Date(AHORA - i * 3600 * 1000).toISOString() }, value: { int64Value: String(periodo === 3600 ? valor : valor * (periodo > 3600 ? 10 : 1)) } }));
  return { ok: true, json: async () => ({ timeSeries: [{ points }] }) };
};
const env = { FIREBASE_PROJECT_ID: 'p' };
const deps = { getGoogleAccessToken: async () => 'token' };
const estado = await calcularUsoFirestore(env, deps, AHORA);
check('del día de la cuota: lecturas, escrituras y borrados', estado.hoy, { lecturas: 10000, escrituras: 500, borrados: 50 });
check('24 horas, de la más vieja a la más nueva, con las cuatro métricas', [estado.porHora.length, estado.porHora[23].hasta === AHORA, estado.porHora[0]], [24, true, { hasta: AHORA - 23 * 3600 * 1000, lecturas: 1000, escrituras: 50, borrados: 5, rechazos: 2 }]);
check('escuchadores y conexiones abiertos ahora (enteros)', [estado.escuchadores, estado.conexiones], [40, 8]);
check('las reglas rechazadas se cuentan sin las permitidas', llamadas.some((f) => f.includes('evaluation_count') && f.includes('result!="ALLOW"')), true);

globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
const sinPermiso = await calcularUsoFirestore(env, deps, AHORA);
check('sin el rol Monitoring Viewer: lo dice en vez de fallar', sinPermiso.error.includes('Monitoring Viewer'), true);

// --- Cada 15 minutos, y guarda un solo documento ---
const escritos = [];
const depsCommit = { ...deps, rutaDatos: () => 'artifacts/a/public/data', commitFirestore: async (_e, _t, writes) => escritos.push(...writes) };
check('fuera de los minutos 0, 15, 30 y 45 no hace nada', (await actualizarUsoFirestore(env, depsCommit, Date.parse('2026-10-31T16:07:00Z'))).actualizado, false);
await actualizarUsoFirestore(env, depsCommit, Date.parse('2026-10-31T16:15:30Z'));
check('en su turno guarda estadoFirestore/actual', [escritos.length, escritos[0]?.update?.name.endsWith('/artifacts/a/public/data/estadoFirestore/actual')], [1, true]);

// --- Conectado al cron, con el alcance de Monitoring, y protegido en las reglas ---
const worker = readFileSync(new URL('../cf-worker/src/index.js', import.meta.url), 'utf8');
check('el cron lo corre y el token pide leer métricas', [worker.includes('actualizarUsoFirestore(env, depsInventario, event.scheduledTime)'), worker.includes('auth/monitoring.read')], [true, true]);
const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
check('estadoFirestore: lo leen solo los de Estaciones y nadie lo escribe desde la app', /estadoFirestore\/\{docId\} \{\n\s*allow read: if veEstaciones\(appId\);\n\s*allow write: if false;/.test(reglas), true);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
