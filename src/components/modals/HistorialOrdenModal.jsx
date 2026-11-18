import { History } from 'lucide-react';
import Modal from '../Modal';
import HistorialTimeline from '../HistorialTimeline';
import BotonCerrar from '../BotonCerrar';

// Línea de tiempo de una orden en solitario (desde el menú de la fila), sin
// tener que abrir Editar.
export default function HistorialOrdenModal({ ticket, onClose }) {
  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-card rounded-card shadow-2xl w-full max-w-md max-h-[90dvh] overflow-hidden border border-border flex flex-col">
        <div className="encabezado-d bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white flex items-center gap-2"><History className="w-4 h-4 text-red-700 dark:text-red-400" aria-hidden="true" /> HISTORIAL DE LA ORDEN</h2>
            <p className="text-xs font-medium text-red-400 truncate">{ticket.codigo || 'S/C'} - {ticket.nombre}</p>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>
        <div className="p-4 pb-5 overflow-y-auto">
          <HistorialTimeline ticket={ticket} />
        </div>
      </div>
    </Modal>
  );
}
