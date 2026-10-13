import { clasificarEvento } from './historial.js';

// Devolución vigente de una orden: el admin la regresó al técnico con un motivo y
// el técnico todavía no la vuelve a pre-finalizar. Se deduce del historial (el
// técnico no puede escribir otros campos en la orden), así que desaparece sola
// cuando pre-finaliza de nuevo. Devuelve { motivo, operador, fecha } o null.
export function devolucionPendiente(ticket) {
  if (ticket?.estado !== 'PENDIENTE') return null;
  const historial = ticket.historialEdiciones || [];
  for (let i = historial.length - 1; i >= 0; i--) {
    const tipo = clasificarEvento(historial[i]);
    if (tipo === 'prefinalizado') return null;
    if (tipo === 'devuelto') {
      const { motivo, operador, fecha } = historial[i];
      return { motivo: motivo || '', operador: operador || '', fecha: fecha || '' };
    }
  }
  return null;
}
