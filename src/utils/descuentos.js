// Descuentos que Finanzas o el administrador le ponen a un técnico por un motivo libre (siempre en dólares): se restan de lo que tenga pendiente en su próximo pago, igual que un adelanto,
// y lo que no alcanza a descontarse queda como saldo para el siguiente. No van ligados a una orden (los de una garantía de otro técnico son otra cosa: utils/ajustes). Funciones puras.
// Se guarda en la colección descuentosTecnicos, un documento por descuento:
//   { tecnico, monto, aplicado, motivo, por, creadoEn, anulado, notificado }   (anulado: anuladoPor y anuladoEn; pagoId: el último pago que lo tocó)
// `aplicado` es lo que ya entró en pagos (sube al pagar, baja al anular el pago, nunca pasa de `monto`).
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
export const armarDescuento = (tecnico, datos, { por, ahora, notificar = false }) => ({
  tecnico,
  monto: redondear(datos.monto),
  aplicado: 0,
  motivo: datos.motivo,
  por,
  creadoEn: ahora,
  anulado: false,
  notificado: Boolean(notificar),
});

// Un descuento se puede anular mientras no se haya descontado nada.
export const sePuedeAnularDescuento = (d) => Boolean(d) && !d.anulado && !(Number(d.aplicado) > 0);

// Si descontar `monto` deja algo sin descontar este pago: lo que le quedaría por descontar después de restarlo de lo que se le paga (`disponible`: órdenes más bonos, menos lo que ya se descuenta).
export const saldoTrasDescuento = (monto, disponible) => Math.max(0, redondear(redondear(monto) - Math.max(0, redondear(disponible))));
