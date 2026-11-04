// La observación que escribe la oficina en una orden puede estar marcada como "interna": no sale en la plantilla de WhatsApp al cliente y
// el técnico tampoco la ve. Solo se muestra al técnico la que NO está marcada. Una orden vieja sin la marca cuenta como interna, igual que la
// casilla del formulario de edición y que la plantilla de WhatsApp (observacionInterna !== false).
// OJO: esto oculta el texto en las pantallas del técnico; la orden en sí llega completa a su teléfono (ver la nota de la prueba).
export const observacionEsInterna = (ticket) => ticket?.observacionInterna !== false;

// El texto de la observación de la oficina que puede ver el técnico ('' si no hay o es interna).
export const observacionParaTecnico = (ticket) => {
  if (observacionEsInterna(ticket)) return '';
  return String(ticket?.observacion ?? '').trim();
};
