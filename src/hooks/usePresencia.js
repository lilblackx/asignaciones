import { useEffect, useState } from 'react';

// Las salidas animadas valen en celular y en PC, salvo con "reducir movimiento": en ese caso el elemento se quita al instante,
// sin quedarse a la vista unos milisegundos sin animación.
export const salidaAnimada = () => typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

// Lo que tarda en plegarse un <Colapsable>; quien quita el contenido de verdad espera este tiempo.
export const DURACION_PLIEGUE_MS = 200;

// Mantiene montado un elemento condicional mientras dura su animación de salida. `visible` es la condición de siempre;
// `montado` es lo que se debe renderizar y `saliendo` indica si hay que aplicar la clase de salida.
export function usePresencia(visible, duracionMs = 150) {
  const [montado, setMontado] = useState(visible);
  const anima = salidaAnimada();
  if (visible && !montado) setMontado(true);
  else if (!visible && montado && !anima) setMontado(false);

  const saliendo = montado && !visible;
  useEffect(() => {
    if (!saliendo) return;
    const id = setTimeout(() => setMontado(false), duracionMs);
    return () => clearTimeout(id);
  }, [saliendo, duracionMs]);

  return { montado: visible || montado, saliendo };
}
