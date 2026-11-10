// El pago del cliente tal como lo ven la oficina, Revisión, Finanzas y Administración: una copia resumida del documento de pago (`pagosOrdenes`, que es el que manda y el que valida las reglas) que se
// guarda en la orden y en el cobro como `pagoCliente`. Así cada pantalla lo lee junto con la orden o el cobro, sin consultas extra, y sobrevive al Cierre del día (que archiva las órdenes completas).
// Funciones puras: las usan las pantallas, la escritura (lib/pagosOrdenes) y las pruebas.
//
// `pagoCliente`:
//   tipo            'PAGO' (el técnico registró el pago), 'DESPUES' (el cliente paga después) o 'JUNTO' (pagó junto con otra orden)
//   pago            { moneda, forma, monto, banco, titular, cuentaEmpresa, referencia, pagadoEn } si tipo es PAGO; si no, null
//   nota            lo que anotó el técnico (la "observación de pago": opcional con un pago, obligatoria en "paga después")
//   compartidoCon   { id, codigo } de la otra orden si tipo es JUNTO; si no, null
//   monedaDistinta, diferencia   el cliente pagó en otra moneda que la del cobro / un monto distinto al cobro (se avisa en pantalla)
//   registradoPor, registradoEn  quién lo registró y cuándo
//   corregidoPor, corregidoEn    solo si el ADMIN lo corrigió después (el último)
import { esPagoDeFinanzas, textoPago } from './pagoCliente.js';

export const TIPO_PAGO = { PAGO: 'PAGO', DESPUES: 'DESPUES', JUNTO: 'JUNTO' };
export const TIPOS_PAGO = Object.values(TIPO_PAGO);

// El resumen que se guarda en la orden y en el cobro, a partir del documento de `pagosOrdenes` (lo que devuelven armarPagoRegistrado y armarPagoPendiente, o el documento ya corregido).
// `corregidoPor`/`corregidoEn`: cuando el ADMIN corrige el pago. null si no hay documento.
export function resumenDePago(documento, { corregidoPor = '', corregidoEn = 0 } = {}) {
  if (!documento) return null;
  const p = documento.pago;
  const tipo = p ? TIPO_PAGO.PAGO : documento.compartidoCon ? TIPO_PAGO.JUNTO : TIPO_PAGO.DESPUES;
  return {
    tipo,
    pago: p ? { moneda: p.moneda, forma: p.forma, monto: p.monto, banco: p.banco || '', titular: p.titular || '', cuentaEmpresa: p.cuentaEmpresa || '', referencia: p.referencia || '', pagadoEn: p.pagadoEn } : null,
    nota: String(documento.nota || ''),
    compartidoCon: documento.compartidoCon ? { id: String(documento.compartidoCon.id), codigo: String(documento.compartidoCon.codigo || '') } : null,
    monedaDistinta: Boolean(documento.monedaDistinta),
    diferencia: Boolean(documento.diferencia),
    registradoPor: String(documento.registradoPor || ''),
    registradoEn: Number(documento.registradoEn) || 0,
    ...(corregidoPor ? { corregidoPor: String(corregidoPor), corregidoEn: Number(corregidoEn) || 0 } : {}),
  };
}

// Lo que decidió el técnico en el formulario del pago, como se le muestra para confirmar (la misma forma que el resumen guardado): { tipo: 'pago', valor, nota } (ya pagó) o { tipo: 'despues', nota, compartidoCon? }.
export function decisionDePago(decision) {
  if (decision?.tipo === 'pago') {
    const { valor } = decision;
    return { tipo: TIPO_PAGO.PAGO, pago: valor.pago, nota: valor.nota || '', compartidoCon: null, monedaDistinta: Boolean(valor.monedaDistinta), diferencia: Boolean(valor.diferencia) };
  }
  return { tipo: decision?.compartidoCon ? TIPO_PAGO.JUNTO : TIPO_PAGO.DESPUES, pago: null, nota: decision?.nota || '', compartidoCon: decision?.compartidoCon || null, monedaDistinta: false, diferencia: false };
}

// El pago de una orden o de un cobro (`pagoCliente`), o null si no tiene (o si no es un resumen válido).
export function pagoClienteDe(x) {
  const p = x?.pagoCliente;
  return p && typeof p === 'object' && TIPOS_PAGO.includes(p.tipo) ? p : null;
}

// ¿Esta orden o cobro puede mostrar su pago en Finanzas? Solo las instalaciones y los cambios de equipo (lo mismo que Finanzas ya ve de los pagos de clientes); las demás órdenes no.
export const pagoVisibleEnFinanzas = (x) => Boolean(pagoClienteDe(x)) && esPagoDeFinanzas(x);

// "Zelle · Bank of America · ref. 4821 · 20 $", "El cliente paga después" o "Pagó junto con la orden IO601".
export function lineaDePago(p) {
  if (!p) return '';
  if (p.tipo === TIPO_PAGO.PAGO) return textoPago(p.pago);
  if (p.tipo === TIPO_PAGO.JUNTO) return `Pagó junto con la orden ${p.compartidoCon?.codigo || 'otra orden'}`;
  return 'El cliente paga después';
}

// Los avisos del pago: el cliente pagó en otra moneda o un monto distinto al cobro.
export function avisosDePago(p) {
  if (p?.tipo !== TIPO_PAGO.PAGO) return [];
  if (p.monedaDistinta) return ['El cliente pagó en otra moneda que la del cobro.'];
  if (p.diferencia) return ['El monto pagado es distinto al cobro.'];
  return [];
}

// El texto completo del pago en una celda o línea: lo que pagó y, si la hay, la nota del técnico. Para las tablas y los archivos exportados.
export function textoDelPago(x) {
  const p = pagoClienteDe(x);
  if (!p) return '';
  return [lineaDePago(p), p.nota].filter(Boolean).join(' | ');
}

// La entrada del historial de la orden cuando el técnico registra el pago (o el ADMIN lo corrige). `fecha` y `operador`: como las demás entradas (fecha corta de es-VE y el usuario).
export function entradaHistorialPago(p, { fecha, operador, corregido = false, motivo = '' }) {
  const texto = [lineaDePago(p), p.nota && `Nota: ${p.nota}`, corregido && motivo && `Corrección: ${motivo}`].filter(Boolean).join(' | ');
  return { fecha, operador, tipo: 'pagoCliente', detalle: `${corregido ? 'Pago del cliente corregido' : 'Pago del cliente'}: ${texto}` };
}
