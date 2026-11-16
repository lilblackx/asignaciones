import { AlertTriangle } from 'lucide-react';
import Modal from '../Modal';
import Spinner from '../Spinner';

// Confirmación cuando un código escrito a mano se salta números del correlativo
// (ej. "AO150" cuando el último es AO15): el contador se movería hasta ese número.
export default function ConfirmCodigoAltoModal({ salto, isSubmitting, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} zIndexClass="z-[70]">
      <div className="bg-card rounded-card shadow-2xl w-full max-w-sm overflow-hidden text-center border border-border">
        <div className="pt-6 pb-4 px-6 flex flex-col items-center">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full mb-4">
            <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-500" />
          </div>
          <h2 className="text-xl font-black text-foreground mb-2">¿Código fuera de secuencia?</h2>
          <p className="text-muted-foreground text-sm mb-2">
            El último código es el número <strong>{salto.ultimo}</strong> y escribiste <strong>{salto.codigo}</strong>. El siguiente en la secuencia sería el <strong>{salto.esperado}</strong>.
          </p>
          <p className="text-muted-foreground text-sm">
            Si continúas, las próximas órdenes automáticas seguirán desde {salto.codigo}. ¿Es correcto?
          </p>
        </div>
        <div className="p-6 bg-sunken flex gap-3 border-t border-border">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-3 text-card-foreground font-bold bg-card border-2 border-input hover:bg-secondary rounded-card transition-colors disabled:opacity-50 shadow-card">
            Corregir
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex-1 py-3 text-white font-bold rounded-campo transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'}`}>
            {isSubmitting && <Spinner />}{isSubmitting ? 'Guardando...' : 'Sí, usar ese'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
