import { Undo2 } from 'lucide-react';
import { devolucionPendiente } from '../utils/devolucion';

// Aviso para el técnico: el admin devolvió la orden con un motivo y todavía no
// la vuelve a pre-finalizar. No renderiza nada si la orden no tiene devolución vigente.
export default function DevolucionAviso({ ticket, compact = false, className = '' }) {
  const devolucion = devolucionPendiente(ticket);
  if (!devolucion) return null;

  return (
    <div role="alert" className={`bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-red-800 dark:text-red-200 flex items-start gap-2 ${compact ? 'p-1.5 text-[10px]' : 'p-2.5 text-xs'} ${className}`}>
      <Undo2 className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} shrink-0 mt-px text-red-600 dark:text-red-400`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-black leading-tight">
          Devuelta{devolucion.operador ? ` por ${devolucion.operador}` : ''}{devolucion.fecha && !compact ? ` · ${devolucion.fecha}` : ''}
        </p>
        {devolucion.motivo && <p className="leading-snug break-words whitespace-pre-wrap mt-0.5">{devolucion.motivo}</p>}
      </div>
    </div>
  );
}
