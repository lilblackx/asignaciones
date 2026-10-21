// Adelantos a los técnicos (siempre en dólares): lo que se les da antes de pagarles y se resta de lo que tienen pendiente. Un adelanto se descuenta en uno o varios
// pagos (`aplicado` sube hasta `monto`); lo que no se descuenta queda como saldo. Funciones puras. Se guarda en la colección adelantosTecnicos:
//   { tecnico, monto, aplicado, forma, banco, referencia, pagadoEn, nota, por, creadoEn, anulado, notificado }
const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

// Lo que le queda por descontar a un adelanto (0 si se anuló).
export const saldoAdelanto = (a) => (a?.anulado ? 0 : Math.max(0, redondear((Number(a?.monto) || 0) - (Number(a?.aplicado) || 0))));

// Los adelantos con saldo de un técnico, del más viejo al más nuevo (el más viejo se descuenta primero).
export function adelantosConSaldo(adelantos, tecnico) {
  return adelantos
    .filter((a) => a.tecnico === tecnico && saldoAdelanto(a) > 0)
    .sort((a, b) => (Number(a.pagadoEn) || 0) - (Number(b.pagadoEn) || 0) || (Number(a.creadoEn) || 0) - (Number(b.creadoEn) || 0));
}

// Cuánto se descuenta de un pago de `total` dólares y de qué adelantos: { descuento, partes: [{ id, monto }] }. Nunca más que el total: lo que sobra queda como saldo.
export function repartirAdelantos(lista, total) {
  let restante = redondear(total);
  const partes = [];
  for (const a of lista) {
    if (restante <= 0) break;
    const monto = Math.min(saldoAdelanto(a), restante);
    if (monto <= 0) continue;
    partes.push({ id: a.id, monto: redondear(monto) });
    restante = redondear(restante - monto);
  }
  return { descuento: redondear(partes.reduce((s, p) => s + p.monto, 0)), partes };
}

// El adelanto listo para guardar. `datos`: lo que devuelve parseAdelanto; `por`: quien lo registra.
export const armarAdelanto = (tecnico, datos, { por, ahora, notificar = false }) => ({
  tecnico,
  monto: redondear(datos.monto),
  aplicado: 0,
  forma: datos.forma,
  banco: datos.banco || '',
  referencia: datos.referencia,
  pagadoEn: datos.pagadoEn,
  nota: datos.nota || '',
  por,
  creadoEn: ahora,
  anulado: false,
  notificado: Boolean(notificar),
});

// Un adelanto se puede anular mientras no se haya descontado nada.
export const sePuedeAnularAdelanto = (a) => Boolean(a) && !a.anulado && !(Number(a.aplicado) > 0);
