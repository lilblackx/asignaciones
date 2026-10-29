// Descuentos que Finanzas o el administrador le ponen a un técnico por un motivo libre (siempre en dólares): se restan de lo que tenga pendiente en su próximo pago, igual que un adelanto,
// y lo que no alcanza a descontarse queda como saldo para el siguiente. No van ligados a una orden (los de una garantía de otro técnico son otra cosa: utils/ajustes). Funciones puras.
// Se guarda en la colección descuentosTecnicos, un documento por descuento:
//   { tecnico, monto, aplicado, motivo, por, creadoEn, anulado, notificado }   (anulado: anuladoPor y anuladoEn; pagoId: el último pago que lo tocó)
// Un descuento programado lleva además `desde` ("AAAA-MM-DD", día de Caracas): no cuenta hasta ese día y entra al primer pago que Finanzas haga a partir de entonces. En cuotas, cada cuota es
// su propio descuento con `cuota`, `cuotas` y `totalPlan` (el monto de todo el plan); solo la primera avisa al técnico. Sin `desde` entra ya.
// `aplicado` es lo que ya entró en pagos (sube al pagar, baja al anular el pago, nunca pasa de `monto`).
import { fechaCorta } from './calendario.js';

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

export const MAX_DESCUENTO = 100000;
export const MAX_MOTIVO = 300;

const limpiar = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

// "50" / "50,5" / "50.50" -> dólares (más de 0, hasta MAX_DESCUENTO, dos decimales) o { error }.
export function parseMontoDescuento(texto) {
  const limpio = String(texto ?? '').trim().replace(',', '.');
  if (limpio === '') return { error: 'Escribe el monto del descuento.' };
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(limpio)) return { error: 'Escribe solo números, con hasta 2 decimales. Ejemplo: 50 o 50,50' };
  const valor = Number(limpio);
  if (valor <= 0) return { error: 'El descuento debe ser mayor a 0.' };
  if (valor > MAX_DESCUENTO) return { error: `El monto no puede pasar de ${MAX_DESCUENTO}.` };
  return { valor };
}

// Monto en dólares + motivo -> { valor: { monto, motivo } } o { error, campo }. Sin motivo no se guarda.
export function parseDescuento({ monto, motivo } = {}) {
  const m = parseMontoDescuento(monto);
  if (m.error) return { error: m.error, campo: 'monto' };
  const motivoLimpio = limpiar(motivo);
  if (!motivoLimpio) return { error: 'Escribe el motivo del descuento.', campo: 'motivo' };
  if (motivoLimpio.length > MAX_MOTIVO) return { error: `El motivo es demasiado largo (máximo ${MAX_MOTIVO} caracteres).`, campo: 'motivo' };
  return { valor: { monto: m.valor, motivo: motivoLimpio } };
}

// El descuento listo para guardar. `datos`: lo que devuelve parseDescuento; `por`: quien lo registra. La fecha y la hora son las de `ahora` y no se eligen.
// `programa`: { desde, cuota?, cuotas?, totalPlan? } si es un descuento programado (ver armarPlanDescuentos).
export const armarDescuento = (tecnico, datos, { por, ahora, notificar = false, programa = null }) => ({
  tecnico,
  monto: redondear(datos.monto),
  aplicado: 0,
  motivo: datos.motivo,
  por,
  creadoEn: ahora,
  anulado: false,
  notificado: Boolean(notificar),
  ...(programa ? { desde: programa.desde, ...(programa.cuotas > 1 ? { cuota: programa.cuota, cuotas: programa.cuotas, totalPlan: redondear(programa.totalPlan) } : {}) } : {}),
});

// --- Descuentos programados y en cuotas ---

export const MAX_CUOTAS = 12;
export const FRECUENCIAS = [{ id: 'SEMANA', etiqueta: 'Cada semana' }, { id: 'QUINCENA', etiqueta: 'Cada 15 días' }, { id: 'MES', etiqueta: 'Cada mes' }];

const partes = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '')); return m ? { a: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null; };
const aISO = (fecha) => fecha.toISOString().slice(0, 10);
// "2026-02-30" no es una fecha: se comprueba que dé la misma al reconstruirla.
export const fechaValida = (iso) => { const p = partes(iso); return Boolean(p) && aISO(new Date(Date.UTC(p.a, p.m - 1, p.d))) === iso; };
const sumarDias = (iso, dias) => { const p = partes(iso); return aISO(new Date(Date.UTC(p.a, p.m - 1, p.d + dias))); };
// Cada mes cae el mismo día (el 31 de enero + 1 mes = 28 o 29 de febrero).
const sumarMeses = (iso, meses) => {
  const p = partes(iso);
  const ultimo = new Date(Date.UTC(p.a, p.m - 1 + meses + 1, 0)).getUTCDate();
  return aISO(new Date(Date.UTC(p.a, p.m - 1 + meses, Math.min(p.d, ultimo))));
};
const fechaDeCuota = (desde, n, frecuencia) => (n === 0 ? desde : frecuencia === 'MES' ? sumarMeses(desde, n) : sumarDias(desde, n * (frecuencia === 'QUINCENA' ? 15 : 7)));

// Desde qué fecha entra y en cuántas cuotas ({ desde, cuotas, frecuencia }) -> { valor: { desde, cuotas, frecuencia } } o { error, campo }. `hoy`: "AAAA-MM-DD" de Caracas. La fecha no puede ser anterior a hoy.
export function parseProgramacion({ desde, cuotas = 1, frecuencia = 'SEMANA' } = {}, { hoy }) {
  if (!fechaValida(desde)) return { error: 'Elige desde qué fecha se aplica.', campo: 'desde' };
  if (desde < hoy) return { error: 'La fecha no puede ser anterior a hoy.', campo: 'desde' };
  const n = Number(cuotas);
  if (!Number.isInteger(n) || n < 1 || n > MAX_CUOTAS) return { error: `Las cuotas van de 1 a ${MAX_CUOTAS}.`, campo: 'cuotas' };
  if (n > 1 && !FRECUENCIAS.some((f) => f.id === frecuencia)) return { error: 'Elige cada cuánto se descuenta cada cuota.', campo: 'frecuencia' };
  return { valor: { desde, cuotas: n, frecuencia: n > 1 ? frecuencia : '' } };
}

// El plan de cuotas de un monto total: [{ monto, desde, cuota, cuotas }]. Los centavos que no se reparten parejo van en la última cuota.
export function planDeCuotas(total, { desde, cuotas, frecuencia }) {
  const centavos = Math.round(redondear(total) * 100);
  const base = Math.floor(centavos / cuotas);
  const resto = centavos - base * cuotas;
  return Array.from({ length: cuotas }, (_, i) => ({ monto: (base + (i === cuotas - 1 ? resto : 0)) / 100, desde: fechaDeCuota(desde, i, frecuencia), cuota: i + 1, cuotas }));
}

// Los descuentos listos para guardar: uno por cuota (o uno solo). Si empieza hoy y es una sola cuota, es un descuento normal (sin `desde`). Solo la primera avisa al técnico.
// `datos`: lo que devuelve parseDescuento (el monto es el total del plan); `programacion`: lo que devuelve parseProgramacion.
export function armarPlanDescuentos(tecnico, datos, programacion, { por, ahora, notificar = false, hoy }) {
  if (programacion.cuotas === 1 && programacion.desde === hoy) return [armarDescuento(tecnico, datos, { por, ahora, notificar })];
  const total = redondear(datos.monto);
  return planDeCuotas(total, programacion).map((c) => armarDescuento(tecnico, { monto: c.monto, motivo: datos.motivo }, {
    por, ahora, notificar: notificar && c.cuota === 1, programa: { desde: c.desde, cuota: c.cuota, cuotas: c.cuotas, totalPlan: total },
  }));
}

// ¿Cuenta ya en los pagos? Sin `desde`, o con `desde` de hoy o anterior. `hoy`: "AAAA-MM-DD" de Caracas.
export const aplicaYa = (d, hoy) => !d?.desde || d.desde <= hoy;
export const estaProgramado = (d, hoy) => Boolean(d) && !d.anulado && !aplicaYa(d, hoy);
export const textoCuota = (d) => (Number(d?.cuotas) > 1 ? `cuota ${d.cuota} de ${d.cuotas}` : '');
export const textoDesde = (d) => (d?.desde ? fechaCorta(d.desde) : '');

// Un descuento se puede anular mientras no se haya descontado nada.
export const sePuedeAnularDescuento = (d) => Boolean(d) && !d.anulado && !(Number(d.aplicado) > 0);

// Si descontar `monto` deja algo sin descontar este pago: lo que le quedaría por descontar después de restarlo de lo que se le paga (`disponible`: órdenes más bonos, menos lo que ya se descuenta).
export const saldoTrasDescuento = (monto, disponible) => Math.max(0, redondear(redondear(monto) - Math.max(0, redondear(disponible))));
