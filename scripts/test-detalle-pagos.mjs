// Prueba el detalle de los pagos (src/utils/detallePagos.js) y los dos reportes de Finanzas que salen de ahí: el Resumen de pagos (el de siempre, sin el detalle de las órdenes) y los Pagos detallados
// (para compartir con cada técnico): las órdenes que entraron en cada pago, lo que se sumó y se descontó, que las cuentas cuadren con el neto, las tablas angostas del PDF y el Word y las listas planas del CSV.
// No necesita el emulador. Uso: `node scripts/test-detalle-pagos.mjs`.
import { detalleDePagos, movimientosDePago, nombreDeConcepto, pagosIncompletos, textoFormaDePago } from '../src/utils/detallePagos.js';
import { documentoPagosDetallados, documentoPagosTecnicos, documentoResumenPagos } from '../src/utils/modelosReporte.js';
import { csvDeDocumento } from '../src/utils/csvReporte.js';
import { nombreDeArchivo } from '../src/utils/exportarDocumento.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// Los montos llevan un espacio sin salto antes de "$" y "Bs" (para que no se partan en las tablas): aquí se escriben con espacio común y se cambian.
const NB = String.fromCharCode(160);
const usd = (texto) => texto.replace(' $', `${NB}$`);
const bs = (texto) => texto.replace(' Bs', `${NB}Bs`);

const caracas = (dia, h = 12, m = 0) => Date.parse(`${dia}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-04:00`);
const rango = { desde: '2026-11-01', hasta: '2026-11-09' };
const ahora = caracas('2026-11-09', 20);

// Tres pagos de JOSE (uno reciente con adelanto, descuento con motivo y pago adicional; uno con garantías; uno antiguo sin detalle guardado), uno anulado de REINEL y uno de LUIS.
const pagos = [
  { id: 'p1', tecnico: 'JOSE', desde: '2026-10-26', hasta: '2026-11-09', cantidades: { AVERIA: 3 }, total: 15, bonos: 5, descuento: 4, neto: 16, cantidadOrdenes: 3, creadoEn: caracas('2026-11-09', 18, 42), pagadoEn: caracas('2026-11-09', 18, 40),
    forma: 'Transferencia', banco: 'Banco Nacional de Crédito (BNC)', referencia: '123456789', moneda: 'BS', tasa: 900, nota: 'Pago de la semana',
    adelantos: [{ id: 'ad1', monto: 3 }], descuentosManuales: [{ id: 'de1', monto: 1 }], adicionales: [{ id: 'x1', monto: 5, nombre: 'Cable', cantidad: 1 }] },
  { id: 'p2', tecnico: 'JOSE', desde: '2026-10-19', hasta: '2026-10-25', cantidades: { INSTALACION: 1, VISITA: 1 }, total: 26.33, bonos: 5, descuento: 2.5, neto: 28.83, cantidadOrdenes: 2, creadoEn: caracas('2026-11-02', 10), tasa: 850,
    ajustes: [{ id: 'desc_a', monto: 2.5, tipo: 'DESCUENTO' }, { id: 'bono_b', monto: 5, tipo: 'BONO' }] },
  { id: 'p3', tecnico: 'JOSE', desde: '2026-10-01', hasta: '2026-10-10', cantidades: { AVERIA: 1 }, total: 5, descuento: 2, neto: 3, cantidadOrdenes: 1, creadoEn: caracas('2026-11-01', 9) },
  { id: 'p4', tecnico: 'REINEL', desde: '2026-10-26', hasta: '2026-11-09', cantidades: { AVERIA: 1 }, total: 5, neto: 5, cantidadOrdenes: 1, creadoEn: caracas('2026-11-05', 9), anulado: true },
  { id: 'p5', tecnico: 'LUIS', desde: '2026-10-26', hasta: '2026-11-09', cantidades: { MUDANZA_EXTERNA: 1 }, total: 10, neto: 10, cantidadOrdenes: 2, creadoEn: caracas('2026-11-06', 15) },
];
const ordenesPagadas = [
  { id: 'o3', pagoId: 'p1', tecnico: 'JOSE', concepto: 'AVERIA', monto: 5, dia: '2026-11-08', codigo: 'AS100' },
  { id: 'o1', pagoId: 'p1', tecnico: 'JOSE', concepto: 'AVERIA', monto: 5, dia: '2026-10-28', codigo: 'AO9' },
  { id: 'o2', pagoId: 'p1', tecnico: 'JOSE', concepto: 'AVERIA', monto: 5, dia: '2026-10-28', codigo: 'AO10' },
  { id: 'o4', pagoId: 'p2', tecnico: 'JOSE', concepto: 'INSTALACION', monto: 21.33, dia: '2026-10-20', codigo: 'IO55' },
  { id: 'o5', pagoId: 'p2', tecnico: 'JOSE', concepto: 'VISITA', monto: 5, dia: '2026-10-22', codigo: 'AO20' },
  { id: 'o6', pagoId: 'p3', tecnico: 'JOSE', concepto: 'AVERIA', monto: 5, dia: '2026-10-05', codigo: 'AO1' },
  { id: 'o7', pagoId: 'p5', tecnico: 'LUIS', concepto: 'MUDANZA_EXTERNA', monto: 10, dia: '2026-11-04', codigo: 'AM3' },
  // De p5 solo se leyó una de las dos órdenes.
];
const adelantos = [{ id: 'ad1', tecnico: 'JOSE', monto: 10, creadoEn: caracas('2026-11-03', 15), forma: 'Efectivo', nota: 'Para la moto' }];
const descuentos = [{ id: 'de1', tecnico: 'JOSE', monto: 1, motivo: 'Material perdido', cuota: 2, cuotas: 4, creadoEn: caracas('2026-11-04') }];
const ajustes = [
  { id: 'desc_a', tecnico: 'JOSE', tipo: 'DESCUENTO', monto: 2.5, codigo: 'AS499', codigoOrigen: 'IO399', de: 'JOSE', a: 'REINEL BRAVO' },
  { id: 'bono_b', tecnico: 'JOSE', tipo: 'BONO', monto: 5, codigo: 'AS77', codigoOrigen: 'IO12', de: 'GERARDO MOLERO', a: 'JOSE' },
];
const adicionales = [{ id: 'x1', tecnico: 'JOSE', nombre: 'Cable', cantidad: 1, monto: 5, nota: 'Metros de cable extra' }];
const nombres = { o3: 'María Pérez', o1: 'José Núñez' };
const nombreDe = (clave) => nombres[clave] || '';

const detalle = detalleDePagos({ pagos, ordenesPagadas, nombreDe, adelantos, ajustes, descuentos, adicionales, tasa: 880 });

// --- El detalle de cada pago ---
check('el detalle deja fuera los pagos anulados y va por técnico y del pago más reciente al más viejo', detalle.map((d) => [d.tecnico, d.pago.id]), [['JOSE', 'p1'], ['JOSE', 'p2'], ['JOSE', 'p3'], ['LUIS', 'p5']]);
const d1 = detalle[0];
check('las órdenes de un pago van de la más antigua a la más nueva, con el código en orden numérico, el cliente si se conoce y el nombre del concepto',
  d1.ordenes.map((o) => [o.codigo, o.nombre, o.dia, o.concepto, o.monto]),
  [['AO9', 'José Núñez', '2026-10-28', 'Avería o visita técnica', 5], ['AO10', '', '2026-10-28', 'Avería o visita técnica', 5], ['AS100', 'María Pérez', '2026-11-08', 'Avería o visita técnica', 5]]);
check('un pago de antes (concepto VISITA) se llama como la avería', [nombreDeConcepto('VISITA'), nombreDeConcepto('MUDANZA_EXTERNA'), nombreDeConcepto('VALIDACION_NAP')], ['Avería o visita técnica', 'Mudanza externa', 'Validación de NAP']);
check('lo que se sumó y se descontó en el pago: adelanto y descuento con motivo restan, el pago adicional suma',
  d1.movimientos.map((m) => [m.tipo, m.monto, m.detalle]),
  [['Adelanto', -3, `Entregado el ${d1.movimientos[0].detalle.slice(13).split(' · ')[0]} · Efectivo · Para la moto`], ['Descuento', -1, 'Material perdido (cuota 2 de 4)'], ['Pago adicional', 5, 'Cable · Metros de cable extra']]);
check('el descuento y el pago por garantía dicen de qué garantía y de qué orden son',
  detalle[1].movimientos.map((m) => [m.tipo, m.monto, m.detalle]),
  [['Descuento por garantía', -2.5, 'Garantía AS499 hecha por REINEL BRAVO: se descuenta de la orden IO399'], ['Pago por garantía', 5, 'Garantía AS77 de la orden IO12 (de GERARDO MOLERO)']]);
check('un pago de antes, sin detalle guardado, muestra la diferencia en una línea aparte', detalle[2].movimientos.map((m) => [m.tipo, m.monto, m.detalle]), [['Descuento', -2, 'Sin detalle guardado (pago anterior)']]);
check('lo sumado y descontado de cada pago siempre cuadra con su neto (neto menos total de las órdenes)',
  detalle.map((d) => Math.round(d.movimientos.reduce((s, m) => s + m.monto, 0) * 100) / 100 === Math.round((d.pago.neto - d.pago.total) * 100) / 100), [true, true, true, true]);
check('si no se pudieron leer todas las órdenes de un pago se dice cuántas faltan', detalle.map((d) => d.faltan), [0, 0, 0, 1]);
check('el título lleva la fecha del pago y las órdenes', [d1.titulo.startsWith('Pago del 09/11/2026'), d1.titulo.endsWith('· 3 órdenes'), detalle[3].titulo.endsWith('· 2 órdenes')], [true, true, true]);
check('la nota dice cómo se pagó (banco, referencia y moneda) y lleva la nota del pago', d1.nota, 'Forma de pago: Transferencia · Banco Nacional de Crédito (BNC) · Ref. 123456789 · en bolívares. Nota: Pago de la semana');
check('un pago de antes, sin forma de pago ni nota, no lleva nota', detalle[1].nota, '');
check('la cuenta del pago: órdenes, bonos, descuentos, neto y los bolívares de la tasa de ese pago (900)', d1.cuenta,
  [['Órdenes pagadas (3)', usd('15,00 $')], ['Bonos y pagos adicionales', usd('+ 5,00 $')], ['Descuentos', usd('- 4,00 $')], ['Neto pagado', usd('16,00 $')], ['Pagado en bolívares (tasa 900,00)', bs('14.400,00 Bs')]]);
check('sin bonos ni descuentos la cuenta no los muestra, y si no se pagó en bolívares dice "equivalente" con la tasa de hoy cuando el pago no guardó la suya',
  detalle[3].cuenta, [['Órdenes pagadas (2)', usd('10,00 $')], ['Neto pagado', usd('10,00 $')], ['Equivalente en bolívares (tasa 880,00)', bs('8.800,00 Bs')]]);
check('un pago con su propia tasa (850) usa esa y no la de hoy', detalle[1].cuenta.at(-1), ['Equivalente en bolívares (tasa 850,00)', bs('24.505,50 Bs')]);
check('cada pago trae su neto y sus bolívares', detalle.map((d) => [d.neto, d.bs]), [[16, 14400], [28.83, 24505.5], [3, 2640], [10, 8800]]);
check('cómo se pagó: banco, referencia y moneda; vacío si el pago no guardó la forma', [
  textoFormaDePago(pagos[0]), textoFormaDePago({ forma: 'Zelle', banco: 'Bank of America', referencia: 'ZL1', moneda: 'USD' }), textoFormaDePago({ forma: 'Efectivo', moneda: 'USD' }), textoFormaDePago(pagos[1]),
], ['Transferencia · Banco Nacional de Crédito (BNC) · Ref. 123456789 · en bolívares', 'Zelle · Bank of America · Ref. ZL1 · en dólares', 'Efectivo · en dólares', '']);
check('movimientosDePago funciona sin listas (usa lo que guardó el pago)', movimientosDePago(pagos[0]).map((m) => [m.tipo, m.monto, m.detalle]), [['Adelanto', -3, 'Adelanto descontado'], ['Descuento', -1, 'Descuento con motivo'], ['Pago adicional', 5, 'Cable']]);
check('de qué pagos faltan órdenes por leer', pagosIncompletos(pagos.filter((p) => !p.anulado), ordenesPagadas), ['p5']);
check('si ya están todas leídas no falta ninguno', pagosIncompletos(pagos.filter((p) => p.id !== 'p5' && !p.anulado), ordenesPagadas), []);

// --- El Resumen de pagos (el de siempre: no lleva el detalle de las órdenes) ---
const resumen = documentoResumenPagos({ rango, tecnico: '', ahora, generadoPor: 'lfernandez', pagosFinanzas: { pagos, tasa: 880, adelantos, descuentos } });
const tablas = resumen.bloques.filter((b) => b.tipo === 'tabla');
check('cada fila de cada tabla (y cada línea gris) corresponde a su fila y trae una celda por columna', tablas.every((t) => t.filas.every((f) => f.length === t.columnas.length && f.every((c) => typeof c === 'string')) && (!t.subfilas || t.subfilas.length === t.filas.length)), true);
const compactas = tablas.filter((t) => t.noCsv && t.subfilas);
check('el resumen, los pagos, los adelantos y los descuentos van en dos tablas: la angosta para el PDF y el Word (con línea gris) y la completa solo para el CSV', [compactas.length, tablas.filter((t) => t.soloCsv).length, tablas.length], [4, 4, 8]);
check('la tabla angosta de pagos tiene 9 columnas y la completa 12', [compactas[1].columnas.length, tablas.find((t) => t.soloCsv && t.titulo.startsWith('Pagos registrados')).columnas.length], [9, 12]);
check('la línea gris de cada pago lleva el periodo, la forma de pago y la nota', compactas[1].subfilas[0].startsWith('Periodo 26/10/2026') && compactas[1].subfilas[0].includes('Pago: Transferencia') && compactas[1].subfilas[0].includes('Nota: Pago de la semana'), true);
check('la línea gris del resumen por técnico dice qué se pagó y en cuántos pagos', compactas[0].subfilas.map((s) => s.endsWith(' pagos') || s.endsWith(' pago')), compactas[0].subfilas.map(() => true));
check('el Resumen no trae el detalle de las órdenes: ni secciones ni tablas por pago, ni listas de órdenes en el CSV', [
  resumen.bloques.some((b) => b.tipo === 'seccion' || b.tipo === 'salto'),
  tablas.some((t) => /^(Pago del|Órdenes pagadas|Descuentos y bonos)/.test(t.titulo || '')),
  csvDeDocumento(resumen).split('\r\n').some((l) => l.startsWith('Técnico;Fecha del pago;Orden;Cliente')),
], [false, false, false]);
check('el Resumen conserva su portada y su pie de siempre', [resumen.etiqueta, resumen.pie, resumen.nombreArchivo], [undefined, undefined, undefined]);
const csvResumen = csvDeDocumento(resumen);
check('el CSV del Resumen trae las tablas completas, no las angostas', [csvResumen.includes('Pagado a cada técnico\r\n'), csvResumen.split('\r\n').filter((l) => l.startsWith('Fecha;Técnico;Periodo;Órdenes;Total;Bonos y adicionales')).length], [true, 1]);

// --- Pago a técnicos (usa las mismas tablas angostas de pagos, adelantos y descuentos que el Resumen; el CSV sigue completo) ---
const filasPagos = [
  { tecnico: 'JOSE', pendientes: [{}, {}, {}], cantidades: { INSTALACION: 1, AVERIA: 2 }, total: 31.33, bonos: 0, descuento: 5, neto: 26.33 },
  { tecnico: 'LUIS', pendientes: [], cantidades: {}, total: 0, bonos: 0, descuento: 0, neto: 0 },
];
const paraPagar = documentoPagosTecnicos({ rango, tecnico: '', ahora, generadoPor: 'lfernandez', pagosFinanzas: { filas: filasPagos, pagos, pagadasPorTecnico: { JOSE: { ordenes: 6, total: 28.83, bs: 24505.5 } }, tasa: 880, adelantos, descuentos } });
const tablasPagar = paraPagar.bloques.filter((b) => b.tipo === 'tabla');
const angostasPagar = tablasPagar.filter((t) => t.noCsv && t.subfilas);
check('Pago a técnicos: cada tabla va en dos versiones (angosta para el PDF y el Word, completa solo para el CSV) y cada fila trae una celda por columna',
  [angostasPagar.length, tablasPagar.filter((t) => t.soloCsv).length, tablasPagar.every((t) => t.filas.every((f) => f.length === t.columnas.length) && (!t.subfilas || t.subfilas.length === t.filas.length))], [4, 4, true]);
check('Pago a técnicos: la tabla angosta de lo que se debe tiene 7 columnas y la completa 11; las instalaciones, averías, validaciones y trabajos adicionales van en la línea gris',
  [angostasPagar[0].columnas.map((c) => c.titulo), tablasPagar.find((t) => t.soloCsv && t.titulo === 'Por pagar a cada técnico').columnas.length, angostasPagar[0].filas.length, angostasPagar[0].subfilas],
  [['Técnico', 'Órdenes', 'Total órdenes', 'Bonos y adic.', 'Descuentos', 'Total por pagar', 'En Bs'], 11, 1, ['1 instalación · 2 averías']]);
check('Pago a técnicos: los pagos registrados, adelantos y descuentos son los mismos del Resumen', [angostasPagar[1].columnas.length, angostasPagar[2].columnas.map((c) => c.titulo), angostasPagar[3].columnas.map((c) => c.titulo)], [9, ['Fecha y hora', 'Técnico', 'Monto', 'Estado'], ['Fecha y hora', 'Técnico', 'Monto', 'Estado']]);
check('Pago a técnicos: su portada y su pie siguen siendo los de siempre', [paraPagar.titulo, paraPagar.etiqueta, paraPagar.pie], ['Pago a técnicos', undefined, undefined]);
check('Pago a técnicos: el CSV conserva las once columnas de lo que se debe', csvDeDocumento(paraPagar).includes('Técnico;Órdenes;Instalaciones;Averías;Val. NAP;Trab. adicional;Total órdenes;Bonos y adicionales;Descuentos;Total por pagar;En Bs\r\n'), true);

// --- Los Pagos detallados ---
const contexto = (extra = {}) => ({ rango, tecnico: '', ahora, generadoPor: 'lfernandez', pagosFinanzas: { pagos, tasa: 880, adelantos, descuentos, detalle }, ...extra });
const todos = documentoPagosDetallados(contexto());
check('el documento se llama Pagos detallados, no dice "uso interno" y su archivo se llama igual', [todos.titulo, todos.etiqueta, todos.pie, todos.subtitulo.includes('Todos los técnicos'), nombreDeArchivo(todos, rango)], ['Pagos detallados', 'Detalle de pagos', '', true, 'pagos-detallados_2026-11-01_2026-11-09']);
const secciones = todos.bloques.map((b, i) => [i, b.tipo, b.titulo]).filter(([, tipo]) => tipo === 'seccion' || tipo === 'salto');
check('sin técnico elegido cada técnico va con su nombre en su propia página (un salto antes del segundo)', secciones.map(([, tipo, titulo]) => [tipo, titulo]), [['seccion', 'JOSE'], ['salto', undefined], ['seccion', 'LUIS']]);
check('el salto va justo antes del nombre del segundo técnico', secciones[1][0] + 1, secciones[2][0]);
const cifras = todos.bloques.filter((b) => b.tipo === 'cifras');
check('las cifras de cada técnico: neto pagado (con bolívares), órdenes y pagos', cifras.map((c) => c.items.map((i) => [i.etiqueta, i.valor, i.detalle])), [
  [['Neto pagado', usd('47,83 $'), bs('41.545,50 Bs')], ['Órdenes pagadas', '6', undefined], ['Pagos', '3', undefined]],
  [['Neto pagado', usd('10,00 $'), bs('8.800,00 Bs')], ['Órdenes pagadas', '2', undefined], ['Pago', '1', undefined]],
]);
const paraPdf = todos.bloques.filter((b) => b.tipo === 'tabla' && b.noCsv);
check('por cada pago hay una tabla de cuenta y una de órdenes, y una de descuentos y bonos si los tuvo (3 + 3 + 3 + 2 tablas)', paraPdf.map((t) => t.titulo.replace(/\(\d+\)/, '(n)').replace(/\d{2}\/\d{2}\/\d{4}.*?·/, 'FECHA ·')), [
  'Pago del FECHA · 3 órdenes', 'Órdenes pagadas (n)', 'Descuentos y bonos (n)',
  'Pago del FECHA · 2 órdenes', 'Órdenes pagadas (n)', 'Descuentos y bonos (n)',
  'Pago del FECHA · 1 orden', 'Órdenes pagadas (n)', 'Descuentos y bonos (n)',
  'Pago del FECHA · 2 órdenes', 'Órdenes pagadas (n)',
]);
check('la tabla de cuenta de un pago lleva la forma de pago como nota y sus filas de cuenta', [paraPdf[0].columnas.map((c) => c.titulo), paraPdf[0].nota.startsWith('Forma de pago: Transferencia'), paraPdf[0].filas.length], [['Resumen del pago', 'Monto'], true, 5]);
check('el cliente que no se conoce sale con un guion en el PDF y el Word, y vacío en el CSV (Excel trata como fórmula lo que empieza con "-")', [paraPdf[1].filas.map((f) => f[1]), csvDeDocumento(todos).includes(";'-;")], [['José Núñez', '-', 'María Pérez'], false]);
check('la tabla de órdenes de un pago con órdenes sin leer avisa cuántas faltan', paraPdf.at(-1).filas.at(-1)[1], 'Falta 1 orden de este pago: no se pudo leer');
check('todas las tablas de los Pagos detallados traen una celda de texto por columna', paraPdf.every((t) => t.filas.every((f) => f.length === t.columnas.length && f.every((c) => typeof c === 'string'))), true);
const csv = csvDeDocumento(todos);
check('el CSV trae las tres listas planas (cuenta de cada pago, órdenes, descuentos y bonos) y no las tablas del PDF', [
  csv.includes('Cuenta de cada pago'), csv.includes('Órdenes pagadas\r\n'), csv.includes('Descuentos y bonos\r\n'), csv.includes('Resumen del pago'),
], [true, true, true, false]);
check('el CSV de órdenes tiene una fila por orden leída', csv.split('\r\n').filter((l) => /^(JOSE|LUIS);\d{2}\/\d{2}\/\d{4}/.test(l) && /;(AO|AS|IO|AM)\d+;/.test(l)).length, ordenesPagadas.length);
check('el CSV de la cuenta tiene una fila por pago, con el neto y los bolívares', csv.split('\r\n').filter((l) => /^(JOSE|LUIS);\d{2}\/\d{2}\/\d{4} [^;]*;\d+;[\d.,]+ \$;/.test(l)).map((l) => l.split(';').slice(2, 8).join('|')), [
  '3|15,00 $|5,00 $|4,00 $|16,00 $|14.400,00 Bs', '2|26,33 $|5,00 $|2,50 $|28,83 $|24.505,50 Bs', '1|5,00 $|0,00 $|2,00 $|3,00 $|2.640,00 Bs', '2|10,00 $|0,00 $|0,00 $|10,00 $|8.800,00 Bs',
]);
check('el CSV de descuentos y bonos lleva el técnico y la fecha del pago en cada fila', csv.split('\r\n').filter((l) => /;(Adelanto|Descuento|Pago adicional|Descuento por garantía|Pago por garantía);/.test(l)).length, 3 + 2 + 1);

const deJose = documentoPagosDetallados(contexto({ tecnico: 'JOSE', pagosFinanzas: { pagos, tasa: 880, adelantos, descuentos, detalle: detalle.filter((d) => d.tecnico === 'JOSE') } }));
check('con un técnico elegido es su documento: sin secciones ni saltos, su nombre en el subtítulo y en el nombre del archivo',
  [deJose.bloques.some((b) => b.tipo === 'seccion' || b.tipo === 'salto'), deJose.subtitulo.includes('Técnico: JOSE'), deJose.nombreArchivo, nombreDeArchivo(deJose, rango), deJose.bloques.filter((b) => b.tipo === 'cifras').length],
  [false, true, 'Pagos detallados JOSE', 'pagos-detallados-jose_2026-11-01_2026-11-09', 1]);
check('el documento de un técnico no menciona a los demás técnicos pagados', JSON.stringify(deJose.bloques.filter((b) => b.noCsv)).includes('LUIS'), false);
const vacio = documentoPagosDetallados(contexto({ pagosFinanzas: { pagos: [], tasa: 880, adelantos: [], descuentos: [], detalle: [] } }));
check('sin pagos en el periodo el documento lo dice y no falla (tampoco el CSV)', [vacio.bloques.find((b) => b.noCsv)?.vacio, csvDeDocumento(vacio).includes('Cuenta de cada pago')], ['Ningún pago registrado en este periodo.', true]);
check('el nombre del archivo del Resumen no cambió', nombreDeArchivo(resumen, rango), 'resumen-de-pagos_2026-11-01_2026-11-09');

// --- Los archivos (PDF y Word) se arman sin fallar ---
const { generarPdf } = await import('../src/utils/exportarPdf.js');
const { generarDocx } = await import('../src/utils/exportarDocx.js');
for (const [nombre, documento] of [['Resumen de pagos', resumen], ['Pagos detallados de todos', todos], ['Pagos detallados de un técnico', deJose], ['Pagos detallados vacío', vacio]]) {
  const pdf = await generarPdf(documento);
  const cabecera = Buffer.from(await pdf.slice(0, 5).arrayBuffer()).toString('latin1');
  check(`${nombre}: el PDF se arma`, [cabecera, pdf.size > 3000], ['%PDF-', true]);
  const word = await generarDocx(documento);
  check(`${nombre}: el Word se arma`, word.size > 3000, true);
}

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
