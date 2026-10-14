import { useCallback, useEffect, useState } from 'react';

// Copiar con aviso: `onCopy(texto, mensaje)` es el copiado de la app (copia y avisa con un mensaje; devuelve si
// pudo). `copiado` es el id de lo último que se copió: su botón muestra un visto durante un momento y vuelve
// a ser el de copiar. Lo usan todas las pantallas con botones de copiar (ver components/BotonCopiar).
const MOSTRAR_VISTO_MS = 1500;

export function useCopiado(onCopy) {
  const [copiado, setCopiado] = useState(null);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(null), MOSTRAR_VISTO_MS);
    return () => clearTimeout(t);
  }, [copiado]);

  const copiar = useCallback(async (id, texto, mensaje) => {
    const ok = Boolean(await onCopy?.(texto, mensaje));
    if (ok) setCopiado(id);
    return ok;
  }, [onCopy]);

  return { copiado, copiar };
}
