// Completa la fecha de finalización (o de cancelación) de las órdenes ya archivadas que no la traen: las de antes de que la app la guardara.
// Cada orden de esos reportes que quedó FINALIZADO sin `finalizadoEn` (o CANCELADO sin `canceladaEn`) recibe como fecha el mediodía (Caracas) del
// día de cierre que dice su reporte, sin pasar de la hora en que se hizo el cierre. Así todos los módulos fechan esa orden en ese día, con la
// misma regla (src/utils/fechaOrden.js), sin depender de un valor de reserva. También se completa su resumen en historialInstalaciones, si existe.
//
// Por defecto NO escribe nada, solo cuenta y muestra ejemplos. Para guardar, agrega --aplicar. Se puede repetir: solo toca lo que aún no tiene fecha.
// Después de aplicarlo, recalcula los totales del mes: scripts/calcular-totales-mensuales.mjs (también con --aplicar).
// Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/completar-fecha-finalizacion.mjs C:\ruta\a\llave.json [--aplicar]
// Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const aplicar = process.argv.includes('--aplicar');
const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));

initializeApp({
  credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(),
  projectId: 'seguimientons-f2026',
});
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;

const hora = (ms) => new Date(ms).toLocaleString('es-VE', { timeZone: 'America/Caracas', dateStyle: 'short', timeStyle: 'short' });
// "30/09/2026" -> mediodía de ese día en Caracas (UTC-4); NaN si no se puede leer.
const mediodia = (fechaCierre) => {
  const [d, m, a] = String(fechaCierre || '').split('/').map(Number);
  return d && m && a ? Date.parse(`${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00-04:00`) : NaN;
};

const reportes = (await db.collection(`${base}/reports`).orderBy('createdAt', 'asc').get()).docs;
const cambios = []; // { ref, detalle (el arreglo nuevo), ordenes: [{ id, campo, valor }] }
for (const doc of reportes) {
  const r = doc.data();
  if (r.tipoReporte !== 'CIERRE' && r.tipoReporte !== 'CANCELADOS') continue;
  const dia = Math.min(mediodia(r.fechaCierre), r.createdAt);
  if (!Number.isFinite(dia)) continue;
  const ordenes = [];
  const detalle = (r.ticketsDetalle || []).map((t) => {
    const estado = t.estado || (r.tipoReporte === 'CANCELADOS' ? 'CANCELADO' : 'FINALIZADO');
    const campo = estado === 'CANCELADO' ? 'canceladaEn' : estado === 'FINALIZADO' ? 'finalizadoEn' : null;
    if (!campo || Number(t[campo]) > 0 || !t.id) return t;
    ordenes.push({ id: t.id, codigo: t.codigo, campo, valor: dia, reporte: r.fechaCierre });
    return { ...t, [campo]: dia };
  });
  if (ordenes.length) cambios.push({ ref: doc.ref, detalle, ordenes });
}

const todas = cambios.flatMap((c) => c.ordenes);
const finalizadas = todas.filter((o) => o.campo === 'finalizadoEn').length;
console.log(`Reportes revisados: ${reportes.length}. Con órdenes sin fecha: ${cambios.length}.`);
console.log(`Órdenes sin fecha: ${todas.length} (${finalizadas} finalizadas, ${todas.length - finalizadas} canceladas).`);
for (const o of todas.slice(0, 15)) console.log(`  ${o.codigo || o.id}  ${o.campo} -> ${hora(o.valor)}  (reporte ${o.reporte})`);
if (todas.length > 15) console.log(`  ... y ${todas.length - 15} más`);

if (!aplicar) {
  console.log('\nNo se escribió nada. Corre de nuevo con --aplicar para guardar.');
  process.exit(0);
}

let reportesEscritos = 0;
let resumenesEscritos = 0;
for (const c of cambios) {
  await c.ref.update({ ticketsDetalle: c.detalle });
  reportesEscritos += 1;
  for (const o of c.ordenes) {
    const resumen = db.doc(`${base}/historialInstalaciones/${o.id}`);
    const existe = await resumen.get();
    if (existe.exists && !(Number(existe.data()[o.campo]) > 0)) { await resumen.update({ [o.campo]: o.valor }); resumenesEscritos += 1; }
  }
}
console.log(`\nListo: ${reportesEscritos} reportes y ${resumenesEscritos} resúmenes del historial de instalaciones actualizados.`);
console.log('Ahora corre scripts/calcular-totales-mensuales.mjs --aplicar para recalcular los totales del mes.');
