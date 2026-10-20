// Pasa a CANCELADO las órdenes que quedaron en estado ELIMINADO (la "papelera"), ahora que solo existe cancelada. A cada una le deja el motivo
// "Eliminada antes de que se unificara con cancelada", quién la eliminó (canceladaPor, de eliminadoPor) y una línea en su historial; no toca nada más.
// Revisa las órdenes (tickets) y el historial de cerradas (historialInstalaciones). NO toca los reportes de cierre (reports): son el registro de lo
// que se cerró ese día, tal como estaba. La app ya lee las ELIMINADO como canceladas aunque este script no se corra; correrlo deja los datos limpios.
//
// Por defecto NO escribe nada, solo cuenta y muestra ejemplos. Para aplicar los cambios, agrega --aplicar. Se puede repetir: lo ya migrado no cambia.
// Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/migrar-eliminadas-a-canceladas.mjs C:\ruta\a\llave.json [--aplicar]
//   o: set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave.json && node scripts/migrar-eliminadas-a-canceladas.mjs [--aplicar]
// Opcional: APP_ID (por defecto "default-app-id"). Con el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (no hace falta llave).
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { MOTIVO_ELIMINADA_ANTES } from '../src/utils/cancelacion.js';

const aplicar = process.argv.includes('--aplicar');
const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));
// Con el emulador no hace falta llave (y no se debe pasar una credencial); contra producción, la de la cuenta de servicio.
initializeApp(process.env.FIRESTORE_EMULATOR_HOST
  ? { projectId: 'seguimientons-f2026' }
  : { credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(), projectId: 'seguimientons-f2026' });
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;

let lote = db.batch();
let enLote = 0;
async function escribir(ref, cambios) {
  lote.update(ref, cambios);
  if (++enLote === 450) { await lote.commit(); lote = db.batch(); enLote = 0; }
}

for (const coleccion of ['tickets', 'historialInstalaciones']) {
  const docs = (await db.collection(`${base}/${coleccion}`).where('estado', '==', 'ELIMINADO').get()).docs;
  console.log(`${coleccion}: ${docs.length} en estado ELIMINADO`);
  for (const d of docs.slice(0, 8)) console.log(`  ${d.data().codigo || d.id} (eliminada por ${d.data().eliminadoPor || '?'})`);
  if (!aplicar) continue;
  for (const d of docs) {
    const t = d.data();
    const cambios = { estado: 'CANCELADO', motivoCancelacion: t.motivoCancelacion || MOTIVO_ELIMINADA_ANTES, canceladaPor: t.canceladaPor || t.eliminadoPor || '' };
    if (coleccion === 'tickets') {
      cambios.historialEdiciones = FieldValue.arrayUnion({
        fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }), operador: 'MIGRACIÓN', tipo: 'cancelado',
        detalle: `Estado: CANCELADO | Motivo de cancelación: ${cambios.motivoCancelacion}`,
      });
    }
    await escribir(d.ref, cambios);
  }
}
if (aplicar && enLote > 0) await lote.commit();
console.log(aplicar ? 'Listo: las órdenes ELIMINADO pasaron a CANCELADO.' : 'No se escribió nada. Agrega --aplicar para migrar.');
process.exit(0);
