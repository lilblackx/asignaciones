import { useEffect, useRef, useState } from 'react';
import { EllipsisVertical, MoreHorizontal } from 'lucide-react';
import { usePresencia } from '../hooks/usePresencia';

// Menú de acciones secundarias de una fila. Va con position: fixed porque el
// contenedor de la tabla recorta el desborde (overflow-hidden) y el menú de la
// última fila quedaría cortado.
// `grande`: el botón y las opciones miden 44 px (la tarjeta de la orden en celular); sin ella, el tamaño chico de la tabla. Una opción con `disabled` se ve apagada y no hace nada (con `titulo` explica por qué).
export default function RowMenu({ label, items, grande = false }) {
  // `pos` conserva dónde dibujar el menú mientras se anima su salida; `abierto` es lo que lo abre y cierra.
  const [pos, setPos] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const { montado, saliendo } = usePresencia(abierto, 120);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const close = () => setAbierto(false);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [abierto]);

  const toggle = () => {
    if (abierto) { setAbierto(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const cabeAbajo = window.innerHeight - r.bottom > items.length * 40 + 16;
    setPos({
      right: window.innerWidth - r.right,
      ...(cabeAbajo ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
    });
    setAbierto(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Más acciones"
        className={grande ? 'inline-flex items-center justify-center min-h-11 min-w-11 rounded-boton bg-secondary text-card-foreground hover:bg-accent transition-colors' : 'p-1 text-zinc-600 dark:text-zinc-300 bg-secondary hover:bg-accent rounded transition-colors'}
      >
        {grande ? <MoreHorizontal className="w-5 h-5" /> : <EllipsisVertical className="w-3.5 h-3.5" />}
      </button>
      {montado && pos && (
        <>
          <div className={`fixed inset-0 z-40${saliendo ? ' pointer-events-none' : ''}`} onClick={() => setAbierto(false)} aria-hidden="true" />
          <div role="menu" style={pos} className={`fixed z-50 ${grande ? 'min-w-[14rem] p-1.5' : 'min-w-[9rem] py-1'} bg-card border border-input rounded-card shadow-xl text-left ${saliendo ? 'animate-menu-salida pointer-events-none' : 'animate-menu-entrada'} shadow-card`}>
            {items.map(({ label: texto, icon: Icon, onClick, danger, disabled = false, titulo }) => (
              <button
                key={texto}
                type="button"
                role="menuitem"
                disabled={disabled}
                title={titulo}
                onClick={() => { setAbierto(false); onClick(); }}
                className={`w-full flex items-center gap-2 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${grande ? 'min-h-11 px-3 text-sm rounded-campo' : 'px-3 py-2 text-xs'} ${danger ? 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-zinc-700 dark:text-zinc-200 hover:bg-secondary'}`}
              >
                <Icon className={grande ? 'w-4 h-4' : 'w-3.5 h-3.5'} /> {texto}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
