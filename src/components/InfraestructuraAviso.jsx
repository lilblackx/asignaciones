import { ChevronDown, HardHat } from 'lucide-react';
import Aviso from './Aviso';
import { enInfraestructura, infraestructuraDe, textoOrigen } from '../utils/infraestructura';

// La orden está esperando a infraestructura, con el motivo. Con `onResolver` (oficina) trae el botón para decidir cómo sigue.
// No renderiza nada si la orden no está esperando (ver utils/infraestructura).

const accionResolver = (ticket, onResolver) => (onResolver ? { etiqueta: 'Resolver', icono: HardHat, onClick: () => onResolver(ticket) } : null);

// En la tabla de PC la escalada es una marca pequeña en la columna Nombre que despliega su detalle (ver DetalleInfraestructura) en una franja bajo la fila.
export function MarcaInfraestructura({ ticket, abierto, onAlternar, id }) {
  if (!enInfraestructura(ticket)) return null;
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-expanded={abierto}
      aria-controls={id}
      title={abierto ? 'Ocultar el detalle de infraestructura' : 'Ver el detalle de infraestructura'}
      className="mt-1 inline-flex items-center gap-1 self-start rounded-md border border-orange-300 dark:border-orange-900/60 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 text-xs font-bold text-orange-900 dark:text-orange-200 transition-colors hover:bg-orange-100 dark:hover:bg-orange-950/50"
    >
      <HardHat className="w-3 h-3" aria-hidden="true" /> En infraestructura
      <ChevronDown className={`w-3 h-3 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
  );
}

// La franja de detalle de la tabla: quién la escaló, el motivo y, para la oficina, el botón Resolver, a todo el ancho.
export function DetalleInfraestructura({ ticket, id, onResolver }) {
  if (!enInfraestructura(ticket)) return null;
  const infra = infraestructuraDe(ticket);
  return (
    <div id={id}>
      <Aviso nivel="atencion" icono={HardHat} titulo={`En infraestructura · la escaló ${textoOrigen(infra)}`} accion={accionResolver(ticket, onResolver)}>
        {infra.motivo}
      </Aviso>
    </div>
  );
}

export default function InfraestructuraAviso({ ticket, compact = false, onResolver, className = '' }) {
  if (!enInfraestructura(ticket)) return null;
  const infra = infraestructuraDe(ticket);

  return (
    <Aviso
      nivel="atencion"
      icono={HardHat}
      compact={compact}
      titulo={`En infraestructura · la escaló ${textoOrigen(infra)}`}
      accion={accionResolver(ticket, onResolver)}
      className={className}
    >
      {infra.motivo}
    </Aviso>
  );
}
