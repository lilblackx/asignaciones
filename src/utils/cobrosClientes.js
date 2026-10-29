// El cobro de una orden al cliente, para ADMINISTRACION: al finalizarse una orden con cobro (o una instalación) se emite un cobro con estado PENDIENTE. Administración lo sube a mano al portal de
// la empresa (la app le da los datos para copiar) y lo marca CARGADO; el cliente ve su factura y paga allá, así que la app no lleva si el cliente ya pagó. Un documento por orden en
// `cobrosClientes` (id = id de la orden). Funciones puras: las usan las pantallas, el hook y las pruebas.
//
// Estados:
//   PENDIENTE  el cobro llegó a Administración y falta subirlo al portal
//   CARGADO    Administración ya lo subió al portal
// Aparte, `anulado` (la orden se canceló o dejó de tener cobro antes de cargarlo: sale de las listas) y `montoCambio` (el monto de la orden cambió cuando ya estaba cargado: Administración lo corrige
// en el portal y lo confirma).
import { MONEDA_BS, MONEDA_USD, formatoMontoBs, parseMontoBs, textoMonto } from './cobro.js';
import { cobroEsperadoDe } from './pagoCliente.js';
import { esInstalacion } from './instalacion.js';
import { diaDe } from './totalesMes.js';

export const ESTADO_COBRO = { PENDIENTE: 'PENDIENTE', CARGADO: 'CARGADO' };
export const ESTADOS_COBRO = Object.values(ESTADO_COBRO);
export const ETIQUETA_ESTADO_COBRO = { PENDIENTE: 'Pendiente', CARGADO: 'Cargado' };
export const FILTROS_ESTADO_COBRO = [
  { valor: 'TODOS', etiqueta: 'Todos' },
  { valor: ESTADO_COBRO.PENDIENTE, etiqueta: 'Pendientes' },
  { valor: ESTADO_COBRO.CARGADO, etiqueta: 'Cargados' },
  { valor: 'ALERTA', etiqueta: 'Con cambio de monto' },
];

const redondear = (n) => Math.round(n * 100) / 100;
const entrada = (por, en, detalle) => ({ en, por, detalle });

// "30 $" / "5.696 Bs" o, si todavía no hay monto (una instalación), "Monto por definir".
export const textoDeCobro = (c) => (c?.monto > 0 ? textoMonto(formatoMontoBs(Number(c.monto)), c.moneda) : 'Monto por definir');

// --- Emitir ---

// El cobro de la orden finalizada, o null si no lleva cobro (una orden exonerada o sin monto no lo emite). Las instalaciones lo emiten sin monto: lo escribe Administración al cargarlo.
export function armarCobro(ticket, { por, ahora }) {
  const instalacion = esInstalacion(ticket?.tipoTrabajo);
  const esperado = cobroEsperadoDe(ticket);
  if (!instalacion && !esperado) return null;
  const cobro = {
    ticketId: String(ticket.id),
    codigo: String(ticket.codigo || ''),
    nombre: String(ticket.nombre || ''),
    cedula: String(ticket.cedula || ''),
    telefono: String(ticket.telefono || '').slice(0, 80),
    tecnico: String(ticket.tecnico || ''),
    tipoTrabajo: String(ticket.tipoTrabajo || ''),
    tipoVisita: String(ticket.tipoVisita || ''),
    falla: String(ticket.falla || ''),
    esInstalacion: instalacion,
    monto: esperado ? esperado.monto : null,
    moneda: esperado ? esperado.moneda : '',
    estado: ESTADO_COBRO.PENDIENTE,
    montoCambio: null,
    anulado: false,
    creadoEn: ahora,
    creadoPor: por,
    cargadoPor: '',
    cargadoEn: 0,
    actualizadoEn: ahora,
  };
  return { ...cobro, historial: [entrada(por, ahora, `Cobro emitido: ${textoDeCobro(cobro)}`)] };
}

// El cobro que reemplaza a un pago "paga después" que quedó pendiente en el flujo anterior (lo usa el script de una sola vez que los pasa a Administración). Conserva cuándo se emitió, el monto y los datos
// de la orden; el historial dice de dónde viene. null si el pago no estaba pendiente o no hay monto que cobrar (y no es una instalación).
export function cobroDesdePagoPendiente(pago, { ahora, por = 'migración' }) {
  if (pago?.estado !== 'PENDIENTE_COBRO') return null;
  const instalacion = esInstalacion(pago.tipoTrabajo);
  const monto = Number(pago.cobro?.monto) > 0 ? Number(pago.cobro.monto) : null;
  if (!instalacion && !monto) return null;
  const cobro = {
    ticketId: String(pago.ticketId),
    codigo: String(pago.codigo || ''),
    nombre: String(pago.nombre || ''),
    cedula: String(pago.cedula || ''),
    telefono: String(pago.telefono || '').slice(0, 80),
    tecnico: String(pago.tecnico || ''),
    tipoTrabajo: String(pago.tipoTrabajo || ''),
    tipoVisita: String(pago.tipoVisita || ''),
    falla: String(pago.falla || ''),
    esInstalacion: instalacion,
    monto,
    moneda: monto ? (pago.cobro.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS) : '',
    estado: ESTADO_COBRO.PENDIENTE,
    montoCambio: null,
    anulado: false,
    creadoEn: Number(pago.creadoEn) || ahora,
    creadoPor: por,
    cargadoPor: '',
    cargadoEn: 0,
    actualizadoEn: ahora,
  };
  const nota = String(pago.nota || '').trim();
  return { ...cobro, historial: [entrada(por, ahora, `Pasó del flujo anterior: el técnico dijo que el cliente paga después${nota ? ` (${nota})` : ''}. ${textoDeCobro(cobro)}`)] };
}

// --- Cuando la orden cambia después de emitido el cobro ---

// La orden se editó o se canceló: `actual` es el cobro guardado y `ticket` la orden como quedó. Devuelve { cambios } o null si no hay nada que cambiar.
//   - Pendiente: se actualiza el monto (o se anula si la orden se canceló o dejó de tener cobro).
//   - Cargado: no se toca lo que Administración subió: queda `montoCambio` con el monto anterior y el nuevo (nuevo null = la orden se canceló o dejó de tener cobro).
export function sincronizarCobro(actual, ticket, { por, ahora }) {
  if (!actual) return null;
  const esperado = cobroEsperadoDe(ticket);
  const sinCobro = ticket?.estado === 'CANCELADO' || (!actual.esInstalacion && !esperado);
  const nuevo = sinCobro ? null : esperado;
  const actualMonto = actual.monto > 0 ? { monto: Number(actual.monto), moneda: actual.moneda } : null;

  if (actual.estado === ESTADO_COBRO.CARGADO) {
    if (actual.esInstalacion && !sinCobro) return null;
    const igual = nuevo && actualMonto && nuevo.monto === actualMonto.monto && nuevo.moneda === actualMonto.moneda;
    if (igual && !actual.montoCambio) return null;
    if (igual) return { cambios: { montoCambio: null, actualizadoEn: ahora, historial: [...(actual.historial || []), entrada(por, ahora, 'La orden volvió al monto cargado')] } };
    if (actual.montoCambio && JSON.stringify(actual.montoCambio.nuevo) === JSON.stringify(nuevo)) return null;
    const anterior = actual.montoCambio?.anterior || actualMonto;
    return { cambios: { montoCambio: { anterior, nuevo }, actualizadoEn: ahora, historial: [...(actual.historial || []), entrada(por, ahora, nuevo ? `El monto de la orden cambió a ${textoMonto(formatoMontoBs(nuevo.monto), nuevo.moneda)} (estaba cargado ${anterior ? textoMonto(formatoMontoBs(anterior.monto), anterior.moneda) : 'sin monto'})` : 'La orden se canceló o dejó de tener cobro (ya estaba cargado)')] } };
  }

  // Pendiente
  if (sinCobro) {
    if (actual.anulado) return null;
    return { cambios: { anulado: true, actualizadoEn: ahora, historial: [...(actual.historial || []), entrada(por, ahora, 'La orden se canceló o dejó de tener cobro: el cobro se retira')] } };
  }
  if (actual.esInstalacion) return actual.anulado ? { cambios: { anulado: false, actualizadoEn: ahora, historial: [...(actual.historial || []), entrada(por, ahora, 'La orden volvió a tener cobro')] } } : null;
  const mismo = actualMonto && nuevo.monto === actualMonto.monto && nuevo.moneda === actualMonto.moneda;
  if (mismo && !actual.anulado) return null;
  return { cambios: { monto: nuevo.monto, moneda: nuevo.moneda, anulado: false, actualizadoEn: ahora, historial: [...(actual.historial || []), entrada(por, ahora, `Monto actualizado a ${textoMonto(formatoMontoBs(nuevo.monto), nuevo.moneda)}`)] } };
}

// --- Lo que hace Administración ---

// Marcar el cobro como CARGADO. Una instalación no trae monto: se escribe aquí (`monto` texto como "45" o "45,50" y `moneda`). Devuelve { cambios } o { error, campo }.
export function armarCarga(actual, { monto = '', moneda = MONEDA_USD } = {}, { por, ahora }) {
  if (!actual || actual.anulado) return { error: 'Este cobro ya no está vigente: la orden se canceló o dejó de tener cobro.' };
  if (actual.estado !== ESTADO_COBRO.PENDIENTE) return { error: 'Este cobro ya está cargado.' };
  let montoFinal = Number(actual.monto) > 0 ? Number(actual.monto) : null;
  let monedaFinal = actual.moneda || '';
  if (!montoFinal) {
    const m = parseMontoBs(monto);
    if (m.error) return { error: m.error.replace('a cobrar', 'del cobro'), campo: 'monto' };
    if (moneda !== MONEDA_BS && moneda !== MONEDA_USD) return { error: 'Elige la moneda del monto.', campo: 'moneda' };
    montoFinal = redondear(m.valor);
    monedaFinal = moneda;
  }
  const cobro = { monto: montoFinal, moneda: monedaFinal };
  return {
    cambios: {
      estado: ESTADO_COBRO.CARGADO,
      monto: montoFinal,
      moneda: monedaFinal,
      montoCambio: null,
      cargadoPor: por,
      cargadoEn: ahora,
      actualizadoEn: ahora,
      historial: [...(actual.historial || []), entrada(por, ahora, `Cargado en el portal: ${textoDeCobro(cobro)}`)],
    },
  };
}

// Deshacer una carga hecha por error: vuelve a PENDIENTE.
export function armarDevolucionCobro(actual, { por, ahora }) {
  if (actual?.estado !== ESTADO_COBRO.CARGADO) return { error: 'Solo se puede devolver un cobro cargado.' };
  return { cambios: { estado: ESTADO_COBRO.PENDIENTE, montoCambio: null, cargadoPor: '', cargadoEn: 0, actualizadoEn: ahora, historial: [...(actual.historial || []), entrada(por, ahora, 'Devuelto a pendiente')] } };
}

// "Ya lo corregí en el portal": el monto nuevo pasa a ser el cargado (si la orden se canceló, el cobro se retira).
export function armarConfirmacionCambio(actual, { por, ahora }) {
  if (!actual?.montoCambio) return { error: 'Este cobro no tiene un cambio de monto por confirmar.' };
  const { nuevo } = actual.montoCambio;
  const detalle = nuevo ? `Corregido en el portal: ${textoMonto(formatoMontoBs(nuevo.monto), nuevo.moneda)}` : 'Retirado del portal (la orden se canceló o dejó de tener cobro)';
  return {
    cambios: {
      ...(nuevo ? { monto: nuevo.monto, moneda: nuevo.moneda } : { anulado: true }),
      montoCambio: null,
      actualizadoEn: ahora,
      historial: [...(actual.historial || []), entrada(por, ahora, detalle)],
    },
  };
}

// --- Textos y avisos ---

// El aviso que recibe Administración (push y campana) cuando se emite un cobro.
export const avisoDeCobro = (c) => ({ title: 'Cobro por cargar', body: [c.codigo || 'S/C', c.nombre, textoDeCobro(c)].filter(Boolean).join(' · ') });

// Todo lo que Administración necesita para subir el cobro al portal, en líneas, para copiarlo de una vez.
export function textoParaCopiar(c) {
  return [
    `Orden: ${c.codigo || 'S/C'}`,
    `Cliente: ${c.nombre || '-'}`,
    c.cedula && `Cédula: ${c.cedula}`,
    c.telefono && `Teléfono: ${c.telefono}`,
    `Trabajo: ${[c.tipoTrabajo, c.falla].filter(Boolean).join(' - ') || '-'}`,
    `Monto: ${textoDeCobro(c)}`,
  ].filter(Boolean).join('\n');
}

// --- La lista de Administración ---

const sinTildes = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const tieneCambioDeMonto = (c) => Boolean(c?.montoCambio);
export const estaVigente = (c) => Boolean(c) && !c.anulado;

// estado ('TODOS' | PENDIENTE | CARGADO | 'ALERTA'), técnico, tipo ('' | 'INSTALACION' | 'OTRAS') y búsqueda por código, cliente, cédula o técnico. Lo anulado no sale.
export function filtrarCobros(cobros, { estado = 'TODOS', tecnico = '', tipo = '', busqueda = '' } = {}) {
  const buscado = sinTildes(busqueda).trim();
  const digitos = buscado.replace(/\D/g, '');
  return (cobros || []).filter((c) => {
    if (!estaVigente(c)) return false;
    if (estado === 'ALERTA' ? !tieneCambioDeMonto(c) : estado && estado !== 'TODOS' && c.estado !== estado) return false;
    if (tecnico && c.tecnico !== tecnico) return false;
    if (tipo === 'INSTALACION' && !c.esInstalacion) return false;
    if (tipo === 'OTRAS' && c.esInstalacion) return false;
    if (!buscado) return true;
    const texto = sinTildes([c.codigo, c.nombre, c.tecnico].filter(Boolean).join(' '));
    return texto.includes(buscado) || (digitos.length >= 3 && String(c.cedula || '').replace(/\D/g, '').includes(digitos));
  });
}

// Con cambio de monto primero (hay que corregirlos en el portal), después los pendientes del más viejo al más nuevo y, al final, los cargados del más nuevo al más viejo.
export function ordenarCobros(cobros) {
  const rango = (c) => (tieneCambioDeMonto(c) ? 0 : c.estado === ESTADO_COBRO.PENDIENTE ? 1 : 2);
  const antiguedad = (c) => Number(c.creadoEn) || 0;
  return [...(cobros || [])].sort((a, b) => rango(a) - rango(b) || (rango(a) === 2 ? antiguedad(b) - antiguedad(a) : antiguedad(a) - antiguedad(b)));
}

// { PENDIENTE: { cantidad, montos: { BS, USD } }, CARGADO: {...}, alertas } de lo vigente; las instalaciones sin monto cuentan en la cantidad y no suman.
export function resumenCobros(cobros) {
  const resumen = { ...Object.fromEntries(ESTADOS_COBRO.map((e) => [e, { cantidad: 0, montos: { [MONEDA_BS]: 0, [MONEDA_USD]: 0 } }])), alertas: 0 };
  for (const c of (cobros || []).filter(estaVigente)) {
    const fila = resumen[c.estado];
    if (!fila) continue;
    fila.cantidad += 1;
    if (c.monto > 0 && fila.montos[c.moneda] !== undefined) fila.montos[c.moneda] = redondear(fila.montos[c.moneda] + Number(c.monto));
    if (tieneCambioDeMonto(c)) resumen.alertas += 1;
  }
  return resumen;
}

export const cantidadPorCargar = (cobros) => (cobros || []).filter((c) => estaVigente(c) && c.estado === ESTADO_COBRO.PENDIENTE).length;
export const diasEsperando = (c, ahora = Date.now()) => Math.max(0, Math.floor((ahora - (Number(c?.creadoEn) || ahora)) / 86400000));

// Las columnas de la tabla del reporte de Finanzas y su fila.
export const columnasCobros = () => [{ titulo: 'Emitido' }, { titulo: 'Código' }, { titulo: 'Cliente' }, { titulo: 'Técnico' }, { titulo: 'Trabajo' }, { titulo: 'Monto', derecha: true }, { titulo: 'Estado' }, { titulo: 'Cargado por' }, { titulo: 'Cargado el' }];
const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');
export const filaCobro = (c) => [fechaHora(c.creadoEn), c.codigo || '', c.nombre || '', c.tecnico || '', c.esInstalacion ? 'Instalación' : [c.tipoTrabajo, c.falla].filter(Boolean).join(' - '), c.monto > 0 ? textoDeCobro(c) : '', ETIQUETA_ESTADO_COBRO[c.estado] || c.estado, c.cargadoPor || '', c.estado === ESTADO_COBRO.CARGADO ? fechaHora(c.cargadoEn) : ''];

// Los cobros creados en el rango (días de Caracas "AAAA-MM-DD"), de un técnico si se pide; los más nuevos primero (para Finanzas).
export function cobrosDelPeriodo(cobros, rango, { tecnico = '' } = {}) {
  return (cobros || [])
    .filter((c) => estaVigente(c) && (!tecnico || String(c.tecnico).toUpperCase() === tecnico.toUpperCase()))
    .filter((c) => { const dia = diaDe(Number(c.creadoEn) || 0); return dia >= rango.desde && dia <= rango.hasta; })
    .sort((a, b) => (Number(b.creadoEn) || 0) - (Number(a.creadoEn) || 0));
}
