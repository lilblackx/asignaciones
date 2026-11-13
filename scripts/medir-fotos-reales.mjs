// SOLO LECTURA. Mide cuánto pesan y cuánto consumen las fotos de los "Detalles de la orden" con las órdenes reales (cada foto guarda su peso al subirse): las órdenes de la lista y las archivadas en los reportes de cierre de
// los últimos días. Dice si conviene no tocar nada, bajar el tamaño de las fotos (1280 px y calidad 60 %) o implementar las miniaturas (docs/PLAN-MINIATURAS.md). No lee ni descarga ninguna foto.
//
// Uso (con la llave de una cuenta de servicio con permiso de lectura en Firestore, nunca dentro del repo):
//   node scripts/medir-fotos-reales.mjs C:\ruta\a\llave.json [--dias=60] [--vistas=2]
//   o con el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/medir-fotos-reales.mjs
// `--dias`: cuántos días hacia atrás cuenta (por defecto 60, los de la retención del bucket). `--vistas`: cuántas veces se abre en promedio una orden con fotos en la oficina (por defecto 2).
// Gasta pocas lecturas: las órdenes de la lista que ya tienen fotos y un reporte por cada cierre del período. Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { CUPOS_STORAGE, VISTAS_POR_ORDEN, resumirFotos } from '../src/utils/consumoFotos.js';

const args = process.argv.slice(2);
const llave = args.find((a) => a.toLowerCase().endsWith('.json'));
const dias = Number(args.find((a) => a.startsWith('--dias='))?.split('=')[1]) || 60;
const vistas = Number(args.find((a) => a.startsWith('--vistas='))?.split('=')[1]) || VISTAS_POR_ORDEN;
initializeApp(process.env.FIRESTORE_EMULATOR_HOST
  ? { projectId: 'seguimientons-f2026' }
  : { credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(), projectId: 'seguimientons-f2026' });
const db = getFirestore();
const base = db.collection('artifacts').doc(process.env.APP_ID || 'default-app-id').collection('public').doc('data');
const ahora = Date.now();
const desde = ahora - dias * 24 * 3600 * 1000;

// Órdenes de la lista con detalles subidos en el período + las archivadas en los cierres del período.
const vivas = (await base.collection('tickets').where('detallesOrden.subidoEn', '>=', desde).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const reportes = (await base.collection('reports').where('createdAt', '>=', desde).get()).docs;
const archivadas = reportes.flatMap((r) => (Array.isArray(r.data().ticketsDetalle) ? r.data().ticketsDetalle : []));
const r = resumirFotos([...archivadas, ...vivas], { dias, vistasPorOrden: vistas, ahora });

console.log(`Fotos de los últimos ${dias} días (${vivas.length} órdenes en la lista y ${reportes.length} cierres leídos):\n`);
if (!r.fotos) {
  r.recomendaciones.forEach((t) => console.log(t));
  process.exit(0);
}
const fila = (etiqueta, valor, cupo = '') => console.log(`  ${etiqueta.padEnd(34)} ${String(valor).padStart(10)}${cupo ? `   (cupo gratis: ${cupo})` : ''}`);
fila('Órdenes con fotos', r.ordenes);
fila('Fotos', r.fotos);
fila('Fotos por orden (promedio)', r.fotosPorOrden);
fila('Órdenes con fotos por día', r.ordenesPorDia);
console.log('\nPeso de cada foto:');
fila('promedio', `${r.fotoKB.promedio} KB`);
fila('mediana', `${r.fotoKB.mediana} KB`);
fila('p95 (el 5 % más pesado)', `${r.fotoKB.p95} KB`);
fila('máximo', `${r.fotoKB.max} KB`);
fila('por orden', `${r.ordenKB} KB`);
console.log(`\nConsumo (estimado al mes, con ${vistas} vistas por orden):`);
fila('Almacenamiento guardado', `${r.almacenamientoGB} GB`, `${CUPOS_STORAGE.almacenamientoGB} GB`);
fila('Subidas', r.subidasMes, `${CUPOS_STORAGE.subidasMes}`);
fila('Descargas', `${r.descargasGBMes} GB`, `${CUPOS_STORAGE.descargasGBMes} GB`);
fila('Lecturas de archivos', r.lecturasMes, `${CUPOS_STORAGE.lecturasMes}`);
console.log('\nQué conviene hacer:');
r.recomendaciones.forEach((t) => console.log(`  - ${t}`));
process.exit(0);
