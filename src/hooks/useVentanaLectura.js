import { useState } from 'react';
import { ensancharRango } from '../utils/periodoReporte';

// La ventana de fechas que una pantalla lee de Firestore mientras está `activa`: empieza siendo el periodo que se elige y solo crece (la unión de todos los que se fueron eligiendo), nunca se encoge.
// Así pasar a un periodo más corto, o volver a uno ya visto, no cambia lo que se lee y Firestore no vuelve a cobrar todos sus documentos; la pantalla filtra el periodo elegido de lo leído.
// Al quedar inactiva (otra sección, otro modo) se olvida y la próxima vez empieza de nuevo. Devuelve { desde, hasta } (días 'AAAA-MM-DD') o null si no está activa.
export function useVentanaLectura(rango, activa = true) {
  const [ventana, setVentana] = useState(null);
  if (!activa) {
    if (ventana) setVentana(null);
    return null;
  }
  const nueva = ensancharRango(ventana, rango);
  if (!ventana || nueva.desde !== ventana.desde || nueva.hasta !== ventana.hasta) {
    setVentana(nueva);
    return nueva;
  }
  return ventana;
}
