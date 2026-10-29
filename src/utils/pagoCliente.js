// El pago que el cliente le hace a la empresa por el cobro de una orden: lo registra el técnico (o, si el cliente paga después, Administración) y
// Administración lo concilia. Un documento por orden en `pagosOrdenes` (id = id de la orden), que lleva copiados los datos clave de la orden para que el
// Cierre del día no lo afecte. Funciones puras: las usan las pantallas, el hook y las pruebas.
//
// Estados:
//   PENDIENTE_COBRO  el técnico dijo "el cliente paga después" (o "pagó junto con otra orden"): lo cobra Administración
//   POR_CONCILIAR    el técnico registró el pago: Administración lo verifica
//   CONCILIADO       Administración lo verificó (o lo cobró y registró)
//   SIN_COBRAR       Administración marcó que el cliente no pagó
import { MAX_BANCO, MAX_NOTA, MAX_REFERENCIA, MAX_TITULAR, MONEDA_BS, MONEDA_USD, esZelle, exigeReferencia, fechaHoraDeMarca, marcaDeFechaHora } from './datosPago.js';
import { CAMPOS_POR_TIPO, TIPO_BINANCE, TIPO_CUENTA, TIPO_PAGO_MOVIL, TIPO_ZELLE, TITULO_POR_TIPO } from './formasPago.js';
import { COBRO_EXONERADO, formatoMontoBs, llevaCobro, monedaDe, parseMontoBs, textoMonto } from './cobro.js';
import { esInstalacion } from './instalacion.js';
import { diaDe } from './totalesMes.js';
import { ADMINISTRACION_ACTIVA } from '../constants.js';
import { TIPO_CAMBIO_EQUIPO } from './tipoVisita.js';

export { MONEDA_BS, MONEDA_USD, fechaHoraDeMarca };

export const ESTADO_PAGO = { PENDIENTE: 'PENDIENTE_COBRO', POR_CONCILIAR: 'POR_CONCILIAR', CONCILIADO: 'CONCILIADO', SIN_COBRAR: 'SIN_COBRAR' };
export const ESTADOS_PAGO = Object.values(ESTADO_PAGO);
export const ETIQUETA_ESTADO_PAGO = { PENDIENTE_COBRO: 'Pendiente de cobro', POR_CONCILIAR: 'Por conciliar', CONCILIADO: 'Conciliado', SIN_COBRAR: 'Sin cobrar' };

// Desde qué día (Caracas) se pide el pago: las órdenes que se finalizan o pre-finalizan desde entonces. Lo anterior no pide nada.
// Para probar con otra fecha en local: VITE_PAGO_CLIENTE_DESDE=AAAA-MM-DD en .env.development.local.
export const FECHA_INICIO_PAGO_CLIENTE = import.meta.env?.VITE_PAGO_CLIENTE_DESDE ?? '2026-10-28';

// Las formas con que paga el cliente, según la moneda.
export const FORMAS_PAGO_CLIENTE = {
  [MONEDA_BS]: ['Pago móvil', 'Transferencia', 'Efectivo'],
  [MONEDA_USD]: ['Zelle', 'Binance', 'Efectivo', 'Otro'],
};
export const formasDeCliente = (moneda) => FORMAS_PAGO_CLIENTE[moneda] || [];
export const MONEDAS_CLIENTE = [{ id: MONEDA_BS, nombre: 'Bolívares (Bs)' }, { id: MONEDA_USD, nombre: 'Dólares ($)' }];

// El banco desde el que pagó el cliente: obligatorio en Pago móvil y Transferencia; en Zelle y Otro es opcional; en efectivo y Binance no hay.
export const exigeBancoCliente = (forma) => ['Pago móvil', 'Transferencia'].includes(forma);
export const aplicaBancoCliente = (forma) => !['Efectivo', 'Binance'].includes(forma);
export const aplicaCuentaEmpresa = (forma) => forma !== 'Efectivo';
// En Zelle se pide el titular de la cuenta desde la que pagó el cliente (el banco no basta para saber quién pagó).
export const exigeTitularCliente = (forma) => forma === 'Zelle';
export { esZelle, exigeReferencia };

const limpiar = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();
export const MAX_MONTO_PAGO = 999999999;

// --- Las cuentas de la empresa donde pudo llegar el pago (las formas de pago que carga el ADMIN) ---

const TIPO_POR_FORMA = { 'Pago móvil': TIPO_PAGO_MOVIL, Transferencia: TIPO_CUENTA, Zelle: TIPO_ZELLE, Binance: TIPO_BINANCE };

// "Pago Móvil · Banco Nacional de Crédito (BNC) · 0412-1009927", "Transferencia bancaria · Banesco · …8484". Un solo texto: lo que se guarda en el pago.
export function etiquetaCuenta(cuenta) {
  const principal = cuenta.banco || cuenta.correo || '';
  const dato = cuenta.telefono || cuenta.payId || (cuenta.numero ? `…${String(cuenta.numero).replace(/\D/g, '').slice(-4)}` : '');
  return [TITULO_POR_TIPO[cuenta.tipo], principal, dato].filter(Boolean).join(' · ');
}

// Las cuentas de la empresa que corresponden a la forma de pago elegida (Otro: cualquiera; Efectivo: ninguna). `formas`: ya normalizadas (normalizarFormasPago).
export function cuentasParaForma(formas, forma) {
  if (!aplicaCuentaEmpresa(forma)) return [];
  const tipo = TIPO_POR_FORMA[forma];
  const cuentas = (Array.isArray(formas) ? formas : []).filter((f) => CAMPOS_POR_TIPO[f?.tipo] && (!tipo || f.tipo === tipo));
  return [...new Set(cuentas.map(etiquetaCuenta))];
}

// --- La referencia: no se puede repetir en otra orden (misma forma de pago, mismo banco, mismo número) ---

const soloLetrasYNumeros = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// La clave que identifica una referencia (también es el id de su documento de reserva en `referenciasPago`): '' si no hay (efectivo).
export function claveReferencia(forma, banco, referencia) {
  const ref = soloLetrasYNumeros(referencia);
  if (!ref) return '';
  return `${soloLetrasYNumeros(forma)}_${soloLetrasYNumeros(banco)}_${ref}`.slice(0, 200);
}

// --- El cobro esperado de la orden ---

// "5.696" / "5.696,50" / "30" -> número.
export function numeroDeCobro(texto) {
  const valor = Number(String(texto ?? '').trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(valor) ? valor : null;
}

// Lo que debía pagar el cliente según la oficina: { monto, moneda } o null (instalaciones, exoneradas y órdenes sin cobro no tienen).
export function cobroEsperadoDe(ticket) {
  if (!llevaCobro(ticket) || ticket?.cobroTipo === COBRO_EXONERADO) return null;
  const monto = numeroDeCobro(ticket?.cobroBs);
  return monto > 0 ? { monto, moneda: monedaDe(ticket) } : null;
}

const redondear = (n) => Math.round(n * 100) / 100;

// --- Lo que escribe quien registra el pago ---

// Moneda, forma, monto, banco, cuenta de la empresa, referencia, fecha, hora y nota -> { valor: { pago, nota, monedaDistinta, diferencia } } o { error, campo }.
//   cuentas: las cuentas de la empresa para esa forma (cuentasParaForma); si no hay ninguna cargada el campo no se pide.
//   cobro: lo esperado ({ monto, moneda } o null): si el monto difiere (en la misma moneda) la nota es obligatoria.
export function parsePagoCliente({ moneda, forma, monto, banco, titular, cuentaEmpresa, referencia, fecha, hora, nota } = {}, { cuentas = [], cobro = null, ahora = Date.now() } = {}) {
  if (moneda !== MONEDA_BS && moneda !== MONEDA_USD) return { error: 'Elige la moneda del pago.', campo: 'moneda' };
  if (!formasDeCliente(moneda).includes(forma)) return { error: 'Elige la forma de pago.', campo: 'forma' };
  const m = parseMontoBs(monto);
  if (m.error) return { error: m.error.replace('a cobrar', 'pagado'), campo: 'monto' };
  const bancoLimpio = limpiar(banco);
  if (bancoLimpio.length > MAX_BANCO) return { error: `El nombre del banco es demasiado largo (máximo ${MAX_BANCO} caracteres).`, campo: 'banco' };
  if (exigeBancoCliente(forma) && !bancoLimpio) return { error: 'Escribe el banco desde el que pagó el cliente.', campo: 'banco' };
  const titularLimpio = limpiar(titular);
  if (titularLimpio.length > MAX_TITULAR) return { error: `El nombre del titular es demasiado largo (máximo ${MAX_TITULAR} caracteres).`, campo: 'titular' };
  if (exigeTitularCliente(forma) && !titularLimpio) return { error: 'Escribe el titular de la cuenta Zelle desde la que pagó el cliente.', campo: 'titular' };
  const ref = limpiar(referencia);
  if (ref.length > MAX_REFERENCIA) return { error: `La referencia es demasiado larga (máximo ${MAX_REFERENCIA} caracteres).`, campo: 'referencia' };
  if (exigeReferencia(forma) && !ref) return { error: 'Escribe la referencia del pago.', campo: 'referencia' };
  const cuenta = limpiar(cuentaEmpresa);
  if (aplicaCuentaEmpresa(forma) && cuentas.length > 0 && !cuentas.includes(cuenta)) return { error: 'Elige la cuenta de la empresa donde llegó el pago.', campo: 'cuentaEmpresa' };
  const pagadoEn = marcaDeFechaHora(fecha, hora);
  if (pagadoEn === null) return { error: 'Escribe la fecha y la hora del pago.', campo: 'fecha' };
  if (pagadoEn > ahora + 5 * 60 * 1000) return { error: 'La fecha y la hora del pago no pueden ser futuras.', campo: 'fecha' };
  const notaLimpia = limpiar(nota);
  if (notaLimpia.length > MAX_NOTA) return { error: `La nota es demasiado larga (máximo ${MAX_NOTA} caracteres).`, campo: 'nota' };

  const monedaDistinta = Boolean(cobro) && moneda !== cobro.moneda;
  const diferencia = Boolean(cobro) && !monedaDistinta && Math.abs(m.valor - cobro.monto) > 0.005;
  if (diferencia && !notaLimpia) return { error: 'El monto es distinto al cobro: escribe por qué.', campo: 'nota' };
  const bancoFinal = aplicaBancoCliente(forma) ? bancoLimpio : '';
  const referenciaFinal = exigeReferencia(forma) ? ref : '';
  return {
    valor: {
      pago: {
        moneda, forma, monto: redondear(m.valor), banco: bancoFinal, titular: exigeTitularCliente(forma) ? titularLimpio : '', cuentaEmpresa: aplicaCuentaEmpresa(forma) ? cuenta : '',
        referencia: referenciaFinal, pagadoEn,
      },
      nota: notaLimpia,
      monedaDistinta,
      diferencia,
    },
  };
}

// --- El documento de una orden ---

// Los datos de la orden que se copian al pago (para listarlo sin leer la orden, que puede estar archivada).
const datosDeOrden = (ticket) => ({
  ticketId: String(ticket.id),
  codigo: String(ticket.codigo || ''),
  nombre: String(ticket.nombre || ''),
  cedula: String(ticket.cedula || ''),
  telefono: String(ticket.telefono || '').slice(0, 80),
  tecnico: String(ticket.tecnico || ''),
  tipoTrabajo: String(ticket.tipoTrabajo || ''),
  falla: String(ticket.falla || ''),
  tipoVisita: String(ticket.tipoVisita || ''),
});

const entradaHistorial = (por, ahora, detalle) => ({ en: ahora, por, detalle });
const textoDeCobro = (cobro) => (cobro ? textoMonto(formatoMontoBs(cobro.monto), cobro.moneda) : '');

// El técnico registró el pago -> el documento nuevo (estado POR_CONCILIAR). `valor`: lo que devuelve parsePagoCliente.
export function armarPagoRegistrado(ticket, valor, { por, ahora, cobro = cobroEsperadoDe(ticket) }) {
  return {
    ...datosDeOrden(ticket),
    estado: ESTADO_PAGO.POR_CONCILIAR,
    cobro: cobro || null,
    pago: valor.pago,
    referenciaClave: claveReferencia(valor.pago.forma, valor.pago.banco, valor.pago.referencia),
    nota: valor.nota,
    compartidoCon: null,
    monedaDistinta: valor.monedaDistinta,
    diferencia: valor.diferencia,
    registradoPor: por,
    registradoEn: ahora,
    conciliadoPor: '',
    conciliadoEn: 0,
    notaAdministracion: '',
    creadoEn: ahora,
    actualizadoEn: ahora,
    historial: [entradaHistorial(por, ahora, `Pago registrado por el técnico: ${textoPago(valor.pago)}`)],
  };
}

// El técnico dijo que el cliente paga después (o pagó junto con otra orden) -> el documento nuevo (estado PENDIENTE_COBRO).
export function armarPagoPendiente(ticket, { nota, compartidoCon = null }, { por, ahora, cobro = cobroEsperadoDe(ticket) }) {
  const detalle = compartidoCon ? `El cliente pagó junto con la orden ${compartidoCon.codigo}` : 'El cliente paga después';
  return {
    ...datosDeOrden(ticket),
    estado: ESTADO_PAGO.PENDIENTE,
    cobro: cobro || null,
    pago: null,
    referenciaClave: '',
    nota: limpiar(nota),
    compartidoCon: compartidoCon ? { id: String(compartidoCon.id), codigo: String(compartidoCon.codigo || '') } : null,
    monedaDistinta: false,
    diferencia: false,
    registradoPor: por,
    registradoEn: ahora,
    conciliadoPor: '',
    conciliadoEn: 0,
    notaAdministracion: '',
    creadoEn: ahora,
    actualizadoEn: ahora,
    historial: [entradaHistorial(por, ahora, `${detalle}: ${limpiar(nota)}`)],
  };
}

// La nota que se guarda cuando el técnico dice que el cliente pagó junto con otra orden.
export const notaPagoCompartido = (otra, referencia) => `Pagó junto con ${otra.codigo || 'otra orden'}${referencia ? ` (misma referencia ${limpiar(referencia)})` : ''}.`;

// ¿El pago se puede conciliar, corregir o marcar sin cobrar? (Siempre: Administración puede corregir en cualquier estado, con registro.)
export const esPendiente = (p) => p?.estado === ESTADO_PAGO.PENDIENTE;
export const estaConciliado = (p) => p?.estado === ESTADO_PAGO.CONCILIADO;

// Administración concilia: un pendiente exige los datos del pago (`valor`); uno por conciliar puede traer una corrección (`valor`) y una nota.
// `repiteReferencia`: la referencia ya está en otra orden (solo Administración puede repetirla y la nota es obligatoria).
// Devuelve { cambios } (lo que se actualiza en el documento) o { error, campo }.
export function armarConciliacion(actual, { valor = null, nota = '', repiteReferencia = false } = {}, { por, ahora }) {
  const notaLimpia = limpiar(nota);
  if (notaLimpia.length > MAX_NOTA) return { error: `La nota es demasiado larga (máximo ${MAX_NOTA} caracteres).`, campo: 'nota' };
  // Un pendiente (o uno marcado sin cobrar que el cliente terminó pagando) no tiene datos de pago: hay que registrarlos para conciliarlo.
  if (!actual.pago && !valor) return { error: 'Registra los datos del pago para conciliarlo.', campo: 'forma' };
  if (repiteReferencia && !notaLimpia) return { error: 'La referencia ya está en otra orden: escribe por qué se repite (por ejemplo, un solo pago para varias órdenes).', campo: 'nota' };
  const pago = valor ? valor.pago : actual.pago;
  const cambios = {
    estado: ESTADO_PAGO.CONCILIADO,
    pago,
    referenciaClave: claveReferencia(pago.forma, pago.banco, pago.referencia),
    monedaDistinta: valor ? valor.monedaDistinta : Boolean(actual.monedaDistinta),
    diferencia: valor ? valor.diferencia : Boolean(actual.diferencia),
    conciliadoPor: por,
    conciliadoEn: ahora,
    notaAdministracion: notaLimpia,
    actualizadoEn: ahora,
  };
  const detalle = !actual.pago ? `Cobrado y conciliado: ${textoPago(pago)}` : valor ? `Conciliado con corrección: ${textoPago(pago)}` : 'Conciliado';
  cambios.historial = [...(actual.historial || []), entradaHistorial(por, ahora, `${detalle}${notaLimpia ? ` | ${notaLimpia}` : ''}`)];
  return { cambios };
}

// Administración marca que el cliente no pagó (nota obligatoria). La referencia que tuviera queda libre.
export function armarSinCobrar(actual, { nota = '' } = {}, { por, ahora }) {
  const notaLimpia = limpiar(nota);
  if (!notaLimpia) return { error: 'Escribe por qué no se cobró.', campo: 'nota' };
  if (notaLimpia.length > MAX_NOTA) return { error: `La nota es demasiado larga (máximo ${MAX_NOTA} caracteres).`, campo: 'nota' };
  return {
    cambios: {
      estado: ESTADO_PAGO.SIN_COBRAR,
      referenciaClave: '',
      conciliadoPor: por,
      conciliadoEn: ahora,
      notaAdministracion: notaLimpia,
      actualizadoEn: ahora,
      historial: [...(actual.historial || []), entradaHistorial(por, ahora, `Marcado sin cobrar | ${notaLimpia}`)],
    },
  };
}

// Administración devuelve un pago ya conciliado a "por conciliar" (nota obligatoria): los datos del pago y su referencia no cambian, solo se vuelve a verificar.
export function armarDevolucion(actual, { nota = '' } = {}, { por, ahora }) {
  const notaLimpia = limpiar(nota);
  if (actual?.estado !== ESTADO_PAGO.CONCILIADO) return { error: 'Solo se puede devolver un pago que está conciliado.', campo: 'nota' };
  if (!notaLimpia) return { error: 'Escribe por qué se devuelve.', campo: 'nota' };
  if (notaLimpia.length > MAX_NOTA) return { error: `La nota es demasiado larga (máximo ${MAX_NOTA} caracteres).`, campo: 'nota' };
  return {
    cambios: {
      estado: ESTADO_PAGO.POR_CONCILIAR,
      notaAdministracion: notaLimpia,
      actualizadoEn: ahora,
      historial: [...(actual.historial || []), entradaHistorial(por, ahora, `Devuelto a por conciliar | ${notaLimpia}`)],
    },
  };
}

// Corregir los datos de un pago ya registrado o conciliado (solo Administración y ADMIN), con quién y cuándo. No cambia el estado.
export function armarCorreccion(actual, { valor, nota = '', repiteReferencia = false }, { por, ahora }) {
  const notaLimpia = limpiar(nota);
  if (!actual?.pago) return { error: 'Este pago no tiene datos que corregir: concílialo con los datos del pago.', campo: 'forma' };
  if (!notaLimpia) return { error: 'Escribe qué se corrigió.', campo: 'nota' };
  if (notaLimpia.length > MAX_NOTA) return { error: `La nota es demasiado larga (máximo ${MAX_NOTA} caracteres).`, campo: 'nota' };
  if (repiteReferencia && !notaLimpia) return { error: 'La referencia ya está en otra orden: escribe por qué se repite.', campo: 'nota' };
  return {
    cambios: {
      pago: valor.pago,
      referenciaClave: claveReferencia(valor.pago.forma, valor.pago.banco, valor.pago.referencia),
      monedaDistinta: valor.monedaDistinta,
      diferencia: valor.diferencia,
      actualizadoEn: ahora,
      historial: [...(actual.historial || []), entradaHistorial(por, ahora, `Corregido: ${textoPago(valor.pago)} | ${notaLimpia}`)],
    },
  };
}

// --- Finanzas: los pagos de instalaciones y de cambios de equipo ---

// Con Administración apagada nadie concilia: un pago registrado por el técnico se llama "Registrado", no "Por conciliar".
export const etiquetaEstadoPago = (estado) => (!ADMINISTRACION_ACTIVA && estado === ESTADO_PAGO.POR_CONCILIAR ? 'Registrado' : ETIQUETA_ESTADO_PAGO[estado] || estado || '');

// FINANZAS no ve estados (nadie concilia para ella): todo lo que el técnico registró se llama "Registrado", para no confundirlo con el flujo de Administración.
export const ETIQUETA_PAGO_FINANZAS = 'Registrado';
export const CLASE_PAGO_FINANZAS = 'bg-sky-700 text-white';

// Lo que ve FINANZAS: el pago de una instalación y el de un cambio de equipo (las reglas de pagosOrdenes dejan leer solo esos).
export const esCambioDeEquipo = (p) => p?.tipoTrabajo === 'CAMBIO DE EQUIPO' || p?.tipoVisita === TIPO_CAMBIO_EQUIPO;
export const esPagoDeFinanzas = (p) => esInstalacion(p?.tipoTrabajo) || esCambioDeEquipo(p);
export const tipoPagoFinanzas = (p) => (esInstalacion(p?.tipoTrabajo) ? 'Instalación' : 'Cambio de equipo');
export const FILTROS_TIPO_PAGO = [{ valor: '', etiqueta: 'Todos' }, { valor: 'Instalación', etiqueta: 'Instalaciones' }, { valor: 'Cambio de equipo', etiqueta: 'Cambios de equipo' }];

// Los pagos creados en el rango (días de Caracas, "AAAA-MM-DD") y, si se pide, de un técnico; los más nuevos primero.
export function pagosClientesDelPeriodo(pagos, rango, { tecnico = '' } = {}) {
  return (pagos || [])
    .filter((p) => esPagoDeFinanzas(p) && (!tecnico || String(p.tecnico).toUpperCase() === tecnico.toUpperCase()))
    .filter((p) => { const dia = diaDe(Number(p.creadoEn) || 0); return dia >= rango.desde && dia <= rango.hasta; })
    .sort((a, b) => (Number(b.creadoEn) || 0) - (Number(a.creadoEn) || 0));
}

export const filtrarPagosClientes = (pagos, { tipo = '', ...filtros } = {}) => filtrarPagos((pagos || []).filter((p) => !tipo || tipoPagoFinanzas(p) === tipo), filtros);

// Lo registrado por forma de pago: [{ forma, cantidad, BS, USD }], la que más se usa primero. Solo cuenta lo que ya tiene pago.
export function resumenPorForma(pagos) {
  const porForma = new Map();
  for (const p of pagos || []) {
    if (!p.pago) continue;
    const fila = porForma.get(p.pago.forma) || { forma: p.pago.forma, cantidad: 0, [MONEDA_BS]: 0, [MONEDA_USD]: 0 };
    fila.cantidad += 1;
    if (fila[p.pago.moneda] !== undefined) fila[p.pago.moneda] = redondear(fila[p.pago.moneda] + (Number(p.pago.monto) || 0));
    porForma.set(p.pago.forma, fila);
  }
  return [...porForma.values()].sort((a, b) => b.cantidad - a.cantidad || a.forma.localeCompare(b.forma, 'es'));
}

const fechaHoraPago = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');
const montoPago = (p) => (p.pago ? textoMonto(formatoMontoBs(Number(p.pago.monto) || 0), p.pago.moneda) : p.cobro ? `Debe ${textoDeCobro(p.cobro)}` : '');

export const columnasPagosClientes = () => [
  { titulo: 'Pagado el' }, { titulo: 'Código' }, { titulo: 'Cliente' }, { titulo: 'Técnico' }, { titulo: 'Tipo' }, { titulo: 'Forma de pago' }, { titulo: 'Banco' }, { titulo: 'Titular' },
  { titulo: 'Referencia' }, { titulo: 'Cuenta de la empresa' }, { titulo: 'Monto', derecha: true }, { titulo: 'Nota' },
];
export const filaPagoCliente = (p) => [
  fechaHoraPago(p.pago?.pagadoEn || p.creadoEn), p.codigo || '', p.nombre || '', p.tecnico || '', tipoPagoFinanzas(p), p.pago?.forma || '', p.pago?.banco || '', p.pago?.titular || '',
  p.pago?.referencia || '', p.pago?.cuentaEmpresa || '', montoPago(p), [p.nota, p.compartidoCon ? `Pagó junto con ${p.compartidoCon.codigo}` : ''].filter(Boolean).join(' | '),
];

// Las cifras de arriba de la sección: cuántos pagos, lo recibido en cada moneda y cuántos faltan por pagar.
export function cifrasPagosClientes(pagos) {
  const r = resumenPagos(pagos);
  const registrados = (pagos || []).filter((p) => p.pago);
  const monto = (moneda) => textoMonto(formatoMontoBs(registrados.filter((p) => p.pago.moneda === moneda).reduce((s, p) => s + (Number(p.pago.monto) || 0), 0)), moneda);
  const sinPago = r[ESTADO_PAGO.PENDIENTE].cantidad;
  return [
    { etiqueta: 'Pagos registrados', valor: String(registrados.length) },
    { etiqueta: 'Recibido en dólares', valor: monto(MONEDA_USD) },
    { etiqueta: 'Recibido en bolívares', valor: monto(MONEDA_BS) },
    { etiqueta: 'Sin pagar todavía', valor: String(sinPago), detalle: sinPago > 0 ? 'el cliente paga después' : '' },
  ];
}

// --- Textos ---

// "Pago móvil · Banesco · ref. 123456 · 5.696 Bs"
export function textoPago(pago) {
  if (!pago) return '';
  return [pago.forma, pago.banco, pago.referencia && `ref. ${pago.referencia}`, textoMonto(formatoMontoBs(Number(pago.monto) || 0), pago.moneda)].filter(Boolean).join(' · ');
}

export { textoDeCobro };

// El aviso que recibe Administración (push y campana) cuando el técnico registra un pago o dice que el cliente paga después.
export function avisoDePagoCliente(doc) {
  const monto = doc.pago ? textoMonto(formatoMontoBs(Number(doc.pago.monto) || 0), doc.pago.moneda) : textoDeCobro(doc.cobro);
  const partes = [doc.codigo || 'S/C', doc.tecnico, monto].filter(Boolean).join(' · ');
  if (doc.estado === ESTADO_PAGO.PENDIENTE) {
    return { title: 'Pago pendiente de cobro', body: `${partes}${doc.compartidoCon ? ` (pagó junto con ${doc.compartidoCon.codigo})` : ' (el cliente paga después)'}` };
  }
  return { title: 'Pago registrado', body: partes };
}

// --- ¿Hay que pedirle el pago al técnico? ---

// Las órdenes con cobro (no instalaciones, no exoneradas) piden el pago cuando se finalizan; las instalaciones, dentro del Pre-finalizar (ver PreFinalizarModal).
// `tienePago`: ya existe el documento de pago de la orden. Solo las finalizadas desde FECHA_INICIO_PAGO_CLIENTE.
export function debePedirPagoCobro(ticket, tienePago, { desde = FECHA_INICIO_PAGO_CLIENTE } = {}) {
  if (!ticket || tienePago || ticket.estado !== 'FINALIZADO') return false;
  if (!cobroEsperadoDe(ticket)) return false;
  const finalizada = Number(ticket.finalizadoEn) || 0;
  return finalizada > 0 && diaDe(finalizada) >= desde;
}

// Las instalaciones piden el pago dentro del Pre-finalizar. Si el técnico ya la envió a revisión (o la oficina la finalizó) y no hay pago, se le vuelve a pedir
// (por ejemplo, si el pago no se pudo guardar justo después de pre-finalizar). Solo las pre-finalizadas desde FECHA_INICIO_PAGO_CLIENTE.
export function debePedirPagoInstalacion(ticket, tienePago, { desde = FECHA_INICIO_PAGO_CLIENTE } = {}) {
  if (!ticket || tienePago || !esInstalacion(ticket.tipoTrabajo)) return false;
  if (ticket.estado !== 'PRE-FINALIZADO' && ticket.estado !== 'FINALIZADO') return false;
  const marca = Number(ticket.prefinalizadoEn) || Number(ticket.finalizadoEn) || 0;
  return marca > 0 && diaDe(marca) >= desde;
}

// ¿Esta orden es de las que piden el pago al técnico (con o sin el pago ya registrado)? Las demás siguen con el aviso de siempre.
export const piensaPagoCliente = (ticket, opciones) => debePedirPagoCobro(ticket, false, opciones) || debePedirPagoInstalacion(ticket, false, opciones);

// --- Resúmenes para Administración ---

// { PENDIENTE_COBRO: { cantidad, montos: { BS, USD } }, ... }: lo registrado por estado y moneda (lo pendiente suma lo esperado, si lo hay).
export function resumenPagos(pagos) {
  const resumen = Object.fromEntries(ESTADOS_PAGO.map((e) => [e, { cantidad: 0, montos: { [MONEDA_BS]: 0, [MONEDA_USD]: 0 } }]));
  for (const p of pagos || []) {
    const fila = resumen[p.estado];
    if (!fila) continue;
    fila.cantidad += 1;
    const origen = p.pago || p.cobro;
    if (origen?.moneda && fila.montos[origen.moneda] !== undefined) fila.montos[origen.moneda] = redondear(fila.montos[origen.moneda] + (Number(origen.monto) || 0));
  }
  return resumen;
}

export const cantidadPorCobrar = (pagos) => (pagos || []).filter(esPendiente).length;

// Días que lleva esperando un pago pendiente.
export const diasEsperando = (p, ahora = Date.now()) => Math.max(0, Math.floor((ahora - (Number(p?.creadoEn) || ahora)) / 86400000));

// --- Filtros de la lista de Administración ---

export const FILTROS_ESTADO_PAGO = [
  { valor: 'TODOS', etiqueta: 'Todos' },
  { valor: ESTADO_PAGO.PENDIENTE, etiqueta: 'Pendientes de cobro' },
  { valor: ESTADO_PAGO.POR_CONCILIAR, etiqueta: 'Por conciliar' },
  { valor: ESTADO_PAGO.CONCILIADO, etiqueta: 'Conciliados' },
  { valor: ESTADO_PAGO.SIN_COBRAR, etiqueta: 'Sin cobrar' },
];

const sinTildes = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// La moneda del pago: la que pagó el cliente o, si todavía no hay pago, la del cobro.
export const monedaDePago = (p) => p?.pago?.moneda || p?.cobro?.moneda || '';

// estado, técnico, forma de pago y moneda ('' o 'TODOS' = sin filtro) y búsqueda por código, cliente, cédula, técnico o referencia.
export function filtrarPagos(pagos, { estado = 'TODOS', tecnico = '', forma = '', moneda = '', busqueda = '' } = {}) {
  const buscado = sinTildes(busqueda).trim();
  const digitos = buscado.replace(/\D/g, '');
  return (pagos || []).filter((p) => {
    if (estado && estado !== 'TODOS' && p.estado !== estado) return false;
    if (tecnico && p.tecnico !== tecnico) return false;
    if (forma && p.pago?.forma !== forma) return false;
    if (moneda && monedaDePago(p) !== moneda) return false;
    if (!buscado) return true;
    const texto = sinTildes([p.codigo, p.nombre, p.tecnico, p.pago?.referencia, p.compartidoCon?.codigo].filter(Boolean).join(' '));
    return texto.includes(buscado) || (digitos.length >= 3 && String(p.cedula || '').replace(/\D/g, '').includes(digitos));
  });
}

// Los pendientes de cobro primero, del más antiguo al más nuevo (son los que hay que cobrar); después lo demás, del más nuevo al más antiguo.
export function ordenarPagos(pagos) {
  const antiguedad = (p) => Number(p.creadoEn) || 0;
  return [...(pagos || [])].sort((a, b) => {
    const pa = esPendiente(a) ? 0 : 1;
    const pb = esPendiente(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return pa === 0 ? antiguedad(a) - antiguedad(b) : antiguedad(b) - antiguedad(a);
  });
}
