// Auditoría de SOLO LECTURA: compara, para un mes, las instalaciones finalizadas que cuenta el contador de ventas (la misma regla del cierre,
// incrementosMensuales) con las que muestra el Historial de órdenes (filtrado por fecha de cierre), y lista las que se cuentan pero no se ven,
// con el motivo. Sirve para saber por qué "Finalizadas" del mes no coincide con el Historial.
// No escribe nada. Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/auditar-historial-mes.mjs C:\ruta\a\llave.json [--mes=2026-10]
// Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { incrementosMensuales, mesDe } from '../src/utils/totalesMes.js';

const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));
const mes = process.argv.find((a) => a.startsWith('--mes='))?.split('=')[1] || mesDe(Date.now());
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) { console.error('--mes debe ser AAAA-MM.'); process.exit(1); }

initializeApp({
  credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(),
  projectId: 'seguimientons-f2026',
});
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;

const reportes = (await db.collection(`${base}/reports`).orderBy('createdAt', 'asc').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const vivas = (await db.collection(`${base}/tickets`).where('estado', '==', 'FINALIZADO').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const hora = (ms) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleString('es-VE', { timeZone: 'America/Caracas', dateStyle: 'short', timeStyle: 'short' }) : '—');
const parseFecha = (f) => { const [d, m, y] = String(f || '').split('/').map(Number); return d && m && y ? new Date(y, m - 1, d).getTime() : 0; };

// Lo que hace el Historial hoy: la fecha de finalización si es creíble (> 0 y no futura); si no, el día del cierre que la archivó.
const fechaHistorial = (t, cierreMs) => {
  const fin = Number(t.finalizadoEn);
  return fin > 0 && fin <= Date.now() ? fin : (cierreMs || t.createdAt || 0);
};

const contadas = []; // las que suma el contador en ese mes (cada orden una vez, como el script de totales)
const vistas = new Set();
const repetidas = [];
for (const r of reportes) {
  if (r.tipoReporte !== 'CIERRE' && r.tipoReporte !== 'CANCELADOS') continue;
  for (const t of r.ticketsDetalle || []) {
    if (!t.id || t.tipoTrabajo !== 'INSTALACIÓN') continue;
    if ((t.estado ? t.estado : (r.tipoReporte === 'CANCELADOS' ? 'CANCELADO' : 'FINALIZADO')) !== 'FINALIZADO') continue;
    if (vistas.has(t.id)) { repetidas.push({ id: t.id, codigo: t.codigo, reporte: r.fechaCierre }); continue; }
    vistas.add(t.id);
    const cierreDia = parseFecha(r.fechaCierre) || r.createdAt;
    const cuenta = incrementosMensuales([t], 'FINALIZADO', r.createdAt, Math.min(cierreDia + 12 * 3600000, r.createdAt))[mes]?.instalacionesFinalizadas || 0;
    const fh = fechaHistorial(t, cierreDia);
    contadas.push({ codigo: t.codigo || t.id, cuenta, mesHistorial: mesDe(fh), finalizadoEn: Number(t.finalizadoEn), cierre: r.fechaCierre, creada: t.createdAt, tecnico: t.tecnico });
  }
}
for (const t of vivas) {
  if (t.tipoTrabajo !== 'INSTALACIÓN') continue;
  const fin = Number(t.finalizadoEn) > 0 ? Number(t.finalizadoEn) : (t.createdAt || Date.now());
  contadas.push({ codigo: t.codigo || t.id, cuenta: mesDe(fin) === mes ? 1 : 0, mesHistorial: mesDe(fin), finalizadoEn: Number(t.finalizadoEn), cierre: 'sin cerrar (en vivo)', creada: t.createdAt, tecnico: t.tecnico });
}

const delContador = contadas.filter((o) => o.cuenta > 0);
const delHistorial = delContador.filter((o) => o.mesHistorial === mes);
const faltan = delContador.filter((o) => o.mesHistorial !== mes);
console.log(`Mes ${mes}`);
console.log(`  Reportes de cierre leídos: ${reportes.length}; órdenes finalizadas en vivo: ${vivas.filter((t) => t.tipoTrabajo === 'INSTALACIÓN').length}`);
console.log(`  Instalaciones finalizadas que cuenta el contador (una vez cada orden): ${delContador.length}`);
console.log(`  De ésas, las que el Historial ubica en el mes: ${delHistorial.length}`);
console.log(`  Órdenes repetidas en más de un reporte (no se cuentan dos veces): ${repetidas.length}`);
if (faltan.length) {
  console.log(`\nSe cuentan pero el Historial las ubica en otro mes (${faltan.length}):`);
  for (const o of faltan) console.log(`  ${o.codigo}  técnico ${o.tecnico || '—'}  creada ${hora(o.creada)}  finalizada ${hora(o.finalizadoEn)}  cierre ${o.cierre}  -> Historial: ${o.mesHistorial}`);
}
console.log('\nNo se escribió nada.');
