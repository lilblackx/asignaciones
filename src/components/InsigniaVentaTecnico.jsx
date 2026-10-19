import { Star } from 'lucide-react';
import { esInstalacion } from '../utils/instalacion';
import { esVentaDelTecnico } from '../utils/tecnicoVenta';

// Marca discreta de una instalación que vendió el propio técnico (venía en la plantilla y sigue asignada a él): "Tu venta" para el
// técnico y "Venta" para la oficina. Mismo tamaño y estilo que la etiqueta del tipo de trabajo (sin borde) para que queden alineadas. La estrella es la misma del aviso verde al crear la orden. No dice nada del pago.
export default function InsigniaVentaTecnico({ ticket, paraTecnico = false }) {
  if (!esInstalacion(ticket?.tipoTrabajo) || !esVentaDelTecnico(ticket.ventaTecnico, ticket.tecnico)) return null;
  const ayuda = paraTecnico ? 'Esta venta la trajiste tú.' : `Venta traída por ${ticket.tecnico}.`;
  return (
    <span title={ayuda} aria-label={ayuda} className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
      <Star className="w-2.5 h-2.5 fill-current" aria-hidden="true" /> {paraTecnico ? 'Tu venta' : 'Venta'}
    </span>
  );
}
