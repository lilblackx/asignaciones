// Prueba el pago del cliente tal como lo ven la oficina, Revisión, Finanzas y Administración (src/utils/pagoEnOrden.js): la copia resumida que queda en la orden y en el cobro, sus textos, lo que Finanzas
// puede ver, lo que decide el técnico al confirmar y la corrección del ADMIN; y comprueba que cada pantalla, el registro y las reglas estén conectados. No necesita el emulador (las reglas
// de verdad las prueban test-rules.mjs, test-cobros-clientes-reglas.mjs y test-pagos-cliente-reglas.mjs). Uso: `npm run test:pagoenorden`.
import { readFileSync } from 'node:fs';
import {
  ESTADO_PAGO, FECHA_INICIO_PAGO_CLIENTE, armarCorreccionAdmin, armarPagoPendiente, armarPagoRegistrado, cobroEsperadoDe, debePedirPagoInstalacion, faltaElPago, montoCalculadora, montoDelCampo, montoParaCampo, notaPagoCompartido, parsePagoCliente, piensaPagoCliente,
} from '../src/utils/pagoCliente.js';
import {
  TIPO_PAGO, avisosDePago, decisionDePago, entradaHistorialPago, lineaDePago, pagoClienteDe, pagoVisibleEnFinanzas, resumenDePago, textoDelPago,
} from '../src/utils/pagoEnOrden.js';
import { armarCobro } from '../src/utils/cobrosClientes.js';

let failures = 0;
function check(name, actual, esperado) {
  // Los montos salen con espacio de no separar: se comparan con espacio normal.
  const a = JSON.stringify(actual)?.replace(/ /g, ' ');
  const e = JSON.stringify(esperado)?.replace(/ /g, ' ');
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const AHORA = Date.parse('2026-11-12T15:00:00-04:00');
const orden = { id: 'T1', codigo: 'AO7', nombre: 'Ana', cedula: '12345678', telefono: '0414-1234567', tecnico: 'JOSE', tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: 'CONECTOR_EXTERNO', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', estado: 'FINALIZADO', finalizadoEn: AHORA - 3600000 };
const instalacion = { ...orden, id: 'T3', codigo: 'IO3', tipoTrabajo: 'INSTALACIÓN', tipoVisita: '', falla: 'SM', cobroBs: null, cobroTipo: null, estado: 'PRE-FINALIZADO', prefinalizadoEn: AHORA - 3600000 };
const cambioEquipo = { ...orden, id: 'T4', codigo: 'AC9', tipoVisita: 'CAMBIO_EQUIPO' };
const base = { moneda: 'BS', forma: 'Pago móvil', monto: '5696', banco: 'Banesco', cuentaEmpresa: '', referencia: '123456', fecha: '2026-11-12', hora: '14:30', nota: '' };
const parse = (extra = {}, opciones = {}) => parsePagoCliente({ ...base, ...extra }, { ahora: AHORA, ...opciones });
const cobroOrden = cobroEsperadoDe(orden);

// --- La copia resumida del pago ---
const registrado = armarPagoRegistrado(orden, parse({ nota: ' Pagó   en efectivo ' }, { cobro: cobroOrden }).valor, { por: 'jose', ahora: AHORA });
const resumen = resumenDePago(registrado);
check('el pago registrado: tipo PAGO, con los datos del pago, la nota limpia y quién lo registró', [resumen.tipo, resumen.pago.forma, resumen.pago.monto, resumen.pago.banco, resumen.pago.referencia, resumen.pago.moneda, resumen.nota, resumen.registradoPor, resumen.registradoEn], ['PAGO', 'Pago móvil', 5696, 'Banesco', '123456', 'BS', 'Pagó en efectivo', 'jose', AHORA]);
check('el resumen no lleva el historial, la clave de la referencia ni los datos de la orden', ['historial' in resumen, 'referenciaClave' in resumen, 'codigo' in resumen, 'estado' in resumen], [false, false, false, false]);
const pendiente = armarPagoPendiente(orden, { nota: 'Paga el viernes' }, { por: 'jose', ahora: AHORA });
check('"paga después": tipo DESPUES, sin datos de pago y con su nota', [resumenDePago(pendiente).tipo, resumenDePago(pendiente).pago, resumenDePago(pendiente).nota], ['DESPUES', null, 'Paga el viernes']);
const compartido = armarPagoPendiente(orden, { nota: notaPagoCompartido({ codigo: 'AO3' }, '123456'), compartidoCon: { id: 'T0', codigo: 'AO3' } }, { por: 'jose', ahora: AHORA });
check('"pagó junto con otra orden": tipo JUNTO con la otra orden', [resumenDePago(compartido).tipo, resumenDePago(compartido).compartidoCon], ['JUNTO', { id: 'T0', codigo: 'AO3' }]);
check('un pago en otra moneda o con otro monto queda marcado', [resumenDePago(armarPagoRegistrado(orden, parse({ moneda: 'USD', forma: 'Zelle', banco: '', titular: 'Juan', monto: '10' }, { cobro: cobroOrden }).valor, { por: 'j', ahora: AHORA })).monedaDistinta, resumenDePago(armarPagoRegistrado(orden, parse({ monto: '5000', nota: 'Pagó menos' }, { cobro: cobroOrden }).valor, { por: 'j', ahora: AHORA })).diferencia], [true, true]);
check('si el ADMIN lo corrigió, el resumen dice quién y cuándo (y solo entonces)', [resumenDePago(registrado, { corregidoPor: 'admin', corregidoEn: AHORA + 5 }).corregidoPor, 'corregidoPor' in resumen], ['admin', false]);
check('sin documento no hay resumen', resumenDePago(null), null);

// --- Leerlo de una orden o de un cobro ---
check('pagoClienteDe lee el resumen válido y descarta lo demás', [pagoClienteDe({ pagoCliente: resumen })?.tipo, pagoClienteDe({}), pagoClienteDe(null), pagoClienteDe({ pagoCliente: 'x' }), pagoClienteDe({ pagoCliente: { tipo: 'OTRO' } })], ['PAGO', null, null, null, null]);

// --- Textos ---
check('la línea de un pago, de "paga después" y de "pagó junto con otra orden"', [lineaDePago(resumen), lineaDePago(resumenDePago(pendiente)), lineaDePago(resumenDePago(compartido)), lineaDePago(null)], ['Pago móvil · Banesco · ref. 123456 · 5.696 Bs', 'El cliente paga después', 'Pagó junto con la orden AO3', '']);
check('el texto completo suma la nota del técnico', [textoDelPago({ pagoCliente: resumen }), textoDelPago({ pagoCliente: resumenDePago(pendiente) }), textoDelPago({})], ['Pago móvil · Banesco · ref. 123456 · 5.696 Bs | Pagó en efectivo', 'El cliente paga después | Paga el viernes', '']);
check('los avisos: otra moneda, otro monto, y nada si cuadra o no es un pago', [avisosDePago({ ...resumen, monedaDistinta: true }), avisosDePago({ ...resumen, diferencia: true }), avisosDePago(resumen), avisosDePago(resumenDePago(pendiente))], [['El cliente pagó en otra moneda que la del cobro.'], ['El monto pagado es distinto al cobro.'], [], []]);
const entrada = entradaHistorialPago(resumen, { fecha: '12/11/26, 3:00 p. m.', operador: 'jose' });
check('la entrada del historial de la orden: tipo pagoCliente, quién y qué pagó', [entrada.tipo, entrada.operador, entrada.detalle], ['pagoCliente', 'jose', 'Pago del cliente: Pago móvil · Banesco · ref. 123456 · 5.696 Bs | Nota: Pagó en efectivo']);
check('la entrada de una corrección dice qué se corrigió', entradaHistorialPago(resumen, { fecha: 'f', operador: 'admin', corregido: true, motivo: 'Era otra referencia' }).detalle.startsWith('Pago del cliente corregido: '), true);
check('la entrada de una corrección lleva el motivo', entradaHistorialPago(resumen, { fecha: 'f', operador: 'admin', corregido: true, motivo: 'Era otra referencia' }).detalle.endsWith('Corrección: Era otra referencia'), true);

// --- Finanzas solo ve instalaciones y cambios de equipo ---
const conPago = (o) => ({ ...o, pagoCliente: resumen });
check('Finanzas ve el pago de una instalación y de un cambio de equipo, no el de una avería ni el de una orden sin pago', [pagoVisibleEnFinanzas(conPago(instalacion)), pagoVisibleEnFinanzas(conPago(cambioEquipo)), pagoVisibleEnFinanzas(conPago({ ...orden, tipoTrabajo: 'CAMBIO DE EQUIPO', tipoVisita: '' })), pagoVisibleEnFinanzas(conPago(orden)), pagoVisibleEnFinanzas(instalacion)], [true, true, true, false, false]);
check('lo mismo vale para el cobro (lleva el tipo de trabajo y de visita de la orden)', [pagoVisibleEnFinanzas(armarCobro(conPago({ ...orden, id: 'T9' }), { por: 'o', ahora: AHORA })), pagoVisibleEnFinanzas(armarCobro(conPago(cambioEquipo), { por: 'o', ahora: AHORA })), pagoVisibleEnFinanzas(armarCobro(conPago(instalacion), { por: 'o', ahora: AHORA }))], [false, true, true]);

// --- La orden y el cobro ---
check('el cobro nace con el pago que la orden ya trae (una instalación lo registra al pre-finalizar)', [armarCobro(conPago(instalacion), { por: 'oficina', ahora: AHORA }).pagoCliente?.tipo, 'pagoCliente' in armarCobro(instalacion, { por: 'oficina', ahora: AHORA })], ['PAGO', false]);

// --- Lo que decide el técnico al confirmar ---
const decision = { tipo: 'pago', valor: parse({ nota: 'Pagó en efectivo' }, { cobro: cobroOrden }).valor, nota: 'Pagó en efectivo' };
check('la confirmación de un pago muestra los mismos datos que se guardarán', [decisionDePago(decision).tipo, decisionDePago(decision).pago.forma, decisionDePago(decision).nota, decisionDePago(decision).diferencia], [TIPO_PAGO.PAGO, 'Pago móvil', 'Pagó en efectivo', false]);
check('"paga después" y "pagó junto con otra orden" también se resumen', [decisionDePago({ tipo: 'despues', nota: 'El viernes' }), decisionDePago({ tipo: 'despues', nota: 'Con AO3', compartidoCon: { id: 'T0', codigo: 'AO3' } }).tipo], [{ tipo: 'DESPUES', pago: null, nota: 'El viernes', compartidoCon: null, monedaDistinta: false, diferencia: false }, 'JUNTO']);
check('la confirmación coincide con lo que queda guardado', JSON.stringify(decisionDePago(decision).pago) === JSON.stringify(resumenDePago(armarPagoRegistrado(orden, decision.valor, { por: 'jose', ahora: AHORA })).pago), true);

// --- El ADMIN corrige ---
const valorNuevo = parse({ referencia: '999888', nota: '' }, { cobro: cobroOrden }).valor;
const corregido = armarCorreccionAdmin(registrado, { valor: valorNuevo, nota: 'La referencia estaba mal', repiteReferencia: false }, { por: 'admin', ahora: AHORA + 1000 });
check('corregir un pago cambia sus datos y la clave de la referencia, sin tocar el estado, y deja el historial', [corregido.cambios.pago.referencia, corregido.cambios.referenciaClave, 'estado' in corregido.cambios, corregido.cambios.historial.length, corregido.cambios.historial.at(-1).por], ['999888', 'pagomovil_banesco_999888', false, 2, 'admin']);
check('corregir exige la nota', armarCorreccionAdmin(registrado, { valor: valorNuevo, nota: '  ' }, { por: 'admin', ahora: AHORA }).campo, 'nota');
const registraAdmin = armarCorreccionAdmin(pendiente, { valor: valorNuevo, nota: 'El cliente pagó en la oficina' }, { por: 'admin', ahora: AHORA + 1000 });
check('si el técnico dejó "paga después", el ADMIN puede registrar el pago: pasa a por conciliar con los datos', [registraAdmin.cambios.estado, registraAdmin.cambios.pago.referencia, registraAdmin.cambios.notaAdministracion, registraAdmin.cambios.historial.at(-1).detalle.startsWith('Pago registrado por el administrador')], [ESTADO_PAGO.POR_CONCILIAR, '999888', 'El cliente pagó en la oficina', true]);
check('registrar el pago de un "paga después" también exige la nota', armarCorreccionAdmin(pendiente, { valor: valorNuevo, nota: '' }, { por: 'admin', ahora: AHORA }).campo, 'nota');
check('si pagó junto con otra orden no hay datos que corregir', armarCorreccionAdmin(compartido, { valor: valorNuevo, nota: 'x' }, { por: 'admin', ahora: AHORA }).campo, 'forma');
check('el resumen corregido sale del documento ya corregido', (() => { const r = resumenDePago({ ...registrado, ...corregido.cambios }, { corregidoPor: 'admin', corregidoEn: AHORA + 1000 }); return [r.pago.referencia, r.corregidoPor, r.registradoPor]; })(), [['999888', 'admin', 'jose']].flat());

// --- El monto se escribe como en una calculadora ---
check("los dígitos se llenan de derecha a izquierda: los dos últimos son los decimales", ["5", "56", "569", "5696", "56960", "569600", "56960000", "1234567890"].map(montoCalculadora), ["0,05", "0,56", "5,69", "56,96", "569,60", "5.696,00", "569.600,00", "12.345.678,90"]);
check("solo cuentan los dígitos (puntos, comas y letras que se cuelen se ignoran)", [montoCalculadora("5.696,00"), montoCalculadora("5a6"), montoCalculadora("")], ["5.696,00", "0,56", ""]);
check("borrar el último dígito retrocede como en una calculadora y se puede dejar vacío", ["5.696,0", "569,6", "0,0", "0,00", "000"].map(montoCalculadora), ["569,60", "56,96", "", "", ""]);
check("tiene tope de once dígitos (hasta 999.999.999,99)", [montoCalculadora("99999999999"), montoCalculadora("999999999999")], ["999.999.999,99", "999.999.999,99"]);
check("un monto guardado se ve en el campo con sus decimales", [montoParaCampo(5696), montoParaCampo(5696.5), montoParaCampo("5696"), montoParaCampo(0), montoParaCampo(null), montoParaCampo(20)], ["5.696,00", "5.696,50", "5.696,00", "", "", "20,00"]);
check("el campo con puntos de miles se lee como lo lee el pago", [montoDelCampo("5.696,00"), montoDelCampo("0,05"), montoDelCampo("12.345.678,90"), montoDelCampo("5696,50")], ["5696,00", "0,05", "12345678,90", "5696,50"]);
check("el pago acepta el monto del campo y lo guarda como número", [parse({ monto: "5.696,00" }).valor?.pago.monto, parse({ monto: "0,05" }).valor?.pago.monto, parse({ monto: "12.345,67" }).valor?.pago.monto], [5696, 0.05, 12345.67]);
check("un monto en cero o vacío sigue dando error", [parse({ monto: "0,00" }).campo, parse({ monto: "" }).campo], ["monto", "monto"]);

// --- ¿A quién se le pide el pago? ---
check('la fecha de inicio es un día AAAA-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(FECHA_INICIO_PAGO_CLIENTE), true);
const instalacionFinalizada = { ...instalacion, estado: 'FINALIZADO', finalizadoEn: AHORA - 1800000 };
check('una instalación pre-finalizada todavía no pide el pago (se pide cuando la oficina la finaliza)', [piensaPagoCliente(instalacion, { desde: '2026-11-12' }), debePedirPagoInstalacion(instalacion, false, { desde: '2026-11-12' })], [false, false]);
check('una instalación finalizada pide el pago; si ya trae el suyo, no', [piensaPagoCliente(instalacionFinalizada, { desde: '2026-11-12' }), debePedirPagoInstalacion(instalacionFinalizada, true, { desde: '2026-11-12' })], [true, false]);
check('las anteriores a la fecha de inicio no lo piden', [piensaPagoCliente(instalacionFinalizada, { desde: '2026-11-13' }), faltaElPago(instalacionFinalizada, { desde: '2026-11-13' })], [false, false]);
const instalacionConPago = { ...instalacionFinalizada, pagoCliente: { tipo: 'PAGO' } };
check('falta el pago: finalizada, de las que lo piden y sin pagoCliente (con él, ya no)', [faltaElPago(instalacionFinalizada, { desde: '2026-11-12' }), faltaElPago(instalacionConPago, { desde: '2026-11-12' }), faltaElPago(instalacion, { desde: '2026-11-12' }), faltaElPago(null)], [true, false, false, false]);
const visitaFinalizada = { ...orden, estado: 'FINALIZADO', finalizadoEn: AHORA - 1800000 };
check('una visita con cobro finalizada también falta; una exonerada no', [faltaElPago(visitaFinalizada, { desde: '2026-11-12' }), faltaElPago({ ...visitaFinalizada, cobroTipo: 'EXONERADO', cobroBs: null }, { desde: '2026-11-12' })], [true, false]);
// El ADMIN registra el pago a nombre del técnico (Revisión): queda marcado y a nombre del técnico de la orden.
const porOficina = armarPagoRegistrado(instalacionFinalizada, { pago: { moneda: 'BS', forma: 'Pago móvil', monto: 5696, banco: 'Banesco', cuentaEmpresa: '', referencia: '123456', pagadoEn: AHORA }, nota: 'El técnico no está', monedaDistinta: false, diferencia: false }, { por: 'admin', ahora: AHORA, aNombreDelTecnico: true });
check('el pago de la oficina queda a nombre del técnico, marcado y con su motivo', [porOficina.tecnico, porOficina.registradoPor, porOficina.aNombreDelTecnico, porOficina.historial[0].detalle.startsWith('Pago registrado por la oficina a nombre del técnico')], ['JOSE', 'admin', true, true]);
check('el resumen conserva la marca; el del técnico no la trae', [resumenDePago(porOficina).aNombreDelTecnico, 'aNombreDelTecnico' in resumenDePago(armarPagoRegistrado(instalacionFinalizada, { pago: porOficina.pago, nota: '', monedaDistinta: false, diferencia: false }, { por: 'tecnico1', ahora: AHORA }))], [true, false]);
const despuesOficina = armarPagoPendiente(visitaFinalizada, { nota: 'Paga el viernes' }, { por: 'admin', ahora: AHORA, aNombreDelTecnico: true });
check('"paga después" por la oficina también queda marcado', [despuesOficina.estado, despuesOficina.aNombreDelTecnico], ['PENDIENTE_COBRO', true]);
check('el historial de la orden dice que lo registró la oficina', entradaHistorialPago(resumenDePago(porOficina), { fecha: '12/11/2026', operador: 'admin' }).detalle.startsWith('Pago del cliente (registrado por la oficina a nombre del técnico)'), true);

// --- Todo está conectado ---
const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const fuentes = Object.fromEntries([
  'src/App.jsx', 'src/hooks/useTickets.js', 'src/utils/revisionPagos.js', 'src/lib/pagosOrdenes.js', 'src/lib/cobrosClientes.js', 'src/utils/cobrosClientes.js', 'src/utils/exportReport.js',
  'src/components/FormularioPagoCliente.jsx', 'src/components/PagoDelCliente.jsx', 'src/components/HistorialTimeline.jsx',
  'src/components/modals/CobroResultanteModal.jsx', 'src/components/modals/ConfirmarPagoModal.jsx', 'src/components/modals/PreFinalizarModal.jsx', 'src/components/modals/ConfirmPreFinalizarModal.jsx',
  'src/components/modals/CobroModal.jsx', 'src/components/modals/CorregirPagoModal.jsx', 'src/components/AdministracionApp.jsx', 'src/components/finanzas/CobrosEmitidos.jsx',
  'src/components/finanzas/DetalleOrdenFinanzas.jsx', 'src/components/finanzas/DetalleTecnico.jsx', 'src/components/finanzas/ResumenPagado.jsx', 'src/components/revision/FilaRevision.jsx',
  'src/components/revision/RevisionPagosModal.jsx', 'src/components/TicketsTable.jsx', 'src/components/TicketsMobileList.jsx', 'src/components/modals/AprobarFinalizarModal.jsx',
  'src/components/modals/DetalleOrdenModal.jsx', 'src/components/modals/OrdersHistoryModal.jsx', 'src/components/modals/reports/ReportDetailsView.jsx', 'firestore.rules',
].map((r) => [r, leer(r)]));
const tiene = (ruta, texto) => fuentes[ruta].includes(texto);
const muestraPago = (ruta) => tiene(ruta, 'PagoDelCliente');

check('el técnico confirma antes de registrar: el formulario abre el modal de confirmación y el ADMIN que corrige lo desactiva', [tiene('src/components/FormularioPagoCliente.jsx', "import ConfirmarPagoModal from './modals/ConfirmarPagoModal'"), tiene('src/components/FormularioPagoCliente.jsx', 'confirmar = true'), tiene('src/components/FormularioPagoCliente.jsx', '<ConfirmarPagoModal'), tiene('src/components/modals/CorregirPagoModal.jsx', 'confirmar={false}')], [true, true, true, true]);
check('las tres salidas (pago, paga después, pagó junto con otra orden) pasan por la confirmación', ['TIPO_PAGO.PAGO', 'TIPO_PAGO.DESPUES', 'TIPO_PAGO.JUNTO'].map((t) => tiene('src/components/FormularioPagoCliente.jsx', `tipo: ${t}`)), [true, true, true]);
check('la confirmación avisa que solo el administrador corrige y tiene "Volver" primero', [tiene('src/components/modals/ConfirmarPagoModal.jsx', 'solo el administrador puede corregirlo'), fuentes['src/components/modals/ConfirmarPagoModal.jsx'].indexOf('onClick={onCancel}') < fuentes['src/components/modals/ConfirmarPagoModal.jsx'].indexOf('onClick={onConfirm}')], [true, true]);
check('la pantalla del cobro lleva el formulario cuando hay registro y "Entendido" cuando no', [tiene('src/components/modals/CobroResultanteModal.jsx', '<FormularioPagoCliente'), tiene('src/components/modals/CobroResultanteModal.jsx', '{!registro && ('), tiene('src/components/modals/CobroResultanteModal.jsx', 'permitirPagarDespues={!instalacion}')], [true, true, true]);
check('el Pre-finalizar ya no pide el pago (lo registra el técnico cuando la oficina finaliza) y su confirmación vuelve a no llevarlo', [tiene('src/components/modals/PreFinalizarModal.jsx', 'FormularioPagoCliente'), tiene('src/components/modals/PreFinalizarModal.jsx', 'pagoInstalacion'), tiene('src/components/modals/PreFinalizarModal.jsx', 'decisionDePago'), tiene('src/components/modals/ConfirmPreFinalizarModal.jsx', 'FichaDelPago')], [false, false, false, false]);
check('App: ya no registra pagos al pre-finalizar y abre la pantalla del cobro con registro (instalaciones y órdenes con cobro finalizadas)', [tiene('src/App.jsx', 'registrarPagoDeOrden(conDatos'), tiene('src/App.jsx', 'pagoInstalacion={isTecnico'), tiene('src/App.jsx', 'registro={{'), tiene('src/App.jsx', 'cobrosPorRegistrar')], [false, false, true, true]);
check('el aviso al técnico al finalizar le dice que registre el pago (push y aviso en pantalla)', [(fuentes['src/hooks/useTickets.js'].match(/avisoPago\(/g) || []).length >= 6, tiene('src/hooks/useTickets.js', "' Registra el pago del cliente.'")], [true, true]);
check('Revisión: la barrera frena la aprobación (aprobar de golpe incluido), muestra el aviso y deja registrar el pago a nombre del técnico', [tiene('src/utils/revisionPagos.js', 'motivoNoAprobable(efectivo) || motivoSinPago(efectivo)'), tiene('src/components/revision/FilaRevision.jsx', 'Registrar el pago'), tiene('src/components/revision/RevisionPagosModal.jsx', 'RegistrarPagoOficinaModal'), tiene('src/components/revision/RevisionPagosModal.jsx', 'registrarPagoPorAdmin'), tiene('src/lib/pagosOrdenes.js', 'aNombreDelTecnico: true')], [true, true, true, true, true]);
check('lo ya aprobado no depende de la barrera (Finanzas sigue con motivoNoAprobable)', fuentes['src/utils/revisionPagos.js'].includes('i.concepto && !motivoNoAprobable(i) && !(i.descuento > 0)'), true);
check('useTickets: lo ya registrado se sabe por la propia orden (pagoCliente), sin leer más, y ya no existe la nota suelta', [tiene('src/hooks/useTickets.js', '!t.pagoCliente'), tiene('src/hooks/useTickets.js', 'registrarPagoCliente'), tiene('src/hooks/useTickets.js', 'observacionPago'), tiene('src/hooks/useTickets.js', 'guardarObservacionPago')], [true, true, false, false]);
check('el registro se guarda en un solo lote (pago, referencia y copia en la orden) y después se copia al cobro', ['writeBatch', 'lote.set(docPago', 'lote.set(docReferencia', 'lote.update(docOrden', 'updateDoc(docCobro', 'arrayUnion'].map((t) => tiene('src/lib/pagosOrdenes.js', t)), [true, true, true, true, true, true]);
check('la corrección del ADMIN va en una transacción que actualiza el pago, la referencia, la orden y el cobro', ['runTransaction', 'tx.update(docPago', 'tx.update(docOrden', 'tx.update(docCobro', 'tx.delete(docReferencia'].map((t) => tiene('src/lib/pagosOrdenes.js', t)), [true, true, true, true, true]);
check('lib/pagosOrdenes pasa por el medidor de Firestore (no importa las funciones de lectura y escritura de firebase/firestore)', [tiene('src/lib/pagosOrdenes.js', "from './medidorFirestore.js'"), /import \{[^}]*\b(getDoc|setDoc|updateDoc|writeBatch|runTransaction)\b[^}]*\} from 'firebase\/firestore'/.test(fuentes['src/lib/pagosOrdenes.js'])], [true, false]);
check('todas las pantallas muestran el pago del cliente', ['src/components/revision/FilaRevision.jsx', 'src/components/finanzas/DetalleTecnico.jsx', 'src/components/finanzas/ResumenPagado.jsx', 'src/components/finanzas/DetalleOrdenFinanzas.jsx', 'src/components/TicketsTable.jsx', 'src/components/TicketsMobileList.jsx', 'src/components/finanzas/CobrosEmitidos.jsx', 'src/components/AdministracionApp.jsx', 'src/components/modals/AprobarFinalizarModal.jsx', 'src/components/modals/CobroModal.jsx', 'src/components/modals/DetalleOrdenModal.jsx', 'src/components/modals/reports/ReportDetailsView.jsx'].map(muestraPago), Array(12).fill(true));
check('en Finanzas solo se ve el pago de instalaciones y cambios de equipo (paraFinanzas); Revisión y Administración ven todos', [tiene('src/components/finanzas/DetalleTecnico.jsx', 'paraFinanzas'), tiene('src/components/finanzas/ResumenPagado.jsx', 'paraFinanzas'), tiene('src/components/finanzas/CobrosEmitidos.jsx', 'paraFinanzas'), tiene('src/components/modals/CobroModal.jsx', 'paraFinanzas={soloLectura}'), tiene('src/components/finanzas/DetalleOrdenFinanzas.jsx', 'paraFinanzas={!verTodoPago}'), tiene('src/components/revision/RevisionPagosModal.jsx', 'verTodoPago'), tiene('src/components/revision/FilaRevision.jsx', 'paraFinanzas'), tiene('src/components/AdministracionApp.jsx', 'paraFinanzas')], [true, true, true, true, true, true, false, false]);
check('el botón de corregir pago es solo del ADMIN (el módulo lo pasa solo si el rol es ADMIN) y no sale en solo lectura', [tiene('src/components/AdministracionApp.jsx', 'correccion={esAdmin ?'), tiene('src/components/AdministracionApp.jsx', 'const esAdmin = role === ROLES.ADMIN'), tiene('src/components/modals/CobroModal.jsx', 'correccion && !soloLectura')], [true, true, true]);
check('la línea de tiempo de la orden conoce el evento pagoCliente y ya no el de la nota', [tiene('src/components/HistorialTimeline.jsx', "pagoCliente: { icono: Banknote, titulo: 'Pago del cliente'"), tiene('src/components/HistorialTimeline.jsx', 'notaPago')], [true, false]);
check('los archivos exportados traen el pago (órdenes, cobros de Administración y reporte de Finanzas)', [tiene('src/utils/exportReport.js', "['Pago del cliente', t => textoDelPago(t)]"), tiene('src/utils/exportReport.js', "['Forma de pago', c => datosPago(c)?.forma"), tiene('src/utils/exportReport.js', "['Nota del técnico'"), tiene('src/utils/cobrosClientes.js', "{ titulo: 'Pago del cliente' }"), tiene('src/utils/cobrosClientes.js', 'pagoVisibleEnFinanzas(c) ? textoDelPago(c)')], [true, true, true, true, true]);
check('ya no queda nada de la observación de pago suelta en el código', Object.entries(fuentes).filter(([ruta, texto]) => !ruta.endsWith('.rules') && /observacionPago|NotaDePago|copiarNotaAlCobro/.test(texto)).map(([ruta]) => ruta), []);

// Las reglas.
check("el formulario usa el formato de calculadora (solo dígitos, a la derecha, con su ayuda)", [tiene("src/components/FormularioPagoCliente.jsx", "montoCalculadora(e.target.value)"), tiene("src/components/FormularioPagoCliente.jsx", "inputMode=\"numeric\""), tiene("src/components/FormularioPagoCliente.jsx", "text-right")], [true, true, true]);
const reglas = fuentes['firestore.rules'];
check('las reglas dejan al ADMIN crear el pago a nombre del técnico (marcado) y el técnico no puede marcarlo', [reglas.includes('function adminCreaPagoDelTecnico(appId)'), reglas.includes('tecnicoCreaSuPago(appId) || adminCreaPagoDelTecnico(appId)'), reglas.includes("&& !('aNombreDelTecnico' in p)")], [true, true, true]);
const reglasTecnico = reglas.slice(reglas.indexOf('allow update: if ((isAdminUser(appId) || isUsuarioRole(appId)) && noPisaElCierre())'));
check('reglas de órdenes: el técnico puede escribir pagoCliente, una sola vez, con la forma válida, en una orden pre-finalizada o finalizada y a su nombre', [
  /hasOnly\(\[[^\]]*'pagoCliente'[^\]]*\]\)/.test(reglasTecnico.slice(0, 900)), reglasTecnico.includes("hasAny(['pagoCliente'])"), reglasTecnico.includes("!('pagoCliente' in resource.data)"), reglasTecnico.includes("resource.data.estado in ['PRE-FINALIZADO', 'FINALIZADO']"),
  reglasTecnico.includes('pagoClienteValido(request.resource.data.pagoCliente)'), reglasTecnico.includes('request.resource.data.pagoCliente.registradoPor == usuarioFinanzas(appId)'), reglas.includes("'observacionPago'"),
], [true, true, true, true, true, true, false]);
const reglasCobros = reglas.slice(reglas.indexOf('match /artifacts/{appId}/public/data/cobrosClientes/{ticketId}'), reglas.indexOf('match /artifacts/{appId}/public/data/pagosOrdenes/{ticketId}'));
check('reglas de cobros: pagoCliente es opcional y válido; el técnico lo copia una vez; el ADMIN lo corrige con historial', [
  reglasCobros.includes("'historial', 'pagoCliente'])"), reglasCobros.includes("(!('pagoCliente' in request.resource.data) || pagoClienteValido(request.resource.data.pagoCliente))"), reglasCobros.includes("&& !('pagoCliente' in resource.data)"),
  reglasCobros.includes("affectedKeys().hasOnly(['pagoCliente'])"), reglasCobros.includes("(isAdminUser(appId)\n            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['pagoCliente', 'actualizadoEn', 'historial'])\n            && pagoClienteValido(request.resource.data.pagoCliente))"),
], [true, true, true, true, true]);
check('reglas: pagoClienteValido revisa el tipo, los datos del pago, la nota, la otra orden, quién y cuándo', ["p.tipo in ['PAGO', 'DESPUES', 'JUNTO']", "(p.tipo == 'PAGO') == (p.pago != null)", "(p.tipo == 'JUNTO') == (p.compartidoCon != null)", 'p.nota.size() <= 300', "p.pago.forma in ['Pago móvil', 'Transferencia', 'Efectivo', 'Zelle', 'Binance', 'Otro']", 'p.registradoEn is int'].map((t) => reglas.includes(t)), Array(6).fill(true));

if (failures > 0) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las pruebas pasaron.');// El mismo formato en los demás campos de monto: los lectores aceptan lo que muestra el campo ("5.696,00") y lo de siempre ("5696,5", "50.50").
import { parseMontoBs } from '../src/utils/cobro.js';
import { parseMontoAdelanto } from '../src/utils/datosPago.js';
import { parseMontoDescuento } from '../src/utils/descuentos.js';
import { parseMontoAjuste } from '../src/utils/ajustes.js';
check('los lectores de montos aceptan el formato del campo (cobro, adelanto, descuento y garantía)', [parseMontoBs('5.696,00').valor, parseMontoAdelanto('1.250,50').valor, parseMontoDescuento('45,00').valor, parseMontoAjuste('1.000,25').valor], [5696, 1250.5, 45, 1000.25]);
check('y siguen aceptando lo de siempre', [parseMontoBs('5696,5').valor, parseMontoAdelanto('50.5').valor, parseMontoDescuento('50,50').valor, parseMontoAjuste('5').valor], [5696.5, 50.5, 50.5, 5]);
check('lo que no es un monto sigue dando error ("5.696" sin decimales no se confunde)', [parseMontoBs('5.696').error ? 'error' : 'ok', parseMontoAdelanto('abc').error ? 'error' : 'ok', parseMontoDescuento('0,00').error ? 'error' : 'ok'], ['error', 'error', 'error']);
check('los campos de monto usan el formato (Otro monto, cobro en Administración, adelanto, descuento y garantía)', [['src/components/modals/CobroSelector.jsx', 'montoCalculadora(e.target.value)'], ['src/components/modals/CobroModal.jsx', 'montoCalculadora(e.target.value)'], ['src/components/finanzas/PanelAdelanto.jsx', 'montoCalculadora(e.target.value)'], ['src/components/finanzas/PanelDescuento.jsx', 'montoCalculadora(e.target.value)'], ['src/components/revision/FilaRevision.jsx', 'montoCalculadora(e.target.value)']].map(([r, t]) => readFileSync(new URL('../' + r, import.meta.url), 'utf8').includes(t)), [true, true, true, true, true]);
check('el técnico puede dejar el pago para después y abrirlo desde su orden (tarjeta del celular y tabla), con el aviso "Falta registrar el pago"', [tiene('src/App.jsx', 'pagoPospuesto'), tiene('src/App.jsx', 'onRegistrarPago={isTecnico ? setPagoAbierto : undefined}'), tiene('src/components/modals/CobroResultanteModal.jsx', 'Registrar después'), readFileSync(new URL('../src/components/TicketsMobileList.jsx', import.meta.url), 'utf8').includes('Registrar el pago'), readFileSync(new URL('../src/components/TicketsTable.jsx', import.meta.url), 'utf8').includes('Registrar el pago del cliente'), tiene('src/components/PagoDelCliente.jsx', 'Falta registrar el pago del cliente')], [true, true, true, true, true, true]);
check('solo se deja para después una orden finalizada (el cobro del conector interno no)', tiene('src/App.jsx', "pagoActual?.estado === 'FINALIZADO'"), true);

