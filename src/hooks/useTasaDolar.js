import { useCallback, useEffect, useState } from 'react';
import { parseTasaDolar } from '../utils/finanzas';

// DolarApi.com: tasa oficial del BCV para el dólar (la app ya usa este proveedor para el euro, ver useTasaBcv). https://dolarapi.com/docs/venezuela/
const API_TASA_USD_BCV = 'https://ve.dolarapi.com/v1/dolares/oficial';

// La tasa BCV del dólar (bolívares por dólar) para mostrar en bolívares lo que se le paga a los técnicos. Se pide al abrir y con `actualizar`.
// { tasa, fecha (ms de la última actualización del BCV) | null, cargando, error }
export function useTasaDolar() {
  const [estado, setEstado] = useState({ tasa: null, fecha: null, cargando: true, error: false });

  const actualizar = useCallback(async () => {
    setEstado((e) => ({ ...e, cargando: true }));
    try {
      const respuesta = await fetch(API_TASA_USD_BCV);
      if (!respuesta.ok) throw new Error(`La API respondió ${respuesta.status}`);
      const dato = parseTasaDolar(await respuesta.json());
      if (!dato) throw new Error('La API no trajo una tasa usable');
      setEstado({ ...dato, cargando: false, error: false });
    } catch (error) {
      console.error('No se pudo obtener la tasa BCV del dólar:', error);
      // Si ya había una tasa se conserva (se avisa que no se pudo actualizar); si no, no hay bolívares que mostrar.
      setEstado((e) => ({ ...e, cargando: false, error: true }));
    }
  }, []);

  useEffect(() => {
    // Se pide al abrir; setEstado ocurre tras la respuesta, no durante el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    actualizar();
  }, [actualizar]);

  return { ...estado, actualizar };
}
