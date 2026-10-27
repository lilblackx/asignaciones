import { Banknote, Hourglass } from 'lucide-react';
import { consultaCobroDe, consultaPendiente, respuestaVigente, textoRespuesta } from '../utils/consultaCobro';

// Estado de la consulta del cobro de un recableado, para la lista de órdenes: pendiente (la oficina aún no responde) o con la
// respuesta. Con `onResponder` (oficina) la consulta pendiente trae el botón para responderla. No renderiza nada si el técnico
// no consultó, ni cuando la orden ya se cerró (el cobro final lo muestra CobroAviso).
export default function ConsultaCobroAviso({ ticket, compact = false, onResponder, className = '' }) {
  if (!['PENDIENTE', 'PRE-FINALIZADO'].includes(ticket?.estado)) return null;
  const consulta = consultaCobroDe(ticket);
  if (!consulta) return null;
  const respuesta = respuestaVigente(ticket);
  const pendiente = consultaPendiente(ticket);
  const icono = compact ? 'w-3 h-3' : 'w-4 h-4';
  const base = `rounded-lg border flex items-start gap-2 ${compact ? 'p-1.5 text-[11px] max-lg:text-xs' : 'p-2.5 text-xs'} ${className}`;

  if (respuesta) {
    return (
      <div className={`${base} bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/50 text-sky-900 dark:text-sky-200`}>
        <Banknote className={`${icono} shrink-0 mt-px text-sky-600 dark:text-sky-400`} aria-hidden="true" />
        <p className="font-bold leading-snug min-w-0 break-words">
          Cobro del recableado ({respuesta.metros} m): <span className="font-black">{textoRespuesta(respuesta)}</span>
        </p>
      </div>
    );
  }

  return (
    <div className={`${base} bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200`}>
      <Hourglass className={`${icono} shrink-0 mt-px text-amber-600 dark:text-amber-400`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-black leading-snug break-words">
          {onResponder ? `${ticket.tecnico || 'El técnico'} pregunta el cobro del recableado (${consulta.metros} m)` : `Consulta de cobro enviada (${consulta.metros} m): esperando a la oficina`}
        </p>
        {pendiente && onResponder && (
          <button
            type="button"
            onClick={() => onResponder(ticket)}
            className={`mt-1.5 inline-flex items-center justify-center gap-1 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-black transition-colors ${compact ? 'px-2 py-1 text-[11px] max-lg:text-xs' : 'px-3 py-2 text-xs min-h-[40px]'}`}
          >
            <Banknote className={icono} aria-hidden="true" /> Responder cobro
          </button>
        )}
      </div>
    </div>
  );
}
