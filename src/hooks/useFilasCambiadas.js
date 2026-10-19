import { useEffect, useRef, useState } from 'react';

const DURACION_DESTELLO_MS = 1800;

// Los ids de las órdenes que acaban de cambiar (o llegar nuevas) por el tiempo real, durante lo que dura el destello de su fila.
// La primera lectura solo fija el punto de partida: lo que ya estaba al abrir la app no destella.
export function useFilasCambiadas(tickets, cargados) {
  const [cambiadas, setCambiadas] = useState(() => new Set());
  const firmasRef = useRef(null);
  const temporizadoresRef = useRef(new Map());

  useEffect(() => {
    if (!cargados) return;
    const firmas = new Map(tickets.map((t) => [t.id, JSON.stringify(t)]));
    const anteriores = firmasRef.current;
    firmasRef.current = firmas;
    if (!anteriores) return;

    const ids = [];
    firmas.forEach((firma, id) => {
      if (anteriores.get(id) !== firma) ids.push(id);
    });
    if (ids.length === 0) return;

    setCambiadas((previas) => new Set([...previas, ...ids]));
    ids.forEach((id) => {
      clearTimeout(temporizadoresRef.current.get(id));
      temporizadoresRef.current.set(id, setTimeout(() => {
        temporizadoresRef.current.delete(id);
        setCambiadas((previas) => {
          const siguientes = new Set(previas);
          siguientes.delete(id);
          return siguientes;
        });
      }, DURACION_DESTELLO_MS));
    });
  }, [tickets, cargados]);

  useEffect(() => {
    const temporizadores = temporizadoresRef.current;
    return () => temporizadores.forEach(clearTimeout);
  }, []);

  return cambiadas;
}
