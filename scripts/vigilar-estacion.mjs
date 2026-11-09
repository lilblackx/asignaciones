// SOLO LECTURA. Sigue en vivo lo que cada estación (navegador con la app abierta) de un usuario reporta a Firestore de producción: cuántas lecturas hizo en
// cada ventana y de qué colección, cuántas suscripciones nuevas abrió y cuántos oyentes tiene activos. Sirve para ver qué cuesta cada cosa que haces en
// la app (abrir Finanzas, cambiar de mes, abrir Revisión...): usa la app con normalidad en tu navegador y mira esta pantalla.
// Cada estación reporta cada ~2 minutos (hooks/useEstacion), así que el efecto de una acción aparece en el siguiente reporte.
//
// Uso (con la llave de una cuenta de servicio con permiso de lectura, nunca dentro del repo):
//   node scripts/vigilar-estacion.mjs C:\ruta\a\llave.json <usuario> [--todas]
// Por defecto solo muestra las estaciones abiertas en las últimas 2 horas; con --todas, las de todo el día. Ctrl+C para terminar.
// Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const [llave, usuario] = args.filter((a) => !a.startsWith('--'));
if (!llave || !usuario) { console.error('Uso: node scripts/vigilar-estacion.mjs <llave.json> <usuario> [--todas]'); process.exit(1); }
const ventanaMs = (args.includes('--todas') ? 24 : 2) * 3600e3;

initializeApp({ credential: cert(JSON.parse(readFileSync(llave, 'utf8'))), projectId: 'seguimientons-f2026' });
const appId = process.env.APP_ID || 'default-app-id';
const db = getFirestore();

const hora = (ms) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(ms));
const lista = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ') || '-';
const previo = new Map(); // estacionId -> total del reporte anterior

console.log(`Vigilando las estaciones de "${usuario}" (Ctrl+C para terminar). Usa la app y espera el siguiente reporte (~2 min).\n`);
db.collection(`artifacts/${appId}/public/data/estaciones`).where('usuario', '==', usuario).onSnapshot((snap) => {
  snap.docChanges().forEach((c) => {
    if (c.type === 'removed') return;
    const e = c.doc.data();
    if (Date.now() - Number(e.ultimaSenal) > ventanaMs) return;
    const antes = previo.get(e.estacionId);
    previo.set(e.estacionId, e.total);
    const v = e.ventana || {};
    const dSusc = antes ? e.total.suscripciones - antes.suscripciones : e.total.suscripciones;
    const dLect = antes ? e.total.lecturas - antes.lecturas : e.total.lecturas;
    console.log(`${hora(e.ultimaSenal)}  ${e.estacionId.slice(0, 6)}  ${e.equipo?.movil ? 'móvil' : 'PC'}  build ${e.build}  ${e.visible ? 'visible' : 'en segundo plano'}`);
    console.log(`   lecturas: ${dLect}${antes ? '' : ' (desde que se abrió)'} · total ${e.total.lecturas} · ventana ${v.lecturas ?? 0} [${lista(v.porColeccion)}]`);
    console.log(`   escrituras ventana ${v.escrituras ?? 0} [${lista(v.escriturasPorColeccion)}] · suscripciones nuevas ${dSusc} (total ${e.total.suscripciones}) · oyentes activos ${e.escuchadoresActivos}`);
    if (e.anomalia) console.log(`   ALERTA: ${e.anomalia}`);
    if (e.ultimoError) console.log(`   último error: ${e.ultimoError}`);
    console.log('');
  });
}, (error) => { console.error('No se pudo leer:', error.message); process.exit(1); });
