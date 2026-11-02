// Pone la marca de pago (pendientePago y pagoId) a las revisiones de pagos (revisionPagos) que ya existían, para que Finanzas lea "lo aprobado y sin pagar" por esa marca (ver utils/revisionPagos.js).
// Cada revisión queda así: pendientePago true si está APROBADA y su orden no está en ordenesPagadas; si la orden está pagada, pagoId es el de su pago y pendientePago false. Se puede correr las veces que haga falta:
// solo escribe las revisiones que no están ya bien. Por defecto SOLO MUESTRA lo que haría (no escribe nada); con --aplicar lo escribe.
//
// Cuándo correrlo al desplegar (ver la nota del despliegue): después de subir las reglas nuevas y antes de subir la app; y otra vez justo después de subir la app, por si alguien pagó o aprobó con la versión vieja.
//
// Uso (con la llave de una cuenta de servicio con permiso de lectura y escritura en Firestore, nunca dentro del repo):
//   node scripts/marcar-pendientes-de-pago.mjs C:\ruta\a\llave.json [--aplicar]
//   o con el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/marcar-pendientes-de-pago.mjs [--aplicar]
// Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { marcasDeRevision } from '../src/utils/revisionPagos.js';

const args = process.argv.slice(2);
const llave = args.find((a) => a.toLowerCase().endsWith('.json'));
const aplicar = args.includes('--aplicar');
const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
initializeApp(enEmulador
  ? { projectId: 'seguimientons-f2026' }
  : { credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(), projectId: 'seguimientons-f2026' });

const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;
const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

const [revisiones, ordenesPagadas] = await Promise.all([db.collection(`${base}/revisionPagos`).get().then(aLista), db.collection(`${base}/ordenesPagadas`).get().then(aLista)]);
const { actualizar, pendientes, pagadas, sinRevision } = marcasDeRevision(revisiones, ordenesPagadas);

console.log(`${enEmulador ? 'EMULADOR' : 'PRODUCCIÓN'} · revisiones: ${revisiones.length} · órdenes pagadas: ${ordenesPagadas.length}`);
console.log(`Quedan pendientes de pago: ${pendientes} · pagadas: ${pagadas} · a escribir: ${actualizar.length}`);
const porTipo = (f) => actualizar.filter(f).length;
console.log(`  a marcar pendientes de pago: ${porTipo((a) => a.datos.pendientePago)} · a marcar con su pago: ${porTipo((a) => a.datos.pagoId)} · a dejar sin pendiente ni pago: ${porTipo((a) => !a.datos.pendientePago && !a.datos.pagoId)}`);
if (sinRevision.length > 0) console.log(`AVISO: ${sinRevision.length} orden(es) pagada(s) sin revisión (no se tocan): ${sinRevision.slice(0, 20).join(', ')}${sinRevision.length > 20 ? '…' : ''}`);

if (!aplicar) { console.log('\nNo se escribió nada. Para aplicarlo, repite el comando con --aplicar.'); process.exit(0); }

for (let i = 0; i < actualizar.length; i += 400) {
  const lote = db.batch();
  for (const { id, datos } of actualizar.slice(i, i + 400)) lote.update(db.doc(`${base}/revisionPagos/${id}`), datos);
  await lote.commit();
}
// Se vuelve a leer para comprobarlo.
const despues = marcasDeRevision(await db.collection(`${base}/revisionPagos`).get().then(aLista), ordenesPagadas);
console.log(`\nListo: se escribieron ${actualizar.length}. Comprobación: quedan ${despues.actualizar.length} por escribir (debe ser 0) · pendientes de pago ${despues.pendientes} · pagadas ${despues.pagadas}.`);
process.exit(despues.actualizar.length === 0 ? 0 : 1);
