// Prueba el pago que el cliente hace por el cobro de una orden (src/utils/pagoCliente.js): la validación de lo que registra el técnico, la clave de la
// referencia, el cobro esperado, los estados y lo que hace Administración al conciliar. No necesita el emulador. Uso: `npm run test:pagocliente`.
import {
  ESTADO_PAGO, armarConciliacion, armarCorreccion, armarDevolucion, armarPagoPendiente, armarPagoRegistrado, armarSinCobrar, aplicaBancoCliente, avisoDePagoCliente, cantidadPorCobrar,
  claveReferencia, cobroEsperadoDe, cuentasParaForma, debePedirPagoCobro, diasEsperando, etiquetaCuenta, formasDeCliente, notaPagoCompartido, numeroDeCobro,
  cifrasPagosClientes, columnasPagosClientes, esPagoDeFinanzas, etiquetaEstadoPago, filaPagoCliente, filtrarPagosClientes, pagosClientesDelPeriodo, parsePagoCliente, resumenPagos, resumenPorForma, textoPago, tipoPagoFinanzas,
} from '../src/utils/pagoCliente.js';
import { documentoPagosClientes } from '../src/utils/modelosReporte.js';
import { ADMINISTRACION_ACTIVA } from '../src/constants.js';
import { normalizarFormasPago } from '../src/utils/formasPago.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const AHORA = Date.parse('2026-10-28T15:00:00-04:00');
const base = { moneda: 'BS', forma: 'Pago móvil', monto: '5696', banco: 'Banesco', cuentaEmpresa: '', referencia: '123456', fecha: '2026-10-28', hora: '14:30', nota: '' };
const parse = (extra = {}, opciones = {}) => parsePagoCliente({ ...base, ...extra }, { ahora: AHORA, ...opciones });

// --- Formas de pago del cliente ---
check('en bolívares: pago móvil, transferencia y efectivo', formasDeCliente('BS'), ['Pago móvil', 'Transferencia', 'Efectivo']);
check('en dólares: Zelle, Binance, efectivo y otro', formasDeCliente('USD'), ['Zelle', 'Binance', 'Efectivo', 'Otro']);
check('el banco no aplica en efectivo ni en Binance', ['Efectivo', 'Binance', 'Zelle', 'Pago móvil'].map(aplicaBancoCliente), [false, false, true, true]);

// --- Validación de lo que escribe el técnico ---
const bien = parse();
check('un pago completo se acepta', [bien.valor?.pago.forma, bien.valor?.pago.monto, bien.valor?.pago.banco, bien.valor?.pago.referencia], ['Pago móvil', 5696, 'Banesco', '123456']);
check('la fecha y hora son de Caracas', bien.valor.pago.pagadoEn, Date.parse('2026-10-28T14:30:00-04:00'));
check('moneda inválida', parse({ moneda: 'EUR' }).campo, 'moneda');
check('una forma de dólares no vale con bolívares', parse({ forma: 'Zelle' }).campo, 'forma');
check('Binance no vale con bolívares y Pago móvil no vale con dólares', [parse({ forma: 'Binance' }).campo, parse({ moneda: 'USD', forma: 'Pago móvil' }).campo], ['forma', 'forma']);
check('sin monto', parse({ monto: '' }).error, 'Escribe el monto pagado.');
check('monto con punto de miles se rechaza (no se confunde 5.696 con 5,696)', parse({ monto: '5.696' }).campo, 'monto');
check('monto cero', parse({ monto: '0' }).campo, 'monto');
check('monto con coma y dos decimales', parse({ monto: '5696,50' }).valor.pago.monto, 5696.5);
check('pago móvil y transferencia exigen banco', [parse({ banco: '' }).campo, parse({ forma: 'Transferencia', banco: '' }).campo], ['banco', 'banco']);
check('Zelle no exige banco', parse({ moneda: 'USD', forma: 'Zelle', banco: '', titular: 'Juan Pérez', monto: '30' }).valor?.pago.banco, '');
check('Zelle exige el titular de la cuenta', [parse({ moneda: 'USD', forma: 'Zelle', banco: '', monto: '30' }).campo, parse({ moneda: 'USD', forma: 'Zelle', titular: '  Juan   Pérez ', monto: '30' }).valor?.pago.titular, parse({ moneda: 'USD', forma: 'Efectivo', titular: 'X', monto: '30' }).valor?.pago.titular], ['titular', 'Juan Pérez', ''])
check('en efectivo no hay banco ni referencia, aunque se hayan escrito antes de cambiar la forma', (() => { const p = parse({ forma: 'Efectivo', banco: 'Banesco', referencia: '999' }).valor.pago; return [p.banco, p.referencia, p.cuentaEmpresa]; })(), ['', '', '']);
check('la referencia es obligatoria salvo en efectivo', [parse({ referencia: '' }).campo, parse({ forma: 'Efectivo', referencia: '' }).valor !== undefined], ['referencia', true]);
check('Binance no lleva banco pero sí referencia', (() => { const r = parse({ moneda: 'USD', forma: 'Binance', banco: 'Banesco', monto: '30' }); return [r.valor.pago.banco, r.valor.pago.referencia]; })(), ['', '123456']);
check('referencia o banco demasiado largos', [parse({ referencia: 'x'.repeat(41) }).campo, parse({ banco: 'x'.repeat(41) }).campo], ['referencia', 'banco']);
check('fecha inválida o futura', [parse({ fecha: '2026-13-40' }).campo, parse({ hora: '99:99' }).campo, parse({ fecha: '2026-10-29' }).campo], ['fecha', 'fecha', 'fecha']);
check('una hora de adelanto por el reloj se tolera, más no', [parse({ hora: '15:03' }).valor !== undefined, parse({ hora: '15:30' }).campo], [true, 'fecha']);
check('nota demasiado larga', parse({ nota: 'x'.repeat(301) }).campo, 'nota');

// --- Cuenta de la empresa donde llegó el pago ---
const formasEmpresa = normalizarFormasPago({ formas: [
  { tipo: 'PAGO_MOVIL', banco: 'Banco Nacional de Crédito (BNC)', telefono: '0412-1009927', rif: 'J-295330804' },
  { tipo: 'CUENTA', banco: 'Banesco', numero: '0134-0086-54-0861268484', titular: 'Network Speed, C.A', rif: 'J-295330804' },
  { tipo: 'CUENTA', banco: 'Banco Mercantil', numero: '0105-0067-21-1067577920', titular: 'Network Speed, C.A', rif: 'J-295330804' },
  { tipo: 'ZELLE', correo: 'pagos@networkspeed.com', titular: 'Network Speed' },
] });
check('el texto de cada cuenta lleva el tipo, el banco y un dato', formasEmpresa.map(etiquetaCuenta), [
  'Pago Móvil · Banco Nacional de Crédito (BNC) · 0412-1009927', 'Transferencia bancaria · Banesco · …8484', 'Transferencia bancaria · Banco Mercantil · …7920', 'Zelle · pagos@networkspeed.com']);
check('cada forma ofrece sus cuentas, el efectivo ninguna y Otro todas', [cuentasParaForma(formasEmpresa, 'Pago móvil').length, cuentasParaForma(formasEmpresa, 'Transferencia').length, cuentasParaForma(formasEmpresa, 'Zelle').length, cuentasParaForma(formasEmpresa, 'Binance').length, cuentasParaForma(formasEmpresa, 'Efectivo').length, cuentasParaForma(formasEmpresa, 'Otro').length], [1, 2, 1, 0, 0, 4]);
const cuentasPm = cuentasParaForma(formasEmpresa, 'Pago móvil');
check('con cuentas cargadas, la cuenta es obligatoria y debe ser una de la lista', [parse({}, { cuentas: cuentasPm }).campo, parse({ cuentaEmpresa: 'otra' }, { cuentas: cuentasPm }).campo, parse({ cuentaEmpresa: cuentasPm[0] }, { cuentas: cuentasPm }).valor?.pago.cuentaEmpresa], ['cuentaEmpresa', 'cuentaEmpresa', cuentasPm[0]]);
check('sin cuentas cargadas para esa forma no se pide', parse({}, { cuentas: [] }).valor !== undefined, true);
check('en efectivo no se pide cuenta', parse({ forma: 'Efectivo' }, { cuentas: cuentasPm }).valor !== undefined, true);

// --- La clave de la referencia (no se repite en otra orden) ---
check('misma forma, banco y número: misma clave, sin importar mayúsculas, tildes, espacios ni guiones', [
  claveReferencia('Pago móvil', 'Banesco', '123-456'), claveReferencia('PAGO MOVIL', 'banesco ', ' 123456'),
], ['pagomovil_banesco_123456', 'pagomovil_banesco_123456']);
check('otro banco con el mismo número no es una referencia repetida', claveReferencia('Pago móvil', 'Banesco', '123456') !== claveReferencia('Pago móvil', 'Mercantil', '123456'), true);
check('otra forma con el mismo número tampoco', claveReferencia('Pago móvil', 'Banesco', '123456') !== claveReferencia('Transferencia', 'Banesco', '123456'), true);
check('sin referencia (efectivo) no hay clave', [claveReferencia('Efectivo', '', ''), claveReferencia('Efectivo', '', '   ')], ['', '']);
check('la clave solo lleva letras, números y guion bajo (sirve de id de documento)', /^[a-z0-9_]+$/.test(claveReferencia('Banco de Venezuela', 'Bañesco/Ñ', 'AB/12 34')), true);
check('una clave muy larga se recorta a 200', claveReferencia('a', 'b', 'c'.repeat(300)).length, 200);

// --- El cobro esperado ---
check('"5.696" "5.696,50" "30" -> número', [numeroDeCobro('5.696'), numeroDeCobro('5.696,50'), numeroDeCobro('30'), numeroDeCobro('x')], [5696, 5696.5, 30, null]);
const visita = { tipoTrabajo: 'AVERÍA', estado: 'FINALIZADO', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', finalizadoEn: Date.parse('2026-10-28T10:00:00-04:00') };
check('el cobro esperado: monto y moneda', [cobroEsperadoDe(visita), cobroEsperadoDe({ ...visita, cobroBs: '30', cobroMoneda: 'USD' })], [{ monto: 5696, moneda: 'BS' }, { monto: 30, moneda: 'USD' }]);
check('exoneradas, instalaciones y sin cobro no tienen cobro esperado', [cobroEsperadoDe({ ...visita, cobroTipo: 'EXONERADO' }), cobroEsperadoDe({ ...visita, tipoTrabajo: 'INSTALACIÓN' }), cobroEsperadoDe({ ...visita, cobroBs: null })], [null, null, null]);
const cobro = { monto: 5696, moneda: 'BS' };
check('el monto igual al cobro no marca nada', (() => { const v = parse({}, { cobro }).valor; return [v.diferencia, v.monedaDistinta]; })(), [false, false]);
check('un monto distinto pide nota', [parse({ monto: '5000' }, { cobro }).campo, parse({ monto: '5000', nota: 'Pagó menos' }, { cobro }).valor.diferencia], ['nota', true]);
check('otra moneda se guarda tal cual, sin pedir nota, marcada como moneda distinta', (() => { const v = parse({ moneda: 'USD', forma: 'Zelle', banco: '', titular: 'Juan Pérez', monto: '10' }, { cobro }).valor; return [v.monedaDistinta, v.diferencia, v.pago.moneda, v.pago.monto]; })(), [true, false, 'USD', 10]);
check('sin cobro esperado (instalación) no hay diferencia ni moneda distinta', (() => { const v = parse({}).valor; return [v.diferencia, v.monedaDistinta]; })(), [false, false]);

// --- Los documentos ---
const orden = { id: 'T1', codigo: 'AO7', nombre: 'Ana', cedula: '12345678', telefono: '0414-1234567 / 0424-7654321', tecnico: 'JOSE', tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: 'CONECTOR_EXTERNO', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', estado: 'FINALIZADO' };
const registrado = armarPagoRegistrado(orden, parse({}, { cobro: cobroEsperadoDe(orden) }).valor, { por: 'jose', ahora: AHORA });
check('el técnico registra: queda por conciliar con los datos de la orden copiados', [registrado.estado, registrado.ticketId, registrado.codigo, registrado.tecnico, registrado.cobro, registrado.referenciaClave, registrado.historial.length], [ESTADO_PAGO.POR_CONCILIAR, 'T1', 'AO7', 'JOSE', { monto: 5696, moneda: 'BS' }, 'pagomovil_banesco_123456', 1]);
check('el teléfono del cliente se copia de la orden (para que Administración lo contacte), también en los pendientes', [registrado.telefono, armarPagoPendiente(orden, { nota: 'x' }, { por: 'jose', ahora: AHORA }).telefono, armarPagoRegistrado({ ...orden, telefono: undefined }, parse({}).valor, { por: 'jose', ahora: AHORA }).telefono], ['0414-1234567 / 0424-7654321', '0414-1234567 / 0424-7654321', '']);
const pendiente = armarPagoPendiente(orden, { nota: 'Paga el viernes' }, { por: 'jose', ahora: AHORA });
check('"paga después": queda pendiente de cobro, con su nota y sin datos de pago ni clave', [pendiente.estado, pendiente.pago, pendiente.referenciaClave, pendiente.nota, pendiente.compartidoCon], [ESTADO_PAGO.PENDIENTE, null, '', 'Paga el viernes', null]);
const compartido = armarPagoPendiente(orden, { nota: notaPagoCompartido({ codigo: 'AO3' }, '123456'), compartidoCon: { id: 'T0', codigo: 'AO3' } }, { por: 'jose', ahora: AHORA });
check('"pagó junto con otra orden": pendiente con la otra orden y la nota automática', [compartido.estado, compartido.compartidoCon, compartido.nota], [ESTADO_PAGO.PENDIENTE, { id: 'T0', codigo: 'AO3' }, 'Pagó junto con AO3 (misma referencia 123456).']);

// --- Administración concilia ---
const conciliarRegistrado = armarConciliacion(registrado, {}, { por: 'admon', ahora: AHORA + 1000 });
check('conciliar un pago registrado lo deja conciliado, con quién y cuándo, sin tocar los datos', [conciliarRegistrado.cambios.estado, conciliarRegistrado.cambios.conciliadoPor, conciliarRegistrado.cambios.conciliadoEn, conciliarRegistrado.cambios.pago.referencia, conciliarRegistrado.cambios.historial.length], [ESTADO_PAGO.CONCILIADO, 'admon', AHORA + 1000, '123456', 2]);
check('un pendiente exige los datos del pago para conciliarse', armarConciliacion(pendiente, {}, { por: 'admon', ahora: AHORA }).campo, 'forma');
const cobrado = armarConciliacion(pendiente, { valor: parse({ referencia: '777' }, { cobro: cobroEsperadoDe(orden) }).valor }, { por: 'admon', ahora: AHORA + 5000 });
check('un pendiente se cobra y concilia con los datos del pago', [cobrado.cambios.estado, cobrado.cambios.pago.referencia, cobrado.cambios.referenciaClave, cobrado.cambios.historial[1].detalle.startsWith('Cobrado y conciliado')], [ESTADO_PAGO.CONCILIADO, '777', 'pagomovil_banesco_777', true]);
check('repetir una referencia exige una nota', [armarConciliacion(registrado, { repiteReferencia: true }, { por: 'a', ahora: AHORA }).campo, armarConciliacion(registrado, { repiteReferencia: true, nota: 'Un solo pago para dos órdenes' }, { por: 'a', ahora: AHORA }).cambios?.notaAdministracion], ['nota', 'Un solo pago para dos órdenes']);
const sinCobrar = armarSinCobrar(pendiente, { nota: 'El cliente se mudó' }, { por: 'admon', ahora: AHORA });
check('"sin cobrar" exige nota, deja el estado y libera la referencia', [armarSinCobrar(pendiente, {}, { por: 'a', ahora: AHORA }).campo, sinCobrar.cambios.estado, sinCobrar.cambios.referenciaClave], ['nota', ESTADO_PAGO.SIN_COBRAR, '']);
const corr = armarCorreccion(registrado, { valor: parse({ referencia: '654321' }).valor, nota: 'Estaba mal tecleada' }, { por: 'admon', ahora: AHORA + 9000 });
check('corregir cambia los datos y la clave, deja el estado y escribe quién y cuándo', [corr.cambios.pago.referencia, corr.cambios.referenciaClave, 'estado' in corr.cambios, corr.cambios.historial.at(-1).por], ['654321', 'pagomovil_banesco_654321', false, 'admon']);
check('corregir exige nota y un pago con datos', [armarCorreccion(registrado, { valor: parse().valor }, { por: 'a', ahora: AHORA }).campo, armarCorreccion(pendiente, { valor: parse().valor, nota: 'x' }, { por: 'a', ahora: AHORA }).campo], ['nota', 'forma']);

const conciliadoDoc = { ...registrado, ...armarConciliacion(registrado, {}, { por: 'admon', ahora: AHORA + 1000 }).cambios };
const devuelto = armarDevolucion(conciliadoDoc, { nota: 'Falta verificar la referencia' }, { por: 'admon', ahora: AHORA + 2000 });
check('devolver exige nota y un pago conciliado', [armarDevolucion(conciliadoDoc, {}, { por: 'a', ahora: AHORA }).campo, armarDevolucion(registrado, { nota: 'x' }, { por: 'a', ahora: AHORA }).campo], ['nota', 'nota']);
check('devolver deja el pago y su referencia, vuelve a por conciliar y anota quién', [devuelto.cambios.estado, 'pago' in devuelto.cambios, 'referenciaClave' in devuelto.cambios, devuelto.cambios.historial.at(-1).por, devuelto.cambios.historial.length], [ESTADO_PAGO.POR_CONCILIAR, false, false, 'admon', conciliadoDoc.historial.length + 1]);

// --- Finanzas: pagos de instalaciones y de cambios de equipo ---
const instalacionOrden = { ...orden, id: 'I1', codigo: 'IO7', tipoTrabajo: 'INSTALACIÓN', tipoVisita: '', cobroBs: '', cobroTipo: '' };
const cambioOrden = { ...orden, id: 'C1', codigo: 'AC9', nombre: 'Luis', tipoTrabajo: 'AVERÍA', tipoVisita: 'CAMBIO_EQUIPO' };
const zelle = (o, extra) => armarPagoRegistrado(o, parse({ moneda: 'USD', forma: 'Zelle', banco: 'Chase', titular: 'Juan Pérez', monto: '45', referencia: 'Z-1', ...extra }).valor, { por: 'jose', ahora: AHORA, cobro: null });
const pagosFin = [
  { ...zelle(instalacionOrden), id: 'I1' },
  { ...zelle(cambioOrden, { referencia: 'Z-2', monto: '30' }), id: 'C1', creadoEn: AHORA + 1000 },
  { ...registrado, id: 'T1' },
  { ...armarPagoPendiente({ ...cambioOrden, id: 'C2', codigo: 'AC10' }, { nota: 'Paga el lunes' }, { por: 'jose', ahora: AHORA }), id: 'C2' },
];
check('Finanzas ve instalaciones y cambios de equipo (por tipo de trabajo o de visita), no otras órdenes', pagosFin.map(esPagoDeFinanzas), [true, true, false, true]);
check('el tipo que se muestra', [tipoPagoFinanzas(pagosFin[0]), tipoPagoFinanzas(pagosFin[1])], ['Instalación', 'Cambio de equipo']);
const rangoFin = { desde: '2026-10-28', hasta: '2026-10-28' };
check('del período y del técnico, los más nuevos primero, sin las órdenes que no ve Finanzas', pagosClientesDelPeriodo(pagosFin, rangoFin).map((p) => p.id), ['C1', 'I1', 'C2']);
check('fuera del rango no sale y el técnico filtra', [pagosClientesDelPeriodo(pagosFin, { desde: '2026-10-29', hasta: '2026-10-30' }).length, pagosClientesDelPeriodo(pagosFin, rangoFin, { tecnico: 'otro' }).length], [0, 0]);
check('filtrar por tipo, forma y moneda', [filtrarPagosClientes(pagosFin, { tipo: 'Instalación' }).map((p) => p.id), filtrarPagosClientes(pagosFin, { forma: 'Zelle', moneda: 'USD' }).length, filtrarPagosClientes(pagosFin, { moneda: 'BS' }).map((p) => p.id)], [['I1'], 2, ['T1', 'C2']]);
check('el resumen por forma suma lo pagado en cada moneda', resumenPorForma(pagosFin), [{ forma: 'Zelle', cantidad: 2, BS: 0, USD: 75 }, { forma: 'Pago móvil', cantidad: 1, BS: 5696, USD: 0 }]);
check('las cifras: pagos registrados, lo recibido y lo que falta pagar', cifrasPagosClientes(pagosClientesDelPeriodo(pagosFin, rangoFin)).map((c) => [c.etiqueta, c.valor]), [['Pagos registrados', '2'], ['Recibido en dólares', '75 $'], ['Recibido en bolívares', '0 Bs'], ['Sin pagar todavía', '1']]);
check('"por conciliar" se llama "Registrado" solo con Administración apagada', [etiquetaEstadoPago('POR_CONCILIAR'), etiquetaEstadoPago('PENDIENTE_COBRO'), etiquetaEstadoPago('CONCILIADO')], [ADMINISTRACION_ACTIVA ? 'Por conciliar' : 'Registrado', 'Pendiente de cobro', 'Conciliado']);
check('la fila del reporte lleva el titular, la referencia y el estado', (({ length }) => length)(columnasPagosClientes()) === filaPagoCliente(pagosFin[0]).length, true);
check('fila de un pago Zelle (sin columna de estado: Finanzas solo ve "Registrado")', filaPagoCliente(pagosFin[0]).slice(1, 11), ['IO7', 'Ana', 'JOSE', 'Instalación', 'Zelle', 'Chase', 'Juan Pérez', 'Z-1', '', '45 $']);
const docFin = documentoPagosClientes({ rango: rangoFin, tecnico: '', pagosClientes: pagosFin, generadoPor: 'finanzas', ahora: AHORA });
check('el documento para exportar: título, cifras, por forma y el detalle de cada pago', [docFin.titulo, docFin.bloques.map((b) => b.tipo), docFin.bloques[2].filas.length, docFin.bloques[1].filas.map((f) => f[0])], ['Pagos de clientes', ['cifras', 'tabla', 'tabla', 'texto'], 3, ['Zelle']]);

// --- Textos y avisos ---
check('el texto de un pago', [textoPago(registrado.pago), textoPago(parse({ moneda: 'USD', forma: 'Zelle', banco: '', titular: 'Juan Pérez', monto: '30', referencia: 'Z1' }).valor.pago), textoPago(null)], ['Pago móvil · Banesco · ref. 123456 · 5.696 Bs', 'Zelle · ref. Z1 · 30 $', '']);
check('aviso a Administración: pago registrado', avisoDePagoCliente(registrado), { title: 'Pago registrado', body: 'AO7 · JOSE · 5.696 Bs' });
check('aviso a Administración: paga después y pagó junto con otra', [avisoDePagoCliente(pendiente), avisoDePagoCliente(compartido)], [
  { title: 'Pago pendiente de cobro', body: 'AO7 · JOSE · 5.696 Bs (el cliente paga después)' },
  { title: 'Pago pendiente de cobro', body: 'AO7 · JOSE · 5.696 Bs (pagó junto con AO3)' },
]);

// --- ¿Hay que pedir el pago? ---
check('una orden con cobro finalizada hoy lo pide', debePedirPagoCobro(visita, false), true);
check('si ya hay pago, no lo vuelve a pedir', debePedirPagoCobro(visita, true), false);
check('antes de la fecha de inicio no pide nada', debePedirPagoCobro({ ...visita, finalizadoEn: Date.parse('2026-10-27T20:00:00-04:00') }, false), false);
check('exonerada, instalación, sin finalizar o sin fecha de cierre: no pide', [debePedirPagoCobro({ ...visita, cobroTipo: 'EXONERADO' }, false), debePedirPagoCobro({ ...visita, tipoTrabajo: 'INSTALACIÓN' }, false), debePedirPagoCobro({ ...visita, estado: 'PRE-FINALIZADO' }, false), debePedirPagoCobro({ ...visita, finalizadoEn: null }, false)], [false, false, false, false]);

// --- Resúmenes ---
const lista = [registrado, pendiente, { ...registrado, estado: ESTADO_PAGO.CONCILIADO, pago: { ...registrado.pago, moneda: 'USD', monto: 30 } }, { ...pendiente, estado: ESTADO_PAGO.SIN_COBRAR }];
const res = resumenPagos(lista);
check('el resumen cuenta por estado y suma por moneda (lo pendiente, lo esperado)', [res.POR_CONCILIAR, res.PENDIENTE_COBRO, res.CONCILIADO.montos, res.SIN_COBRAR.cantidad], [{ cantidad: 1, montos: { BS: 5696, USD: 0 } }, { cantidad: 1, montos: { BS: 5696, USD: 0 } }, { BS: 0, USD: 30 }, 1]);
check('cuántos están por cobrar', cantidadPorCobrar(lista), 1);
check('los días que lleva esperando un pendiente', [diasEsperando(pendiente, AHORA), diasEsperando(pendiente, AHORA + 3 * 86400000 + 5000)], [0, 3]);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
