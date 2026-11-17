import { TriangleAlert } from 'lucide-react';
import Aviso from './Aviso';

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
  return <Aviso nivel="error" role="alert" icono={TriangleAlert} titulo="Esta orden cambió mientras la tenías abierta." className={className}>{texto}</Aviso>;
}
