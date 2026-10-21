import { useEffect } from 'react';
import { usePreferencia } from './usePreferencia';

// El tamaño de letra de la pantalla de Finanzas: cambia el tamaño base (todo lo que está en rem se agranda junto: textos, botones y espacios) y se recuerda en este equipo.
// Al salir de Finanzas se devuelve el tamaño normal del navegador.
export const NIVELES = [
  { id: 'normal', texto: 'Normal', porcentaje: 100, muestra: 'text-sm' },
  { id: 'grande', texto: 'Grande', porcentaje: 110, muestra: 'text-lg' },
  { id: 'muygrande', texto: 'Muy grande', porcentaje: 120, muestra: 'text-2xl' },
];

export function useTamanoLetra() {
  const [nivel, setNivel] = usePreferencia('finanzas:tamano2', 'normal', (v) => IDS.includes(v));
  useEffect(() => {
    const raiz = document.documentElement;
    const anterior = raiz.style.fontSize;
    raiz.style.fontSize = `${NIVELES.find((n) => n.id === nivel).porcentaje}%`;
    return () => { raiz.style.fontSize = anterior; };
  }, [nivel]);
  return [nivel, setNivel];
}

const IDS = NIVELES.map((n) => n.id);
