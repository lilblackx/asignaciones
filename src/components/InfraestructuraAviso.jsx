import { HardHat } from 'lucide-react';
import Aviso from './Aviso';
import { enInfraestructura, infraestructuraDe, textoOrigen } from '../utils/infraestructura';

// Aviso en la lista de la oficina: la orden está esperando a infraestructura, con el motivo. Con `onResolver` trae el botón para
// decidir cómo sigue. No renderiza nada si la orden no está esperando (ver utils/infraestructura).
export default function InfraestructuraAviso({ ticket, compact = false, onResolver, className = '' }) {
  if (!enInfraestructura(ticket)) return null;
  const infra = infraestructuraDe(ticket);

  return (
    <Aviso
      nivel="atencion"
      icono={HardHat}
      compact={compact}
      titulo={`En infraestructura · la escaló ${textoOrigen(infra)}`}
      accion={onResolver ? { etiqueta: 'Resolver', icono: HardHat, onClick: () => onResolver(ticket) } : null}
      className={className}
    >
      {infra.motivo}
    </Aviso>
  );
}
