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
      <div className="bg-card rounded-card shadow-2xl w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden border border-border">
        <div className="encabezado-d bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] max-lg:text-xs font-black uppercase tracking-wide text-red-700 dark:text-red-400">{titulo}</p>
            <h2 className="mt-1 flex items-baseline gap-2 min-w-0">
              <span className="text-lg font-black text-white tabular-nums leading-none">{orden.codigo || 'S/C'}</span>
              {orden.nombre && <span className="text-sm font-bold text-zinc-300 truncate">{orden.nombre}</span>}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex items-center justify-center relative bg-zinc-800 p-1.5 rounded-full max-lg:after:absolute max-lg:after:-inset-2 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 overflow-y-auto space-y-1.5">
          <p className="text-[11px] max-lg:text-xs font-semibold text-muted-foreground">Texto para copiar</p>
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono text-foreground bg-sunken border border-border rounded-campo p-3">{texto}</pre>
        </div>

        <div className="flex gap-2 justify-end px-4 py-3 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-card-foreground font-bold bg-card border-2 border-input hover:bg-secondary rounded-card transition-colors shadow-card"
          >
            Cerrar
          </button>
          <BotonCopiar
            copiado={copiado === 'plantilla'}
            onClick={() => copiar('plantilla', texto, 'Plantilla copiada.')}
            etiqueta="Copiar plantilla"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-campo shadow-md"
            iconoClase="w-3.5 h-3.5"
            tono="bg-primary hover:bg-primary-hover text-white"
            tonoCopiado="bg-emerald-700 text-white"
          >
            {copiado === 'plantilla' ? 'Copiada' : 'Copiar plantilla'}
          </BotonCopiar>
        </div>
      </div>
    </Modal>
  );
}
