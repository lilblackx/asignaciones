import { useEffect, useState } from 'react';

// La hora actual, refrescada cada `cadaMs`: así lo que depende del reloj ("hace 5 min", un "en camino"
// que caduca) se actualiza solo, sin esperar a que cambie algo en las órdenes.
export function useAhora(cadaMs = 60000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}
