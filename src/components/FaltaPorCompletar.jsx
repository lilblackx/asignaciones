import { AlertCircle } from 'lucide-react';
import { esPendienteDelTecnico, textoFaltante, textoFaltanteCorto } from '../utils/pendientesTecnico';

// Etiqueta de la tarjeta (o la fila) de una orden finalizada a la que le falta el pago del cliente o las fotos: "Falta pago", "Faltan fotos" o "Falta pago y fotos".
// Va en el tono suave de los avisos (ámbar claro con texto ámbar oscuro), en una sola línea, junto al estado FINALIZADO en vez de un bloque sólido. Para los lectores de pantalla
// lleva la frase completa ("Falta: pago del cliente y fotos"). Solo para el técnico; sin pendiente no pinta nada.
export function EtiquetaFalta({ texto, completo, className = '' }) {
  return (
    <span
      title={completo}
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] max-lg:text-xs font-bold leading-tight pl-1.5 pr-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300 ${className}`}
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span aria-hidden="true">{texto}</span>
      <span className="sr-only">{completo}</span>
    </span>
  );
}

export default function FaltaPorCompletar({ ticket, className = '' }) {
  if (!esPendienteDelTecnico(ticket)) return null;
  return <EtiquetaFalta texto={textoFaltanteCorto(ticket)} completo={`Falta: ${textoFaltante(ticket)}`} className={className} />;
}
