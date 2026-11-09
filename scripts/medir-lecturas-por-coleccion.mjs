// SOLO LECTURA. Suma, mientras corre, todo lo que cada estación (navegador con la app abierta) reporta a Firestore de producción: lecturas y escrituras por
// colección, por rol y por usuario. Cada estación reporta cada ~2 minutos una ventana con sus lecturas (hooks/useEstacion); aquí se suma cada ventana una sola
// vez, así que el total es exacto para lo que hacen los navegadores (no incluye al Worker ni a los scripts, que se calculan aparte: ver el final).
// Sirve para saber qué colecciones y qué usuarios gastan más lecturas antes de tocar nada.
//
// Uso (con la llave de una cuenta de servicio con permiso de lectura, nunca dentro del repo):
//   node scripts/medir-lecturas-por-coleccion.mjs C:\ruta\a\llave.json [--hasta=HH:MM] [--salida=archivo.json]
// `--hasta` es la hora de Caracas en que termina (por defecto, hasta Ctrl+C). Muestra un resumen cada 10 minutos y lo guarda en --salida (por defecto
// medicion-lecturas.json en la carpeta actual; lleva nombres de usuario, guárdalo fuera del repo).
// OJO: escucha toda la colección de estaciones, y cada reporte de cada estación le cuesta una lectura (unas 500 por hora con 16 estaciones).
// Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const llave = args.find((a) => a.toLowerCase().endsWith('.json') && !a.startsWith('--'));
const hastaTxt = args.find((a) => a.startsWith('--hasta='))?.slice('--hasta='.length);
const salida = args.find((a) => a.startsWith('--salida='))?.slice('--salida='.length) || 'medicion-lecturas.json';
if (!llave) { console.error('Uso: node scripts/medir-lecturas-por-coleccion.mjs <llave.json> [--hasta=HH:MM] [--salida=archivo.json]'); process.exit(1); }

const HORA = 3600e3;
const inicio = Date.now();
let fin = Infinity;
if (hastaTxt) {
  const [h, m] = hastaTxt.split(':').map(Number);
  const hoyCaracas = new Date(inicio - 4 * HORA).toISOString().slice(0, 10);
  fin = Date.parse(`${hoyCaracas}T${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00-04:00`);
  if (!(fin > inicio)) { console.error(`La hora ${hastaTxt} ya pasó (hora de Caracas).`); process.exit(1); }
}

initializeApp({ credential: cert(JSON.parse(readFileSync(llave, 'utf8'))), projectId: 'seguimientons-f2026' });
const appId = process.env.APP_ID || 'default-app-id';
const db = getFirestore();

const vistas = new Set();
const sumar = (obj, clave, n) => { obj[clave] = (obj[clave] || 0) + n; };
const acum = { ventanas: 0, lecturas: 0, escrituras: 0, porColeccion: {}, escriturasPorColeccion: {}, porRol: {}, porUsuario: {}, porRolColeccion: {}, suscripciones: 0, segundosCubiertos: 0, estaciones: new Set() };

function procesar(e) {
  const v = e.ventana;
  if (!v || !(v.hasta >= inicio)) return;
  const clave = `${e.estacionId}:${v.hasta}`;
  if (vistas.has(clave)) return;
  vistas.add(clave);
  acum.ventanas++;
  acum.estaciones.add(e.estacionId);
  acum.lecturas += v.lecturas || 0;
  acum.escrituras += v.escrituras || 0;
  acum.suscripciones += v.suscripciones || 0;
  acum.segundosCubiertos += Math.max(0, (v.hasta - v.desde) / 1000);
  for (const [c, n] of Object.entries(v.porColeccion || {})) { sumar(acum.porColeccion, c, n); sumar(acum.porRolColeccion, `${e.rol}/${c}`, n); }
  for (const [c, n] of Object.entries(v.escriturasPorColeccion || {})) sumar(acum.escriturasPorColeccion, c, n);
  sumar(acum.porRol, e.rol, v.lecturas || 0);
  sumar(acum.porUsuario, `${e.usuario} (${e.rol}${e.equipo?.movil ? ', móvil' : ', PC'})`, v.lecturas || 0);
}

const orden = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
const pct = (n, t) => (t ? `${((n / t) * 100).toFixed(0)}%` : '-');
const tabla = (o, total, tope = 12) => orden(o).slice(0, tope).map(([k, n]) => `   ${String(n).padStart(7)}  ${pct(n, total).padStart(4)}  ${k}`).join('\n') || '   -';

function resumen() {
  const minutos = Math.round((Date.now() - inicio) / 60000);
  const t = acum.lecturas;
  const texto = [
    `\n=== ${new Date(Date.now() - 4 * HORA).toISOString().slice(11, 19)} Caracas · ${minutos} min medidos · ${acum.estaciones.size} estaciones · ${acum.ventanas} reportes ===`,
    `Lecturas de los navegadores: ${t} · escrituras: ${acum.escrituras} · suscripciones nuevas: ${acum.suscripciones}`,
    'Por colección:', tabla(acum.porColeccion, t),
    'Por rol:', tabla(acum.porRol, t),
    'Por usuario:', tabla(acum.porUsuario, t),
    'Por rol y colección (las 10 mayores):', tabla(acum.porRolColeccion, t, 10),
    'Escrituras por colección:', tabla(acum.escriturasPorColeccion, acum.escrituras, 8),
  ].join('\n');
  console.log(texto);
  writeFileSync(salida, JSON.stringify({ inicio, hasta: Date.now(), ...acum, estaciones: [...acum.estaciones] }, null, 1));
}

console.log(`Midiendo desde ahora${hastaTxt ? ` hasta las ${hastaTxt} (Caracas)` : ' (Ctrl+C para terminar)'}. Resumen cada 10 minutos; se guarda en ${salida}.`);
const escucha = db.collection(`artifacts/${appId}/public/data/estaciones`).onSnapshot(
  (snap) => snap.docChanges().forEach((c) => { if (c.type !== 'removed') procesar(c.doc.data()); }),
  (error) => { console.error('No se pudo leer:', error.message); process.exit(1); },
);
const cada10 = setInterval(resumen, 10 * 60 * 1000);
const terminar = () => { clearInterval(cada10); escucha(); resumen(); console.log(`\nTerminado. Compara el total con el del día en scripts/medir-consumo.mjs: la diferencia es el Worker, los scripts y las lecturas que no alcanzaron a reportarse.`); process.exit(0); };
process.on('SIGINT', terminar);
if (Number.isFinite(fin)) setTimeout(terminar, fin - Date.now());
