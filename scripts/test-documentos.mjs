// Prueba los documentos de reporte (src/utils/modelosReporte.js): cada reporte arma un documento bien formado (cifras, gráficos con sus series,
// tablas con tantas celdas como columnas) y su CSV. El PDF y el Word se arman en el navegador con estos mismos datos. No necesita el emulador.
// Uso: `npm run test:documentos`.
import {
  documentoActivacion, documentoCalidad, documentoCausasAveria, documentoEstadisticas, documentoProductividad, documentoResumenEjecutivo, documentoTendencia, documentoTiempoAtencion,
} from '../src/utils/modelosReporte.js';
import { csvDeDocumento } from '../src/utils/csvReporte.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const HORA = 3600000;
const DIA = 24 * HORA;
const caracas = (dia, h = 12, m = 0) => Date.parse(`${dia}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-04:00`);
const AHORA = caracas('2026-10-19', 15);
const rango = { desde: '2026-10-13', hasta: '2026-10-19' };
const orden = (id, extra) => ({ id, codigo: `AS${id}`, estado: 'FINALIZADO', tecnico: 'GERARDO', tipoTrabajo: 'AVERÍA', cedula: `1000${id}`, nombre: `Cliente ${id}`, nap: id % 2 ? 'N1' : 'N2', createdAt: caracas('2026-10-15', 8), finalizadoEn: caracas('2026-10-15', 10), potenciaDbm: -21, ...extra });
const ordenes = [
  orden('1'), orden('2', { tecnico: 'REINEL', tipoTrabajo: 'INSTALACIÓN', finalizadoEn: caracas('2026-10-17', 8) }),
  orden('3', { cedula: '10001', estado: 'PENDIENTE', createdAt: caracas('2026-10-16', 9), finalizadoEn: undefined }),
  orden('4', { estado: 'PENDIENTE', createdAt: caracas('2026-10-10', 9), finalizadoEn: undefined }),
];
const eventos = [
  { tecnico: 'GERARDO', activo: true, en: caracas('2026-10-15', 8), dia: '2026-10-15', por: 'admin', rol: 'ADMIN' },
  { tecnico: 'GERARDO', activo: false, en: caracas('2026-10-15', 12), dia: '2026-10-15', por: 'admin', rol: 'ADMIN' },
];
const contadores = { '2026-09': { instalacionesFinalizadas: 8, losResueltas: 3 }, '2026-10': { instalacionesFinalizadas: 10, instalacionesCanceladas: 1, losResueltas: 4 } };
const ctx = { ordenes, eventos, rango, tecnico: '', metaHoras: 48, contadores, tickets: ordenes, ventana: 6, ahora: AHORA, generadoPor: 'admin' };

const documentos = {
  estadisticas: documentoEstadisticas(ctx),
  tendencia: documentoTendencia(ctx),
  tiempo: documentoTiempoAtencion(ctx),
  productividad: documentoProductividad(ctx),
  calidad: documentoCalidad(ctx),
  activacion: documentoActivacion(ctx),
  resumen: documentoResumenEjecutivo(ctx),
  causas: documentoCausasAveria(ctx),
};

for (const [nombre, d] of Object.entries(documentos)) {
  check(`${nombre}: título, subtítulo y quién lo generó`, [Boolean(d.titulo), Boolean(d.subtitulo), d.generado], [true, true, { en: AHORA, por: 'admin' }]);
  check(`${nombre}: las listas de puntos de atención traen nivel y texto`, d.bloques.filter((b) => b.tipo === 'lista').every((l) => l.items.every((i) => ['aviso', 'ok'].includes(i.nivel) && typeof i.texto === 'string' && i.texto.length > 0)), true);
  check(`${nombre}: empieza con cuatro cifras`, [d.bloques[0].tipo, d.bloques[0].items.length], ['cifras', 4]);
  const tablas = d.bloques.filter((b) => b.tipo === 'tabla');
  check(`${nombre}: cada fila de cada tabla tiene una celda por columna y son textos`, tablas.every((t) => t.filas.every((f) => f.length === t.columnas.length && f.every((c) => typeof c === 'string'))), true);
  const graficos = d.bloques.filter((b) => b.tipo === 'grafico');
  check(`${nombre}: cada gráfico trae un valor por serie en cada categoría y colores`, graficos.every((g) => g.categorias.length > 0 && g.categorias.every((c) => c.valores.length === g.series.length && c.valores.every(Number.isFinite)) && g.series.every((s) => /^#[0-9a-f]{6}$/i.test(s.color))), true);
}

check('el resumen ejecutivo trae dos filas de cifras, los puntos de atención, la tendencia y el comparativo por técnico', documentos.resumen.bloques.map((b) => b.tipo + (b.titulo ? `:${b.titulo}` : '')), ['cifras', 'cifras', 'lista:Puntos de atención', 'grafico:Finalizadas por mes', 'tabla:Comparativo por técnico', 'texto']);
check('las causas de avería traen el detalle por falla, la evolución y las NAPs', documentos.causas.bloques.filter((b) => b.tipo === 'tabla').map((b) => b.titulo), ['Detalle por falla', 'Evolución mensual de las fallas más frecuentes', 'NAPs con más averías']);
check('el periodo sale en el subtítulo, y la tendencia habla de todo el negocio', [documentos.tiempo.subtitulo.includes('13/10/2026'), documentos.tendencia.subtitulo], [true, 'Todo el negocio, mes contra mes']);
check('la tendencia trae dos gráficos de columnas con el mes en curso marcado', documentos.tendencia.bloques.filter((b) => b.tipo === 'grafico').map((g) => [g.variante, g.categorias.at(-1).etiqueta]), [['columnas', 'oct 26*'], ['columnas', 'oct 26*']]);
check('el tiempo de atención lleva las pendientes más antiguas', documentos.tiempo.bloques.find((b) => b.titulo === 'Pendientes más antiguas').filas.map((f) => f[0]), ['AS4', 'AS3']);
check('la activación suma el tiempo activo por técnico en horas', documentos.activacion.bloques.find((b) => b.tipo === 'grafico').categorias, [{ etiqueta: 'GERARDO', valores: [4], textos: ['4 h 00 min'] }]);
check('con el filtro de técnico solo queda ese técnico', documentoTiempoAtencion({ ...ctx, tecnico: 'REINEL' }).bloques.find((b) => b.titulo === 'Por técnico').filas.map((f) => f[0]), ['REINEL']);
check('un periodo sin nada igual arma el documento, con las tablas avisando que no hay datos', (() => {
  const d = documentoTiempoAtencion({ ...ctx, ordenes: [], rango: { desde: '2026-01-01', hasta: '2026-01-02' } });
  return d.bloques.filter((b) => b.tipo === 'tabla').slice(0, 2).every((t) => t.filas.length === 0 && Boolean(t.vacio));
})(), true);

const csv = csvDeDocumento(documentos.estadisticas);
check('el CSV de un documento lleva el resumen y las tablas, con BOM', [csv.charCodeAt(0), csv.includes('Resumen'), csv.includes('NAPs con más órdenes'), csv.includes('Clientes con más de una orden')], [0xFEFF, true, true, true]);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas de los documentos pasaron.');
