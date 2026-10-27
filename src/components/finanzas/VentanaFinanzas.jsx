import { X } from 'lucide-react';
import Modal from '../Modal';

// La ventana de los formularios de Finanzas (pagar, adelanto) con el mismo formato que las tarjetas: esquinas secas, cabecera negra con el nombre y un estado en
// sólido a la derecha, cuerpo con etiquetas pequeñas y un pie con la acción, siempre abajo. `estado`: { texto, clase }; `pie`: los botones (alineados a la derecha).
export default function VentanaFinanzas({ titulo, estado, onClose, pie, children, zIndexClass = 'z-[60]' }) {
  return (
    <Modal onClose={onClose} zIndexClass={zIndexClass}>
      <div className="w-full max-w-lg max-h-[92vh] min-w-0 flex flex-col rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xl">
        <div className="bg-black px-4 py-3 flex items-center gap-3 shrink-0">
          <h2 className="text-base font-bold text-white leading-tight truncate min-w-0">{titulo}</h2>
          {estado && <span key={estado.texto} className={`ml-auto shrink-0 text-xs font-bold rounded-md px-2.5 py-1 leading-none lg:animate-fade-in ${estado.clase}`}>{estado.texto}</span>}
          <button type="button" onClick={onClose} aria-label="Cerrar" className={`${estado ? '' : 'ml-auto '}shrink-0 p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors`}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-sm">{children}</div>
        <div className="border-t border-zinc-400 dark:border-zinc-700 px-4 py-3 flex flex-wrap items-center justify-end gap-2 shrink-0">{pie}</div>
      </div>
    </Modal>
  );
}
