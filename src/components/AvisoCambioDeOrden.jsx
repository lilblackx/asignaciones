import { TriangleAlert } from 'lucide-react';

// La orden cambió mientras se tenía abierta (otra persona la finalizó, la canceló o el técnico la pre-finalizó): lo dice y el modal deja de
// dejar guardar. `texto` viene de cambioMientrasAbierta (utils/concurrencia); sin texto no se muestra.
export default function AvisoCambioDeOrden({ texto, className = '' }) {
  if (!texto) return null;
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-xl border-2 border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-900 dark:text-red-200 ${className}`}>
      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="leading-snug"><span className="font-black">Esta orden cambió mientras la tenías abierta.</span> {texto}</p>
    </div>
  );
}
