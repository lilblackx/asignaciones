// Línea de tiempo de una orden a partir de ticket.historialEdiciones.
// Las entradas nuevas traen `tipo`; las viejas solo tienen texto (`detalle`) y
// el tipo se deduce de él. Una entrada puede juntar varios cambios separados por
// " | " (ej. "Técnico: X | Estado: Y"): se muestran como líneas aparte.

export function clasificarEvento(entrada) {
  if (entrada?.tipo) return entrada.tipo;
  const d = String(entrada?.detalle || '');
  if (/(ENVIADO|ASIGNADO) marcado.*reenv/i.test(d)) return 'reenvio';
  if (/(ENVIADO|ASIGNADO) marcado/.test(d)) return 'envio';
  if (/(ENVIADO|ASIGNADO) retirado/.test(d)) return 'envio-retirado';
  if (/^Marcado como PRE-FINALIZADO/.test(d)) return 'prefinalizado';
  if (/^Aprobado y marcado como FINALIZADO/.test(d)) return 'aprobado';
  if (/^Marcado como FINALIZADO/.test(d)) return 'finalizado';
  if (/^Ubicación (agregada|modificada)/.test(d)) return 'ubicacion';
  if (/(^|\| )Técnico:/.test(d)) return 'tecnico';
  if (/Estado: CANCELADO/.test(d)) return 'cancelado';
  if (/Estado: FINALIZADO/.test(d)) return 'aprobado';
  if (/(^|\| )Estado:/.test(d)) return 'estado';
  return 'edicion';
}

// Cuando el técnico de la orden cambia, la línea dice de quién a quién ("Técnico: Sin asignar → GERARDO"): el evento se titula según lo que pasó, para
// que se vea cuándo y quién asignó la orden. Las entradas viejas solo traen el técnico nuevo ("Técnico: GERARDO") y quedan como "Cambio de técnico".
export const SIN_ASIGNAR = 'Sin asignar';
export const lineaTecnico = (antes, despues) => `Técnico: ${antes || SIN_ASIGNAR} → ${despues || SIN_ASIGNAR}`;

export function tituloDeAsignacion(lineas) {
  const m = lineas.map((l) => /^Técnico:\s*(.+?)\s*→\s*(.+)$/.exec(l)).find(Boolean);
  if (!m) return null;
  if (m[1] === SIN_ASIGNAR) return 'Orden asignada';
  if (m[2] === SIN_ASIGNAR) return 'Técnico retirado';
  return 'Orden reasignada';
}

// Más reciente primero. Incluye el evento "creada", que no vive en el historial.
export function construirLineaDeTiempo(ticket) {
  const eventos = (ticket?.historialEdiciones || []).map((e, i) => ({
    clave: `h-${i}`,
    tipo: clasificarEvento(e),
    fecha: e.fecha || '',
    operador: e.operador || '',
    lineas: String(e.detalle || '').split(' | ').map(l => l.trim()).filter(Boolean),
  })).map((ev) => (ev.tipo === 'tecnico' ? { ...ev, titulo: tituloDeAsignacion(ev.lineas) } : ev)).reverse();

  const fechaCreacion = ticket?.createdAt
    ? new Date(ticket.createdAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
    : (ticket?.fecha || '');
  eventos.push({
    clave: 'creada',
    tipo: 'creada',
    fecha: fechaCreacion,
    operador: ticket?.creado || '',
    lineas: [ticket?.codigo ? `Código ${ticket.codigo}` : 'Orden registrada'],
  });
  return eventos;
}
