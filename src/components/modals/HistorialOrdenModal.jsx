import { History, X } from 'lucide-react';
import Modal from '../Modal';
import HistorialTimeline from '../HistorialTimeline';

// Línea de tiempo de una orden en solitario (desde el menú de la fila), sin
// tener que abrir Editar.
export default function HistorialOrdenModal({ ticket, onClose }) {
  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden border border-zinc-300 dark:border-zinc-800 flex flex-col">
        <div className="bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white flex items-center gap-2"><History className="w-4 h-4 text-red-500" aria-hidden="true" /> HISTORIAL DE LA ORDEN</h2>
            <p className="text-[10px] font-medium text-red-400 truncate">{ticket.codigo || 'S/C'} — {ticket.nombre}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 overflow-y-auto">
          <HistorialTimeline ticket={ticket} />
        </div>
      </div>
    </Modal>
  );
}
