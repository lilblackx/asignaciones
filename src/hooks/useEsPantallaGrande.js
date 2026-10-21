import { useEffect, useState } from 'react';

// ¿La pantalla es de PC (1024 px o más)? Se actualiza si cambia el tamaño de la ventana.
const CONSULTA = '(min-width: 1024px)';
export function useEsPantallaGrande() {
  const [grande, setGrande] = useState(() => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches);
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const alCambiar = () => setGrande(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return grande;
}
