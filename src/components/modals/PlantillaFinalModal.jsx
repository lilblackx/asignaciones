import { FileText, X } from 'lucide-react';
import Modal from '../Modal';
import BotonCopiar from '../BotonCopiar';
import { useCopiado } from '../../hooks/useCopiado';

// La plantilla final de una instalación finalizada, ya llena por el técnico, para que la promotora la lea y la copie
// (por ejemplo para pegarla en WhatsApp). Solo lectura. `onCopy(texto, mensaje)` copia y avisa con el toast (devuelve si pudo).
export default function PlantillaFinalModal({ orden, texto, onCopy, onClose }) {
  const { copiado, copiar } = useCopiado(onCopy);
  if (!orden) return null;
  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex justify-between items-center gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-wide text-red-500 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" aria-hidden="true" /> PLANTILLA FINAL</p>
            <h2 className="text-sm font-black text-white truncate">{orden.codigo || 'S/C'}{orden.nombre ? ` — ${orden.nombre}` : ''}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 overflow-y-auto">
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">{texto}</pre>
        </div>

        <div className="flex gap-2.5 p-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-sm text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors"
          >
            Cerrar
          </button>
          <BotonCopiar
            copiado={copiado === 'plantilla'}
            onClick={() => copiar('plantilla', texto, 'Plantilla copiada.')}
            etiqueta="Copiar plantilla"
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-black rounded-xl shadow-md"
            tono="bg-red-600 hover:bg-red-700 text-white"
            tonoCopiado="bg-emerald-600 text-white"
          >
            {copiado === 'plantilla' ? 'Copiada' : 'Copiar plantilla'}
          </BotonCopiar>
        </div>
      </div>
    </Modal>
  );
}
