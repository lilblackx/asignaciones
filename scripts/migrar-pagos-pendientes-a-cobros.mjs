// Pasa UNA SOLA VEZ a Administración los "paga después" que quedaron pendientes en el flujo anterior (los pagos de pagosOrdenes con estado PENDIENTE_COBRO): cada uno se convierte en un cobro
// pendiente en cobrosClientes, con su monto, su fecha original y de dónde viene en el historial. Los pagos que los técnicos sí registraron (por conciliar o conciliados) se quedan como están,
// como historial. No toca los pagos de pagosOrdenes ni las órdenes. Si ya existe el cobro de una orden, la salta: se puede repetir sin duplicar.
//
// Por defecto NO escribe nada: cuenta y lista lo que pasaría. Con --aplicar escribe.
//
// Uso (la llave va en tu consola, nunca dentro del repo):
//   node scripts/migrar-pagos-pendientes-a-cobros.mjs C:\ruta\a\llave-firebase.json [--aplicar]
//   o con GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave-firebase.json en lugar de pasar la ruta.
// Opcional: APP_ID (por defecto "default-app-id"). Con el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (no hace falta llave).
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cobroDesdePagoPendiente } from '../src/utils/cobrosClientes.js';

const aplicar = process.argv.includes('--aplicar');
const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));
initializeApp(process.env.FIRESTORE_EMULATOR_HOST
  ? { projectId: 'seguimientons-f2026' }
  : { credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(), projectId: 'seguimientons-f2026' });
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;
const ahora = Date.now();

const pendientes = (await db.collection(`${base}/pagosOrdenes`).where('estado', '==', 'PENDIENTE_COBRO').get()).docs;
const aMigrar = [];
const yaExisten = [];
const sinMonto = [];
for (const d of pendientes) {
  const pago = { ...d.data(), ticketId: d.data().ticketId || d.id };
  const cobro = cobroDesdePagoPendiente(pago, { ahora });
  if (!cobro) { sinMonto.push(pago); continue; }
  if ((await db.doc(`${base}/cobrosClientes/${cobro.ticketId}`).get()).exists) { yaExisten.push(cobro); continue; }
  aMigrar.push(cobro);
}

console.log(`Pagos "paga después" pendientes: ${pendientes.length}`);
console.log(`  - pasarían a Administración: ${aMigrar.length}`);
for (const c of aMigrar) console.log(`      ${c.codigo || 'S/C'} · ${c.nombre} · ${c.esInstalacion ? 'instalación (monto por definir)' : `${c.monto} ${c.moneda}`} · ${c.tecnico}`);
console.log(`  - ya tienen su cobro (se saltan): ${yaExisten.length}`);
console.log(`  - sin monto que cobrar (no pasan): ${sinMonto.length}`);
for (const p of sinMonto) console.log(`      ${p.codigo || 'S/C'} · ${p.nombre} · ${p.tipoTrabajo}`);

if (!aplicar) {
  console.log('\nNo se escribió nada. Con --aplicar se crean los cobros.');
  process.exit(0);
}
for (const c of aMigrar) await db.doc(`${base}/cobrosClientes/${c.ticketId}`).set(c);
console.log(`\nListo: ${aMigrar.length} cobros creados.`);
process.exit(0);
