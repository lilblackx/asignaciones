import { Flag } from 'lucide-react';

// Botón junto al código de la orden (solo ADMIN y USUARIO): marca o quita la prioridad alta.
// Al marcarla, el técnico asignado recibe un aviso.
export function BotonPrioridad({ activa, codigo, onClick }) {
  const orden = codigo ? `la orden ${codigo}` : 'la orden';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      aria-label={activa ? `Quitar la prioridad alta de ${orden}` : `Marcar ${orden} con prioridad alta`}
      title={activa ? 'Prioridad alta: toca para quitarla' : 'Dar prioridad alta (se le avisa al técnico)'}
      className={`inline-flex items-center justify-center p-1 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
        activa
          ? 'bg-red-600 text-white hover:bg-red-500'
          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400'
      }`}
    >
      <Flag className={`w-3.5 h-3.5 ${activa ? 'fill-current' : ''}`} aria-hidden="true" />
    </button>
  );
}

// Etiqueta que ve todo el que mira una orden con prioridad alta (incluido el técnico).
export function InsigniaPrioridad({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 self-start text-[9px] font-black tracking-wide px-1.5 py-0.5 rounded bg-red-600 text-white ${className}`}>
      <Flag className="w-2.5 h-2.5 fill-current" aria-hidden="true" /> PRIORIDAD ALTA
    </span>
  );
}
