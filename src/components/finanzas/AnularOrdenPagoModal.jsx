import { useState } from 'react';
import { Ban, X } from 'lucide-react';
import Modal from '../Modal';
import { AccionesConfirmacion } from '../modals/DialogoConfirmacion';
import { stripEmojis } from '../../utils/sanitizeInput';
import { MAX_MOTIVO_ANULACION, dolares, parseMotivoAnulacion } from '../../utils/finanzas';
import { claseArea } from '../estilos';

// Anular el pago de UNA orden de un pago: pide el motivo, que el técnico ve en su aviso. La orden vuelve a estar por pagar; el pago sigue vigente con el resto de sus órdenes.
// `onConfirmar(motivo)` guarda y avisa al técnico; devuelve true si se pudo.
export default function AnularOrdenPagoModal({ orden, tecnico, onConfirmar, onClose }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    const revisado = parseMotivoAnulacion(motivo);
    if (revisado.error) { setError(revisado.error); return; }
    setEnviando(true);
    const ok = await onConfirmar(revisado.valor);
    setEnviando(false);
    if (ok) onClose();
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-[70]">
      <div className="bg-card rounded-card shadow-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto border border-border">
        <div className="encabezado-d bg-black px-4 py-3.5 border-b-2 border-red-600 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-red-600 text-white text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded tracking-wide">ANULAR PAGO DE LA ORDEN</span>
              <span className="text-xs font-bold text-red-400">{orden.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate">{tecnico} · {dolares(orden.monto)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 inline-flex items-center justify-center relative bg-zinc-800 p-1.5 rounded-full max-lg:after:absolute max-lg:after:-inset-2 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <label htmlFor="motivo-anular-pago-orden" className="text-xs font-bold text-red-700 dark:text-red-400 ml-1 flex items-center gap-1">
              <Ban className="w-3.5 h-3.5" aria-hidden="true" /> MOTIVO <span className="font-normal">(obligatorio, lo verá {tecnico})</span>
            </label>
            <textarea
              id="motivo-anular-pago-orden"
              value={motivo}
              onChange={(e) => { setMotivo(stripEmojis(e.target.value)); setError(''); }}
              rows={3}
              maxLength={MAX_MOTIVO_ANULACION}
              autoFocus
              aria-invalid={!!error}
              placeholder="Ej. La orden se canceló después de pagarse, se pagó por error, cambió el tipo de trabajo..."
              className={`${claseArea('normal')} resize-none`}
            />
            {error && <p role="alert" className="text-[11px] max-lg:text-xs text-red-700 dark:text-red-400 font-bold ml-1">{error}</p>}
            <p className="text-[11px] max-lg:text-xs text-muted-foreground ml-1">
              La orden vuelve a estar por pagar y el resto del pago sigue como está. {tecnico} recibe un aviso con el motivo. Si el dinero ya salió, ajústalo con un descuento.
            </p>
          </div>
          <AccionesConfirmacion
            nivel="error"
            cancelLabel="Cancelar"
            confirmLabel="Anular pago de la orden"
            procesando={enviando}
            procesandoLabel="Anulando..."
            onCancel={onClose}
            onConfirm={confirmar}
            className="pt-1"
          />
        </div>
      </div>
    </Modal>
  );
}
