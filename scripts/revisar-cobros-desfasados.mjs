// Busca los cobros de Administración (cobrosClientes) que ya no coinciden con su orden: por ejemplo una orden finalizada con cobro, devuelta a pre-finalizada y cerrada
// exonerada, cuyo cobro pendiente se quedó en la lista. Aplica a cada cobro la misma regla que usa la app al cambiar una orden (sincronizarCobro): pendiente se retira o se
// actualiza; cargado queda con la alerta de cambio de monto. Las órdenes archivadas en un cierre del día se buscan en reports.ticketsDetalle.
//
// Por defecto NO escribe nada: lista lo que cambiaría. Con --aplicar escribe esos cambios (solo cobros de órdenes que se encontraron).
//
// Uso (la llave va en tu consola, nunca dentro del repo):
//   node scripts/revisar-cobros-desfasados.mjs C:\ruta\a\llave-firebase.json [--aplicar]
// Opcional: APP_ID (por defecto "default-app-id"). Con el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (no hace falta llave).
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sincronizarCobro, textoDeCobro } from '../src/utils/cobrosClientes.js';

const aplicar = process.argv.includes('--aplicar');
const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));
initializeApp(process.env.FIRESTORE_EMULATOR_HOST
  ? { projectId: 'seguimientons-f2026' }
  : { credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(), projectId: 'seguimientons-f2026' });
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;
const ahora = Date.now();

const cobros = (await db.collection(`${base}/cobrosClientes`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const ordenes = new Map();
for (const c of cobros) {
  const snap = await db.doc(`${base}/tickets/${c.id}`).get();
  if (snap.exists) ordenes.set(c.id, { id: snap.id, ...snap.data() });
}

// Las que no están en tickets pueden estar archivadas en un cierre del día.
const faltan = cobros.filter((c) => !ordenes.has(c.id));
let archivadas = 0;
if (faltan.length) {
  const ids = new Set(faltan.map((c) => c.id));
  for (const r of (await db.collection(`${base}/reports`).get()).docs) {
    for (const t of r.data().ticketsDetalle || []) {
      if (ids.has(String(t.id)) && !ordenes.has(String(t.id))) { ordenes.set(String(t.id), { ...t, id: String(t.id) }); archivadas++; }
    }
  }
}

const aCambiar = [];
const sinOrden = [];
for (const c of cobros) {
  const orden = ordenes.get(c.id);
  if (!orden) { sinOrden.push(c); continue; }
  // Solo órdenes ya cerradas o canceladas: una abierta (devuelta a pendiente o a pre-finalizada) sigue su camino y se sincroniza al cerrarse.
  if (orden.estado !== 'FINALIZADO' && orden.estado !== 'CANCELADO') continue;
  const r = sincronizarCobro(c, orden, { por: 'revisión de cobros desfasados', ahora });
  if (r) aCambiar.push({ cobro: c, orden, cambios: r.cambios });
}

console.log(`Cobros leídos: ${cobros.length} (órdenes encontradas: ${ordenes.size}, de ellas archivadas: ${archivadas})`);
console.log(`Cobros que no coinciden con su orden: ${aCambiar.length}`);
for (const { cobro, orden, cambios } of aCambiar) {
  const que = cambios.anulado === true ? 'se retiraría (anulado)' : cambios.montoCambio !== undefined ? 'quedaría con alerta de cambio de monto' : cambios.anulado === false ? 'volvería a estar vigente' : `monto → ${cambios.monto} ${cambios.moneda}`;
  console.log(`  ${cobro.codigo || 'S/C'} · ${cobro.nombre} · técnico ${cobro.tecnico} · cobro ${cobro.estado} ${textoDeCobro(cobro)}${cobro.pagoCliente ? ' (con pago del técnico)' : ''} · orden ${orden.estado}${orden.cobroTipo === 'EXONERADO' ? ' EXONERADA' : ''} → ${que}`);
}
console.log(`Cobros sin orden encontrada (no se tocan): ${sinOrden.length}`);
for (const c of sinOrden) console.log(`  ${c.codigo || 'S/C'} · ${c.nombre} · ${c.estado}`);

if (!aplicar) {
  console.log('\nNo se escribió nada. Con --aplicar se guardan los cambios.');
  process.exit(0);
}
for (const { cobro, cambios } of aCambiar) await db.doc(`${base}/cobrosClientes/${cobro.id}`).update(cambios);
console.log(`\nListo: ${aCambiar.length} cobros actualizados.`);
process.exit(0);
