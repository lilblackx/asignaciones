// Prueba los pagos adicionales (src/utils/adicionales.js y lo que usan de finanzas.js): los ítems del tabulador (nombre y precio), lo que se le suma a un técnico (ítem por cantidad), cómo entra en lo que
// se le paga junto a las órdenes, los adelantos y los descuentos, el pago que lo lleva y el aviso al técnico. No necesita el emulador. Uso: `node scripts/test-adicionales.mjs`.
import {
  MAX_CANTIDAD_ADICIONAL, MAX_ITEMS_ADICIONALES, MAX_NOMBRE_ADICIONAL, adicionalesConSaldo, armarAdicional, idItemAdicional, itemsAdicionales, parseAdicional, parseCantidadAdicional,
  parseCatalogoAdicionales, parseItemAdicional, parsePrecioAdicional, sePuedeAnularAdicional, textoAdicional,
} from '../src/utils/adicionales.js';
import { armarPago, avisoDeAdicional, avisoDePago, estadoDeFila, ordenesPagables, resumenPagos, tarifasCompletas, tienePorPagar } from '../src/utils/finanzas.js';

let failures = 0;
function check(name, actual, esperado) {
  // Los montos salen con espacio de no separar ("15,00 $"): se comparan con espacio normal.
  const a = JSON.stringify(actual)?.replace(/ /g, ' ');
  const e = JSON.stringify(esperado)?.replace(/ /g, ' ');
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- El precio y el nombre de un ítem ---
check('el precio de un ítem', ['10', '10,5', '7.25', '', '0', '0,00', '-3', 'abc', '1000000', '100000'].map((t) => parsePrecioAdicional(t).valor ?? 'error'), [10, 10.5, 7.25, 'error', 'error', 'error', 'error', 'error', 'error', 100000]);
check('un ítem válido sale limpio', parseItemAdicional({ nombre: '  Domingo   trabajado ', precio: '10' }), { valor: { nombre: 'Domingo trabajado', precio: 10 } });
check('sin nombre no se guarda, y un nombre largo tampoco', [parseItemAdicional({ nombre: '   ', precio: '10' }).campo, parseItemAdicional({ nombre: 'x'.repeat(MAX_NOMBRE_ADICIONAL + 1), precio: '10' }).campo, parseItemAdicional({ nombre: 'x'.repeat(MAX_NOMBRE_ADICIONAL), precio: '10' }).valor?.nombre.length], ['nombre', 'nombre', MAX_NOMBRE_ADICIONAL]);
check('un precio malo se señala en el precio', parseItemAdicional({ nombre: 'Domingo', precio: '0' }).campo, 'precio');
check('el nombre no se repite (sin importar mayúsculas ni espacios)', parseItemAdicional({ nombre: ' domingo TRABAJADO ', precio: '5' }, [{ id: 'a', nombre: 'Domingo trabajado', precio: 10 }]).campo, 'nombre');

// --- La lista completa de ítems ---
const filas = [{ id: 'a', nombre: 'Domingo trabajado', precio: '10' }, { id: 'b', nombre: 'Feriado', precio: '15,5' }];
check('la lista de ítems sale lista para guardar', parseCatalogoAdicionales(filas), { valor: [{ id: 'a', nombre: 'Domingo trabajado', precio: 10 }, { id: 'b', nombre: 'Feriado', precio: 15.5 }] });
check('un error en una fila dice cuál es y qué campo', (({ id, campo }) => ({ id, campo }))(parseCatalogoAdicionales([...filas, { id: 'c', nombre: 'feriado', precio: '3' }])), { id: 'c', campo: 'nombre' });
check('una lista vacía es válida (se pueden quitar todos)', parseCatalogoAdicionales([]), { valor: [] });
check('no pasa del máximo de ítems', Boolean(parseCatalogoAdicionales(Array.from({ length: MAX_ITEMS_ADICIONALES + 1 }, (_, i) => ({ id: `i${i}`, nombre: `Ítem ${i}`, precio: '1' }))).error), true);
check('los ids nuevos son distintos', [idItemAdicional(1, 0.1) !== idItemAdicional(1, 0.2), idItemAdicional(5, 0.5) === idItemAdicional(5, 0.5)], [true, true]);
check('el catálogo guardado se lee ordenado por nombre y sin lo que no sirve', itemsAdicionales({ items: [{ id: 'b', nombre: 'Feriado', precio: 15.5 }, { id: 'a', nombre: 'Domingo', precio: 10 }, { id: '', nombre: 'Sin id', precio: 1 }, { id: 'c', nombre: '  ', precio: 1 }, null] }).map((i) => i.nombre), ['Domingo', 'Feriado']);
check('sin catálogo guardado no hay ítems', [itemsAdicionales(null), itemsAdicionales({}), itemsAdicionales({ items: 'x' })], [[], [], []]);

// --- Sumarle un pago adicional a un técnico ---
const items = itemsAdicionales({ items: [{ id: 'dom', nombre: 'Domingo trabajado', precio: 10 }, { id: 'fer', nombre: 'Feriado', precio: 15.5 }] });
check('la cantidad', ['1', '3', '99', '', '0', '100', '1,5', 'a', '-2'].map((t) => parseCantidadAdicional(t).valor ?? 'error'), [1, 3, 99, 'error', 'error', 'error', 'error', 'error', 'error']);
const bien = parseAdicional({ itemId: 'dom', cantidad: '3', nota: '  Domingos de   octubre ' }, items);
check('un pago adicional válido: el monto es el precio por la cantidad', [bien.valor.item.nombre, bien.valor.cantidad, bien.valor.monto, bien.valor.nota], ['Domingo trabajado', 3, 30, 'Domingos de octubre']);
check('el monto no tiene decimales de más', parseAdicional({ itemId: 'fer', cantidad: '3' }, items).valor.monto, 46.5);
check('sin ítem, con un ítem que ya no existe o con mala cantidad no se guarda', [parseAdicional({ itemId: '', cantidad: '1' }, items).campo, parseAdicional({ itemId: 'borrado', cantidad: '1' }, items).campo, parseAdicional({ itemId: 'dom', cantidad: '0' }, items).campo, parseAdicional({ itemId: 'dom', cantidad: String(MAX_CANTIDAD_ADICIONAL + 1) }, items).campo], ['item', 'item', 'cantidad', 'cantidad']);
check('una nota de más de 300 letras se rechaza', parseAdicional({ itemId: 'dom', cantidad: '1', nota: 'x'.repeat(301) }, items).campo, 'nota');
check('un monto que pasa del tope se rechaza', parseAdicional({ itemId: 'dom', cantidad: '99' }, [{ id: 'dom', nombre: 'Caro', precio: 99999 }]).campo, 'cantidad');
const adicionalGuardado = armarAdicional('GERARDO', bien.valor, { por: 'fina', ahora: 7, notificar: true });
check('un pago adicional armado guarda el nombre y el precio de ese momento, sin aplicar, con quién y cuándo', adicionalGuardado, { tecnico: 'GERARDO', concepto: 'dom', nombre: 'Domingo trabajado', precio: 10, cantidad: 3, monto: 30, aplicado: 0, nota: 'Domingos de octubre', por: 'fina', creadoEn: 7, anulado: false, notificado: true });
check('el aviso al técnico va apagado si no se marca', armarAdicional('GERARDO', bien.valor, { por: 'fina', ahora: 7 }).notificado, false);
check('solo se anula uno que no ha entrado en ningún pago', [sePuedeAnularAdicional({ monto: 5, aplicado: 0, anulado: false }), sePuedeAnularAdicional({ monto: 5, aplicado: 1 }), sePuedeAnularAdicional({ monto: 5, aplicado: 0, anulado: true })], [true, false, false]);
check('el texto de un pago adicional lleva la cantidad solo si es más de una', [textoAdicional({ nombre: 'Domingo trabajado', cantidad: 1 }), textoAdicional({ nombre: 'Domingo trabajado', cantidad: 3 })], ['Domingo trabajado', 'Domingo trabajado × 3']);
check('el aviso al técnico dice el monto, el ítem y la nota', avisoDeAdicional(adicionalGuardado), { title: 'Pago adicional', body: 'Se te suman 30,00 $ por Domingo trabajado × 3 (Domingos de octubre). Entran en tu próximo pago.' });

// --- Junto a las órdenes, los adelantos y los descuentos ---
const DIA = (n) => Date.UTC(2026, 9, n, 16, 0, 0);
const rango = { desde: '2026-10-26', hasta: '2026-10-31' };
const orden = (id, extra) => ({ id, codigo: `IO${id}`, nombre: `Cliente ${id}`, estado: 'FINALIZADO', tecnico: 'GERARDO', createdAt: DIA(26), finalizadoEn: DIA(27), tipoTrabajo: 'INSTALACIÓN', ...extra });
const tarifas = tarifasCompletas({ INSTALACION: 25, AVERIA: 4 });
const ordenes = ordenesPagables([orden('1'), orden('2')], rango); // 50 $
const adicional = (id, monto, extra) => ({ id, tecnico: 'GERARDO', concepto: 'dom', nombre: 'Domingo trabajado', precio: 10, cantidad: monto / 10, monto, aplicado: 0, nota: '', por: 'fina', creadoEn: DIA(27), anulado: false, ...extra });
const adelanto = (id, monto, extra) => ({ id, tecnico: 'GERARDO', monto, aplicado: 0, forma: 'Zelle', referencia: 'ZL', pagadoEn: DIA(26), creadoEn: DIA(26), anulado: false, ...extra });
const hoy = '2026-10-30';
const filaDe = (adicionales, adelantos = [], ordenesDe = ordenes) => resumenPagos(ordenesDe, tarifas, new Set(), adelantos, [], [], hoy, adicionales)[0];

const sin = filaDe([]);
check('sin pagos adicionales nada cambia', [sin.total, sin.adicionales, sin.bonos, sin.neto, sin.partesAdicionales], [50, 0, 0, 50, []]);
const con = filaDe([adicional('p1', 30)]);
check('un pago adicional se suma entero a lo que se le paga', [con.total, con.adicionales, con.bonos, con.bonosGarantia, con.neto], [50, 30, 30, 0, 80]);
check('la fila trae lo que entra (id, monto, nombre y cantidad) para guardarlo en el pago', con.partesAdicionales, [{ id: 'p1', monto: 30, nombre: 'Domingo trabajado', cantidad: 3 }]);
check('un anulado o ya aplicado completo no cuenta; uno aplicado en parte cuenta lo que queda', [filaDe([adicional('p1', 30, { anulado: true })]).adicionales, filaDe([adicional('p1', 30, { aplicado: 30 })]).adicionales, filaDe([adicional('p1', 30, { aplicado: 10 })]).adicionales], [0, 0, 20]);
check('un pago adicional de otro técnico no cuenta', filaDe([adicional('p1', 30, { tecnico: 'OTRO' })]).adicionales, 0);
const conAdelanto = filaDe([adicional('p1', 30)], [adelanto('a1', 20)]);
check('los adelantos se restan del total con el pago adicional incluido', [conAdelanto.descuento, conAdelanto.neto], [20, 60]);
const adelantoGrande = filaDe([adicional('p1', 30)], [adelanto('a1', 100)]);
check('un adelanto se descuenta hasta lo que hay (órdenes más pagos adicionales) y el resto queda como saldo', [adelantoGrande.descuento, adelantoGrande.neto, adelantoGrande.adelantos], [80, 0, 100]);

const soloAdicional = resumenPagos([], tarifas, new Set(), [], [], [], hoy, [adicional('p1', 30)]);
check('un técnico sin órdenes y con un pago adicional tiene su tarjeta, por pagar', [soloAdicional.length, soloAdicional[0].tecnico, soloAdicional[0].neto, tienePorPagar(soloAdicional[0]), estadoDeFila(soloAdicional[0])], [1, 'GERARDO', 30, true, 'POR_PAGAR']);

// --- El pago ---
const rangoPago = { desde: '2026-10-26', hasta: '2026-10-31' };
const armado = armarPago(con, rangoPago, tarifas, { por: 'fina', ahora: 1000, notificar: true });
check('el pago lleva el pago adicional (con nombre y cantidad), cuenta como bono y suma al neto', [armado.pago.bonos, armado.pago.total, armado.pago.neto, armado.pago.adicionales], [30, 50, 80, [{ id: 'p1', monto: 30, nombre: 'Domingo trabajado', cantidad: 3 }]]);
check('y devuelve lo que hay que marcar como aplicado', armado.adicionales, [{ id: 'p1', monto: 30, nombre: 'Domingo trabajado', cantidad: 3 }]);
const armadoSolo = armarPago(soloAdicional[0], rangoPago, tarifas, { por: 'fina', ahora: 1000 });
check('se puede pagar a un técnico que solo tiene un pago adicional (sin órdenes)', [armadoSolo.error, armadoSolo.pago.cantidadOrdenes, armadoSolo.pago.total, armadoSolo.pago.bonos, armadoSolo.pago.neto], [undefined, 0, 0, 30, 30]);
check('un pago sin adicionales no trae el campo', 'adicionales' in armarPago(sin, rangoPago, tarifas, { por: 'fina', ahora: 1000 }).pago, false);
check('el aviso del pago menciona los pagos adicionales', [avisoDePago(armado.pago).body.includes('Incluye: Domingo trabajado × 3.'), avisoDePago(armadoSolo.pago).body.includes('por pagos adicionales')], [true, true]);
check('un pago ya hecho con adicionales deja la lista, y sin ellos el aviso no cambia', avisoDePago({ ...armado.pago, adicionales: undefined }).body.includes('Incluye'), false);
check('las filas que lo piden tienen su lista al pagar', adicionalesConSaldo([adicional('p1', 30), adicional('p2', 10, { creadoEn: DIA(26) }), adicional('p3', 5, { anulado: true })], 'GERARDO').map((a) => a.id), ['p2', 'p1']);

console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);
