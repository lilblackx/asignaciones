// Respaldo de Firestore a archivos JSON en esta PC: una carpeta con fecha y hora dentro de respaldos/, un archivo por colección y un resumen.json
// con la cantidad de documentos de cada una. Solo LEE (no escribe nada en Firestore); cada documento leído cuenta contra la cuota diaria de lecturas
// del plan Spark (50 000), así que conviene correrlo una vez al día o a la semana, no seguido.
// Las fechas (Timestamp), referencias y coordenadas se guardan con una marca de tipo ({ "__tipo": "timestamp", ... }) para poder restaurarlas igual.
// Respaldo de colecciones de primer nivel: si algún día hay subcolecciones dentro de un documento, no se incluyen.
// NO respalda los usuarios de Authentication (correo/contraseña) ni los archivos de Storage.
//
// Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/respaldar-firestore.mjs C:\ruta\a\llave.json [carpeta-destino]
//   o: set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave.json && node scripts/respaldar-firestore.mjs [carpeta-destino]
// Opcional: APP_ID (por defecto "default-app-id"). Por defecto guarda en respaldos/ (carpeta ignorada por git: tiene datos de clientes).
// Con el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (no hace falta llave).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { Timestamp, GeoPoint, DocumentReference, getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const llave = args.find((a) => a.toLowerCase().endsWith('.json'));
const destinoBase = args.find((a) => a !== llave) || 'respaldos';
// Con el emulador no hace falta llave (y no se debe pasar una credencial); contra producción, la de la cuenta de servicio.
initializeApp(process.env.FIRESTORE_EMULATOR_HOST
  ? { projectId: 'seguimientons-f2026' }
  : { credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(), projectId: 'seguimientons-f2026' });
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;

// Convierte los tipos propios de Firestore a JSON conservando el tipo.
function aJson(valor) {
  if (valor instanceof Timestamp) return { __tipo: 'timestamp', segundos: valor.seconds, nanosegundos: valor.nanoseconds, iso: valor.toDate().toISOString() };
  if (valor instanceof GeoPoint) return { __tipo: 'geopoint', latitud: valor.latitude, longitud: valor.longitude };
  if (valor instanceof DocumentReference) return { __tipo: 'referencia', ruta: valor.path };
  if (Array.isArray(valor)) return valor.map(aJson);
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, aJson(v)]));
  return valor;
}

const ahora = new Date();
const dos = (n) => String(n).padStart(2, '0');
const carpeta = join(destinoBase, `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}_${dos(ahora.getHours())}${dos(ahora.getMinutes())}`);
mkdirSync(carpeta, { recursive: true });

// "data" es un documento: sus subcolecciones son todas las colecciones de la app, incluso las que no estén listadas en el código.
const colecciones = await db.doc(base).listCollections();
const resumen = { fecha: ahora.toISOString(), proyecto: 'seguimientons-f2026', ruta: base, colecciones: {} };
let total = 0;
for (const col of colecciones) {
  const docs = (await col.get()).docs;
  const datos = Object.fromEntries(docs.map((d) => [d.id, aJson(d.data())]));
  writeFileSync(join(carpeta, `${col.id}.json`), JSON.stringify(datos, null, 2), 'utf8');
  resumen.colecciones[col.id] = docs.length;
  total += docs.length;
  console.log(`${col.id}: ${docs.length} documentos`);
}
resumen.totalDocumentos = total;
writeFileSync(join(carpeta, 'resumen.json'), JSON.stringify(resumen, null, 2), 'utf8');
console.log(`Listo: ${total} documentos de ${colecciones.length} colecciones guardados en ${carpeta}`);
if (!colecciones.length) console.log('Aviso: no se encontró ninguna colección. Revisa APP_ID y la llave.');
process.exit(0);
