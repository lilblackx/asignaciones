import { Ban } from 'lucide-react';
import { motivoCancelacion } from '../utils/cancelacion';

const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');

// Por qué se canceló la orden, en las listas y el detalle. No renderiza nada si la orden no está cancelada o es una de las
// canceladas antes de que se pidiera el motivo (esas no lo tienen).
export default function CancelacionAviso({ ticket, compact = false, className = '' }) {
  const motivo = motivoCancelacion(ticket);
  if (!motivo) return null;
  const quien = ticket.canceladaPor ? ` por ${ticket.canceladaPor}` : '';
  const cuando = !compact && ticket.canceladaEn ? ` · ${fechaHora(ticket.canceladaEn)}` : '';
  return (
    <div className={`rounded-lg border flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200 ${compact ? 'p-1.5 text-[10px]' : 'p-2.5 text-xs'} ${className}`}>
      <Ban className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} shrink-0 mt-px text-red-600 dark:text-red-400`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-black leading-tight">Cancelada{quien}{cuando}</p>
        <p className="leading-snug break-words whitespace-pre-wrap mt-0.5">{motivo}</p>
      </div>
    </div>
  );
}
