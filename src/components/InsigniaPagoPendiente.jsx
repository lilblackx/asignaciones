import { Clock } from 'lucide-react';

// "Pago pendiente": el cliente de esta orden todavía no pagó y el pago está en Administración (ver utils/pagoCliente). Informativa, para el técnico y la oficina; mismo tamaño que las demás etiquetas.
// `pagosPendientes`: el conjunto de ids de las órdenes con pago pendiente de cobro.
export default function InsigniaPagoPendiente({ ticket, pagosPendientes }) {
  if (!ticket?.id || !pagosPendientes?.has(ticket.id)) return null;
  return (
    <span title="El cliente aún no pagó: el pago está en Administración." className="inline-flex items-center gap-1 text-[11px] max-lg:text-xs font-black px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
      <Clock className="w-2.5 h-2.5" aria-hidden="true" /> Pago pendiente
    </span>
  );
}
