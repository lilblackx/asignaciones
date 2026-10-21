// Prueba los datos del pago a un técnico y los adelantos (src/utils/datosPago.js, adelantos.js y lo que usan de finanzas.js): validación de moneda, forma, referencia, fecha y
// hora; el descuento de los adelantos del pago; el desglose por concepto y los avisos al técnico. No necesita el emulador. Uso: `node scripts/test-pagos-adelantos.mjs`.
import {
  MONEDA_BS, MONEDA_USD, exigeReferencia, fechaHoraDeMarca, formasDeMoneda, marcaDeFechaHora, parseAdelanto, parseDatosPago, parseMontoAdelanto,
} from '../src/utils/datosPago.js';
import { adelantosConSaldo, armarAdelanto, repartirAdelantos, saldoAdelanto, sePuedeAnularAdelanto } from '../src/utils/adelantos.js';
import {
  agruparOrdenes, armarPago, avisoDeAdelanto, avisoDeAnulacion, avisoDePago, desglosePorConcepto, ordenesPagables, resumenPagos, tarifasCompletas, totalPendiente, textoDatosPago, columnasPagosRegistrados, filaPagoRegistrado,
} from '../src/utils/finanzas.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const AHORA = Date.parse('2026-10-26T15:00:00-04:00');

// --- Fecha y hora ---
check('la hora es la de Caracas', [marcaDeFechaHora('2026-10-26', '15:45'), fechaHoraDeMarca(Date.parse('2026-10-26T15:45:00-04:00'))], [Date.parse('2026-10-26T15:45:00-04:00'), { fecha: '2026-10-26', hora: '15:45' }]);
check('una fecha u hora inválida no es una marca', ['2026-02-30', '2026-10-26', '2026-10-26', ''].map((f, i) => marcaDeFechaHora(f, ['10:00', '25:00', '9:5', '10:00'][i])), [null, null, null, null]);

// --- Datos del pago ---
const base = { moneda: MONEDA_BS, forma: 'Pago móvil', banco: ' Banesco ', referencia: ' 0012 3456 ', fecha: '2026-10-26', hora: '14:30' };
check('un pago válido sale limpio, con la fecha y hora como marca de tiempo', parseDatosPago(base, { ahora: AHORA }), { valor: { moneda: 'BS', forma: 'Pago móvil', banco: 'Banesco', referencia: '0012 3456', pagadoEn: Date.parse('2026-10-26T14:30:00-04:00') } });
check('las formas dependen de la moneda', [formasDeMoneda(MONEDA_BS), formasDeMoneda(MONEDA_USD), formasDeMoneda('EUR')], [['Pago móvil', 'Transferencia', 'Efectivo'], ['Zelle', 'Pago móvil', 'Transferencia', 'Efectivo', 'Otro'], []]);
check('Zelle no vale en bolívares, y una forma inventada no vale en ninguna moneda', [parseDatosPago({ ...base, forma: 'Zelle' }, { ahora: AHORA }).campo, parseDatosPago({ ...base, forma: 'Bitcoin' }, { ahora: AHORA }).campo, parseDatosPago({ ...base, moneda: MONEDA_USD, forma: 'Bitcoin' }, { ahora: AHORA }).campo], ['forma', 'forma', 'forma']);
check('en dólares también se puede pagar con Pago móvil y Transferencia', ['Pago móvil', 'Transferencia'].map((forma) => parseDatosPago({ ...base, moneda: MONEDA_USD, forma }, { ahora: AHORA }).valor?.forma), ['Pago móvil', 'Transferencia']);
check('el banco es obligatorio en pago móvil, transferencia y Zelle, y no en efectivo ni en "Otro"', [['Pago móvil', 'Transferencia'].map((forma) => parseDatosPago({ ...base, forma, banco: '' }, { ahora: AHORA }).campo), parseDatosPago({ ...base, moneda: MONEDA_USD, forma: 'Zelle', banco: '' }, { ahora: AHORA }).campo, parseDatosPago({ ...base, moneda: MONEDA_USD, forma: 'Otro', banco: '' }, { ahora: AHORA }).valor?.banco], [['banco', 'banco'], 'banco', '']);
check('en efectivo no se guarda banco aunque se haya escrito uno antes de cambiar la forma', parseDatosPago({ ...base, forma: 'Efectivo', banco: 'Banesco', referencia: '' }, { ahora: AHORA }).valor?.banco, '');
check('un banco muy largo se rechaza', parseDatosPago({ ...base, banco: 'x'.repeat(41) }, { ahora: AHORA }).campo, 'banco');
check('sin moneda no se puede', parseDatosPago({ ...base, moneda: '' }, { ahora: AHORA }).campo, 'moneda');
check('la referencia es obligatoria salvo en efectivo', [exigeReferencia('Zelle'), exigeReferencia('Efectivo'), parseDatosPago({ ...base, referencia: '' }, { ahora: AHORA }).campo, parseDatosPago({ ...base, forma: 'Efectivo', referencia: '' }, { ahora: AHORA }).valor?.referencia], [true, false, 'referencia', '']);
check('una referencia muy larga se rechaza', parseDatosPago({ ...base, referencia: 'x'.repeat(41) }, { ahora: AHORA }).campo, 'referencia');
check('la fecha y la hora no pueden ser futuras, pero cinco minutos de diferencia del reloj se toleran', [parseDatosPago({ ...base, hora: '15:30' }, { ahora: AHORA }).campo, parseDatosPago({ ...base, hora: '15:04' }, { ahora: AHORA }).valor !== undefined, parseDatosPago({ ...base, fecha: '2026-10-27' }, { ahora: AHORA }).campo], ['fecha', true, 'fecha']);

// --- Monto y adelanto ---
check('el monto del adelanto', ['50', '50,5', '50.50', '', '0', '-5', 'abc', '1000000'].map((t) => parseMontoAdelanto(t).valor ?? 'error'), [50, 50.5, 50.5, 'error', 'error', 'error', 'error', 'error']);
const adelantoEscrito = { monto: '50', forma: 'Zelle', banco: 'Chase', referencia: 'ZL-9', fecha: '2026-10-26', hora: '10:00', nota: '  para   gasolina ' };
check('un adelanto es siempre en dólares y sale limpio', parseAdelanto(adelantoEscrito, { ahora: AHORA }), { valor: { monto: 50, forma: 'Zelle', banco: 'Chase', referencia: 'ZL-9', pagadoEn: Date.parse('2026-10-26T10:00:00-04:00'), nota: 'para gasolina' } });
check('un adelanto acepta Pago móvil y Transferencia, pero no una forma inventada', [parseAdelanto({ ...adelantoEscrito, forma: 'Pago móvil' }, { ahora: AHORA }).valor?.forma, parseAdelanto({ ...adelantoEscrito, forma: 'Transferencia' }, { ahora: AHORA }).valor?.forma, parseAdelanto({ ...adelantoEscrito, forma: 'Bitcoin' }, { ahora: AHORA }).campo], ['Pago móvil', 'Transferencia', 'forma']);
check('el adelanto en efectivo no pide referencia', parseAdelanto({ ...adelantoEscrito, forma: 'Efectivo', referencia: '' }, { ahora: AHORA }).valor?.forma, 'Efectivo');

// --- Adelantos: saldo y reparto ---
const adelanto = (id, monto, extra = {}) => ({ id, tecnico: 'GERARDO', monto, aplicado: 0, pagadoEn: Date.parse('2026-10-26T10:00:00-04:00'), creadoEn: 1, anulado: false, ...extra });
check('el saldo de un adelanto', [saldoAdelanto(adelanto('a', 50)), saldoAdelanto(adelanto('a', 50, { aplicado: 20 })), saldoAdelanto(adelanto('a', 50, { anulado: true })), saldoAdelanto(adelanto('a', 50, { aplicado: 50 }))], [50, 30, 0, 0]);
const lista = [adelanto('nuevo', 30, { pagadoEn: 3 }), adelanto('viejo', 20, { pagadoEn: 1 }), adelanto('medio', 40, { pagadoEn: 2, aplicado: 10 }), adelanto('otro', 99, { tecnico: 'REINEL' }), adelanto('anulado', 15, { anulado: true })];
check('los adelantos con saldo del técnico, del más viejo al más nuevo', adelantosConSaldo(lista, 'GERARDO').map((a) => a.id), ['viejo', 'medio', 'nuevo']);
check('se descuenta del más viejo al más nuevo hasta lo que se debe', repartirAdelantos(adelantosConSaldo(lista, 'GERARDO'), 45), { descuento: 45, partes: [{ id: 'viejo', monto: 20 }, { id: 'medio', monto: 25 }] });
check('nunca se descuenta más que el total: lo demás queda de saldo', repartirAdelantos(adelantosConSaldo(lista, 'GERARDO'), 1000), { descuento: 80, partes: [{ id: 'viejo', monto: 20 }, { id: 'medio', monto: 30 }, { id: 'nuevo', monto: 30 }] });
check('sin total no se descuenta nada', repartirAdelantos(adelantosConSaldo(lista, 'GERARDO'), 0), { descuento: 0, partes: [] });
check('un adelanto armado: aplicado 0, sin anular, con quién y cuándo', armarAdelanto('GERARDO', { monto: 50, forma: 'Zelle', banco: 'Chase', referencia: 'ZL-9', pagadoEn: 5, nota: '' }, { por: 'fina', ahora: 7, notificar: true }), { tecnico: 'GERARDO', monto: 50, aplicado: 0, forma: 'Zelle', banco: 'Chase', referencia: 'ZL-9', pagadoEn: 5, nota: '', por: 'fina', creadoEn: 7, anulado: false, notificado: true });
check('solo se anula un adelanto que no se ha descontado', [sePuedeAnularAdelanto(adelanto('a', 50)), sePuedeAnularAdelanto(adelanto('a', 50, { aplicado: 1 })), sePuedeAnularAdelanto(adelanto('a', 50, { anulado: true }))], [true, false, false]);

// --- El pago pendiente con adelantos ---
const DIA = (n) => Date.UTC(2026, 9, n, 16, 0, 0);
const rango = { desde: '2026-10-26', hasta: '2026-10-31' };
const orden = (id, extra) => ({ id, codigo: `IO${id}`, nombre: `Cliente ${id}`, estado: 'FINALIZADO', tecnico: 'GERARDO', createdAt: DIA(26), finalizadoEn: DIA(27), tipoTrabajo: 'INSTALACIÓN', ...extra });
const tarifas = tarifasCompletas({ INSTALACION: 25, AVERIA: 4 });
const items = ordenesPagables([orden('1'), orden('2'), orden('3', { tipoTrabajo: 'AVERÍA', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA' })], rango);
const sinAdelanto = resumenPagos(items, tarifas, new Set())[0];
check('sin adelantos el neto es el total', [sinAdelanto.total, sinAdelanto.adelantos, sinAdelanto.descuento, sinAdelanto.neto], [54, 0, 0, 54]);
const conAdelanto = resumenPagos(items, tarifas, new Set(), [adelanto('a1', 20)])[0];
check('el adelanto se resta de lo pendiente: 54 − 20 = 34', [conAdelanto.total, conAdelanto.adelantos, conAdelanto.descuento, conAdelanto.neto, totalPendiente([conAdelanto])], [54, 20, 20, 34, 34]);
const grande = resumenPagos(items, tarifas, new Set(), [adelanto('a1', 80)])[0];
check('un adelanto mayor que lo que se debe: se descuenta el total, el neto es 0 y el saldo queda', [grande.adelantos, grande.descuento, grande.neto], [80, 54, 0]);
const soloAdelanto = resumenPagos([], tarifas, new Set(), [adelanto('a1', 30, { tecnico: 'LUIS' })]);
check('un técnico con solo adelantos tiene tarjeta, sin órdenes ni descuento', soloAdelanto.map((f) => [f.tecnico, f.pendientes.length, f.total, f.adelantos, f.descuento, f.neto]), [['LUIS', 0, 0, 30, 0, 0]]);
check('un adelanto anulado o ya descontado no cuenta', resumenPagos(items, tarifas, new Set(), [adelanto('a1', 20, { anulado: true }), adelanto('a2', 20, { aplicado: 20 })])[0].adelantos, 0);

// --- El desglose por concepto ---
check('una fila por concepto con órdenes: cantidad, precio y subtotal', desglosePorConcepto(sinAdelanto.cantidades, tarifas), [{ id: 'INSTALACION', nombre: 'Instalación', cantidad: 2, precio: 25, subtotal: 50 }, { id: 'AVERIA', nombre: 'Visita / avería pagada', cantidad: 1, precio: 4, subtotal: 4 }]);
check('sin órdenes no hay desglose', desglosePorConcepto(resumenPagos([], tarifas, new Set(), [adelanto('a1', 30, { tecnico: 'LUIS' })])[0].cantidades, tarifas), []);

// --- Armar el pago ---
const datos = parseDatosPago({ moneda: MONEDA_BS, forma: 'Pago móvil', banco: 'Banesco', referencia: '123', fecha: '2026-10-28', hora: '09:00' }, { ahora: DIA(28) + 8 * 3600000 }).valor;
check('el pago en Bs sin tasa no se arma', armarPago(conAdelanto, rango, tarifas, { por: 'fina', ahora: DIA(28), datos }).error, 'No hay tasa BCV: elige dólares o actualiza la tasa.');
const pagoBs = armarPago(conAdelanto, rango, tarifas, { por: 'fina', ahora: DIA(28), tasa: 883.4, datos, notificar: true });
check('el pago guarda el bruto, el descuento, el neto, los datos y cuánto se pagó en bolívares', [pagoBs.pago.total, pagoBs.pago.descuento, pagoBs.pago.neto, pagoBs.pago.moneda, pagoBs.pago.forma, pagoBs.pago.referencia, pagoBs.pago.pagadoEn, pagoBs.pago.montoPagado, pagoBs.pago.notificado, pagoBs.pago.tasa], [54, 20, 34, 'BS', 'Pago móvil', '123', datos.pagadoEn, 30035.6, true, 883.4]);
check('el pago y el lote llevan los adelantos que se descuentan', [pagoBs.pago.adelantos, pagoBs.adelantos], [[{ id: 'a1', monto: 20 }], [{ id: 'a1', monto: 20 }]]);
const datosUsd = parseDatosPago({ moneda: MONEDA_USD, forma: 'Zelle', banco: 'Chase', referencia: 'ZL-1', fecha: '2026-10-28', hora: '09:00' }, { ahora: DIA(28) + 8 * 3600000 }).valor;
const pagoUsd = armarPago(sinAdelanto, rango, tarifas, { por: 'fina', ahora: DIA(28), datos: datosUsd });
check('en dólares se paga el neto y no hace falta tasa; sin adelantos no hay lista de adelantos', [pagoUsd.pago.montoPagado, pagoUsd.pago.descuento, pagoUsd.pago.adelantos, pagoUsd.adelantos], [54, 0, undefined, []]);
check('sin datos (pagos de antes) el pago sigue armándose sin moneda ni forma', [armarPago(sinAdelanto, rango, tarifas, { por: 'fina', ahora: DIA(28) }).pago.moneda, armarPago(sinAdelanto, rango, tarifas, { por: 'fina', ahora: DIA(28) }).pago.neto], [undefined, 54]);

// --- Avisos y reportes ---
check('el aviso del pago en bolívares', avisoDePago(pagoBs.pago), { title: 'Pago recibido', body: `Se te registró un pago de ${'30.035,60'}${String.fromCharCode(160)}Bs (34,00${String.fromCharCode(160)}$) por 3 órdenes: 2 instalaciones · 1 avería. Se descontaron 20,00${String.fromCharCode(160)}$ de adelantos. Pago móvil · Banesco · Ref. 123.` });
check('el aviso del pago en dólares sin adelantos', avisoDePago(pagoUsd.pago).body, `Se te registró un pago de 54,00${String.fromCharCode(160)}$ por 3 órdenes: 2 instalaciones · 1 avería. Zelle · Chase · Ref. ZL-1.`);
check('el aviso de un pago anulado', avisoDeAnulacion(pagoBs.pago), { title: 'Pago anulado', body: `Se anuló el pago de 30.035,60${String.fromCharCode(160)}Bs (3 órdenes). Esas órdenes vuelven a estar por pagar.` });
check('el aviso del adelanto', avisoDeAdelanto({ monto: 50, forma: 'Zelle', referencia: 'ZL-9' }), { title: 'Adelanto registrado', body: `Se te registró un adelanto de 50,00${String.fromCharCode(160)}$ (Zelle · Ref. ZL-9). Se descontará de tu próximo pago.` });
check('el texto del pago en el reporte: forma, referencia, fecha y hora, y moneda; "—" en los pagos de antes', [textoDatosPago({ forma: 'Pago móvil', referencia: '123', pagadoEn: datos.pagadoEn, moneda: 'BS' }), textoDatosPago({ total: 5 })], ['Pago móvil · Ref. 123 · 28/10/2026 9:00 a. m. · Bs', '—']);
check('la tabla de pagos registrados trae adelantos, neto y datos del pago', [columnasPagosRegistrados().map((c) => c.titulo), filaPagoRegistrado({ ...pagoBs.pago, tecnico: 'GERARDO', creadoEn: DIA(28) }).slice(4, 10)], [['Fecha', 'Técnico', 'Periodo', 'Órdenes', 'Total', 'Adelantos', 'Neto', 'En Bs', 'Pago', 'Estado', 'Nota'], [`54,00${String.fromCharCode(160)}$`, `20,00${String.fromCharCode(160)}$`, `34,00${String.fromCharCode(160)}$`, `30.035,60${String.fromCharCode(160)}Bs`, 'Pago móvil · Banesco · Ref. 123 · 28/10/2026 9:00 a. m. · Bs', 'Pagado']]);

// --- Las órdenes agrupadas como en los reportes ---
const itemsMezclados = ordenesPagables([
  orden('7', { tipoTrabajo: 'AVERÍA', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', finalizadoEn: DIA(29) }),
  orden('8', { finalizadoEn: DIA(30) }),
  orden('9', { tipoTrabajo: 'AVERÍA', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', finalizadoEn: DIA(27) }),
  orden('10', { tipoTrabajo: 'MUDANZA', falla: 'Interna', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', finalizadoEn: DIA(28) }),
  orden('11', { finalizadoEn: DIA(27) }),
], rango, { registros: [{ id: 'r1', codigo: 'VAN01', trabajo: 'VN', tecnico: 'GERARDO', fecha: '2026-10-26', observacion: '' }, { id: 'r2', codigo: 'TA01', trabajo: 'TA', tecnico: 'GERARDO', fecha: '2026-10-27', observacion: '' }] });
const grupos = agruparOrdenes(itemsMezclados);
check('los grupos salen en el orden de los reportes: instalaciones, averías, validaciones de NAP y trabajos adicionales', grupos.map((g) => [g.titulo, g.items.length]), [['Instalaciones', 2], ['Averías', 3], ['Validaciones de NAP', 1], ['Trabajos adicionales', 1]]);
check('cada grupo va de la orden más antigua a la más nueva; la mudanza cuenta como avería', grupos.map((g) => g.items.map((i) => i.orden.codigo)), [['IO11', 'IO8'], ['IO9', 'IO10', 'IO7'], ['VAN01'], ['TA01']]);
check('solo salen los grupos que tienen órdenes', agruparOrdenes(itemsMezclados.filter((i) => i.concepto === 'INSTALACION')).map((g) => g.id), ['instalaciones']);
check('sin órdenes no hay grupos', agruparOrdenes([]), []);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
