// El detalle de cada pago registrado para los Pagos detallados: las órdenes que entraron en él (con su código, cliente, día, concepto y monto) y lo que se le sumó o se le descontó
// (adelantos, descuentos con motivo, descuentos y pagos por garantía, pagos adicionales). Todo sale de lo que guardó cada pago y de las listas que Finanzas ya tiene leídas. Funciones puras.
import { CONCEPTOS_PAGO, aBs, bolivares, dolares, fechaHoraLegiblePago, textoOrdenes } from './finanzas.js';
import { MONEDA_BS, MONEDA_USD } from './datosPago.js';
import { textoAdicional } from './adicionales.js';
import { textoCuota } from './descuentos.js';

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;
const marcaDe = (a) => Number(a?.pagadoEn) || Number(a?.creadoEn) || 0;

// El nombre de cada concepto ("Avería o visita técnica", "Mudanza interna"...). VISITA es el concepto de los pagos de antes, cuando la visita tenía precio aparte.
const NOMBRES = { VISITA: 'Avería o visita técnica', ...Object.fromEntries(CONCEPTOS_PAGO.map((c) => [c.id, c.nombre])) };
export const nombreDeConcepto = (id) => NOMBRES[id] || String(id || '');

const diaLegible = (dia) => String(dia || '').split('-').reverse().join('/');
// "+ 5,00 $" o "- 20,00 $".
export const montoConSigno = (monto) => `${monto < 0 ? '-' : '+'} ${dolares(Math.abs(monto))}`;

// Lo que se sumó (monto positivo) y se descontó (negativo) en un pago: [{ tipo, detalle, monto }] en dólares. Cuando una lista ya no trae el documento (es antiguo) se usa lo que el pago guardó. Si lo
// listado no suma lo que el pago registró como bonos y descuentos (pagos de antes de guardar ese detalle), la diferencia sale en una línea aparte para que las cuentas cuadren con el neto.
export function movimientosDePago(pago, { adelantos = [], ajustes = [], descuentos = [], adicionales = [] } = {}) {
  const por = (lista) => new Map(lista.map((x) => [x.id, x]));
  const adelantoDe = por(adelantos);
  const ajusteDe = por(ajustes);
  const descuentoDe = por(descuentos);
  const adicionalDe = por(adicionales);
  const filas = [];
  for (const { id, monto } of pago.adelantos || []) {
    const a = adelantoDe.get(id);
    filas.push({ tipo: 'Adelanto', detalle: a ? [`Entregado el ${fechaHoraLegiblePago(marcaDe(a))}`, a.forma, a.nota].filter(Boolean).join(' · ') : 'Adelanto descontado', monto: -redondear(monto) });
  }
  for (const { id, monto, tipo } of pago.ajustes || []) {
    const a = ajusteDe.get(id);
    const garantia = a ? `Garantía ${a.codigo || 's/c'}` : 'Garantía';
    if (tipo === 'BONO') filas.push({ tipo: 'Pago por garantía', detalle: a ? `${garantia} de la orden ${a.codigoOrigen || 's/c'} (de ${a.de})` : garantia, monto: redondear(monto) });
    else filas.push({ tipo: 'Descuento por garantía', detalle: a ? `${garantia} hecha por ${a.a}: se descuenta de la orden ${a.codigoOrigen || 's/c'}` : garantia, monto: -redondear(monto) });
  }
  for (const { id, monto } of pago.descuentosManuales || []) {
    const d = descuentoDe.get(id);
    filas.push({ tipo: 'Descuento', detalle: d ? [d.motivo, textoCuota(d) && `(${textoCuota(d)})`].filter(Boolean).join(' ') || 'Descuento con motivo' : 'Descuento con motivo', monto: -redondear(monto) });
  }
  for (const { id, monto, nombre, cantidad } of pago.adicionales || []) {
    const a = adicionalDe.get(id) || { nombre, cantidad };
    filas.push({ tipo: 'Pago adicional', detalle: [textoAdicional(a), a.nota].filter(Boolean).join(' · '), monto: redondear(monto) });
  }
  const esperado = redondear((Number(pago.neto ?? pago.total) || 0) - (Number(pago.total) || 0));
  const listado = redondear(filas.reduce((suma, f) => suma + f.monto, 0));
  if (Math.abs(esperado - listado) > 0.005) {
    filas.push({ tipo: esperado < listado ? 'Descuento' : 'Bono', detalle: 'Sin detalle guardado (pago anterior)', monto: redondear(esperado - listado) });
  }
  return filas;
}

// Las órdenes de un pago, de la más antigua a la más nueva: [{ clave, codigo, nombre, dia, concepto, monto }]. `nombreDe(clave)`: el cliente de esa orden si se conoce.
const porDiaYCodigo = (a, b) => String(a.dia).localeCompare(String(b.dia)) || String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true });
export const ordenesDePago = (pago, ordenesPagadas, nombreDe = () => '') => ordenesPagadas
  .filter((o) => o.pagoId === pago.id)
  .map((o) => ({ clave: o.id, codigo: o.codigo || 's/c', nombre: nombreDe(o.id) || '', dia: o.dia, concepto: nombreDeConcepto(o.concepto), monto: redondear(o.monto) }))
  .sort(porDiaYCodigo);

// Los pagos de los que todavía faltan órdenes por leer: los que tienen leídas menos órdenes (por el id del pago) de las que registraron. Devuelve sus ids.
export function pagosIncompletos(pagos, ordenesPagadas) {
  const porPago = new Map();
  for (const o of ordenesPagadas) porPago.set(o.pagoId, (porPago.get(o.pagoId) || 0) + 1);
  return pagos.filter((p) => (porPago.get(p.id) || 0) < (Number(p.cantidadOrdenes) || 0)).map((p) => p.id);
}

const tasaLegible = (tasa) => Number(tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Cómo se pagó, para quien recibe el detalle: "Transferencia · Banco … · Ref. 123 · en bolívares". Vacío en los pagos de antes, que no guardaron estos datos.
export const textoFormaDePago = (pago) => (pago?.forma
  ? [pago.forma, pago.banco, pago.referencia && `Ref. ${pago.referencia}`, pago.moneda === MONEDA_BS ? 'en bolívares' : pago.moneda === MONEDA_USD ? 'en dólares' : ''].filter(Boolean).join(' · ')
  : '');

// El detalle de los pagos dados (los del periodo, sin anular): uno por pago, por técnico y del más reciente al más viejo.
// `ordenesPagadas`: los documentos de las órdenes pagadas de esos pagos. Cada elemento:
//   { pago, tecnico, fecha, titulo, nota, cuenta, neto, bs, ordenes, faltan, movimientos }
//   cuenta: las filas [concepto, monto] de la cuenta del pago (órdenes, bonos, descuentos, neto y bolívares);
//   nota: cómo se pagó y la nota del pago; faltan: cuántas órdenes del pago no se pudieron leer (0 si salieron todas).
export function detalleDePagos({ pagos, ordenesPagadas = [], nombreDe = () => '', adelantos = [], ajustes = [], descuentos = [], adicionales = [], tasa = null }) {
  return pagos
    .filter((p) => !p.anulado)
    .map((pago) => {
      const ordenes = ordenesDePago(pago, ordenesPagadas, nombreDe);
      const movimientos = movimientosDePago(pago, { adelantos, ajustes, descuentos, adicionales });
      const cantidad = Number(pago.cantidadOrdenes) || ordenes.length;
      const total = redondear(pago.total);
      const bonos = redondear(pago.bonos);
      const descuento = redondear(pago.descuento);
      const neto = redondear(pago.neto ?? pago.total);
      const tasaDelPago = Number(pago.tasa) > 0 ? Number(pago.tasa) : Number(tasa) > 0 ? Number(tasa) : null;
      const bs = aBs(neto, tasaDelPago);
      const fecha = fechaHoraLegiblePago(marcaDe(pago));
      const forma = textoFormaDePago(pago);
      return {
        pago,
        tecnico: pago.tecnico,
        fecha,
        titulo: `Pago del ${fecha} · ${textoOrdenes(cantidad)}`,
        nota: [forma && `Forma de pago: ${forma}`, pago.nota && `Nota: ${pago.nota}`].filter(Boolean).join('. '),
        cuenta: [
          [`Órdenes pagadas (${cantidad})`, dolares(total)],
          bonos > 0 && ['Bonos y pagos adicionales', `+ ${dolares(bonos)}`],
          descuento > 0 && ['Descuentos', `- ${dolares(descuento)}`],
          ['Neto pagado', dolares(neto)],
          bs != null && [`${pago.moneda === MONEDA_BS ? 'Pagado en bolívares' : 'Equivalente en bolívares'} (tasa ${tasaLegible(tasaDelPago)})`, bolivares(bs)],
        ].filter(Boolean),
        neto,
        bs,
        ordenes,
        faltan: Math.max(0, (Number(pago.cantidadOrdenes) || 0) - ordenes.length),
        movimientos,
      };
    })
    .sort((a, b) => String(a.tecnico).localeCompare(String(b.tecnico)) || Number(b.pago.creadoEn) - Number(a.pago.creadoEn));
}

// Las columnas y filas de las tablas del detalle (las usa el documento de Pagos detallados). `sinNombre`: lo que se pone cuando no se conoce el cliente (en las tablas del PDF y el Word, un guion;
// en el CSV, vacío: Excel lo trata como fórmula si empieza con "-").
export const columnasCuentaDelPago = () => [{ titulo: 'Resumen del pago' }, { titulo: 'Monto', derecha: true }];
export const columnasOrdenesDePago = () => [{ titulo: 'Orden' }, { titulo: 'Cliente' }, { titulo: 'Día' }, { titulo: 'Concepto' }, { titulo: 'Monto', derecha: true }];
export const filaOrdenDePago = (o, sinNombre = '') => [o.codigo, o.nombre || sinNombre, diaLegible(o.dia).slice(0, 5), o.concepto, dolares(o.monto)];
export const columnasMovimientos = () => [{ titulo: 'Tipo' }, { titulo: 'Detalle' }, { titulo: 'Monto', derecha: true }];
export const filaMovimiento = (m) => [m.tipo, m.detalle, montoConSigno(m.monto)];
