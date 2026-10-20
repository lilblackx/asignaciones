// Cancelar una orden pide un motivo, y ese motivo se ve donde se sigue la orden (lista de la oficina y del técnico, historial, detalle,
// ventas y reportes). En la orden se guardan tres campos, que se borran si la orden deja de estar cancelada:
//   motivoCancelacion: por qué se canceló (texto)
//   canceladaPor:      quién la canceló (usuario)
//   canceladaEn:       cuándo (marca de tiempo)
// El motivo es obligatorio al pasar de cualquier estado a CANCELADO. Las órdenes canceladas antes de este cambio no lo tienen.

export const ESTADO_CANCELADO = 'CANCELADO';
export const MAX_LARGO_MOTIVO_CANCELACION = 300;

// El texto sin saltos de línea ni "|" (el historial separa sus líneas con " | ").
const limpiar = (raw) => String(raw ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

// Texto escrito -> { valor } o { error }.
export function parseMotivoCancelacion(raw) {
  const texto = limpiar(raw);
  if (!texto) return { error: 'Escribe el motivo de la cancelación.' };
  if (texto.length > MAX_LARGO_MOTIVO_CANCELACION) return { error: `El motivo es demasiado largo (máximo ${MAX_LARGO_MOTIVO_CANCELACION} caracteres).` };
  return { valor: texto };
}

// El motivo guardado en la orden ('' si no tiene).
export const motivoCancelacion = (t) => (t?.estado === ESTADO_CANCELADO ? limpiar(t.motivoCancelacion) : '');

// ¿Esta edición cancela la orden (y antes no lo estaba)? Ahí el motivo es obligatorio.
export const cancelaAhora = (original, nueva) => nueva?.estado === ESTADO_CANCELADO && original?.estado !== ESTADO_CANCELADO;

// Los campos de cancelación que se guardan al editar una orden ({} si no cambia nada):
//   - pasa a CANCELADO: el motivo, quién y cuándo
//   - ya estaba cancelada: solo se actualiza el motivo si se corrigió (no se cambia quién ni cuándo)
//   - deja de estar cancelada: los tres campos se borran (null)
// `parseMotivoCancelacion` ya validó el texto: aquí se vuelve a limpiar.
export function camposCancelacion(original, nueva, { por, ahora = Date.now() } = {}) {
  if (cancelaAhora(original, nueva)) {
    return { motivoCancelacion: parseMotivoCancelacion(nueva.motivoCancelacion).valor ?? '', canceladaPor: por || '', canceladaEn: ahora };
  }
  if (nueva?.estado === ESTADO_CANCELADO) {
    const corregido = limpiar(nueva.motivoCancelacion).slice(0, MAX_LARGO_MOTIVO_CANCELACION);
    return corregido !== String(original?.motivoCancelacion ?? '') ? { motivoCancelacion: corregido } : {};
  }
  if (original?.estado === ESTADO_CANCELADO) return { motivoCancelacion: null, canceladaPor: null, canceladaEn: null };
  return {};
}

// La línea del historial: "Motivo de cancelación: ..." ('' si no hay).
export const lineaMotivoCancelacion = (motivo) => (motivo ? `Motivo de cancelación: ${motivo}` : '');

// Las órdenes que se "eliminaron" antes de que existiera solo el estado CANCELADO (estado ELIMINADO, con eliminadoPor y fechaEliminacion) se leen como
// canceladas, con un motivo que lo explica. Así no hace falta que la migración (scripts/migrar-eliminadas-a-canceladas.mjs) haya corrido para que la
// app ya no las trate como un estado aparte. Cualquier otra orden se devuelve tal cual.
export const MOTIVO_ELIMINADA_ANTES = 'Eliminada antes de que se unificara con cancelada';
export function comoCancelada(t) {
  if (t?.estado !== 'ELIMINADO') return t;
  return { ...t, estado: ESTADO_CANCELADO, motivoCancelacion: t.motivoCancelacion || MOTIVO_ELIMINADA_ANTES, canceladaPor: t.canceladaPor || t.eliminadoPor || '' };
}
