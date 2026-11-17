import { Plug } from 'lucide-react';
import Aviso from './Aviso';
import { conceptoCobro, estaExonerado, monedaDe, textoMonto, tieneCobroFinal } from '../utils/cobro';

// Cobro resultante de una orden con cobro (visita de conector o instalación) ya finalizada: el monto se
// guarda al finalizar (aprobarFinalizarTicket / finalizarTicket). No renderiza
// nada antes de finalizar ni en otros casos.
export default function CobroAviso({ ticket, compact = false, className = '' }) {
  if (ticket?.estado !== 'FINALIZADO' || !tieneCobroFinal(ticket)) return null;
  const tipo = conceptoCobro(ticket);
  const titulo = estaExonerado(ticket)
    ? `${tipo}: visita exonerada, sin cobro al cliente.`
    : `${tipo}: cobro resultante al cliente ${textoMonto(ticket.cobroBs, monedaDe(ticket))}.`;
  return <Aviso nivel="info" icono={Plug} compact={compact} titulo={titulo} className={className} />;
}
