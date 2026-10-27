import { TriangleAlert } from 'lucide-react';

// La orden cambió mientras se tenía abierta (otra persona la finalizó, la canceló o el técnico la pre-finalizó): lo dice y el modal deja de
// dejar guardar. `texto` viene de cambioMientrasAbierta (utils/concurrencia); sin texto no se muestra.
// En el encabezado fijo de la ventana (`encabezado`): solo texto, en rojo claro sobre el fondo negro, para que se vea siempre aunque se desplace el formulario.
export default function AvisoCambioDeOrden({ texto, encabezado = false, className = '' }) {
  if (!texto) return null;
  if (encabezado) {
    return (
      <p role="alert" className={`mt-1 flex items-start gap-1 text-[11px] max-lg:text-xs leading-snug text-red-300 ${className}`}>
        <TriangleAlert className="w-3 h-3 shrink-0 mt-px" aria-hidden="true" />
        <span><span className="font-bold">Esta orden cambió mientras la tenías abierta.</span> {texto}</span>
      </p>
    );
  }
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-xl border-2 border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-900 dark:text-red-200 ${className}`}>
      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="leading-snug"><span className="font-black">Esta orden cambió mientras la tenías abierta.</span> {texto}</p>
    </div>
  );
}
