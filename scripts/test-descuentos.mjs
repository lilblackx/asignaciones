// Prueba los descuentos con motivo a un técnico (src/utils/descuentos.js y lo que usan de finanzas.js): validación del monto y del motivo, el descuento junto a los adelantos y las garantías,
// lo que queda como saldo, el pago que los lleva, el aviso al técnico y las tablas de los reportes. No necesita el emulador. Uso: `node scripts/test-descuentos.mjs`.
import { MAX_MOTIVO, armarDescuento, parseDescuento, parseMontoDescuento, saldoTrasDescuento, sePuedeAnularDescuento } from '../src/utils/descuentos.js';
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
check('la tabla de los reportes lleva fecha, técnico, monto, motivo, quién y estado', [columnasDescuentos().map((c) => c.titulo), filaDescuento(descuento('d1', 15, { creadoEn: DIA(28) })).slice(1)], [['Fecha y hora', 'Técnico', 'Monto', 'Motivo', 'Registrado por', 'Estado'], ['GERARDO', '15,00 $', 'Equipo perdido', 'fina', 'Por descontar']]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
