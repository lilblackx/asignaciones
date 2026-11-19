import { Camera } from 'lucide-react';
import Modal from '../Modal';
import DetallesOrdenCampo from '../DetallesOrdenCampo';
import { FOTOS_EXACTAS, fotosDe } from '../../utils/detallesOrden';
import BotonCerrar from '../BotonCerrar';

// El técnico corrige los "Detalles de la orden" que ya subió: quita o cambia fotos (por si se equivocó) y agrega otras, siempre 7. Solo mientras la orden siga finalizada en su lista (el cierre del día la archiva).
// `onGuardar(ticket, fotos, onProgreso)` -> { ok } | { error } (ver DetallesOrdenCampo); al guardar se cierra solo.
export default function CorregirDetallesModal({ ticket, onGuardar, onClose }) {
  if (!ticket) return null;
  return (
    <Modal onClose={onClose} zIndexClass="z-[60]">
      <div role="dialog" aria-labelledby="corregir-detalles-titulo" className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-card rounded-card shadow-2xl border border-border">
        <div className="encabezado-d bg-black px-4 py-3.5 border-b-2 border-emerald-600 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-400">{ticket.codigo || 'S/C'}</p>
            <h2 id="corregir-detalles-titulo" className="text-sm font-black text-white mt-0.5 truncate inline-flex items-center gap-2"><Camera className="w-4 h-4 shrink-0" aria-hidden="true" />Corregir las fotos de la orden</h2>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-xs text-muted-foreground">Quita con la X una foto equivocada o cámbiala por otra con la flecha, y agrega las que falten. Tienen que quedar exactamente {FOTOS_EXACTAS} fotos. Se corrige mientras la orden siga en tu lista de finalizadas.</p>
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
