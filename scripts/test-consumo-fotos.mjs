// Prueba las tres decisiones sobre el consumo de las fotos de "Detalles de la orden": 1) la caché de 60 días al subirlas, 2) la medición con órdenes reales (src/utils/consumoFotos.js y scripts/medir-fotos-reales.mjs), que dice si no hay que
// tocar nada, bajar el tamaño o pasar a miniaturas, y 3) el plan de las miniaturas dejado por escrito (docs/PLAN-MINIATURAS.md). No necesita el emulador. Uso: `npm run test:consumofotos`.
import { existsSync, readFileSync } from 'node:fs';
import { CACHE_FOTO } from '../src/utils/detallesOrden.js';
import { CUPOS_STORAGE, resumirFotos } from '../src/utils/consumoFotos.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const leer = (ruta) => readFileSync(ruta, 'utf8');

// --- 1) Caché de 60 días ---
check('las fotos se suben con caché privada de 60 días (no se sobrescriben nunca, así que es seguro)', [CACHE_FOTO, CACHE_FOTO.includes('max-age=5184000'), 5184000 / 86400], ['private, max-age=5184000, immutable', true, 60]);
check('la subida usa esa caché y las reglas de Storage siguen sin dejar sobrescribir', [leer('src/lib/fotosOrden.js').includes("{ contentType: 'image/jpeg', cacheControl: CACHE_FOTO }"), leer('storage.rules').includes('allow update: if false')], [true, true]);

// --- 2) Medición con órdenes reales ---
const AHORA = Date.parse('2026-12-01T12:00:00-04:00');
const DIA = 24 * 3600 * 1000;
const orden = (id, kb, n = 7, hace = 1) => ({ id, detallesOrden: { fotos: Array.from({ length: n }, () => ({ bytes: kb * 1024 })), subidoEn: AHORA - hace * DIA } });
const muchas = (cantidad, kb, n = 7) => Array.from({ length: cantidad }, (_, i) => orden(`o${i}`, kb, n, (i % 55) + 1));

const sinFotos = resumirFotos([], { ahora: AHORA });
check('sin fotos no hay nada que medir y lo dice', [sinFotos.ordenes, sinFotos.recomendaciones[0].startsWith('Todavía no hay fotos')], [0, true]);
const normal = resumirFotos(muchas(1200, 300), { ahora: AHORA });
check('con el volumen y el peso esperados (20 órdenes al día, 300 KB): dentro de los cupos y no hace falta cambiar nada', [normal.ordenes, normal.fotos, normal.fotoKB.mediana, normal.ordenesPorDia, normal.recomendaciones], [1200, 8400, 300, 20, ['Todo dentro de los cupos gratis y con fotos del peso esperado: no hace falta cambiar nada.']]);
check('calcula el peso por orden, el almacenamiento y el consumo mensual', [normal.ordenKB, normal.almacenamientoGB, normal.subidasMes, normal.descargasGBMes], [2100, 2.4, 4200, 2.4]);
check('solo cuenta las subidas dentro de los días pedidos y no repite una orden', resumirFotos([orden('a', 300), orden('a', 300), orden('b', 300, 7, 90)], { ahora: AHORA }).ordenes, 1);
check('ignora las órdenes sin fotos o con pesos inválidos', resumirFotos([{ id: 'x' }, { id: 'y', detallesOrden: { fotos: [] } }, { id: 'z', detallesOrden: { fotos: [{ bytes: 'mucho' }, { bytes: 0 }], subidoEn: AHORA } }, orden('ok', 100, 2)], { ahora: AHORA }).fotos, 2);

const pesadas = resumirFotos(muchas(300, 700), { ahora: AHORA });
check('si las fotos reales pesan mucho más de lo esperado, sugiere 1280 px y calidad 60 % con el peso resultante', [pesadas.recomendaciones.length >= 1, pesadas.recomendaciones[0].includes('1280') && pesadas.recomendaciones[0].includes('385 KB'), pesadas.recomendaciones[0].includes('mediana')], [true, true, true]);
const muchasDescargas = resumirFotos(muchas(1500, 300), { ahora: AHORA, vistasPorOrden: 60 });
check('si las descargas pasan de la mitad del cupo, recomienda las miniaturas y apunta al plan', [muchasDescargas.descargasGBMes > CUPOS_STORAGE.descargasGBMes * 0.5, muchasDescargas.recomendaciones.some((t) => t.includes('miniaturas') && t.includes('docs/PLAN-MINIATURAS.md'))], [true, true]);
const casiLleno = resumirFotos(muchas(2400, 500), { ahora: AHORA, dias: 60 });
check('avisa si el almacenamiento se acerca al cupo y si las subidas lo pasan', [casiLleno.recomendaciones.some((t) => t.includes('almacenamiento')), casiLleno.recomendaciones.some((t) => t.includes('Las subidas'))], [true, true]);
check('el percentil 95 y el máximo reflejan las fotos más pesadas', (() => { const r = resumirFotos([orden('a', 100, 19), orden('b', 900, 1)], { ahora: AHORA }); return [r.fotoKB.mediana, r.fotoKB.p95, r.fotoKB.max]; })(), [100, 100, 900]);

// --- El script es de solo lectura y usa esa misma función ---
const script = leer('scripts/medir-fotos-reales.mjs');
check('el script mide con las órdenes de la lista y las archivadas en los cierres, sin escribir ni leer fotos', [script.includes("where('detallesOrden.subidoEn', '>=', desde)"), script.includes('ticketsDetalle'), script.includes("from '../src/utils/consumoFotos.js'"), !/\.(set|update|delete|add)\(/.test(script), !script.includes('getStorage')], [true, true, true, true, true]);
check('hay un comando para correrlo', JSON.parse(leer('package.json')).scripts['medir:fotos'], 'node scripts/medir-fotos-reales.mjs');

// --- 3) El plan de las miniaturas por escrito ---
const plan = existsSync('docs/PLAN-MINIATURAS.md') ? leer('docs/PLAN-MINIATURAS.md') : '';
check('el plan de las miniaturas está escrito: estado pendiente, disparadores, por qué no ahora, diseño y archivos a tocar', ['Estado: pendiente', 'Cuándo implementarlo', 'Por qué no ahora', 'detallesOrden: { fotos: [{ ruta, mini, bytes }]', 'firestore.rules', 'npm run medir:fotos'].map((t) => plan.includes(t)), [true, true, true, true, true, true]);
check('el plan fija los disparadores medibles y el orden: primero lo barato (caché y 1280 px) y después las miniaturas', [plan.includes('50 GB al mes'), plan.includes('1280'), plan.includes('CACHE_FOTO')], [true, true, true]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
