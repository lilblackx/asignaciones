// Calcula los totales mensuales (estadisticasMensuales) de lo ya cerrado, a partir de los reportes de cierre (reports), que guardan el
// detalle de cada orden que se archivó. Hace falta una vez, para los cierres de antes de que el cierre del día empezara a sumar los
// totales; después los mantiene el propio cierre (el automático en el Worker y el manual en la app).
// Cada orden cuenta en el mes en que se finalizó; si no trae una fecha de finalización creíble (las canceladas no la tienen), en el mes
// del cierre: la misma regla que usa el cierre (cf-worker/src/index.js, incrementosMensuales).
//
// Por defecto NO escribe nada, solo muestra lo que calculó. Para guardar, agrega --aplicar: ESCRIBE los totales calculados (no suma),
// así que se puede repetir. Mejor correrlo justo después de desplegar y fuera de la hora del cierre.
// Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/calcular-totales-mensuales.mjs C:\ruta\a\llave.json [--aplicar] [--desde=2026-10]
// Opcional: APP_ID (por defecto "default-app-id"). --desde limita a los meses desde ese (AAAA-MM).
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { incrementosMensuales } from '../src/utils/totalesMes.js';

const aplicar = process.argv.includes('--aplicar');
const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));
const desde = process.argv.find((a) => a.startsWith('--desde='))?.split('=')[1] || '';
if (desde && !/^\d{4}-(0[1-9]|1[0-2])$/.test(desde)) { console.error('--desde debe ser AAAA-MM.'); process.exit(1); }

initializeApp({
  credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(),
  projectId: 'seguimientons-f2026',
});
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;

const reportes = (await db.collection(`${base}/reports`).orderBy('createdAt', 'asc').get()).docs.map((d) => d.data());
console.log(`Reportes de cierre: ${reportes.length}${reportes.length ? ` (del ${new Date(reportes[0].createdAt).toLocaleDateString('es-VE')} al ${new Date(reportes.at(-1).createdAt).toLocaleDateString('es-VE')})` : ''}.`);

// Una orden archivada una sola vez: si aparece en más de un reporte se cuenta en el primero.
const vistas = new Set();
const totales = {};
for (const r of reportes) {
  if (r.tipoReporte !== 'CANCELADOS' && r.tipoReporte !== 'CIERRE') continue;
  // Un reporte viejo trae solo finalizadas (CIERRE) o solo canceladas (CANCELADOS); uno nuevo trae las dos, cada orden con su estado.
  for (const estado of ['FINALIZADO', 'CANCELADO']) {
    const nuevas = (r.ticketsDetalle || []).filter((t) => t.id && !vistas.has(`${estado}:${t.id}`) && (t.estado ? t.estado === estado : estado === (r.tipoReporte === 'CANCELADOS' ? 'CANCELADO' : 'FINALIZADO')));
    nuevas.forEach((t) => vistas.add(`${estado}:${t.id}`));
    for (const [mes, campos] of Object.entries(incrementosMensuales(nuevas, estado, r.createdAt))) {
      for (const [campo, n] of Object.entries(campos)) totales[mes] = { ...totales[mes], [campo]: (totales[mes]?.[campo] || 0) + n };
    }
  }
}

const meses = Object.keys(totales).filter((m) => !desde || m >= desde).sort();
if (!meses.length) { console.log('No hay nada que calcular.'); process.exit(0); }
for (const mes of meses) {
  const t = totales[mes];
  console.log(`  ${mes}: instalaciones finalizadas ${t.instalacionesFinalizadas || 0}, canceladas ${t.instalacionesCanceladas || 0}; LOS resueltas ${t.losResueltas || 0}, canceladas ${t.losCanceladas || 0}`);
}

if (!aplicar) {
  console.log('\nNo se escribió nada. Corre de nuevo con --aplicar para guardar.');
  process.exit(0);
}
const lote = db.batch();
for (const mes of meses) {
  const t = totales[mes];
  lote.set(db.doc(`${base}/estadisticasMensuales/${mes}`), {
    instalacionesFinalizadas: t.instalacionesFinalizadas || 0,
    instalacionesCanceladas: t.instalacionesCanceladas || 0,
    losResueltas: t.losResueltas || 0,
    losCanceladas: t.losCanceladas || 0,
  });
}
await lote.commit();
console.log(`\nGuardados ${meses.length} ${meses.length === 1 ? 'mes' : 'meses'}.`);
