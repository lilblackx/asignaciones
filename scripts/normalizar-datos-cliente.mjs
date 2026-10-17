// Normaliza el nombre y la dirección de los clientes ya guardados (mayúsculas uniformes: "Angela Maria Ospino Borges"), las mismas reglas con
// que ahora se guardan los nuevos (src/utils/datosCliente.js). Arregla las órdenes en la lista (tickets) y el historial de cerradas
// (historialInstalaciones). NO toca los reportes de cierre (reports): son el registro de lo que se cerró ese día, tal como estaba.
// Solo escribe `nombre` y `direccion`, y solo en las que cambian; no toca la plantilla pegada ni ningún otro dato.
//
// Por defecto NO escribe nada, solo cuenta y muestra ejemplos. Para aplicar los cambios, agrega --aplicar. Se puede repetir: lo ya normalizado no cambia.
// Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/normalizar-datos-cliente.mjs C:\ruta\a\llave.json [--aplicar]
//   o: set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave.json && node scripts/normalizar-datos-cliente.mjs [--aplicar]
// Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { direccionCliente, nombrePersona } from '../src/utils/datosCliente.js';

const aplicar = process.argv.includes('--aplicar');
const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));
initializeApp({
  credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(),
  projectId: 'seguimientons-f2026',
});
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;

let lote = db.batch();
let enLote = 0;
async function escribir(ref, cambios) {
  lote.update(ref, cambios);
  if (++enLote === 450) { await lote.commit(); lote = db.batch(); enLote = 0; }
}

for (const coleccion of ['tickets', 'historialInstalaciones']) {
  const docs = (await db.collection(`${base}/${coleccion}`).get()).docs;
  let cambian = 0;
  const ejemplos = [];
  for (const d of docs) {
    const t = d.data();
    const cambios = {};
    if (typeof t.nombre === 'string' && nombrePersona(t.nombre) !== t.nombre) cambios.nombre = nombrePersona(t.nombre);
    if (typeof t.direccion === 'string' && direccionCliente(t.direccion) !== t.direccion) cambios.direccion = direccionCliente(t.direccion);
    if (!Object.keys(cambios).length) continue;
    cambian++;
    if (ejemplos.length < 8) ejemplos.push(`  ${t.codigo || d.id}: ${cambios.nombre ? `"${t.nombre}" -> "${cambios.nombre}"` : ''}${cambios.nombre && cambios.direccion ? ' | ' : ''}${cambios.direccion ? `"${t.direccion}" -> "${cambios.direccion}"` : ''}`);
    if (aplicar) await escribir(d.ref, cambios);
  }
  console.log(`${coleccion}: ${docs.length} documentos, ${cambian} ${aplicar ? 'se normalizaron' : 'se normalizarían'}.`);
  for (const e of ejemplos) console.log(e);
}
if (aplicar && enLote) await lote.commit();
if (!aplicar) console.log('\nNo se escribió nada. Corre de nuevo con --aplicar para guardar.');
