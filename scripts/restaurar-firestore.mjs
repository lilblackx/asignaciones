// Restaura Firestore desde una carpeta creada por respaldar-firestore.mjs (respaldos/AAAA-MM-DD_HHMM). Devuelve las fechas, referencias y coordenadas a su
// tipo original. Escribe documentos con el mismo id que tenían: NO borra nada de lo que esté en Firestore y no esté en el respaldo.
//
// Por defecto NO escribe nada, solo cuenta qué haría. Para aplicar, agrega --aplicar. Cada documento escrito cuenta contra las 20 000 escrituras diarias del plan Spark.
//   --solo-faltantes   crea solo los documentos que ya no existen y deja intactos los que siguen ahí (para recuperar borrados sin perder cambios nuevos)
//   --solo=a,b         restaura solo esas colecciones (por ejemplo --solo=tickets,pagosTecnicos)
// Sin --solo-faltantes, los documentos que sí existen se SOBRESCRIBEN con la versión del respaldo (vuelven a como estaban ese día).
//
// Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/restaurar-firestore.mjs respaldos\2026-10-22_1033 C:\ruta\a\llave.json [--solo-faltantes] [--solo=tickets] [--aplicar]
//   o: set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave.json && node scripts/restaurar-firestore.mjs respaldos\2026-10-22_1033 [...]
// Opcional: APP_ID (por defecto "default-app-id"). Con el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (no hace falta llave).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { Timestamp, GeoPoint, getFirestore } from 'firebase-admin/firestore';

const aplicar = process.argv.includes('--aplicar');
const soloFaltantes = process.argv.includes('--solo-faltantes');
const soloArg = process.argv.find((a) => a.startsWith('--solo='));
const solo = soloArg ? soloArg.slice('--solo='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const llave = args.find((a) => a.toLowerCase().endsWith('.json'));
const carpeta = args.find((a) => a !== llave);
if (!carpeta) {
  console.error('Falta la carpeta del respaldo. Ejemplo: node scripts/restaurar-firestore.mjs respaldos\\2026-10-22_1033 C:\\ruta\\a\\llave.json');
  process.exit(1);
}

// Con el emulador no hace falta llave (y no se debe pasar una credencial); contra producción, la de la cuenta de servicio.
initializeApp(process.env.FIRESTORE_EMULATOR_HOST
  ? { projectId: 'seguimientons-f2026' }
  : { credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(), projectId: 'seguimientons-f2026' });
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;

// Inverso de aJson de respaldar-firestore.mjs.
function deJson(valor) {
  if (Array.isArray(valor)) return valor.map(deJson);
  if (valor && typeof valor === 'object') {
    if (valor.__tipo === 'timestamp') return new Timestamp(valor.segundos, valor.nanosegundos);
    if (valor.__tipo === 'geopoint') return new GeoPoint(valor.latitud, valor.longitud);
    if (valor.__tipo === 'referencia') return db.doc(valor.ruta);
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, deJson(v)]));
  }
  return valor;
}

let resumen;
try {
  resumen = JSON.parse(readFileSync(join(carpeta, 'resumen.json'), 'utf8'));
} catch {
  console.error(`No encontré resumen.json en "${carpeta}". ¿Es una carpeta de respaldo de respaldar-firestore.mjs?`);
  process.exit(1);
}
const archivos = readdirSync(carpeta).filter((f) => f.endsWith('.json') && f !== 'resumen.json').map((f) => f.slice(0, -'.json'.length));
const colecciones = solo ? archivos.filter((c) => solo.includes(c)) : archivos;
const noEncontradas = (solo || []).filter((c) => !archivos.includes(c));
if (noEncontradas.length) console.log(`Aviso: no hay respaldo de ${noEncontradas.join(', ')}.`);

console.log(`Respaldo del ${resumen.fecha} (ruta ${resumen.ruta}). Destino: ${base}${process.env.FIRESTORE_EMULATOR_HOST ? ' [EMULADOR]' : ' [PRODUCCIÓN]'}`);
console.log(soloFaltantes ? 'Modo: solo los documentos que faltan (no se pisa nada).' : 'Modo: sobrescribir con la versión del respaldo.');

const escritor = db.bulkWriter();
let escritos = 0;
let yaExistian = 0;
for (const col of colecciones) {
  const datos = JSON.parse(readFileSync(join(carpeta, `${col}.json`), 'utf8'));
  const ids = Object.keys(datos);
  let faltan = ids.length;
  if (soloFaltantes || !aplicar) {
    // Se cuentan los que ya existen para informar; cuesta una lectura por documento.
    let cuantos = 0;
    for (let i = 0; i < ids.length; i += 300) {
      const tanda = await db.getAll(...ids.slice(i, i + 300).map((id) => db.doc(`${base}/${col}/${id}`)), { fieldMask: [] });
      cuantos += tanda.filter((d) => d.exists).length;
    }
    faltan = ids.length - cuantos;
    console.log(`${col}: ${ids.length} en el respaldo, ${cuantos} ya existen, ${faltan} faltan`);
  } else {
    console.log(`${col}: ${ids.length} documentos`);
  }
  if (!aplicar) continue;
  for (const id of ids) {
    const ref = db.doc(`${base}/${col}/${id}`);
    const datosDoc = deJson(datos[id]);
    if (soloFaltantes) {
      escritor.create(ref, datosDoc).then(() => { escritos++; }, (e) => {
        if (e.code === 6) yaExistian++; // ALREADY_EXISTS: se deja como está
        else throw e;
      });
    } else {
      escritor.set(ref, datosDoc).then(() => { escritos++; });
    }
  }
}
if (aplicar) {
  await escritor.close();
  console.log(`Listo: ${escritos} documentos escritos${soloFaltantes ? `, ${yaExistian} ya existían y se dejaron igual` : ''}.`);
} else {
  console.log('No se escribió nada. Agrega --aplicar para restaurar.');
}
process.exit(0);
