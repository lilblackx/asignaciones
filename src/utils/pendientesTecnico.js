import { faltaElPago } from './pagoCliente.js';
import { faltanDetalles } from './detallesOrden.js';

// Lo que le falta completar al técnico en una orden que ya se finalizó: el pago del cliente y/o los detalles (fotos, que solo se piden en las instalaciones). Una orden finalizada así sale de "Activas" para la oficina, pero para el técnico no: sigue en su lista, arriba de todas
// y con su etiqueta ("Falta: pago del cliente y fotos", ver components/FaltaPorCompletar), hasta que lo complete. No hay un aviso aparte arriba de la lista: ocupaba mucho espacio en la pantalla del técnico.
export function faltantesDelTecnico(ticket, opciones) {
  if (!ticket || ticket.estado !== 'FINALIZADO') return [];
  return [...(faltaElPago(ticket, opciones) ? ['PAGO'] : []), ...(faltanDetalles(ticket, opciones) ? ['DETALLES'] : [])];
}

export const esPendienteDelTecnico = (ticket, opciones) => faltantesDelTecnico(ticket, opciones).length > 0;

// "pago del cliente", "fotos" o "pago del cliente y fotos".
export const textoFaltante = (ticket, opciones) => faltantesDelTecnico(ticket, opciones).map((f) => (f === 'PAGO' ? 'pago del cliente' : 'fotos')).join(' y ');

// La versión corta para la etiqueta de la orden: "Falta pago", "Faltan fotos" o "Falta pago y fotos".
export function textoFaltanteCorto(ticket, opciones) {
  const f = faltantesDelTecnico(ticket, opciones);
  if (f.length === 0) return '';
  if (f.length === 2) return 'Falta pago y fotos';
  return f[0] === 'PAGO' ? 'Falta pago' : 'Faltan fotos';
}

// Las que le faltan completar van primero, sin cambiar el orden entre ellas ni el del resto.
export const pendientesDelTecnicoPrimero = (lista, opciones) => [...lista.filter((t) => esPendienteDelTecnico(t, opciones)), ...lista.filter((t) => !esPendienteDelTecnico(t, opciones))];
