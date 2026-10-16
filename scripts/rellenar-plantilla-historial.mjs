// Rellena `plantillaFinal` en historialInstalaciones para las instalaciones finalizadas que se archivaron sin ella
// (cerradas antes de que la orden guardara ese campo), para que ventas vea su botón "Ver plantilla".
// La plantilla se arma con la orden completa: la del reporte de cierre (reports.ticketsDetalle) o, si sigue viva, la de tickets.
// Solo escribe `plantillaFinal`: no toca `archivadoEn`, así que se siguen borrando a los 15 días como siempre.
//
// Por defecto NO escribe nada, solo cuenta y lista. Para aplicar los cambios, agrega --aplicar.
// Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/rellenar-plantilla-historial.mjs C:\ruta\a\llave.json [--aplicar]
//   o: set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave.json && node scripts/rellenar-plantilla-historial.mjs [--aplicar]
// Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { RETENCION_MS_HISTORIAL_VENTAS } from '../src/utils/estadoInstalacion.js';
import { generarMensajeWhatsAppInstalacion } from '../src/utils/whatsapp.js';

const aplicar = process.argv.includes('--aplicar');
const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));
initializeApp({
  credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(),
  projectId: 'seguimientons-f2026',
});

const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;
const desde = Date.now() - RETENCION_MS_HISTORIAL_VENTAS;

const historial = await db.collection(`${base}/historialInstalaciones`).where('archivadoEn', '>=', desde).get();
const sinPlantilla = historial.docs.filter((d) => {
  const h = d.data();
  return h.estado === 'FINALIZADO' && h.tipoTrabajo !== 'AVERÍA' && !String(h.plantillaFinal || '').trim();
});
console.log(`En el historial (últimos 15 días): ${historial.size}. Finalizadas sin plantilla: ${sinPlantilla.length}.`);
if (!sinPlantilla.length) process.exit(0);

// Las órdenes completas: primero las vivas, luego las de los reportes (las vivas ganan, son las más recientes).
const ordenes = new Map();
for (const r of (await db.collection(`${base}/reports`).where('createdAt', '>=', desde).get()).docs) {
  for (const t of r.data().ticketsDetalle || []) ordenes.set(String(t.id), t);
}
for (const d of (await db.collection(`${base}/tickets`).where('estado', '==', 'FINALIZADO').get()).docs) ordenes.set(d.id, { id: d.id, ...d.data() });

let lote = db.batch();
let enLote = 0;
let listas = 0;
const sinOrden = [];
for (const d of sinPlantilla) {
  const t = ordenes.get(d.id);
  const texto = t ? generarMensajeWhatsAppInstalacion({ ...t, estado: 'FINALIZADO' }) : '';
  const h = d.data();
  if (!texto) { sinOrden.push(`${h.codigo || d.id} — ${h.nombre || 'sin nombre'} (${t ? 'la orden no tiene plantilla de la promotora' : 'no se encontró la orden completa'})`); continue; }
  listas++;
  console.log(`  ${aplicar ? 'rellena' : 'rellenaría'}: ${h.codigo || d.id} — ${h.nombre || 'sin nombre'}`);
  if (!aplicar) continue;
  lote.update(d.ref, { plantillaFinal: texto });
  if (++enLote === 450) { await lote.commit(); lote = db.batch(); enLote = 0; }
}
if (aplicar && enLote) await lote.commit();

console.log(`\n${aplicar ? 'Rellenadas' : 'Se rellenarían'}: ${listas}. Sin forma de armarla: ${sinOrden.length}.`);
for (const linea of sinOrden) console.log(`  ${linea}`);
if (!aplicar && listas) console.log('\nNo se escribió nada. Corre de nuevo con --aplicar para guardar.');
