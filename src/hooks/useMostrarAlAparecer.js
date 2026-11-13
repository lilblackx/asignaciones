import { useCallback } from 'react';
import { DURACION_PLIEGUE_MS, salidaAnimada } from './usePresencia';

// Cuando un campo nuevo aparece más abajo (dentro de un <Colapsable>, al pulsar "El cliente paga después" o "Devolver"), la pantalla baja suave hasta mostrarlo completo. Es la `ref` del bloque que aparece:
//   const mostrar = useMostrarAlAparecer({ margenInferior: 80, enfocar: 'motivo' });  ...  <div ref={mostrar}>…</div>
// Espera a que termine de desplegarse (en PC; en el celular aparece de golpe) y después baja. Con "reducir movimiento" baja sin animación.
// `margenInferior`: píxeles que deja libres abajo, para una barra de botones fija que tape el final del bloque. `enfocar`: el id de un campo del bloque al que se le da el foco al terminar, sin que el foco mueva la pantalla.
export function useMostrarAlAparecer({ margenInferior = 0, enfocar = '' } = {}) {
  return useCallback((bloque) => {
    if (!bloque) return;
    const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      if (!bloque.isConnected) return;
      bloque.style.scrollMarginBottom = `${margenInferior}px`;
      bloque.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'nearest' });
      if (enfocar) document.getElementById(enfocar)?.focus({ preventScroll: true });
    }, salidaAnimada() ? DURACION_PLIEGUE_MS + 20 : 30);
  }, [margenInferior, enfocar]);
}
