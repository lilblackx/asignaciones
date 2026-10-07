import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

const DEFAULT_CLASS = 'w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl py-2.5 pl-3 pr-9 focus:ring-2 focus:ring-red-600 outline-none font-medium text-sm shadow-sm transition-colors aria-expanded:border-red-600 disabled:opacity-60 disabled:cursor-not-allowed';
const PANEL_MAX_HEIGHT = 288;
const PANEL_MAX_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

// Dropdown propio (el <select> nativo no se puede estilizar). `items` mezcla
// opciones sueltas { value, label } y grupos { group, options: [...] }.
// `className` reemplaza el estilo del botón (debe dejar espacio a la derecha
// para la flecha: pr-*). El panel se pinta en un portal con posición fija para
// que no lo recorte el scroll de los modales.
export default function SelectMenu({
  id, value, onChange, items, ariaLabel, icon: Icon,
  disabled = false, className = DEFAULT_CLASS, chevronClassName = 'w-3.5 h-3.5 right-3'
}) {
  // Con w-full en `className` el selector ocupa todo el ancho; sin él (badges
  // pequeños) se ajusta al texto y la flecha queda pegada al botón.
  const fullWidth = /(^|\s)w-full(\s|$)/.test(className);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState(null);
  const [portalTarget, setPortalTarget] = useState(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const flat = useMemo(
    () => items.flatMap(it => (it.group ? it.options : [it])),
    [items]
  );
  const selected = flat.find(o => o.value === value) || flat[0];

  const updatePos = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const above = rect.top - VIEWPORT_MARGIN;
    const up = below < 200 && above > below;
    // Se abre hacia el lado con más espacio: hacia la derecha desde el borde
    // izquierdo del botón, o hacia la izquierda desde su borde derecho.
    const espacioDerecha = window.innerWidth - rect.left - VIEWPORT_MARGIN;
    const espacioIzquierda = rect.right - VIEWPORT_MARGIN;
    const alignRight = espacioDerecha < PANEL_MAX_WIDTH && espacioIzquierda > espacioDerecha;
    const maxWidth = Math.min(PANEL_MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    setPos({
      ...(alignRight
        ? { right: Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right), maxWidth: Math.min(maxWidth, espacioIzquierda) }
        : { left: Math.max(VIEWPORT_MARGIN, rect.left), maxWidth: Math.min(maxWidth, espacioDerecha) }),
      minWidth: Math.min(rect.width, maxWidth),
      maxHeight: Math.min(PANEL_MAX_HEIGHT, up ? above : below),
      ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 })
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (buttonRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, pos]);

  const openMenu = () => {
    setActiveIndex(Math.max(0, flat.findIndex(o => o.value === value)));
    // El modo oscuro es una clase en un div de la app, no en <html>: el panel
    // debe montarse dentro de ese div para heredarlo.
    setPortalTarget(buttonRef.current?.closest('.dark') || document.body);
    updatePos();
    setOpen(true);
  };

  const choose = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      // Los modales cierran con Esc a nivel documento: aquí solo se cierra el menú.
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(flat.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(flat[activeIndex]);
    }
  };

  const renderOption = (opt) => {
    const i = flat.indexOf(opt);
    const isSelected = opt.value === value;
    return (
      <li
        key={opt.value}
        id={`${listId}-${i}`}
        data-index={i}
        role="option"
        aria-selected={isSelected}
        className={`flex items-center justify-between gap-2 px-3 py-2 mx-1 rounded-lg text-sm normal-case font-medium cursor-pointer transition-colors ${
          i === activeIndex ? 'bg-zinc-100 dark:bg-zinc-800' : ''
        } ${isSelected ? '!font-bold text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-200'}`}
        onPointerEnter={() => setActiveIndex(i)}
        onClick={() => choose(opt)}
      >
        <span className="truncate">{opt.label}</span>
        {isSelected && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
      </li>
    );
  };

  return (
    <div className={`items-center gap-2 ${fullWidth ? 'flex w-full' : 'inline-flex'}`}>
      {Icon && <Icon className="text-zinc-500 dark:text-zinc-400 w-4 h-4 shrink-0" aria-hidden="true" />}
      <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
        <button
          ref={buttonRef}
          id={id}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
          className={`block text-left ${className}`}
        >
          <span className="block truncate">{selected?.label}</span>
        </button>
        <ChevronDown className={`absolute top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''} ${chevronClassName}`} aria-hidden="true" />

        {open && pos && portalTarget && createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            onMouseDown={(e) => e.preventDefault()}
            style={pos}
            className="fixed z-[300] w-max overflow-auto py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl"
          >
            {items.map(it =>
              it.group ? (
                <li key={it.group} role="presentation">
                  <div className="px-3 pt-2 pb-1 mt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {it.group}
                  </div>
                  <ul role="group" aria-label={it.group}>
                    {it.options.map(renderOption)}
                  </ul>
                </li>
              ) : (
                renderOption(it)
              )
            )}
          </ul>,
          portalTarget
        )}
      </div>
    </div>
  );
}
