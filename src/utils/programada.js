// Fecha programada de una orden ("yyyy-mm-dd", como la guarda el input date).
// Se compara como texto ISO contra el día de hoy en hora local.

const dosDigitos = (n) => String(n).padStart(2, '0');

export function hoyISO(ahora = new Date()) {
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
}

export function mananaISO(ahora = new Date()) {
  const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  return hoyISO(manana);
}

// 'vencida' | 'hoy' | 'futura' | null (sin fecha programada)
export function categoriaProgramada(fechaProgramada, ahora = new Date()) {
  if (!fechaProgramada) return null;
  const hoy = hoyISO(ahora);
  if (fechaProgramada < hoy) return 'vencida';
  return fechaProgramada === hoy ? 'hoy' : 'futura';
}

// Orden pendiente cuya fecha programada aún no llega.
export const esProgramadaFutura = (ticket) =>
  ticket?.estado === 'PENDIENTE' && categoriaProgramada(ticket.fechaProgramada) === 'futura';
