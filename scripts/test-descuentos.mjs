// Prueba los descuentos con motivo a un técnico (src/utils/descuentos.js y lo que usan de finanzas.js): validación del monto y del motivo, el descuento junto a los adelantos y las garantías,
// lo que queda como saldo, el pago que los lleva, el aviso al técnico y las tablas de los reportes. No necesita el emulador. Uso: `node scripts/test-descuentos.mjs`.
import { FRECUENCIAS, MAX_CUOTAS, MAX_MOTIVO, aplicaYa, armarDescuento, armarPlanDescuentos, estaProgramado, fechaValida, parseDescuento, parseProgramacion, planDeCuotas, textoCuota, parseMontoDescuento, saldoTrasDescuento, sePuedeAnularDescuento } from '../src/utils/descuentos.js';
import {
  armarPago, avisoDeDescuento, avisoDePago, columnasDescuentos, descuentosDelPeriodo, estadoDeDescuento, estadoDeFila, filaDescuento, ordenesPagables, resumenPagos, tarifasCompletas, totalPendiente,
} from '../src/utils/finanzas.js';

let failures = 0;
function check(name, actual, esperado) {
  // Los montos salen con espacio de no separar ("15,00 $"): se comparan con espacio normal.
  const a = JSON.stringify(actual)?.replace(/ /g, ' ');
  const e = JSON.stringify(esperado)?.replace(/ /g, ' ');
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- Monto y motivo ---
check('el monto del descuento', ['50', '50,5', '50.50', '', '0', '-5', 'abc', '1000000', '100000'].map((t) => parseMontoDescuento(t).valor ?? 'error'), [50, 50.5, 50.5, 'error', 'error', 'error', 'error', 'error', 100000]);
check('un descuento válido sale limpio', parseDescuento({ monto: '15,5', motivo: '  Equipo   perdido ' }), { valor: { monto: 15.5, motivo: 'Equipo perdido' } });
check('sin motivo no se guarda (vacío o solo espacios)', ['', '   ', undefined].map((motivo) => parseDescuento({ monto: '10', motivo }).campo), ['motivo', 'motivo', 'motivo']);
check('un motivo de más de 300 letras se rechaza, uno de 300 se acepta', [parseDescuento({ monto: '10', motivo: 'x'.repeat(MAX_MOTIVO + 1) }).campo, parseDescuento({ monto: '10', motivo: 'x'.repeat(MAX_MOTIVO) }).valor?.motivo.length], ['motivo', MAX_MOTIVO]);
check('un monto malo se señala en el monto aunque el motivo también falte', parseDescuento({ monto: '0', motivo: '' }).campo, 'monto');
check('un descuento armado: aplicado 0, sin anular, con quién y cuándo (la fecha es la de ahora)', armarDescuento('GERARDO', { monto: 15, motivo: 'Equipo perdido' }, { por: 'fina', ahora: 7, notificar: true }), { tecnico: 'GERARDO', monto: 15, aplicado: 0, motivo: 'Equipo perdido', por: 'fina', creadoEn: 7, anulado: false, notificado: true });
check('el aviso al técnico va apagado si no se marca', armarDescuento('GERARDO', { monto: 15, motivo: 'x' }, { por: 'fina', ahora: 7 }).notificado, false);
check('solo se anula un descuento que no se ha descontado', [sePuedeAnularDescuento({ monto: 5, aplicado: 0, anulado: false }), sePuedeAnularDescuento({ monto: 5, aplicado: 1 }), sePuedeAnularDescuento({ monto: 5, aplicado: 0, anulado: true })], [true, false, false]);
check('lo que queda por descontar después de este pago', [saldoTrasDescuento(15, 100), saldoTrasDescuento(15, 10), saldoTrasDescuento(15, 0), saldoTrasDescuento(15, -4), saldoTrasDescuento(15, 15)], [0, 5, 15, 15, 0]);

// --- Junto a las órdenes, los adelantos y las garantías ---
const DIA = (n) => Date.UTC(2026, 9, n, 16, 0, 0);
const rango = { desde: '2026-10-26', hasta: '2026-10-31' };
const orden = (id, extra) => ({ id, codigo: `IO${id}`, nombre: `Cliente ${id}`, estado: 'FINALIZADO', tecnico: 'GERARDO', createdAt: DIA(26), finalizadoEn: DIA(27), tipoTrabajo: 'INSTALACIÓN', ...extra });
const tarifas = tarifasCompletas({ INSTALACION: 25, AVERIA: 4 });
const items = ordenesPagables([orden('1'), orden('2')], rango); // 50 $
const descuento = (id, monto, extra) => ({ id, tecnico: 'GERARDO', monto, aplicado: 0, motivo: 'Equipo perdido', por: 'fina', creadoEn: DIA(27), anulado: false, ...extra });
const adelanto = (id, monto, extra) => ({ id, tecnico: 'GERARDO', monto, aplicado: 0, forma: 'Zelle', referencia: 'ZL', pagadoEn: DIA(26), creadoEn: DIA(26), anulado: false, ...extra });
const ajuste = (id, monto, extra) => ({ id, tecnico: 'GERARDO', tipo: 'DESCUENTO', monto, aplicado: 0, clave: 'g', codigo: 'IG', claveOrigen: 'o', codigoOrigen: 'IO1', de: 'GERARDO', a: 'LUIS', creadoEn: DIA(26), ...extra });

const sin = resumenPagos(items, tarifas, new Set())[0];
check('sin descuentos nada cambia', [sin.total, sin.descuentosLibres, sin.descuento, sin.neto, sin.partesLibres], [50, 0, 0, 50, []]);
const con = resumenPagos(items, tarifas, new Set(), [], [], [descuento('d1', 15)])[0];
check('un descuento se resta de lo pendiente: 50 − 15 = 35', [con.descuentosLibres, con.adelantos, con.descuento, con.neto, totalPendiente([con])], [15, 0, 15, 35, 35]);
check('va aparte de los adelantos en el pago: partesLibres lo trae y partes no', [con.partesLibres, con.partes], [[{ id: 'd1', monto: 15 }], []]);
const mezcla = resumenPagos(items, tarifas, new Set(), [adelanto('a1', 10)], [ajuste('j1', 5)], [descuento('d1', 15)])[0];
check('con un adelanto, un descuento por garantía y un descuento con motivo: cada uno en su clase y todos restan (50 − 30 = 20)', [mezcla.adelantos, mezcla.descuentosOrden, mezcla.descuentosLibres, mezcla.descuento, mezcla.neto], [10, 5, 15, 30, 20]);
check('cada parte va en su lista', [mezcla.partes.map((p) => p.id), mezcla.partesAjustes.map((p) => p.id), mezcla.partesLibres.map((p) => p.id)], [['a1'], ['j1'], ['d1']]);
const grande = resumenPagos(items, tarifas, new Set(), [], [], [descuento('d1', 80)])[0];
check('un descuento mayor que lo pendiente: se descuenta lo que hay, el neto es 0 y el saldo queda para el pago siguiente', [grande.descuentosLibres, grande.descuento, grande.neto, grande.partesLibres], [80, 50, 0, [{ id: 'd1', monto: 50 }]]);
const dos = resumenPagos(items, tarifas, new Set(), [], [], [descuento('nuevo', 40, { creadoEn: DIA(29) }), descuento('viejo', 40, { creadoEn: DIA(27) })])[0];
check('se descuenta del más viejo al más nuevo', dos.partesLibres, [{ id: 'viejo', monto: 40 }, { id: 'nuevo', monto: 10 }]);
const soloDescuento = resumenPagos([], tarifas, new Set(), [], [], [descuento('d1', 30, { tecnico: 'LUIS' })]);
check('un técnico con solo un descuento tiene tarjeta, sin órdenes ni descuento este pago, y se ve "con descuento"', soloDescuento.map((f) => [f.tecnico, f.pendientes.length, f.descuentosLibres, f.descuento, f.neto, estadoDeFila(f)]), [['LUIS', 0, 30, 0, 0, 'CON_ADELANTO']]);
check('un descuento anulado, ya descontado o de otro técnico no cuenta', resumenPagos(items, tarifas, new Set(), [], [], [descuento('a', 20, { anulado: true }), descuento('b', 20, { aplicado: 20 }), descuento('c', 20, { tecnico: 'LUIS' })]).find((f) => f.tecnico === 'GERARDO').descuentosLibres, 0);
check('un descuento parcialmente aplicado descuenta solo lo que le queda', resumenPagos(items, tarifas, new Set(), [], [], [descuento('d1', 30, { aplicado: 12 })])[0].partesLibres, [{ id: 'd1', monto: 18 }]);

// --- El pago que los lleva ---
const armado = armarPago(con, rango, tarifas, { por: 'fina', ahora: DIA(30), notificar: true });
check('el pago trae los descuentos con motivo en descuentosManuales, y el lote los sube en aplicado', [armado.pago.descuentosManuales, armado.pago.adelantos, armado.pago.ajustes, armado.pago.descuento, armado.pago.neto, armado.descuentosLibres], [[{ id: 'd1', monto: 15 }], undefined, undefined, 15, 35, [{ id: 'd1', monto: 15 }]]);
const armadoMezcla = armarPago(mezcla, rango, tarifas, { por: 'fina', ahora: DIA(30) });
check('un pago con los tres tipos los guarda cada uno en su lista', [armadoMezcla.pago.adelantos, armadoMezcla.pago.ajustes.map((a) => a.id), armadoMezcla.pago.descuentosManuales, armadoMezcla.pago.neto], [[{ id: 'a1', monto: 10 }], ['j1'], [{ id: 'd1', monto: 15 }], 20]);
check('un pago sin descuentos no trae la lista', armarPago(sin, rango, tarifas, { por: 'fina', ahora: DIA(30) }).pago.descuentosManuales, undefined);
check('el aviso del pago habla de adelantos y descuentos', avisoDePago(armado.pago).body.includes('de adelantos y descuentos'), true);

// --- El aviso y los reportes ---
check('el aviso al técnico lleva el monto y el motivo', avisoDeDescuento({ monto: 15, motivo: 'Equipo perdido' }), { title: 'Descuento registrado', body: 'Se te registró un descuento de 15,00 $. Motivo: Equipo perdido. Se resta de tu próximo pago.' });
const lista = [descuento('d1', 15, { creadoEn: DIA(28) }), descuento('d2', 5, { creadoEn: DIA(29), tecnico: 'LUIS' }), descuento('d3', 9, { creadoEn: DIA(5) })];
check('los descuentos del periodo, del más reciente al más viejo, y del técnico si se elige', [descuentosDelPeriodo(lista, rango).map((d) => d.id), descuentosDelPeriodo(lista, rango, { tecnico: 'gerardo' }).map((d) => d.id)], [['d2', 'd1'], ['d1']]);
check('el estado de un descuento', [estadoDeDescuento(descuento('a', 10)), estadoDeDescuento(descuento('a', 10, { aplicado: 4 })), estadoDeDescuento(descuento('a', 10, { aplicado: 10 })), estadoDeDescuento(descuento('a', 10, { anulado: true }))], ['Por descontar', 'Descontado en parte (4,00 $)', 'Descontado', 'Anulado']);
check('la tabla de los reportes lleva fecha, técnico, monto, desde cuándo aplica, motivo, quién y estado', [columnasDescuentos().map((c) => c.titulo), filaDescuento(descuento('d1', 15, { creadoEn: DIA(28) })).slice(1)], [['Fecha y hora', 'Técnico', 'Monto', 'Aplica desde', 'Motivo', 'Registrado por', 'Estado'], ['GERARDO', '15,00 $', '', 'Equipo perdido', 'fina', 'Por descontar']]);

// --- Descuentos programados y en cuotas ---
const HOY = '2026-10-29';
check('fechas válidas', ['2026-11-05', '2026-02-30', '2026-13-01', '05/11/2026', '', undefined].map(fechaValida), [true, false, false, false, false, false]);
check('la programación: hoy o después, y de 1 a 12 cuotas', [
  parseProgramacion({ desde: '2026-11-05' }, { hoy: HOY }).valor,
  parseProgramacion({ desde: HOY }, { hoy: HOY }).valor?.desde,
  parseProgramacion({ desde: '2026-10-28' }, { hoy: HOY }).campo,
  parseProgramacion({ desde: '', cuotas: 1 }, { hoy: HOY }).campo,
  parseProgramacion({ desde: '2026-11-05', cuotas: 4, frecuencia: 'QUINCENA' }, { hoy: HOY }).valor,
  parseProgramacion({ desde: '2026-11-05', cuotas: 13 }, { hoy: HOY }).campo,
  parseProgramacion({ desde: '2026-11-05', cuotas: 2.5 }, { hoy: HOY }).campo,
  parseProgramacion({ desde: '2026-11-05', cuotas: 3, frecuencia: 'DIARIO' }, { hoy: HOY }).campo,
], [{ desde: '2026-11-05', cuotas: 1, frecuencia: '' }, HOY, 'desde', 'desde', { desde: '2026-11-05', cuotas: 4, frecuencia: 'QUINCENA' }, 'cuotas', 'cuotas', 'frecuencia']);
check('hay tres frecuencias y el tope son 12 cuotas', [FRECUENCIAS.map((f) => f.id), MAX_CUOTAS], [['SEMANA', 'QUINCENA', 'MES'], 12]);
check('cuotas semanales: las fechas de 7 en 7 y el monto repartido parejo', planDeCuotas(80, { desde: '2026-11-05', cuotas: 4, frecuencia: 'SEMANA' }).map((c) => [c.cuota, c.monto, c.desde]),
  [[1, 20, '2026-11-05'], [2, 20, '2026-11-12'], [3, 20, '2026-11-19'], [4, 20, '2026-11-26']]);
check('cuotas cada 15 días', planDeCuotas(30, { desde: '2026-10-30', cuotas: 3, frecuencia: 'QUINCENA' }).map((c) => c.desde), ['2026-10-30', '2026-11-14', '2026-11-29']);
check('cuotas cada mes caen el mismo día (el 31 de enero sigue en febrero)', planDeCuotas(90, { desde: '2027-01-31', cuotas: 3, frecuencia: 'MES' }).map((c) => c.desde), ['2027-01-31', '2027-02-28', '2027-03-31']);
check('los centavos que sobran van en la última cuota y todo suma el total', (({ lista }) => [lista.map((c) => c.monto), Math.round(lista.reduce((s, c) => s + c.monto, 0) * 100) / 100])({ lista: planDeCuotas(100, { desde: '2026-11-05', cuotas: 3, frecuencia: 'SEMANA' }) }), [[33.33, 33.33, 33.34], 100]);
const plan = armarPlanDescuentos('GERARDO', { monto: 80, motivo: 'Equipo perdido' }, { desde: '2026-11-05', cuotas: 4, frecuencia: 'SEMANA' }, { por: 'fina', ahora: DIA(29), notificar: true, hoy: HOY });
check('el plan guarda un descuento por cuota, con su fecha y el total, y solo la primera avisa', [plan.length, plan.map((d) => d.monto), plan.map((d) => d.desde), plan.map((d) => d.notificado), plan.map(textoCuota), plan[2].totalPlan, plan.every((d) => d.aplicado === 0 && d.anulado === false)],
  [4, [20, 20, 20, 20], ['2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26'], [true, false, false, false], ['cuota 1 de 4', 'cuota 2 de 4', 'cuota 3 de 4', 'cuota 4 de 4'], 80, true]);
const unoProgramado = armarPlanDescuentos('GERARDO', { monto: 25, motivo: 'Multa' }, { desde: '2026-11-05', cuotas: 1, frecuencia: '' }, { por: 'fina', ahora: DIA(29), notificar: true, hoy: HOY });
check('uno solo programado lleva su fecha y ninguna cuota', [unoProgramado.length, unoProgramado[0].desde, 'cuotas' in unoProgramado[0], unoProgramado[0].notificado], [1, '2026-11-05', false, true]);
const ya = armarPlanDescuentos('GERARDO', { monto: 25, motivo: 'Multa' }, { desde: HOY, cuotas: 1, frecuencia: '' }, { por: 'fina', ahora: DIA(29), notificar: false, hoy: HOY });
check('uno solo que empieza hoy es un descuento normal, igual que antes (sin fecha)', [ya.length, 'desde' in ya[0], ya[0]], [1, false, armarDescuento('GERARDO', { monto: 25, motivo: 'Multa' }, { por: 'fina', ahora: DIA(29) })]);
check('cuenta ya si no tiene fecha o la fecha es hoy o antes; programado si es después y no está anulado', [aplicaYa(descuento('a', 5), HOY), aplicaYa({ desde: HOY }, HOY), aplicaYa({ desde: '2026-11-05' }, HOY), estaProgramado({ desde: '2026-11-05' }, HOY), estaProgramado({ desde: '2026-11-05', anulado: true }, HOY), estaProgramado({ desde: HOY }, HOY)], [true, true, false, true, false, false]);

const programado = (id, monto, desde, extra) => ({ ...descuento(id, monto), desde, ...extra });
const antes = resumenPagos(items, tarifas, new Set(), [], [], [descuento('d1', 15), programado('p1', 40, '2026-11-05')], HOY)[0];
check('un descuento programado no se resta ni cuenta como por descontar hasta su fecha', [antes.descuento, antes.descuentosLibres, antes.partesLibres.map((p) => p.id)], [15, 15, ['d1']]);
const despues = resumenPagos(items, tarifas, new Set(), [], [], [descuento('d1', 15), programado('p1', 40, '2026-11-05')], '2026-11-05')[0];
check('llegada su fecha entra al primer pago, junto con los demás', [despues.descuentosLibres, despues.partesLibres.map((p) => p.id).sort()], [55, ['d1', 'p1']]);
const soloProgramado = resumenPagos([], tarifas, new Set(), [], [], [programado('p1', 40, '2026-11-05')], HOY);
check('un técnico que solo tiene descuentos programados tiene tarjeta (para verlos y anularlos), sin nada por pagar ni por descontar todavía', [soloProgramado.length, soloProgramado[0].total, soloProgramado[0].descuentosLibres, soloProgramado[0].descuentosProgramados, estadoDeFila(soloProgramado[0])], [1, 0, 0, 40, 'PROGRAMADO']);
check('lo programado suma aparte (sin los anulados) y al llegar la fecha pasa a lo que se descuenta', [
  resumenPagos(items, tarifas, new Set(), [], [], [programado('p1', 40, '2026-11-05'), programado('p2', 20, '2026-11-12'), programado('p3', 9, '2026-11-12', { anulado: true })], HOY)[0].descuentosProgramados,
  resumenPagos(items, tarifas, new Set(), [], [], [programado('p1', 40, '2026-11-05'), programado('p2', 20, '2026-11-12')], '2026-11-05')[0].descuentosProgramados,
  resumenPagos([], tarifas, new Set(), [], [], [programado('p1', 40, '2026-11-05')], '2026-11-05').map(estadoDeFila),
], [60, 20, ['CON_ADELANTO']]);
check('con órdenes por pagar la tarjeta sigue "Por pagar" aunque tenga descuentos programados', estadoDeFila(resumenPagos(items, tarifas, new Set(), [], [], [programado('p1', 40, '2026-11-05')], HOY)[0]), 'POR_PAGAR');
check('el aviso de uno programado dice desde cuándo; de un plan, el total y las cuotas; de uno normal, igual que antes', [
  avisoDeDescuento({ monto: 25, motivo: 'Multa', desde: '2026-11-05', creadoEn: DIA(29) }).title,
  avisoDeDescuento({ monto: 25, motivo: 'Multa', desde: '2026-11-05', creadoEn: DIA(29) }).body,
  avisoDeDescuento({ monto: 20, motivo: 'Equipo perdido', desde: '2026-11-05', cuota: 1, cuotas: 4, totalPlan: 80, creadoEn: DIA(29) }).body,
  avisoDeDescuento({ monto: 15, motivo: 'Equipo perdido', creadoEn: DIA(29) }).title,
], ['Descuento programado', 'Se te programó un descuento de 25,00 $, desde el 05/11/2026. Motivo: Multa. Se resta del primer pago que se te haga desde esa fecha.', 'Se te programó un descuento de 80,00 $ en 4 cuotas, desde el 05/11/2026. Motivo: Equipo perdido. Cada cuota se resta del primer pago que se te haga desde su fecha.', 'Descuento registrado']);
check('en los reportes: el estado dice "Programado" y la fila trae desde cuándo y la cuota', [estadoDeDescuento(programado('p1', 40, '2026-11-05'), HOY), estadoDeDescuento(programado('p1', 40, '2026-11-05'), '2026-11-05'), filaDescuento(programado('p2', 20, '2026-11-12', { cuota: 2, cuotas: 4, totalPlan: 80 })).slice(3, 5)],
  ['Programado (desde el 05/11/2026)', 'Por descontar', ['12/11/2026', 'Equipo perdido (cuota 2 de 4)']]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
