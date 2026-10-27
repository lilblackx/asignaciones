import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { usePresencia } from '../hooks/usePresencia';
import { claseBoton } from './estilos';

const ANCHO_PANEL = 288;
const MARGEN = 8;

// Un desplegable con casillas: el botón dice el resumen de lo que está marcado y el panel lista las opciones permitidas con su casilla.
//   resumen: el texto del botón (p. ej. "Puede cerrar" o "Sin permisos").
//   opciones: [{ clave, etiqueta, ayuda?, marcado, deshabilitado?, onCambiar(nuevoValor) }]: las casillas.
//   acciones: [{ clave, etiqueta, detalle?, onClick }]: filas sin casilla que abren una edición (p. ej. los nombres de la plantilla).
//   vacio: texto del panel cuando no hay nada que elegir; con `opciones` y `acciones` vacías el botón queda deshabilitado.
// El panel va en un portal con posición fija, para que no lo recorte la tarjeta que lo contiene.
export default function MenuPermisos({ resumen, opciones = [], acciones = [], ariaLabel, deshabilitado = false, vacio = 'Este rol no tiene permisos que elegir.' }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const [destino, setDestino] = useState(null);
  const boton = useRef(null);
  const panel = useRef(null);
  const id = useId();
  const { montado, saliendo } = usePresencia(abierto, 120);
  const sinNada = opciones.length === 0 && acciones.length === 0;

  const colocar = useCallback(() => {
    if (!boton.current) return;
    const r = boton.current.getBoundingClientRect();
    const ancho = Math.min(ANCHO_PANEL, window.innerWidth - MARGEN * 2);
    const izquierda = Math.min(Math.max(MARGEN, r.left), window.innerWidth - ancho - MARGEN);
    const abajo = window.innerHeight - r.bottom;
    const arriba = abajo < 220 && r.top > abajo;
    setPos({ left: izquierda, width: ancho, ...(arriba ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  }, []);

  useLayoutEffect(() => { if (abierto) colocar(); }, [abierto, colocar]);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarSiFuera = (e) => { if (!boton.current?.contains(e.target) && !panel.current?.contains(e.target)) setAbierto(false); };
    const teclas = (e) => { if (e.key === 'Escape') { setAbierto(false); boton.current?.focus(); } };
    const mover = () => setAbierto(false);
    document.addEventListener('pointerdown', cerrarSiFuera);
    document.addEventListener('keydown', teclas);
    window.addEventListener('resize', mover);
    window.addEventListener('scroll', mover, true);
    return () => {
      document.removeEventListener('pointerdown', cerrarSiFuera);
      document.removeEventListener('keydown', teclas);
      window.removeEventListener('resize', mover);
      window.removeEventListener('scroll', mover, true);
    };
  }, [abierto]);

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => { setDestino(boton.current?.closest('.dark') || document.body); setAbierto((v) => !v); }}
        disabled={deshabilitado}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls={montado ? id : undefined}
        aria-label={ariaLabel}
        className={`${claseBoton('secundario', 'compacto')} w-full justify-between min-w-0`}
      >
        <span className="truncate">{resumen}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {montado && pos && destino && createPortal(
        <div
          ref={panel}
          id={id}
          role="group"
          aria-label={ariaLabel}
          style={pos}
          className={`fixed z-[300] rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-1.5 ${saliendo ? 'lg:animate-menu-salida' : 'lg:animate-menu-entrada'}`}
        >
          {sinNada && <p className="px-2.5 py-2 text-xs text-zinc-600 dark:text-zinc-400">{vacio}</p>}
          {opciones.map((o) => (
            <label key={o.clave} className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm ${o.deshabilitado ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <input
                type="checkbox"
                checked={o.marcado}
                disabled={o.deshabilitado}
                onChange={(e) => o.onCambiar(e.target.checked)}
                className="sr-only peer"
              />
              <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 peer-checked:bg-red-600 peer-checked:border-red-600 peer-focus-visible:ring-2 peer-focus-visible:ring-red-600/40 text-white [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-zinc-800 dark:text-zinc-100">{o.etiqueta}</span>
                {o.ayuda && <span className="block text-[11px] max-lg:text-xs leading-snug text-zinc-600 dark:text-zinc-400">{o.ayuda}</span>}
              </span>
            </label>
          ))}
          {acciones.length > 0 && opciones.length > 0 && <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />}
          {acciones.map((a) => (
            <button
              key={a.clave}
              type="button"
              onClick={() => { setAbierto(false); a.onClick(); }}
              className="w-full text-left rounded-lg px-2.5 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="block font-bold text-zinc-800 dark:text-zinc-100">{a.etiqueta}</span>
              {a.detalle && <span className="block text-[11px] max-lg:text-xs leading-snug text-zinc-600 dark:text-zinc-400 break-words">{a.detalle}</span>}
            </button>
          ))}
        </div>,
        destino,
      )}
    </>
  );
}
