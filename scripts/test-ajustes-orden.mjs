// Prueba la garantía de otro técnico (src/utils/garantia.js, ajustes.js, revisionPagos.js y finanzas.js): el check al crear la orden, que una garantía no se aprueba sin decidir, el descuento de la orden
// original, cuándo se crean los ajustes (al aprobar), que la garantía no se paga como orden y cómo entran en el pago de cada técnico y qué pasa si el descuento no alcanza.
// No necesita el emulador. Uso: `node scripts/test-ajustes-orden.mjs`.
import { SIN_TECNICO, armarPago, claveOrden, resumenPagos, tarifasCompletas } from '../src/utils/finanzas.js';
import { ajustesDeOrden, bonosConSaldo, descuentosConSaldo, idAjuste, parseMontoAjuste } from '../src/utils/ajustes.js';
import { buscarOrdenesGarantia, datosGarantia, errorGarantia, esGarantia } from '../src/utils/garantia.js';
import { aprobarPendientes, armarRevision, borrarAlDeshacer, garantiasPorResolver, itemsParaRevisar, motivoNoAprobable, paraFinanzas, revisar } from '../src/utils/revisionPagos.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const DIA = (n) => Date.UTC(2026, 9, n, 16, 0, 0);
const rango = { desde: '2026-10-26', hasta: '2026-10-31' };
const tarifas = { ...tarifasCompletas({}), INSTALACION: 25, AVERIA: 4 };
const orden = (id, tecnico, extra) => ({ id, codigo: id.toUpperCase(), nombre: `Cliente ${id}`, cedula: 'V-111', estado: 'FINALIZADO', tecnico, createdAt: DIA(25), finalizadoEn: DIA(27), tipoTrabajo: 'INSTALACIÓN', ...extra });

// --- El check "Garantía de otro técnico" al crear o editar la orden ---
const original = orden('io1', 'GERARDO');
const otra = orden('io9', 'LUIS', { cedula: 'V-999', nombre: 'Otro cliente' });
const cancelada = orden('io8', 'GERARDO', { estado: 'CANCELADO' });
const yaGarantia = orden('io7', 'GERARDO', { garantiaDe: { id: 'x', codigo: 'IO0', tecnico: 'LUIS' } });
const sinTec = orden('io6', '');
const todas = [original, otra, cancelada, yaGarantia, sinTec];
check('la garantía guarda la orden original: su clave, código, técnico y cliente', datosGarantia(original), { id: claveOrden(original), codigo: 'IO1', tecnico: 'GERARDO', cliente: 'Cliente io1' });
check('el buscador ofrece órdenes con técnico, sin cancelar, que no sean garantía, de otro técnico', buscarOrdenesGarantia(todas, 'io', { tecnico: 'REINEL' }).map((o) => o.codigo), ['IO1', 'IO9']);
check('no ofrece las del mismo técnico ni la misma orden', [buscarOrdenesGarantia(todas, 'io', { tecnico: 'gerardo' }).map((o) => o.codigo), buscarOrdenesGarantia(todas, 'io', { tecnico: 'REINEL', idExcluido: claveOrden(original) }).map((o) => o.codigo)], [['IO9'], ['IO9']]);
check('busca por cliente, cédula o técnico, sin importar tildes ni mayúsculas', [buscarOrdenesGarantia(todas, 'OTRO CLIENTE', {}).map((o) => o.codigo), buscarOrdenesGarantia(todas, 'v-999', {}).map((o) => o.codigo), buscarOrdenesGarantia(todas, 'luis', {}).map((o) => o.codigo)], [['IO9'], ['IO9'], ['IO9']]);
check('sin texto solo salen las del mismo cliente (por la cédula)', [buscarOrdenesGarantia(todas, '', { cedula: 'V-111', tecnico: 'REINEL' }).map((o) => o.codigo), buscarOrdenesGarantia(todas, '', { tecnico: 'REINEL' }).length], [['IO1'], 0]);
check('errores al guardar: sin original elegida o del mismo técnico', [errorGarantia(null), errorGarantia({ id: '' }), errorGarantia({ id: 'a', tecnico: 'GERARDO' }, { tecnico: 'gerardo' }), errorGarantia({ id: 'a', tecnico: 'GERARDO' }, { tecnico: 'REINEL' })], ['', 'Elige la orden original de la garantía.', 'La orden original es del mismo técnico: una garantía de otro técnico debe ser de uno distinto.', '']);
check('esGarantia', [esGarantia(yaGarantia), esGarantia(original)], [true, false]);

// --- El monto ---
check('el monto acepta coma o punto, con hasta dos decimales', [parseMontoAjuste('5').valor, parseMontoAjuste('5,50').valor, parseMontoAjuste(' 7.5 ').valor], [5, 5.5, 7.5]);
check('el monto vacío, cero, negativo, con letras o enorme se rechaza', ['', '0', '-3', 'abc', '1,234', '100001'].map((t) => parseMontoAjuste(t).error !== undefined), [true, true, true, true, true, true]);

// --- Una garantía no se aprueba sin decidir ---
const garantia = orden('io2', 'REINEL', { garantiaDe: datosGarantia(original) });
const ordenes = [original, garantia, orden('io3', 'REINEL')];
const items = itemsParaRevisar({ ordenes, rango });
const itemDe = (codigo, docs = []) => revisar(items, Object.fromEntries(docs.map((d) => [d.id, d.datos]))).find((i) => i.orden.codigo === codigo);
const origenDe = (it) => ({ id: it.clave, codigo: it.orden.codigo, tecnico: it.tecnico });
check('una orden marcada como garantía llega sin resolver y no se puede aprobar', [itemDe('IO2').garantiaDe.codigo, itemDe('IO2').garantiaResuelta, motivoNoAprobable(itemDe('IO2')) !== '', armarRevision(itemDe('IO2'), 'APROBAR', { por: 'admin', ahora: 1 }).error !== undefined], ['IO1', false, true, true]);
check('una orden que no es garantía se aprueba como siempre', [motivoNoAprobable(itemDe('IO3')), armarRevision(itemDe('IO3'), 'APROBAR', { por: 'admin', ahora: 1 }).error], ['', undefined]);
check('aprobar de golpe se salta la garantía sin resolver y la avisa', (() => { const r = aprobarPendientes(revisar(items), { por: 'admin', ahora: 1 }); return [r.documentos.map((d) => d.datos.codigo).sort(), r.omitidas.map((o) => o.item.orden.codigo)]; })(), [['IO1', 'IO3'], ['IO2']]);
check('las garantías por resolver se cuentan', garantiasPorResolver(revisar(items)).map((i) => i.orden.codigo), ['IO2']);

// --- Decidir: descontar de la orden original ---
const orig = items.find((i) => i.orden.codigo === 'IO1');
const decide = (garantiaDecision) => armarRevision(itemDe('IO2'), 'PENDIENTE', { por: 'admin', ahora: 10, garantia: garantiaDecision });
check('descontar guarda el monto y la orden original, y todavía no crea ajustes', (() => { const d = decide({ descuento: 6, origen: origenDe(orig), tope: 25 }); return [d.datos.estado, d.datos.descuento, d.datos.descuentoDe, d.ajustes.length, d.borrarAjustes.length]; })(), ['PENDIENTE', 6, { id: orig.clave, codigo: 'IO1', tecnico: 'GERARDO' }, 0, 0]);
check('el monto es obligatorio, positivo y sin pasar de lo que cobra la original', [decide({ descuento: 0, origen: origenDe(orig) }).error, decide({ descuento: '', origen: origenDe(orig) }).error, decide({ descuento: 30, origen: origenDe(orig), tope: 25 }).error], ['Escribe el monto a descontar.', 'Escribe el monto a descontar.', 'El descuento no puede pasar de lo que cobra la orden original (25 $).']);
check('hay que elegir la original, que no sea la misma garantía ni de un técnico sin nombre ni del mismo técnico', [
  decide({ descuento: 5, origen: null }).error,
  decide({ descuento: 5, origen: { id: itemDe('IO2').clave, codigo: 'IO2', tecnico: 'GERARDO' } }).error,
  decide({ descuento: 5, origen: { id: 'z', codigo: 'IOZ', tecnico: SIN_TECNICO } }).error,
  decide({ descuento: 5, origen: { id: 'z', codigo: 'IOZ', tecnico: 'reinel' } }).error,
], ['Elige la orden original de la que se descuenta.', 'La orden original no puede ser la misma garantía.', 'La orden original no tiene técnico: no hay a quién descontarle.', 'La orden original es del mismo técnico que hizo la garantía.']);
check('sin descuento pide el motivo', [decide({ sinDescuento: '  ' }).error, decide({ sinDescuento: 'Garantía de la empresa' }).datos.garantiaSinDescuento], ['Escribe por qué no se descuenta nada.', 'Garantía de la empresa']);

const decidido = decide({ descuento: 6, origen: origenDe(orig), tope: 25 });
const pendiente = itemDe('IO2', [decidido]);
check('con la decisión la garantía queda resuelta y se puede aprobar', [pendiente.estadoRevision, pendiente.garantiaResuelta, pendiente.descuento, motivoNoAprobable(pendiente)], ['PENDIENTE', true, 6, '']);
const aprobada = armarRevision(pendiente, 'APROBAR', { por: 'admin', ahora: 20 });
check('al aprobar se crean el descuento al técnico de la original y el pago al de la garantía', aprobada.ajustes.map((a) => [a.id, a.datos.tipo, a.datos.tecnico, a.datos.monto, a.datos.aplicado, a.datos.de, a.datos.a, a.datos.claveOrigen === orig.clave, a.datos.codigoOrigen, a.datos.codigo, a.datos.notificado]), [
  [idAjuste(pendiente.clave, 'DESCUENTO', pendiente.firma), 'DESCUENTO', 'GERARDO', 6, 0, 'GERARDO', 'REINEL', true, 'IO1', 'IO2', true],
  [idAjuste(pendiente.clave, 'BONO', pendiente.firma), 'BONO', 'REINEL', 6, 0, 'GERARDO', 'REINEL', true, 'IO1', 'IO2', true],
]);
const revisadasAprobada = revisar(items, { [aprobada.id]: aprobada.datos });
check('una garantía aprobada con descuento no se paga como orden: solo el descuento y el pago', [revisadasAprobada.find((i) => i.orden.codigo === 'IO2').estadoRevision, paraFinanzas(revisadasAprobada).map((i) => i.orden.codigo)], ['APROBADA', []]);
const sinDesc = armarRevision(itemDe('IO2'), 'PENDIENTE', { por: 'admin', ahora: 10, garantia: { sinDescuento: 'Garantía de la empresa' } });
const aprobadaSin = armarRevision(itemDe('IO2', [sinDesc]), 'APROBAR', { por: 'admin', ahora: 20 });
check('una garantía sin descuento se aprueba y se paga como orden normal', [aprobadaSin.error, aprobadaSin.ajustes.length, paraFinanzas(revisar(items, { [aprobadaSin.id]: aprobadaSin.datos })).map((i) => i.orden.codigo)], [undefined, 0, ['IO2']]);

// --- Volver atrás borra los ajustes ---
const aprobadaVigente = itemDe('IO2', [aprobada]);
const ids = [idAjuste(pendiente.clave, 'DESCUENTO', pendiente.firma), idAjuste(pendiente.clave, 'BONO', pendiente.firma)];
check('al deshacer una aprobación con descuento se borran sus dos ajustes', borrarAlDeshacer(aprobadaVigente).borrarAjustes, ids);
check('al retener, excluir o cambiar la decisión de una garantía aprobada también se borran', [
  armarRevision(aprobadaVigente, 'RETENER', { por: 'admin', ahora: 40, motivo: 'Dudas' }).borrarAjustes.length,
  armarRevision(aprobadaVigente, 'EXCLUIR', { por: 'admin', ahora: 40, motivo: 'Prueba' }).borrarAjustes.length,
  armarRevision(aprobadaVigente, 'PENDIENTE', { por: 'admin', ahora: 40, garantia: { descuento: 3, origen: origenDe(orig), tope: 25 } }).borrarAjustes.length,
], [2, 2, 2]);
check('deshacer algo que no tenía ajustes no borra nada', borrarAlDeshacer(itemDe('IO3')).borrarAjustes.length, 0);
check('corregir el técnico o el concepto conserva la decisión de la garantía', (() => { const c = armarRevision(pendiente, 'PENDIENTE', { por: 'admin', ahora: 50, correccion: { tecnico: '', concepto: 'AVERIA' } }); return [c.datos.descuento, c.datos.descuentoDe?.codigo]; })(), [6, 'IO1']);
// Si la garantía cambió después de aprobarse, la aprobación ya no vale pero sus ajustes siguen: al volver a revisarla se borran.
const cambiada = revisar(itemsParaRevisar({ ordenes: [original, orden('io2', 'OTRO', { garantiaDe: datosGarantia(original) }), ordenes[2]], rango }), { [aprobada.id]: aprobada.datos }).find((i) => i.orden.codigo === 'IO2');
check('si la garantía cambió, la revisión anterior sigue sirviendo para borrar los ajustes', [cambiada.estadoRevision, cambiada.garantiaResuelta, armarRevision(cambiada, 'EXCLUIR', { por: 'admin', ahora: 50, motivo: 'Prueba' }).borrarAjustes.length], ['PENDIENTE', false, 2]);

// --- Los ajustes en el pago de cada técnico ---
const ajustes = ajustesDeOrden({ ...pendiente, descuentoDe: decidido.datos.descuentoDe }, { por: 'admin', ahora: 20 }).map(({ id, datos }) => ({ id, ...datos }));
check('sin monto, sin original o con el mismo técnico no hay ajustes', [ajustesDeOrden({ ...pendiente, descuento: 0 }, { por: 'admin', ahora: 1 }).length, ajustesDeOrden({ ...pendiente, descuentoDe: null }, { por: 'admin', ahora: 1 }).length, ajustesDeOrden({ ...pendiente, descuentoDe: { id: 'a', codigo: 'A', tecnico: 'REINEL' } }, { por: 'admin', ahora: 1 }).length], [0, 0, 0]);
// GERARDO tiene IO1 por pagar (25) y un descuento de 6 de esa orden; REINEL tiene IO3 (25) y el pago de 6 de la garantía.
const itemsFinanzas = paraFinanzas(revisar(items, { [aprobada.id]: aprobada.datos }), new Set()).concat(revisar(items).filter((i) => ['IO1', 'IO3'].includes(i.orden.codigo)));
const filas = resumenPagos(itemsFinanzas, tarifas, new Set(), [], ajustes);
const gerardo = filas.find((f) => f.tecnico === 'GERARDO');
const reinel = filas.find((f) => f.tecnico === 'REINEL');
check('el dueño de la original: lo suyo menos el descuento (25 − 6 = 19)', [gerardo.total, gerardo.descuentosOrden, gerardo.descuento, gerardo.neto, gerardo.partesAjustes.map((p) => [p.tipo, p.monto])], [25, 6, 6, 19, [['DESCUENTO', 6]]]);
check('el de la garantía: lo suyo más los 6 de la garantía (y no el precio de la orden)', [reinel.total, reinel.bonos, reinel.neto, reinel.pendientes.length, reinel.partesAjustes.map((p) => [p.tipo, p.monto])], [25, 6, 31, 1, [['BONO', 6]]]);

const pagoReinel = armarPago(reinel, rango, tarifas, { por: 'finanzas', ahora: 1000 });
check('el pago del técnico de la garantía suma los 6 y los deja anotados para marcarlos aplicados', [pagoReinel.pago.total, pagoReinel.pago.bonos, pagoReinel.pago.neto, pagoReinel.ajustes], [25, 6, 31, [{ id: idAjuste(pendiente.clave, 'BONO', pendiente.firma), monto: 6, tipo: 'BONO' }]]);
const pagoGerardo = armarPago(gerardo, rango, tarifas, { por: 'finanzas', ahora: 1000 });
check('el pago del dueño de la original resta el descuento', [pagoGerardo.pago.total, pagoGerardo.pago.descuento, pagoGerardo.pago.neto, pagoGerardo.ajustes.map((p) => [p.tipo, p.monto])], [25, 6, 19, [['DESCUENTO', 6]]]);

// Un técnico que solo tiene el pago de una garantía (sin órdenes) se puede pagar.
const soloBono = resumenPagos([], tarifas, new Set(), [], ajustes).find((f) => f.tecnico === 'REINEL');
const pagoSoloBono = armarPago(soloBono, rango, tarifas, { por: 'finanzas', ahora: 1000 });
check('solo con el pago de una garantía hay tarjeta y se puede pagar', [soloBono.pendientes.length, soloBono.total, soloBono.neto, pagoSoloBono.error, pagoSoloBono.pago?.cantidadOrdenes, pagoSoloBono.pago?.neto], [0, 0, 6, undefined, 0, 6]);
check('sin órdenes ni bonos no hay nada que pagar', armarPago({ ...soloBono, bonos: 0, partesAjustes: [] }, rango, tarifas, { por: 'finanzas', ahora: 1 }).error, 'No hay órdenes por pagar.');

// --- Si la original ya se pagó o el descuento no alcanza, queda el saldo y se arrastra ---
const deuda = [{ id: 'd1', tecnico: 'GERARDO', tipo: 'DESCUENTO', monto: 40, aplicado: 0, creadoEn: 5 }];
const alcanza = resumenPagos(itemsFinanzas.filter((i) => i.tecnico === 'GERARDO'), tarifas, new Set(), [], deuda).find((f) => f.tecnico === 'GERARDO');
check('el descuento nunca pasa de lo que tiene por cobrar: se descuentan 25 y quedan 15 de saldo', [alcanza.descuento, alcanza.neto, alcanza.descuentosOrden, alcanza.partesAjustes[0].monto], [25, 0, 40, 25]);
const despues = [{ ...deuda[0], aplicado: 25 }];
check('el saldo se descuenta en el próximo pago', [descuentosConSaldo(despues, 'GERARDO').length, resumenPagos(itemsFinanzas.filter((i) => i.tecnico === 'GERARDO'), tarifas, new Set(), [], despues).find((f) => f.tecnico === 'GERARDO').descuento], [1, 15]);
check('un técnico con solo un descuento pendiente (sin órdenes) tiene tarjeta y nada que pagar', (() => { const f = resumenPagos([], tarifas, new Set(), [], deuda)[0]; return [f.tecnico, f.neto, f.descuento, f.descuentosOrden]; })(), ['GERARDO', 0, 0, 40]);
check('un bono o descuento ya aplicado no cuenta', [bonosConSaldo([{ ...ajustes[1], aplicado: 6 }], 'REINEL').length, descuentosConSaldo([{ ...ajustes[0], aplicado: 6 }], 'GERARDO').length], [0, 0]);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
