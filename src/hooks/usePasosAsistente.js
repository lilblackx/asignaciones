import { useState } from 'react';

// La navegación de un asistente por pasos (ver components/AsistentePasos): qué paso se ve y cómo ir al siguiente, al anterior o a uno en concreto.
//   const nav = usePasosAsistente(['cobro', 'pago', 'detalles'], (clave) => clave === 'pago' && !pidePago);
// `claves`: los pasos en orden (los que aplican a esta pantalla; deben ser los mismos mientras está abierta). `hecho(clave)`: si un paso ya se completó y debe saltarse (al seguir o al volver).
// Devuelve { clave, indice, total, esUltimo, hayAnterior, siguiente(), anterior(), ir(clave) }: `clave` es el paso visible.
export function usePasosAsistente(claves, hecho = () => false) {
  const [elegido, setElegido] = useState(0);
  const ultimo = Math.max(0, claves.length - 1);
  // El paso visible: el elegido, saltando los ya hechos (al registrar el pago, por ejemplo, se pasa solo al siguiente).
  let indice = Math.min(elegido, ultimo);
  while (indice < ultimo && hecho(claves[indice])) indice += 1;
  let previo = -1;
  for (let i = indice - 1; i >= 0; i -= 1) {
    if (!hecho(claves[i])) { previo = i; break; }
  }
  return {
    clave: claves[indice],
    indice,
    total: claves.length,
    esUltimo: indice === ultimo,
    hayAnterior: previo >= 0,
    siguiente: () => setElegido(Math.min(indice + 1, ultimo)),
    anterior: () => { if (previo >= 0) setElegido(previo); },
    ir: (clave) => { const i = claves.indexOf(clave); if (i >= 0) setElegido(i); },
  };
}
