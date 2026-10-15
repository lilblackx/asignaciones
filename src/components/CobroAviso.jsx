import { Plug } from 'lucide-react';
import { conceptoCobro, estaExonerado, monedaDe, textoMonto, tieneCobroFinal } from '../utils/cobro';

// Cobro resultante de una orden con cobro (visita de conector o instalación) ya finalizada: el monto se
// guarda al finalizar (aprobarFinalizarTicket / finalizarTicket). No renderiza
// nada antes de finalizar ni en otros casos.
export default function CobroAviso({ ticket, compact = false, className = '' }) {
  if (ticket?.estado !== 'FINALIZADO' || !tieneCobroFinal(ticket)) return null;
  const tipo = conceptoCobro(ticket);

  return (
    <div className={`bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-lg text-sky-900 dark:text-sky-200 flex items-start gap-2 ${compact ? 'p-1.5 text-[10px]' : 'p-2.5 text-xs'} ${className}`}>
      <Plug className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} shrink-0 mt-px text-sky-600 dark:text-sky-400`} aria-hidden="true" />
      {estaExonerado(ticket)
        ? <p className="font-bold leading-snug">{tipo}: visita exonerada, <span className="font-black">sin cobro al cliente</span>.</p>
        : <p className="font-bold leading-snug">{tipo}: cobro resultante al cliente <span className="font-black">{textoMonto(ticket.cobroBs, monedaDe(ticket))}</span>.</p>}
    </div>
  );
}
