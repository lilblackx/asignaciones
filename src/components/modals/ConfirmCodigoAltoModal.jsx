import { AlertTriangle } from 'lucide-react';
import Modal from '../Modal';

// Confirmación cuando un código escrito a mano se salta números del correlativo
// (ej. "AO150" cuando el último es AO15): el contador se movería hasta ese número.
export default function ConfirmCodigoAltoModal({ salto, isSubmitting, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} zIndexClass="z-[70]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center border border-zinc-300 dark:border-zinc-800">
        <div className="pt-6 pb-4 px-6 flex flex-col items-center">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full mb-4">
            <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-500" />
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2">¿Código fuera de secuencia?</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-2">
            El último código es el número <strong>{salto.ultimo}</strong> y escribiste <strong>{salto.codigo}</strong>. El siguiente en la secuencia sería el <strong>{salto.esperado}</strong>.
          </p>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Si continúas, las próximas órdenes automáticas seguirán desde {salto.codigo}. ¿Es correcto?
          </p>
        </div>
        <div className="p-6 bg-zinc-50 dark:bg-zinc-950 flex gap-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-3 text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50">
            Corregir
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'}`}>
            {isSubmitting ? 'Guardando...' : 'Sí, usar ese'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
