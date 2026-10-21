import { X } from 'lucide-react';
import Modal from '../Modal';
import BotonCopiar from '../BotonCopiar';
import { useCopiado } from '../../hooks/useCopiado';

// La plantilla final de una instalación finalizada, ya llena por el técnico, para que la promotora la lea y la copie
// (por ejemplo para pegarla en WhatsApp). Solo lectura. `onCopy(texto, mensaje)` copia y avisa con el toast (devuelve si pudo).
// Misma forma que los demás modales de la app (cabecera negra con raya roja, botones pequeños a la derecha) y mismo lenguaje que la
// tarjeta de la orden: código grande, etiquetas en mayúsculas, esquinas secas en el contenido.
export default function PlantillaFinalModal({ orden, texto, onCopy, onClose, zIndexClass = 'z-50', titulo = 'PLANTILLA FINAL' }) {
  const { copiado, copiar } = useCopiado(onCopy);
  if (!orden) return null;
  return (
    <Modal onClose={onClose} zIndexClass={zIndexClass}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-red-500">{titulo}</p>
            <h2 className="mt-1 flex items-baseline gap-2 min-w-0">
              <span className="text-lg font-black text-white tabular-nums leading-none">{orden.codigo || 'S/C'}</span>
              {orden.nombre && <span className="text-sm font-bold text-zinc-300 truncate">{orden.nombre}</span>}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 overflow-y-auto space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">Texto para copiar</p>
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md p-3">{texto}</pre>
        </div>

        <div className="flex gap-2 justify-end px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 border-2 border-zinc-400 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cerrar
          </button>
          <BotonCopiar
            copiado={copiado === 'plantilla'}
            onClick={() => copiar('plantilla', texto, 'Plantilla copiada.')}
            etiqueta="Copiar plantilla"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg shadow-md"
            iconoClase="w-3.5 h-3.5"
            tono="bg-red-600 hover:bg-red-700 text-white"
            tonoCopiado="bg-emerald-700 text-white"
          >
            {copiado === 'plantilla' ? 'Copiada' : 'Copiar plantilla'}
          </BotonCopiar>
        </div>
      </div>
    </Modal>
  );
}
