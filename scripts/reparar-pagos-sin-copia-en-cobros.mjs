// Repara los cobros de Administración que siguen diciendo "Técnico sin registrar el pago" aunque la oficina (ADMIN) ya registró ese pago a nombre del técnico: la copia del pago al cobro se escribía con una
// forma que las reglas rechazaban en silencio (ya corregido en la app, ver copiarAlCobro en lib/pagosOrdenes). Para cada cobro vigente sin `pagoCliente` que tenga su pago en `pagosOrdenes`, copia el
// resumen del pago al cobro y deja una entrada en su historial. No toca los pagos ni las órdenes. Se puede repetir: los cobros que ya tienen la copia se saltan.
//
// Por defecto NO escribe nada: cuenta y lista lo que pasaría. Con --aplicar escribe.
//
// Uso (la llave va en tu consola, nunca dentro del repo):
//   node scripts/reparar-pagos-sin-copia-en-cobros.mjs C:\ruta\a\llave-firebase.json [--aplicar]
//   o con GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave-firebase.json en lugar de pasar la ruta.
// Opcional: APP_ID (por defecto "default-app-id"). Con el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (no hace falta llave).
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { lineaDePago, resumenDePago } from '../src/utils/pagoEnOrden.js';

const aplicar = process.argv.includes('--aplicar');
const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));
initializeApp(process.env.FIRESTORE_EMULATOR_HOST
  ? { projectId: 'seguimientons-f2026' }
  : { credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(), projectId: 'seguimientons-f2026' });
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;
const ahora = Date.now();

const cobros = (await db.collection(`${base}/cobrosClientes`).get()).docs.filter((d) => !d.data().anulado && !d.data().pagoCliente);
const aReparar = [];
for (const c of cobros) {
  const pago = await db.doc(`${base}/pagosOrdenes/${c.id}`).get();
  if (!pago.exists) continue;
  const p = pago.data();
  aReparar.push({ id: c.id, cobro: c.data(), resumen: resumenDePago(p, p.corregidoPor ? { corregidoPor: p.corregidoPor, corregidoEn: p.corregidoEn } : {}) });
}

console.log(`Cobros vigentes sin la copia del pago: ${cobros.length}`);
console.log(`  - con su pago guardado (se repararían): ${aReparar.length}`);
for (const r of aReparar) console.log(`      ${r.cobro.codigo || 'S/C'} · ${r.cobro.nombre} · ${r.cobro.tecnico} · ${lineaDePago(r.resumen)}`);
console.log(`  - sin pago registrado todavía (se dejan): ${cobros.length - aReparar.length}`);

if (!aplicar) {
  console.log('\nNo se escribió nada. Con --aplicar se copian los pagos a los cobros.');
  process.exit(0);
}
for (const r of aReparar) {
  const entrada = { en: ahora, por: 'reparación', detalle: `Pago del cliente copiado al cobro: ${lineaDePago(r.resumen)}` };
  await db.doc(`${base}/cobrosClientes/${r.id}`).update({ pagoCliente: r.resumen, actualizadoEn: ahora, historial: [...(r.cobro.historial || []), entrada] });
}
console.log(`\nListo: ${aReparar.length} cobros reparados.`);
process.exit(0);
