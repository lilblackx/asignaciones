import { CheckCircle2, Copy, X } from 'lucide-react';
import Modal from '../Modal';

export default function WhatsAppMessageModal({ mensaje, onCopy, onClose }) {
  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3 border-b-2 border-green-600 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-black text-white leading-tight">Orden creada</h2>
              <p className="text-[10px] font-medium text-green-400 leading-tight">Plantilla lista para WhatsApp</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <textarea
            readOnly
            value={mensaje}
            rows="10"
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-xs text-zinc-900 dark:text-white whitespace-pre-wrap"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs transition-colors">Cerrar</button>
            <button type="button" onClick={onCopy} className="px-4 py-1.5 flex items-center gap-1.5 text-white font-bold bg-green-600 hover:bg-green-700 rounded-lg text-xs shadow-md transition-colors"><Copy className="w-3.5 h-3.5" /> Copiar plantilla</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
