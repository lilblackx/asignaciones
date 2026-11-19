import { Wrench } from 'lucide-react';

// El comentario que dejó el técnico al pre-finalizar (`observacionTecnico`), en la lista de órdenes: una cita suave con su nombre, aparte de los avisos de arriba (devolución, consulta de cobro),
// para que no se confunda con ellos. `compact` (la tabla): letra de 12 px y hasta tres líneas, con el texto completo al pasar el cursor.
export default function NotaTecnico({ texto, compact = false, className = '' }) {
  if (!texto) return null;
  return (
    <div className={`rounded-campo bg-secondary/60 flex items-start gap-2 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} ${className}`} title={compact ? `Nota del técnico: ${texto}` : undefined}>
      <Wrench className={`${compact ? 'w-3 h-3 mt-0.5' : 'w-4 h-4 mt-0.5'} shrink-0 text-muted-foreground`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-muted-foreground leading-tight">Nota del técnico</p>
        <p className={`${compact ? 'text-xs line-clamp-3' : 'text-sm'} text-card-foreground leading-snug break-words mt-0.5`}>{texto}</p>
      </div>
    </div>
  );
}
