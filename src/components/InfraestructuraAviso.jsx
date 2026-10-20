import { HardHat } from 'lucide-react';
import { enInfraestructura, infraestructuraDe, textoOrigen } from '../utils/infraestructura';

// Aviso en la lista de la oficina: la orden está esperando a infraestructura, con el motivo. Con `onResolver` trae el botón para
// decidir cómo sigue. No renderiza nada si la orden no está esperando (ver utils/infraestructura).
export default function InfraestructuraAviso({ ticket, compact = false, onResolver, className = '' }) {
  if (!enInfraestructura(ticket)) return null;
  const infra = infraestructuraDe(ticket);
  const icono = compact ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div className={`rounded-lg border flex items-start gap-2 bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-900/60 text-orange-900 dark:text-orange-200 ${compact ? 'p-1.5 text-[10px]' : 'p-2.5 text-xs'} ${className}`}>
      <HardHat className={`${icono} shrink-0 mt-px text-orange-600 dark:text-orange-400`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-black leading-snug">En infraestructura <span className="font-bold">· la escaló {textoOrigen(infra)}</span></p>
        <p className="leading-snug break-words whitespace-pre-wrap mt-0.5">{infra.motivo}</p>
        {onResolver && (
          <button
            type="button"
            onClick={() => onResolver(ticket)}
            className={`mt-1.5 inline-flex items-center justify-center gap-1 rounded-md bg-orange-500 hover:bg-orange-400 text-black font-black transition-colors ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs min-h-[40px]'}`}
          >
            <HardHat className={icono} aria-hidden="true" /> Resolver
          </button>
        )}
      </div>
    </div>
  );
}
