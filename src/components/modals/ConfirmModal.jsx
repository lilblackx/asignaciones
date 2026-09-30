import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../Modal';

const THEMES = {
  red: {
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-500',
    inputFocus: 'focus:border-red-500',
    confirmBg: 'bg-red-600 hover:bg-red-700'
  },
  blue: {
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-500',
    inputFocus: 'focus:border-blue-500',
    confirmBg: 'bg-blue-600 hover:bg-blue-700'
  },
  yellow: {
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconColor: 'text-yellow-600 dark:text-yellow-500',
    inputFocus: 'focus:border-yellow-500',
    confirmBg: 'bg-yellow-600 hover:bg-yellow-700'
  }
};

// Confirmación genérica (Eliminar / Retirar asignación / Confirmar cierre, etc.)
// — un solo componente con tema por color en vez de tres modales casi idénticos.
export default function ConfirmModal({
  color = 'red',
  icon: Icon = AlertTriangle,
  title,
  description,
  confirmLabel = 'Confirmar',
  processingLabel = 'Procesando...',
  cancelLabel = 'Cancelar',
  dateInput,
  setDateInput,
  isProcessing: externalProcessing,
  zIndexClass = 'z-[70]',
  onCancel,
  onConfirm
}) {
  const theme = THEMES[color];
  const [internalProcessing, setInternalProcessing] = useState(false);
  // Cierre de jornada controla su propio isProcessing desde afuera (lo comparte
  // con otras acciones); Eliminar/Retirar lo manejan solos alrededor de onConfirm.
  const isControlled = externalProcessing !== undefined;
  const isProcessing = isControlled ? externalProcessing : internalProcessing;

  const handleConfirm = async () => {
    if (isControlled) {
      onConfirm();
      return;
    }
    setInternalProcessing(true);
    await onConfirm();
    setInternalProcessing(false);
  };

  return (
    <Modal onClose={onCancel} zIndexClass={zIndexClass}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center border border-zinc-300 dark:border-zinc-800">
        <div className="pt-6 pb-4 px-6 flex flex-col items-center">
          <div className={`${theme.iconBg} p-4 rounded-full mb-4`}>
            <Icon className={`w-10 h-10 ${theme.iconColor}`} />
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2">{title}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{description}</p>
          {dateInput !== undefined && setDateInput && (
            <div className="w-full space-y-1 text-left">
              <label htmlFor="confirm-fecha" className="text-xs font-bold text-zinc-600 dark:text-zinc-400 ml-1">FECHA DEL REPORTE</label>
              <input
                id="confirm-fecha"
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className={`w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-xl ${theme.inputFocus} focus:ring-0 outline-none text-zinc-900 dark:text-white font-medium`}
              />
            </div>
          )}
        </div>
        <div className="p-6 bg-zinc-50 dark:bg-zinc-950 flex gap-3 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={onCancel} disabled={isProcessing} className="flex-1 py-3 text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50">
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-md text-white ${isProcessing ? 'bg-zinc-400 cursor-not-allowed' : theme.confirmBg}`}
          >
            {isProcessing ? processingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
