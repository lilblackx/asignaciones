import { useEffect, useState } from 'react';

// La hora actual (ms), que se refresca sola cada minuto: para que lo que depende de "ahora" (tramos activos, esperas) no quede viejo.
export function useAhora(intervaloMs = 60000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}
