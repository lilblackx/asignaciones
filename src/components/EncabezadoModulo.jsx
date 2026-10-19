import { ArrowLeft, X } from 'lucide-react';

// La barra negra de arriba de los módulos: "Volver" a la izquierda (solo en PC, donde el módulo ocupa toda la pantalla), el título y,
// a la derecha, las acciones propias del módulo y la X, que cierra el módulo entero.
//   onVolver: sube un nivel dentro del módulo; sin él, Volver cierra (igual que la X). Sin onClose (página del almacén) no hay ni Volver ni X.
export default function EncabezadoModulo({ Icono, titulo, onClose, onVolver = onClose, acciones, className = '' }) {
  return (
    <div className={`bg-black px-4 sm:px-6 py-3.5 border-b-2 border-red-600 flex items-center gap-3 shrink-0 sticky top-0 z-10 ${className}`}>
      {onVolver && (
        <button onClick={onVolver} className="hidden lg:inline-flex items-center gap-1.5 shrink-0 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white pl-2.5 pr-3 py-1.5 rounded-lg border border-zinc-700 transition-colors">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver
        </button>
      )}
      <h2 className="text-lg font-black text-white flex items-center gap-2 min-w-0">
        <Icono className="w-5 h-5 text-red-500 shrink-0" aria-hidden="true" /> <span className="truncate">{titulo}</span>
      </h2>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {acciones}
        {onClose && (
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
        )}
      </div>
    </div>
  );
}
