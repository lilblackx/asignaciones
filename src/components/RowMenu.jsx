import { useEffect, useRef, useState } from 'react';
import { EllipsisVertical } from 'lucide-react';

// Menú de acciones secundarias de una fila. Va con position: fixed porque el
// contenedor de la tabla recorta el desborde (overflow-hidden) y el menú de la
// última fila quedaría cortado.
export default function RowMenu({ label, items }) {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    const cabeAbajo = window.innerHeight - r.bottom > items.length * 40 + 16;
    setPos({
      right: window.innerWidth - r.right,
      ...(cabeAbajo ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
    });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        title="Más acciones"
        className="p-1 text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
      >
        <EllipsisVertical className="w-3.5 h-3.5" />
      </button>
      {pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} aria-hidden="true" />
          <div role="menu" style={pos} className="fixed z-50 min-w-[9rem] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-xl py-1 text-left">
            {items.map(({ label: texto, icon: Icon, onClick, danger }) => (
              <button
                key={texto}
                type="button"
                role="menuitem"
                onClick={() => { setPos(null); onClick(); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors ${danger ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {texto}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
