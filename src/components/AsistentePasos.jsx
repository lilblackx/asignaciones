import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Pasos from './Pasos';

// Carcasa de un asistente por pasos para cualquier ventana de la app: encabezado fijo, indicador de pasos, una indicación de qué hacer para seguir, el contenido de UN paso por vez (que entra deslizándose desde el lado hacia el que
// se avanza y arranca arriba del todo) y un pie fijo con los botones. Solo pone la estructura y la transición: qué pasos hay, cuándo se puede seguir y qué hace cada botón lo decide quien la usa (ver hooks/usePasosAsistente).
//   const nav = usePasosAsistente(['revisar', 'cobro', 'decision']);
//   <AsistentePasos pasos={[{ clave: 'revisar', etiqueta: 'Revisar' }, ...]} actual={nav.clave} encabezado={…} indicacion="…" pie={<BotonesPasos … />} clasePanel="max-w-3xl h-[min(92dvh,48rem)] …">{contenido del paso}</AsistentePasos>
// `pasos`: [{ clave, etiqueta }]; `actual`: la clave del paso visible; `hecho(clave)`: pasos ya completos (visto en el indicador); `onElegir(clave)`: hace clicable el indicador (saltar entre pasos); `bloqueo(clave)`: motivo por el que aún no se puede llegar a un paso ('' si se puede; ese paso se ve bloqueado); `encabezado`: lo de arriba, fijo;
// `indicacion`: la frase bajo el indicador ("Paso 2 de 3 · …" lo antepone la carcasa); `pie`: lo de abajo, fijo; `clasePanel`: tamaño, borde y colores del panel; `rol`, `ariaLabelledBy`: accesibilidad del diálogo.
// La barra de desplazamiento solo aparece cuando el paso no cabe de verdad. Si lo único que sobra es el margen de abajo del contenido (hasta TOLERANCIA_PX: los pasos llevan 16 px o más de margen abajo), no hay nada que
// desplazar y la barra sería ruido. Mide al abrir, al cambiar de paso, al cambiar el contenido y al cambiar el tamaño de la ventana.
const TOLERANCIA_PX = 16;

export default function AsistentePasos({ pasos, actual, hecho, onElegir, bloqueo, encabezado, indicacion, pie, clasePanel = '', rol = 'dialog', ariaLabelledBy, etiquetaPasos = 'Pasos', children }) {
  const indice = Math.max(0, pasos.findIndex((p) => p.clave === actual));
  const esUltimo = indice === pasos.length - 1;
  // La dirección de la transición se saca de cómo cambió el paso visible (se ajusta al dibujar, no en un efecto). El primer paso no se anima: la ventana ya tiene su propia entrada.
  const [vista, setVista] = useState({ indice: 0, direccion: 'adelante', animar: false });
  if (vista.indice !== indice) setVista({ indice, direccion: indice > vista.indice ? 'adelante' : 'atras', animar: true });
  const animacion = !vista.animar ? '' : vista.direccion === 'atras' ? 'animate-paso-atras' : 'animate-paso-adelante';
  // Cada paso nuevo arranca arriba del todo (también cuando se pasa solo).
  const zona = useRef(null);
  const [sinBarra, setSinBarra] = useState(false);
  useEffect(() => {
    const elemento = zona.current;
    if (!elemento) return undefined;
    const medir = () => setSinBarra(elemento.scrollHeight - elemento.clientHeight <= TOLERANCIA_PX);
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    if (elemento.firstElementChild) observador.observe(elemento.firstElementChild);
    return () => observador.disconnect();
  }, [actual]);
  const alMontarPaso = useCallback((elemento) => { elemento?.parentElement?.scrollTo({ top: 0 }); }, []);

  return (
    <div role={rol} aria-labelledby={ariaLabelledBy} className={`bg-card rounded-card shadow-2xl flex flex-col overflow-hidden ${clasePanel}`}>
      {encabezado}

      <div className="shrink-0 px-5 pt-3 pb-2.5 space-y-2">
        {pasos.length > 1 && <Pasos pasos={pasos} actual={indice} hecho={hecho} onElegir={onElegir} bloqueo={bloqueo} etiqueta={etiquetaPasos} />}
        {(indicacion || pasos.length > 1) && (
          <p role="status" className="text-xs text-zinc-700 dark:text-zinc-300 leading-snug">
            {pasos.length > 1 && <span className="font-black">{`Paso ${indice + 1} de ${pasos.length}${esUltimo ? ' (último)' : ''}`}</span>}{pasos.length > 1 && indicacion ? ' · ' : ''}{indicacion}
          </p>
        )}
      </div>

      <div ref={zona} className={`flex-1 min-h-0 overflow-x-hidden ${sinBarra ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
        <div key={actual} ref={alMontarPaso} className={animacion || undefined}>{children}</div>
      </div>

      {pie && <div className="shrink-0 px-5 py-3 bg-card border-t border-border space-y-2">{pie}</div>}
    </div>
  );
}

const TONOS = {
  verde: 'bg-emerald-700 hover:bg-emerald-800 text-white',
  azul: 'bg-blue-600 hover:bg-blue-700 text-white',
  rojo: 'bg-red-600 hover:bg-red-700 text-white',
  ambar: 'bg-amber-500 hover:bg-amber-400 text-black',
};
const TONOS_SECUNDARIA = {
  neutro: 'text-foreground hover:bg-secondary',
  rojo: 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30',
};
const BASE_SECUNDARIA = 'inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-boton text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

// El pie de siempre de un asistente: el botón principal a todo el ancho y, debajo, una fila de botones de texto con "Atrás" a la izquierda y la acción alterna a la derecha ("Hacerlo después", "Devolver"); con uno solo, va centrado.
// Una nota opcional, centrada, cierra el pie. Así nada tiene que alinearse con el botón principal.
// `siguiente`: { onClick, disabled?, titulo?, texto?, icono?, tono?: 'verde' | 'azul' | 'rojo' | 'ambar', ocupado? } o null si no hay botón principal. `onAnterior`: sin ella no hay "Atrás" (`textoAnterior` lo cambia: "Volver").
// `secundaria`: { texto, onClick, icono?, tono?: 'neutro' | 'rojo', disabled?, titulo? } o null. `nota`: texto explicativo de abajo.
export function BotonesPasos({ onAnterior = null, textoAnterior = 'Atrás', siguiente = null, secundaria = null, nota = '' }) {
  const Icono = siguiente && siguiente.icono !== undefined ? siguiente.icono : ArrowRight;
  const IconoSecundaria = secundaria?.icono;
  return (
    <div className="space-y-1.5">
      {siguiente && (
        <button type="button" onClick={siguiente.onClick} disabled={siguiente.disabled} title={siguiente.titulo} className={`w-full inline-flex items-center justify-center gap-2 h-11 max-lg:h-14 rounded-boton shadow-boton font-black text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${TONOS[siguiente.tono || 'verde']}`}>
          {siguiente.ocupado}{siguiente.texto || 'Siguiente'} {Icono && <Icono className="w-5 h-5" aria-hidden="true" />}
        </button>
      )}
      {(onAnterior || secundaria) && (
        <div className={`flex items-center ${onAnterior && secundaria ? 'justify-between' : 'justify-center'}`}>
          {onAnterior && (
            <button type="button" onClick={onAnterior} className={`${BASE_SECUNDARIA} ${TONOS_SECUNDARIA.neutro}`}>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {textoAnterior}
            </button>
          )}
          {secundaria && (
            <button type="button" onClick={secundaria.onClick} disabled={secundaria.disabled} title={secundaria.titulo} className={`${BASE_SECUNDARIA} ${TONOS_SECUNDARIA[secundaria.tono || 'neutro']}`}>
              {IconoSecundaria && <IconoSecundaria className="w-4 h-4" aria-hidden="true" />} {secundaria.texto}
            </button>
          )}
        </div>
      )}
      {nota && <p className="text-[11px] max-lg:text-xs text-muted-foreground text-center leading-snug">{nota}</p>}
    </div>
  );
}
