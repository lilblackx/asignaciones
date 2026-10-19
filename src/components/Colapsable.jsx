import { useState } from 'react';
import { DURACION_PLIEGUE_MS, usePresencia } from '../hooks/usePresencia';

// Envuelve algo que aparece y desaparece dentro del flujo de la página (un aviso, una sección desplegable de un formulario): al aparecer se
// despliega y al irse se pliega, para que lo de abajo no salte de golpe. Sin contenido (null / false) se va; mientras sale conserva el
// último contenido que tuvo. Con `animarAlMontar={false}` lo que ya está al montarse (las filas iniciales de un formulario) no se anima.
// El contenido solo se recorta mientras
// dura la animación (index.css), para no cortar los aros de foco ni las sombras de lo que hay dentro cuando está quieto.
export default function Colapsable({ children, animarAlMontar = true }) {
  const { montado, saliendo } = usePresencia(Boolean(children), DURACION_PLIEGUE_MS);
  const [ultimo, setUltimo] = useState(children);
  if (children && children !== ultimo) setUltimo(children);

  if (!montado) return null;
  return (
    <div className={`grid grid-rows-[1fr] ${saliendo ? 'colapsable-salida lg:animate-aviso-salida' : animarAlMontar ? 'colapsable-entrada lg:animate-aviso-entrada' : ''}`}>
      <div className="min-h-0">{children || ultimo}</div>
    </div>
  );
}
