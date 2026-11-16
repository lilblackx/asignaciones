// Prueba la anulación del pago de una sola orden (src/utils/finanzas.js): el motivo, lo que se anota en el pago, el aviso al técnico y cómo se descuenta lo anulado en los totales. No necesita el emulador.
// Uso: `npm run test:anularordenpago`.
import { armarAnulacionDeOrden, avisoDeAnulacionDeOrden, ordenAnuladaEnPago, parseMotivoAnulacion, resumenPagado, totalAnuladoDelPago } from '../src/utils/finanzas.js';
import { detalleDePagos, pagosIncompletos } from '../src/utils/detallePagos.js';

let failures = 0;
function check(name, actual, esperado) {
  const ok = JSON.stringify(actual) === JSON.stringify(esperado);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log('      esperado:', JSON.stringify(esperado), '\n      recibido:', JSON.stringify(actual));
}

const pago = { id: '1000-JOSE', tecnico: 'JOSE', desde: '2026-11-01', hasta: '2026-11-15', cantidades: { AVERIA: 2, INSTALACION: 1 }, total: 28, neto: 28, cantidadOrdenes: 3, tasa: 100, creadoEn: Date.parse('2026-11-10T12:00:00-04:00'), anulado: false };
const orden = { id: 'o1', pagoId: '1000-JOSE', concepto: 'AVERIA', monto: 4, codigo: 'AN181' };
const ahora = 5000;

check('el motivo es obligatorio', parseMotivoAnulacion('   ').error, 'Escribe el motivo: el técnico lo verá.');
check('el motivo se limpia (espacios y barras)', parseMotivoAnulacion('  Se  canceló |  la orden ').valor, 'Se canceló / la orden');
check('un motivo de más de 300 letras no pasa', Boolean(parseMotivoAnulacion('x'.repeat(301)).error), true);

const r = armarAnulacionDeOrden(pago, orden, 'Se canceló', { por: 'fina', ahora });
check('lo que se anota en el pago: la última orden y el detalle con quién y cuándo', r.cambios, { ultimaOrdenAnulada: 'o1', anulacionesOrden: [{ id: 'o1', codigo: 'AN181', concepto: 'AVERIA', monto: 4, motivo: 'Se canceló', por: 'fina', en: 5000 }] });
check('no toca los totales del pago', Object.keys(r.cambios), ['ultimaOrdenAnulada', 'anulacionesOrden']);
check('un pago ya anulado no admite anulaciones', armarAnulacionDeOrden({ ...pago, anulado: true }, orden, 'x', { por: 'f', ahora }).error, 'Este pago ya está anulado.');
check('una orden de otro pago no se anula aquí', armarAnulacionDeOrden(pago, { ...orden, pagoId: 'otro' }, 'x', { por: 'f', ahora }).error, 'Esta orden no pertenece a este pago.');
const conUna = { ...pago, ...r.cambios };
check('la misma orden no se anula dos veces', armarAnulacionDeOrden(conUna, orden, 'x', { por: 'f', ahora }).error, 'El pago de esta orden ya está anulado.');
check('sin motivo no se anula', armarAnulacionDeOrden(pago, orden, '', { por: 'f', ahora }).campo, 'motivo');
const dos = { ...conUna, ...armarAnulacionDeOrden(conUna, { ...orden, id: 'o2', codigo: 'AN196', concepto: 'INSTALACION', monto: 20 }, 'Otro motivo', { por: 'fina', ahora: 6000 }).cambios };
check('una segunda orden se suma a la lista sin perder la primera', [dos.anulacionesOrden.map((a) => a.id), ordenAnuladaEnPago(dos, 'o1'), ordenAnuladaEnPago(dos, 'o9')], [['o1', 'o2'], true, false]);
check('cuánto se anuló del pago', [totalAnuladoDelPago(pago), totalAnuladoDelPago(dos)], [{ ordenes: 0, total: 0 }, { ordenes: 2, total: 24 }]);

const aviso = avisoDeAnulacionDeOrden(r.anulacion);
check('el aviso al técnico trae la orden, el monto y el motivo', { ...aviso, body: aviso.body.replace(/ /g, ' ') }, { title: 'Pago de una orden anulado', body: 'AN181: se anuló el pago de esta orden (4,00 $). Motivo: Se canceló. La orden vuelve a estar por pagar.' });

// Los totales de lo pagado descuentan lo anulado
const sin = resumenPagado([pago], { desde: '2026-11-01', hasta: '2026-11-30' }, { tasa: 100 });
const con = resumenPagado([conUna], { desde: '2026-11-01', hasta: '2026-11-30' }, { tasa: 100 });
check('lo pagado sin anulaciones', [sin.total, sin.ordenes, sin.bs], [28, 3, 2800]);
check('el neto del técnico también descuenta lo anulado', [sin.porTecnico[0].neto, con.porTecnico[0].neto], [28, 24]);
check('lo pagado descuenta la orden anulada (total, órdenes y bolívares)', [con.total, con.ordenes, con.bs, con.porTecnico[0].cantidades.AVERIA], [24, 2, 2400, 1]);

// Al leer las órdenes de un pago no se esperan las anuladas
const leidas = [{ id: 'o2', pagoId: '1000-JOSE' }, { id: 'o3', pagoId: '1000-JOSE' }];
check('un pago con una orden anulada y las demás leídas está completo', pagosIncompletos([conUna], leidas), []);
check('sin la anulación, le faltaría una', pagosIncompletos([pago], leidas), ['1000-JOSE']);

// Pagos detallados (el documento que se comparte con el técnico): descuenta lo anulado y lo anota
const ordenesLeidas = [{ id: 'o2', pagoId: '1000-JOSE', codigo: 'AN196', dia: '2026-11-05', concepto: 'INSTALACION', monto: 20 }, { id: 'o3', pagoId: '1000-JOSE', codigo: 'AN197', dia: '2026-11-06', concepto: 'AVERIA', monto: 4 }];
const [sinAnular] = detalleDePagos({ pagos: [pago], ordenesPagadas: [{ ...ordenesLeidas[0] }, { ...ordenesLeidas[1] }, { id: 'o1', pagoId: '1000-JOSE', codigo: 'AN181', dia: '2026-11-04', concepto: 'AVERIA', monto: 4 }] });
const [detalle] = detalleDePagos({ pagos: [conUna], ordenesPagadas: ordenesLeidas });
check('sin anulaciones el detalle sigue igual', [sinAnular.neto, sinAnular.ordenes.length, sinAnular.faltan], [28, 3, 0]);
check('con una orden anulada: el neto, la cantidad y los bolívares la descuentan y no avisa que falten órdenes', [detalle.neto, detalle.ordenes.length, detalle.faltan, detalle.bs, detalle.titulo.includes('2 órdenes')], [24, 2, 0, 2400, true]);
check('la nota del pago dice qué orden se anuló y por qué', detalle.nota.replace(/\u00a0/g, ' '), 'Pago anulado de la orden AN181 (4,00 $): Se canceló');

if (failures) { console.log(`\n${failures} pruebas fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
