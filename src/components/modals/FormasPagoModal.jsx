import { Landmark, X } from 'lucide-react';
import Modal from '../Modal';
import FormasPagoLista from './FormasPagoLista';
import { normalizarFormasPago } from '../../utils/formasPago';

// Vista de solo lectura para el técnico: cada forma de pago en su tarjeta y cada
// dato se copia con un toque para pegarlo en WhatsApp. `onCopy(texto, mensaje)`
// hace la copia (devuelve si pudo) y avisa con el toast.
export default function FormasPagoModal({ formasPago, onCopy, onClose }) {
  const formas = normalizarFormasPago(formasPago);

  return (
    <Modal onClose={onClose} zIndexClass="z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-6 py-4 border-b-2 border-red-600 flex justify-between items-center">
          <h2 className="text-lg font-black text-white flex items-center gap-2"><Landmark className="w-5 h-5 text-red-500" aria-hidden="true" /> FORMAS DE PAGO</h2>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {formas.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-6">Aún no se han cargado las formas de pago. Avisa al administrador.</p>
          ) : (
            <FormasPagoLista formas={formas} onCopy={onCopy} />
          )}
        </div>
      </div>
    </Modal>
  );
}
