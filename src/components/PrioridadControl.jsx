import { Flag } from 'lucide-react';

// Botón junto al código de la orden (solo ADMIN y USUARIO): marca o quita la prioridad alta.
// Al marcarla, el técnico asignado recibe un aviso.
export function BotonPrioridad({ activa, codigo, onClick, compacto = false }) {
  const orden = codigo ? `la orden ${codigo}` : 'la orden';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      aria-label={activa ? `Quitar la prioridad alta de ${orden}` : `Marcar ${orden} con prioridad alta`}
      title={activa ? 'Prioridad alta: toca para quitarla' : 'Dar prioridad alta (se le avisa al técnico)'}
      className="group relative inline-flex items-center justify-center rounded-full focus:outline-none max-lg:after:absolute max-lg:after:-inset-3"
    >
      {/* En celular el botón mide 44 px para el dedo; el círculo que se ve sigue siendo chico. */}
      <span className={`inline-flex ${compacto ? 'p-0.5' : 'p-1'} rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-red-500 ${
        activa
          ? 'bg-red-600 text-white group-hover:bg-red-500'
          : 'bg-zinc-200 dark:bg-zinc-800 text-muted-foreground group-hover:bg-red-100 dark:group-hover:bg-red-900/40 group-hover:text-red-600 dark:group-hover:text-red-400'
      }`}>
        <Flag className={`${compacto ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${activa ? 'fill-current' : ''}`} aria-hidden="true" />
      </span>
    </button>
  );
}

// Etiqueta que ve todo el que mira una orden con prioridad alta (incluido el técnico).
// `corta`: en la tabla, donde la columna del código es angosta, dice solo "ALTA" (el nombre completo queda en el título y para los lectores de pantalla): la versión larga se salía de la columna y tapaba lo de al lado.
export function InsigniaPrioridad({ className = '', corta = false }) {
  return (
    <span title={corta ? 'Prioridad alta' : undefined} className={`inline-flex items-center gap-1 self-start shrink-0 whitespace-nowrap text-etiqueta font-black px-1.5 py-0.5 rounded bg-red-600 text-white ${className}`}>
      <Flag className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
      {corta ? <><span aria-hidden="true">Alta</span><span className="sr-only">Prioridad alta</span></> : 'Prioridad alta'}
    </span>
  );
}
