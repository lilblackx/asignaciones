// Prueba las cuentas del módulo de Finanzas (src/utils/finanzas.js): qué órdenes se le pagan al técnico, el total
// por técnico con las tarifas, que una orden ya pagada no se cobre dos veces y cómo se arma un pago. No necesita el emulador.
// Uso: `npm run test:finanzas`.
import {
  CONCEPTOS_PAGO, SIN_TECNICO, armarPago, cifrasPagos, cifrasResumenPagado, claveOrden, conceptoDePago, conceptosSinTarifa, dolares, frasePagado, ordenesPagables, parseTarifa, resumenPagado, resumenPagos, sumaPagado, tarifasCompletas, totalesPagados, totalPendiente,
} from '../src/utils/finanzas.js';
import { ROLES, etiquetaRol } from '../src/constants.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// 2026-10-14 12:00 en Caracas (UTC-4) = 16:00 UTC.
const DIA = (n) => Date.UTC(2026, 9, n, 16, 0, 0);
const rango = { desde: '2026-10-01', hasta: '2026-10-31' };
let n = 0;
const orden = (extra) => ({ id: `o${++n}`, codigo: `IO${n}`, nombre: `Cliente ${n}`, estado: 'FINALIZADO', tecnico: 'GERARDO', createdAt: DIA(1), finalizadoEn: DIA(14), tipoTrabajo: 'AVERÍA', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', ...extra });

const instalacion = orden({ tipoTrabajo: 'INSTALACIÓN', cobroBs: null, cobroTipo: null });
const averiaCobrada = orden({});
const averiaExonerada = orden({ cobroBs: null, cobroTipo: 'EXONERADO' });
const lowSignal = orden({ tipoTrabajo: 'LOW SIGNAL', cobroBs: null, cobroTipo: null });
const averiaSinCobro = orden({ cobroBs: null, cobroTipo: null });
const averiaGarantia = orden({ falla: 'GARANTIA' });
const averiaCancelada = orden({ estado: 'CANCELADO', canceladaEn: DIA(14), finalizadoEn: null });
const mudanza = orden({ tipoTrabajo: 'MUDANZA' });
const garantiaVisita = orden({ tipoTrabajo: 'GARANTIA' });
const validacion = orden({ tipoTrabajo: 'VALIDACION NAP' });
const otroTecnico = orden({ tecnico: 'LUIS', tipoTrabajo: 'INSTALACIÓN', cobroBs: null, cobroTipo: null });
const sinTecnico = orden({ tecnico: '', tipoTrabajo: 'INSTALACIÓN', cobroBs: null, cobroTipo: null });
const fueraDeRango = orden({ finalizadoEn: Date.UTC(2026, 8, 20, 16), tipoTrabajo: 'INSTALACIÓN', cobroBs: null, cobroTipo: null });
const pendiente = orden({ estado: 'PENDIENTE', finalizadoEn: null });
const todas = [instalacion, averiaCobrada, averiaExonerada, lowSignal, averiaSinCobro, averiaGarantia, averiaCancelada, mudanza, garantiaVisita, validacion, otroTecnico, sinTecnico, fueraDeRango, pendiente];

// --- El rol ---
check('el rol existe y se muestra tal cual', [ROLES.FINANZAS, etiquetaRol('FINANZAS')], ['FINANZAS', 'FINANZAS']);

// --- Qué se le paga al técnico ---
check('instalación finalizada: se paga', conceptoDePago(instalacion, 'INSTALACIONES'), 'INSTALACION');
check('avería cobrada y exonerada: se pagan', [conceptoDePago(averiaCobrada, 'AVERIAS'), conceptoDePago(averiaExonerada, 'AVERIAS')], ['AVERIA', 'AVERIA']);
check('low signal siempre se paga', conceptoDePago(lowSignal, 'AVERIAS'), 'AVERIA');
check('avería sin cobro registrado, garantía y cancelada no se pagan', [conceptoDePago(averiaSinCobro, 'AVERIAS'), conceptoDePago(averiaGarantia, 'AVERIAS'), conceptoDePago(averiaCancelada, 'AVERIAS')], [null, null, null]);
check('visita cobrada se paga; la garantía no', [conceptoDePago(mudanza, 'VISITAS'), conceptoDePago(garantiaVisita, 'VISITAS')], ['VISITA', null]);
check('la validación de NAP (hoja manual) no se paga aquí', conceptoDePago(validacion, 'VNTA'), null);

const items = ordenesPagables(todas, rango);
check('las órdenes pagables del periodo', items.map((i) => [i.orden.id, i.concepto, i.tecnico]).sort(), [
  [instalacion.id, 'INSTALACION', 'GERARDO'], [averiaCobrada.id, 'AVERIA', 'GERARDO'], [averiaExonerada.id, 'AVERIA', 'GERARDO'], [lowSignal.id, 'AVERIA', 'GERARDO'],
  [mudanza.id, 'VISITA', 'GERARDO'], [otroTecnico.id, 'INSTALACION', 'LUIS'], [sinTecnico.id, 'INSTALACION', SIN_TECNICO],
].sort());
check('filtrar por técnico', ordenesPagables(todas, rango, { tecnico: 'luis' }).map((i) => i.orden.id), [otroTecnico.id]);

// --- Recableado: tarifa propia ---
const averiaRecableado = orden({ tipoVisita: 'RECABLEADO' });
const visitaRecableado = orden({ tipoTrabajo: 'MUDANZA', tipoVisita: 'RECABLEADO', cobroBs: null, cobroTipo: 'EXONERADO' });
const recableadoGarantia = orden({ tipoVisita: 'RECABLEADO', falla: 'GARANTIA' });
const recableadoCancelado = orden({ tipoVisita: 'RECABLEADO', estado: 'CANCELADO', canceladaEn: DIA(14), finalizadoEn: null });
const instalacionConRecableado = orden({ tipoTrabajo: 'INSTALACIÓN', tipoVisita: 'RECABLEADO', cobroBs: null, cobroTipo: null });
check('una avería pagada que fue recableado se paga como recableado', conceptoDePago(averiaRecableado, 'AVERIAS'), 'RECABLEADO');
check('una visita exonerada que fue recableado también', conceptoDePago(visitaRecableado, 'VISITAS'), 'RECABLEADO');
check('un recableado en garantía, cancelado o una instalación no cambian de concepto', [conceptoDePago(recableadoGarantia, 'AVERIAS'), conceptoDePago(recableadoCancelado, 'AVERIAS'), conceptoDePago(instalacionConRecableado, 'INSTALACIONES')], [null, null, 'INSTALACION']);
const filasRec = resumenPagos(ordenesPagables([averiaRecableado, visitaRecableado, averiaCobrada], rango), tarifasCompletas({ INSTALACION: 20, VISITA: 5, AVERIA: 3.5, RECABLEADO: 8 }), new Set());
check('GERARDO: 2 recableados × 8 + 1 avería × 3,50 = 19,50', [filasRec[0].cantidades, filasRec[0].total], [{ INSTALACION: 0, VISITA: 0, AVERIA: 1, RECABLEADO: 2 }, 19.5]);
check('sin precio de recableado avisa y no suma', conceptosSinTarifa(filasRec[0], tarifasCompletas({ INSTALACION: 20, VISITA: 5, AVERIA: 3.5 })), ['Recableado']);

// --- Lo ya pagado, por técnico ---
const ya = totalesPagados([{ tecnico: 'GERARDO', monto: 3.5 }, { tecnico: 'GERARDO', monto: 20 }, { tecnico: 'LUIS', monto: 5 }]);
check('lo pagado por técnico', ya, { GERARDO: { ordenes: 2, total: 23.5 }, LUIS: { ordenes: 1, total: 5 } });
check('suma de lo pagado', sumaPagado(Object.values(ya)), { ordenes: 3, monto: 28.5 });
check('las cifras: total a pagar, técnicos por pagar y ya pagado', cifrasPagos(resumenPagos(items, tarifasCompletas({ INSTALACION: 20, VISITA: 5, AVERIA: 3.5 }), new Set()).filter((f) => f.tecnico !== SIN_TECNICO), { ordenes: 3, monto: 28.5 }).map((c) => [c.etiqueta, c.valor]), [['Total a pagar', dolares(55.5)], ['Técnicos por pagar', 2], ['Ya pagado', dolares(28.5)]]);

// --- Totales con tarifas ---
const tarifas = tarifasCompletas({ INSTALACION: 20, VISITA: 5, AVERIA: 3.5 });
check('las tarifas faltantes valen 0', tarifasCompletas({ INSTALACION: 20 }), { INSTALACION: 20, VISITA: 0, AVERIA: 0, RECABLEADO: 0 });
const filas = resumenPagos(items, tarifas, new Set());
const gerardo = filas.find((f) => f.tecnico === 'GERARDO');
check('GERARDO: 1 instalación, 1 visita, 3 averías', gerardo.cantidades, { INSTALACION: 1, VISITA: 1, AVERIA: 3, RECABLEADO: 0 });
check('GERARDO: 20 + 5 + 3 × 3,50 = 35,50', gerardo.total, 35.5);
check('de más a menos por pagar', filas.map((f) => f.tecnico), ['GERARDO', 'LUIS', SIN_TECNICO]);
check('total por pagar de todos', totalPendiente(filas), 75.5);

// --- Una orden ya pagada no se paga dos veces ---
const yaPagadas = new Set([claveOrden(averiaCobrada), claveOrden(lowSignal)]);
const despues = resumenPagos(items, tarifas, yaPagadas).find((f) => f.tecnico === 'GERARDO');
check('las ya pagadas salen de lo pendiente', [despues.cantidades.AVERIA, despues.total, despues.pagadas], [1, 28.5, 2]);
check('si todo está pagado no queda nada por pagar', resumenPagos(items, tarifas, new Set(items.map((i) => i.clave))).every((f) => f.pendientes.length === 0 && f.total === 0), true);
check('avisa de los conceptos sin tarifa', conceptosSinTarifa(gerardo, tarifasCompletas({ INSTALACION: 20 })), ['Visita pagada', 'Avería pagada']);
check('con todas las tarifas no avisa', conceptosSinTarifa(gerardo, tarifas), []);

// --- Armar un pago ---
const ahora = DIA(20);
const pago = armarPago(gerardo, rango, tarifas, { por: 'fina', ahora, nota: '  Quincena  1 ' });
check('el pago lleva técnico, periodo, total y quién lo hizo', [pago.pago.tecnico, pago.pago.desde, pago.pago.hasta, pago.pago.total, pago.pago.cantidadOrdenes, pago.pago.por, pago.pago.anulado], ['GERARDO', '2026-10-01', '2026-10-31', 35.5, 5, 'fina', false]);
check('la nota se limpia', pago.pago.nota, 'Quincena 1');
check('guarda las tarifas de ese momento', pago.pago.tarifas, { INSTALACION: 20, VISITA: 5, AVERIA: 3.5, RECABLEADO: 0 });
check('una fila por orden, con el monto de su concepto', pago.ordenes.map((o) => [o.datos.concepto, o.datos.monto]).sort(), [['AVERIA', 3.5], ['AVERIA', 3.5], ['AVERIA', 3.5], ['INSTALACION', 20], ['VISITA', 5]]);
check('cada fila apunta al pago', pago.ordenes.every((o) => o.datos.pagoId === pago.pagoId), true);
check('los montos de las filas suman el total', Math.round(pago.ordenes.reduce((s, o) => s + o.datos.monto, 0) * 100) / 100, pago.pago.total);
check('sin técnico no se paga', armarPago(filas.find((f) => f.tecnico === SIN_TECNICO), rango, tarifas, { por: 'fina', ahora }).error !== undefined, true);
check('sin tarifas el total es 0 y no se paga', armarPago(resumenPagos(items, tarifasCompletas({}), new Set())[0], rango, tarifasCompletas({}), { por: 'fina', ahora }).error !== undefined, true);
check('sin órdenes pendientes no se paga', armarPago({ ...gerardo, pendientes: [] }, rango, tarifas, { por: 'fina', ahora }).error !== undefined, true);
check('demasiadas órdenes para un lote se rechazan', armarPago({ ...gerardo, pendientes: Array.from({ length: 451 }, () => gerardo.pendientes[0]) }, rango, tarifas, { por: 'fina', ahora }).error !== undefined, true);
check('el id del pago no repite entre técnicos ni instantes', new Set([pago.pagoId, armarPago(filas.find((f) => f.tecnico === 'LUIS'), rango, tarifas, { por: 'fina', ahora }).pagoId, armarPago(gerardo, rango, tarifas, { por: 'fina', ahora: ahora + 1 }).pagoId]).size, 3);

// --- Tarifas escritas a mano ---
check('tarifas válidas', ['5', '5,50', '5.5', '0', ' 12 '].map((t) => parseTarifa(t).valor), [5, 5.5, 5.5, 0, 12]);
check('tarifas inválidas', ['', 'abc', '-3', '5,555', '1000000', '1,2,3'].map((t) => parseTarifa(t).error !== undefined), [true, true, true, true, true, true]);

check('los conceptos son cuatro', CONCEPTOS_PAGO.map((c) => c.id), ['INSTALACION', 'VISITA', 'AVERIA', 'RECABLEADO']);

// --- Resumen de lo pagado ---
const dia = (n) => Date.UTC(2026, 9, n, 16, 0, 0);
const pagosPrueba = [
  { id: 'p1', tecnico: 'REINEL BRAVO', total: 245, cantidadOrdenes: 15, cantidades: { INSTALACION: 5, VISITA: 0, AVERIA: 10, RECABLEADO: 0 }, creadoEn: dia(15), anulado: false },
  { id: 'p2', tecnico: 'REINEL BRAVO', total: 40, cantidadOrdenes: 4, cantidades: { INSTALACION: 0, VISITA: 1, AVERIA: 2, RECABLEADO: 1 }, creadoEn: dia(18), anulado: false },
  { id: 'p3', tecnico: 'GERARDO MOLERO', total: 100, cantidadOrdenes: 10, cantidades: { AVERIA: 10 }, creadoEn: dia(16), anulado: false },
  { id: 'p4', tecnico: 'GERARDO MOLERO', total: 999, cantidadOrdenes: 99, cantidades: { AVERIA: 99 }, creadoEn: dia(16), anulado: true },
  { id: 'p5', tecnico: 'LUIS', total: 50, cantidadOrdenes: 5, cantidades: { AVERIA: 5 }, creadoEn: Date.UTC(2026, 8, 1, 16) },
];
const pagado = resumenPagado(pagosPrueba, rango);
check('el resumen suma lo pagado: no cuenta lo anulado ni lo de otro periodo', [pagado.total, pagado.ordenes, pagado.pagos, pagado.porTecnico.length], [385, 29, 3, 2]);
check('REINEL: 245 + 40 por 19 órdenes en 2 pagos, con el detalle por concepto', pagado.porTecnico[0], { tecnico: 'REINEL BRAVO', pagos: 2, ordenes: 19, total: 285, cantidades: { INSTALACION: 5, VISITA: 1, AVERIA: 12, RECABLEADO: 1 }, ultimo: dia(18) });
check('GERARDO: un pago de 100 por 10 órdenes (un cantidades incompleto no rompe)', [pagado.porTecnico[1].total, pagado.porTecnico[1].ordenes, pagado.porTecnico[1].cantidades.INSTALACION], [100, 10, 0]);
check('la frase del reporte', frasePagado({ tecnico: 'REINEL BRAVO', ordenes: 15, total: 245 }), `Se pagó ${dolares(245)} por 15 órdenes a REINEL BRAVO`);
check('filtrar por técnico', resumenPagado(pagosPrueba, rango, { tecnico: 'gerardo molero' }).total, 100);
check('las cifras del reporte', cifrasResumenPagado(pagado).map((c) => [c.etiqueta, c.valor]), [['Total pagado', dolares(385)], ['Órdenes pagadas', 29], ['Técnicos pagados', 2]]);
check('sin pagos el resumen está vacío', resumenPagado([], rango), { total: 0, ordenes: 0, pagos: 0, porTecnico: [] });

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
