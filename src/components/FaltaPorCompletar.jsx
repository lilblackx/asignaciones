import { AlertCircle } from 'lucide-react';
import { esPendienteDelTecnico, textoFaltante } from '../utils/pendientesTecnico';

// Etiqueta ámbar de la tarjeta (o la fila) de una orden finalizada a la que le falta el pago del cliente o las fotos: "Falta: pago del cliente y fotos". Solo para el técnico; sin pendiente no pinta nada.
export default function FaltaPorCompletar({ ticket, className = '' }) {
  if (!esPendienteDelTecnico(ticket)) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] max-lg:text-xs font-black leading-tight px-2 py-0.5 rounded bg-amber-400 text-black ${className}`}>
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Falta: {textoFaltante(ticket)}
    </span>
  );
}
