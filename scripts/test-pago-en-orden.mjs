// Prueba el pago del cliente tal como lo ven la oficina, Revisión, Finanzas y Administración (src/utils/pagoEnOrden.js): la copia resumida que queda en la orden y en el cobro, sus textos, lo que Finanzas
// puede ver, lo que decide el técnico al confirmar y la corrección del ADMIN; y comprueba que cada pantalla, el registro y las reglas estén conectados. No necesita el emulador (las reglas
// de verdad las prueban test-rules.mjs, test-cobros-clientes-reglas.mjs y test-pagos-cliente-reglas.mjs). Uso: `npm run test:pagoenorden`.
import { readFileSync } from 'node:fs';
import {
  ESTADO_PAGO, FECHA_INICIO_PAGO_CLIENTE, armarCorreccionAdmin, armarPagoPendiente, armarPagoRegistrado, cobroEsperadoDe, debePedirPagoInstalacion, notaPagoCompartido, parsePagoCliente, piensaPagoCliente,
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

// --- ¿A quién se le pide el pago? ---
check('la fecha de inicio es un día AAAA-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(FECHA_INICIO_PAGO_CLIENTE), true);
check('una instalación pre-finalizada pide el pago; si ya trae el suyo, no', [piensaPagoCliente(instalacion, { desde: '2026-11-12' }), debePedirPagoInstalacion(instalacion, true, { desde: '2026-11-12' })], [true, false]);

// --- Todo está conectado ---
const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const fuentes = Object.fromEntries([
  'src/App.jsx', 'src/hooks/useTickets.js', 'src/lib/pagosOrdenes.js', 'src/lib/cobrosClientes.js', 'src/utils/cobrosClientes.js', 'src/utils/exportReport.js',
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
check('el Pre-finalizar de una instalación pide el pago (obligatorio, sin "paga después") y lo muestra en su confirmación', [tiene('src/components/modals/PreFinalizarModal.jsx', 'permitirPagarDespues={false}'), tiene('src/components/modals/PreFinalizarModal.jsx', '(pedirPago && !pagoCliente)'), tiene('src/components/modals/PreFinalizarModal.jsx', 'decisionDePago(porConfirmar.pagoCliente)'), tiene('src/components/modals/ConfirmPreFinalizarModal.jsx', '<FichaDelPago')], [true, true, true, true]);
check('App: registra el pago de la instalación después de pre-finalizar y abre la pantalla del cobro con registro', [tiene('src/App.jsx', 'registrarPagoDeOrden(conDatos, pagoCliente.valor)'), tiene('src/App.jsx', 'registro={{'), tiene('src/App.jsx', 'pagoInstalacion={isTecnico'), tiene('src/App.jsx', 'cobrosPorRegistrar')], [true, true, true, true]);
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
const reglas = fuentes['firestore.rules'];
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
console.log('\nTodas las pruebas pasaron.');
