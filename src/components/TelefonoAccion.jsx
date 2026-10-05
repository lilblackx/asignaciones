import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Phone } from 'lucide-react';
import { getEnlaceLlamada, getEnlaceWhatsApp, parseTelefonos } from '../utils/telefono';

const ACCIONES = {
  llamar: {
    Icon: Phone,
    texto: 'Llamar',
    titulo: 'Llamar al cliente',
    aria: (nombre) => `Llamar a ${nombre || 'el cliente'}`,
    enlace: getEnlaceLlamada,
    externo: false,
  },
  chat: {
    Icon: MessageCircle,
    texto: 'Chat',
    titulo: 'WhatsApp al cliente',
    aria: (nombre) => `Escribir por WhatsApp a ${nombre || 'el cliente'}`,
    enlace: getEnlaceWhatsApp,
    externo: true,
  },
};

// Botón "Llamar" o "Chat" de una orden. Con un solo teléfono es un enlace directo;
// con varios sigue siendo un único botón y, al tocarlo, deja elegir a cuál número.
// No renderiza nada si ningún teléfono es usable.
export default function TelefonoAccion({ telefono, tipo, nombre, className }) {
  const { Icon, texto, titulo, aria, enlace, externo } = ACCIONES[tipo];
  const [abierto, setAbierto] = useState(false);
  const primeraOpcion = useRef(null);

  const opciones = parseTelefonos(telefono)
    .map(numero => ({ numero, href: enlace(numero) }))
    .filter(o => o.href);

  useEffect(() => {
    if (!abierto) return undefined;
    // En captura y con stopPropagation: si la hoja está sobre un modal, Escape
    // cierra solo la hoja y no el modal de abajo.
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setAbierto(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    primeraOpcion.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [abierto]);

  if (opciones.length === 0) return null;

  const contenido = (
    <>
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">{texto}</span>
    </>
  );

  if (opciones.length === 1) {
    return (
      <a
        href={opciones[0].href}
        {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        aria-label={aria(nombre)}
        title={titulo}
        className={className}
      >
        {contenido}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        aria-label={`${aria(nombre)}: elegir número`}
        title={`${titulo}: elegir número`}
        className={className}
      >
        {contenido}
      </button>
      {abierto && createPortal(
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          role="presentation"
          onClick={() => setAbierto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${texto}: elegir número`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-3 space-y-2"
          >
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 px-1">{texto} a:</p>
            {opciones.map((o, i) => (
              <a
                key={o.numero}
                ref={i === 0 ? primeraOpcion : undefined}
                href={o.href}
                {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={() => setAbierto(false)}
                className="flex items-center gap-2 py-3 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> {o.numero}
              </a>
            ))}
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="w-full py-2 rounded-lg text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
