import { Camera, X } from 'lucide-react';
import Modal from '../Modal';
import DetallesOrdenCampo from '../DetallesOrdenCampo';
import { FOTOS_EXACTAS, fotosDe } from '../../utils/detallesOrden';

// El técnico corrige los "Detalles de la orden" que ya subió: quita o cambia fotos (por si se equivocó) y agrega otras, siempre 7. Solo mientras la orden siga finalizada en su lista (el cierre del día la archiva).
// `onGuardar(ticket, fotos, onProgreso)` -> { ok } | { error } (ver DetallesOrdenCampo); al guardar se cierra solo.
export default function CorregirDetallesModal({ ticket, onGuardar, onClose }) {
  if (!ticket) return null;
  return (
    <Modal onClose={onClose} zIndexClass="z-[60]">
      <div role="dialog" aria-labelledby="corregir-detalles-titulo" className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-emerald-600 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-400">{ticket.codigo || 'S/C'}</p>
            <h2 id="corregir-detalles-titulo" className="text-sm font-black text-white mt-0.5 truncate inline-flex items-center gap-2"><Camera className="w-4 h-4 shrink-0" aria-hidden="true" />Corregir las fotos de la orden</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Quita con la X una foto equivocada o cámbiala por otra con la flecha, y agrega las que falten. Tienen que quedar exactamente {FOTOS_EXACTAS} fotos. Se corrige mientras la orden siga en tu lista de finalizadas.</p>
          <DetallesOrdenCampo
            iniciales={fotosDe(ticket)}
            textoGuardar="Guardar las correcciones"
            onSubir={async (fotos, onProgreso) => {
              const r = await onGuardar(ticket, fotos, onProgreso);
              if (r?.ok) onClose();
              return r;
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
