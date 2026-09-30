import { ArrowRightLeft, Ban, BadgeCheck, CheckCheck, Clock, MapPin, Pencil, Plus, Send, Undo2, UserCog } from 'lucide-react';
import { construirLineaDeTiempo } from '../utils/historial';

const TIPOS = {
  creada: { icono: Plus, titulo: 'Orden creada', color: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200' },
  envio: { icono: CheckCheck, titulo: 'Marcada como enviada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  reenvio: { icono: Send, titulo: 'Plantilla reenviada', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  'envio-retirado': { icono: Undo2, titulo: 'Envío retirado', color: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200' },
  tecnico: { icono: UserCog, titulo: 'Cambio de técnico', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  prefinalizado: { icono: Clock, titulo: 'Pre-finalizada', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  aprobado: { icono: BadgeCheck, titulo: 'Aprobada y finalizada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  cancelado: { icono: Ban, titulo: 'Cancelada', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  estado: { icono: ArrowRightLeft, titulo: 'Cambio de estado', color: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200' },
  ubicacion: { icono: MapPin, titulo: 'Ubicación', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  edicion: { icono: Pencil, titulo: 'Edición', color: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200' },
};

// Línea de tiempo vertical de una orden, del evento más reciente al más antiguo.
// `compact` limita la altura con scroll (dentro de un formulario).
export default function HistorialTimeline({ ticket, compact = false }) {
  const eventos = construirLineaDeTiempo(ticket);

  return (
    <ol className={`relative space-y-3 ${compact ? 'max-h-64 overflow-y-auto pr-1' : ''}`} aria-label="Historial de la orden">
      {eventos.map((ev, i) => {
        const { icono: Icono, titulo, color } = TIPOS[ev.tipo] || TIPOS.edicion;
        const esUltimo = i === eventos.length - 1;
        return (
          <li key={ev.clave} className="relative flex gap-3">
            {!esUltimo && <span className="absolute left-3 top-6 bottom-[-0.75rem] w-px bg-zinc-300 dark:bg-zinc-700" aria-hidden="true" />}
            <span className={`relative z-[1] w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${color}`}>
              <Icono className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pb-0.5">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{titulo}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                {ev.fecha}{ev.operador && <> · <span className="font-semibold text-zinc-600 dark:text-zinc-300">{ev.operador}</span></>}
              </p>
              {ev.lineas.map((linea, j) => (
                <p key={j} className="text-xs text-zinc-700 dark:text-zinc-300 leading-snug break-words mt-0.5">{linea}</p>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
