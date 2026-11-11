import { Route } from 'lucide-react';
import Boton from './Boton';

// El atajo a la Ruta del día, en la fila del chip del técnico (ver TechnicianWorkload): "Ruta · 7" (las paradas que tiene hoy).
export default function BotonRuta({ cantidad, onClick }) {
  return (
    <Boton variante="secundario" tamano="compacto" icono={Route} onClick={onClick} aria-label={`Ruta del día: ${cantidad} ${cantidad === 1 ? 'parada' : 'paradas'}`} title="Ver mi ruta de hoy">
      Ruta · {cantidad}
    </Boton>
  );
}
