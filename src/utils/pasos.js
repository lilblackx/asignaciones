// Reglas comunes de los asistentes por pasos de la app (ver components/AsistentePasos y hooks/usePasosAsistente).

// ¿Se puede llegar al paso `destino` desde el `actual`? Hacia atrás siempre. Hacia adelante solo si todos los pasos del camino (el actual incluido) tienen lo obligatorio cumplido: devuelve el motivo del primero que no, o ''
// si se puede. `motivoDe(clave)`: el motivo por el que ese paso no deja seguir, o ''. Vale tanto para el botón "Siguiente" como para saltar con el indicador de pasos.
export function motivoNoSePuedeLlegar(claves, actual, destino, motivoDe) {
  const desde = claves.indexOf(actual);
  const hasta = claves.indexOf(destino);
  if (desde < 0 || hasta <= desde) return '';
  for (let i = desde; i < hasta; i += 1) {
    const motivo = motivoDe(claves[i]);
    if (motivo) return motivo;
  }
  return '';
}
