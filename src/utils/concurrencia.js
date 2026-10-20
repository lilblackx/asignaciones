// Dos personas trabajando la misma orden a la vez (carrera): lo que decide quién gana y lo que se le dice a quien llega tarde.
//   - Al guardar (useTickets): la escritura se hace en una transacción que vuelve a leer la orden; si ya no está en el estado que se
//     esperaba, no escribe y avisa con el texto de aquí.
//   - Mientras se tiene abierta (modales): la orden en vivo se compara con la que se abrió y, si cambió, se avisa y se bloquea el botón.
// El texto dice qué pasó y, cuando se sabe, quién lo hizo y a qué hora (de la última línea del historial de la orden).

export class ConflictoOrdenError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ConflictoOrdenError';
  }
}

// La última acción registrada en la orden: { por, cuando } ('' si no hay).
export function ultimaAccion(orden) {
  const historial = Array.isArray(orden?.historialEdiciones) ? orden.historialEdiciones : [];
  const ultima = historial[historial.length - 1];
  return { por: String(ultima?.operador || ''), cuando: String(ultima?.fecha || '') };
}

const quien = ({ por, cuando }) => `${por ? ` por ${por}` : ''}${cuando ? ` (${cuando})` : ''}`;

// Qué le pasó a la orden desde que se abrió (o desde que se leyó), en palabras: `esperado` es el estado en que debía estar.
export function textoCambioDeOrden(actual, esperado) {
  if (!actual) return 'Esta orden ya no está disponible: ya se cerró el día.';
  const accion = quien(ultimaAccion(actual));
  switch (actual.estado) {
    case 'FINALIZADO': return `Esta orden ya fue finalizada${accion}. No se guardó tu cambio.`;
    case 'CANCELADO': return `Esta orden ya fue cancelada${accion}. No se guardó tu cambio.`;
    case 'PRE-FINALIZADO': return `El técnico ya la pre-finalizó${accion}. Ciérrala y vuelve a abrirla para ver lo que cargó.`;
    case 'PENDIENTE': return esperado === 'PRE-FINALIZADO' ? `Esta orden ya fue devuelta al técnico${accion}. No se guardó tu cambio.` : `Esta orden cambió${accion}. Ciérrala y vuelve a abrirla.`;
    default: return `Esta orden cambió${accion}. Ciérrala y vuelve a abrirla.`;
  }
}

// Para la transacción: devuelve la función que revisa la orden recién leída y da el texto del problema, o null si todo sigue igual.
//   estados: los estados en los que la acción todavía tiene sentido (por ejemplo ['PRE-FINALIZADO'] para aprobar).
//   extra(actual): otra condición opcional (por ejemplo "no está esperando a infraestructura"); devuelve true si se puede seguir.
export const verificarEstado = (estados, extra = null) => (actual) => {
  if (!actual) return textoCambioDeOrden(null);
  if (!estados.includes(actual.estado) || (extra && !extra(actual))) return textoCambioDeOrden(actual, estados[0]);
  return null;
};

// Con la orden abierta en un modal: texto del cambio si la orden en vivo ya no está en el estado en que se abrió; si no, null.
// `actual` es la orden en vivo (null si ya no está en la lista).
export function cambioMientrasAbierta(abierta, actual) {
  if (!abierta) return null;
  if (!actual) return textoCambioDeOrden(null);
  return actual.estado === abierta.estado ? null : textoCambioDeOrden(actual, abierta.estado);
}
