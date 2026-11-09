import { RENOVAR_CADA_MS, debeRenovar } from '../utils/avisoDeOrden.js';

// Mantiene vivo el aviso de "estoy revisando esta orden": lo deja al empezar y lo renueva cada RENOVAR_CADA_MS, pero solo mientras la pestaña se vea y la persona haga algo (ver debeRenovar). Si se deja de
// renovar, el aviso vence solo y se vuelve a dejar apenas la persona vuelve (`actividad`). Todo lo que toca el navegador entra por parámetro para poder probarlo sin él:
//   ahora() -> ms · visible() -> bool · cada(fn, ms) -> función que lo detiene · dejar() -> escribe el aviso
export function crearRenovador({ ahora, visible, cada, dejar }) {
  let ultimaActividad = ahora();
  let ultimoAviso = 0;
  let pausado = false;
  const avisar = () => { ultimoAviso = ahora(); dejar(); };
  avisar();
  const detener = cada(() => {
    if (!debeRenovar({ visible: visible(), ultimaActividad, ahora: ahora() })) { pausado = true; return; }
    // Si justo se acaba de dejar el aviso (al volver de una pausa), no se repite.
    if (ahora() - ultimoAviso >= RENOVAR_CADA_MS / 2) avisar();
  }, RENOVAR_CADA_MS);
  return {
    // La persona hizo algo o volvió a ver la pestaña: si se había dejado de renovar, el aviso se deja de nuevo ya.
    actividad() {
      ultimaActividad = ahora();
      if (pausado && visible()) { pausado = false; avisar(); }
    },
    detener,
  };
}
