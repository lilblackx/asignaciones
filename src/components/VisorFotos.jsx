import { useEffect, useRef } from 'react';
import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Modal from './Modal';

// Visor de fotos para cualquier pantalla de la app: una ventana como las demás (encabezado negro con su línea roja) que muestra la foto grande encima de lo que se está viendo, sin salir de la app ni abrir otra pestaña (así no se
// ofrece descargarla). Flechas, teclado (← →), deslizar con el dedo o tocar una miniatura de abajo para pasar de una a otra; la X, Escape o el atrás del celular la cierran.
//   {abierta !== null && <VisorFotos titulo="Detalles de la orden" subtitulo="DK5 - Cliente" fotos={[{ url }]} indice={abierta} onCambiar={setAbierta} onClose={() => setAbierta(null)} />}
// `fotos`: [{ url }] (solo las que se pueden mostrar); `indice`: la que se ve; `onCambiar(i)`: pide pasar a otra; `titulo` y `subtitulo`: lo que dice el encabezado.
// La zona de la foto tiene siempre el mismo tamaño, así la ventana no salta al pasar de una foto vertical a una horizontal.
export default function VisorFotos({ fotos, indice, onCambiar, onClose, titulo = 'Fotos', subtitulo = '' }) {
  const total = fotos.length;
  const foto = fotos[indice];
  const toque = useRef(null);
  const ir = (paso) => onCambiar((indice + paso + total) % total);
  const irRef = useRef(ir);
  useEffect(() => { irRef.current = ir; });

  useEffect(() => {
    if (total < 2) return undefined;
    const tecla = (e) => {
      if (e.key === 'ArrowLeft') irRef.current(-1);
      else if (e.key === 'ArrowRight') irRef.current(1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [total]);

  if (!foto) return null;
  const flecha = 'absolute top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/55 text-white hover:bg-black/80 backdrop-blur-sm transition-colors';
  return (
    <Modal onClose={onClose} zIndexClass="z-[120]">
      <div
        role="dialog"
        aria-label={`${titulo}: foto ${indice + 1} de ${total}`}
        className="bg-card rounded-card shadow-2xl w-full max-w-3xl max-h-[94dvh] overflow-hidden border border-border flex flex-col"
      >
        <div className="encabezado-d bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white flex items-center gap-2 uppercase"><Camera className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" /> {titulo}</h2>
            {subtitulo && <p className="text-[11px] max-lg:text-xs font-medium text-red-400 truncate">{subtitulo}</p>}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-bold text-zinc-300 tabular-nums">{indice + 1} / {total}</span>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex items-center justify-center relative bg-zinc-800 p-1.5 rounded-full max-lg:after:absolute max-lg:after:-inset-2 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        </div>

        <div
          className="relative h-[min(62dvh,34rem)] bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center shrink-0 touch-pan-y"
          onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (toque.current === null || total < 2) return;
            const dx = e.changedTouches[0].clientX - toque.current;
            toque.current = null;
            if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1);
          }}
        >
          <img key={foto.url} src={foto.url} alt={`Foto ${indice + 1} del trabajo`} draggable={false} className="w-full h-full object-contain animate-fade-in select-none" />
          {total > 1 && (
            <>
              <button type="button" onClick={() => ir(-1)} aria-label="Foto anterior" className={`${flecha} left-2`}><ChevronLeft className="w-5 h-5" aria-hidden="true" /></button>
              <button type="button" onClick={() => ir(1)} aria-label="Foto siguiente" className={`${flecha} right-2`}><ChevronRight className="w-5 h-5" aria-hidden="true" /></button>
            </>
          )}
        </div>

        {total > 1 && (
          <ul aria-label="Fotos" className="flex gap-2 overflow-x-auto px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-t border-border shrink-0">
            {fotos.map((f, i) => (
              <li key={f.url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onCambiar(i)}
                  aria-label={`Ver la foto ${i + 1}`}
                  aria-current={i === indice ? 'true' : undefined}
                  className={`block w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === indice ? 'border-red-600 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={f.url} alt="" draggable={false} className="w-full h-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
