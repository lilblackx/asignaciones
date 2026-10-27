import { Eye } from 'lucide-react';

// El ojito junto al nombre del cliente: abre el detalle de la orden (solo para mirar). Discreto: gris, y se marca al pasar el mouse.
export default function BotonVerDetalle({ ticket, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(ticket)}
      aria-label={`Ver detalle de la orden ${ticket.codigo || ''}`.trim()}
      title="Ver detalle de la orden"
      className="shrink-0 inline-flex items-center justify-center p-0.5 max-lg:min-w-11 max-lg:min-h-11 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 focus-visible:text-zinc-800 dark:focus-visible:text-white transition-colors"
    >
      <Eye className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
