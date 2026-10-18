import { X } from 'lucide-react';

// Botón de limpiar de los buscadores de la app, en lugar del que dibuja el navegador (que se ve distinto en
// cada uno; ese se oculta en index.css). Va dentro del contenedor `relative` del campo y solo aparece con texto.
export default function BotonLimpiarBusqueda({ valor, onLimpiar }) {
  if (!valor) return null;
  return (
    <button
      type="button"
      onClick={onLimpiar}
      aria-label="Borrar búsqueda"
      title="Borrar búsqueda"
      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-full text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
    >
      <X className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
