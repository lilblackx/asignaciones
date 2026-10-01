// main.jsx avisa acá cuando el Service Worker detecta una versión nueva y
// UpdatePrompt (React) se suscribe para mostrar el aviso con el botón.
let disponible = false;
let aplicar = () => {};
const oyentes = new Set();

export function setUpdateAvailable(fnAplicar) {
  disponible = true;
  aplicar = fnAplicar;
  oyentes.forEach((fn) => fn());
}

// updateSW(true) normalmente recarga solo cuando el SW nuevo toma el control.
// Si no lo hizo tras unos segundos, se recarga a la fuerza para no dejar el
// botón colgado en "Actualizando…".
export function aplicarActualizacion() {
  aplicar();
  setTimeout(() => window.location.reload(), 3000);
}
export const hayActualizacion = () => disponible;
export function suscribirActualizacion(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
