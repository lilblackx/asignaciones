import { useState } from 'react';
import Modal from '../Modal';
import { AccionesConfirmacion } from '../modals/DialogoConfirmacion';
import { stripEmojis } from '../../utils/sanitizeInput';
import { MAX_MOTIVO_ANULACION, dolares, parseMotivoAnulacion } from '../../utils/finanzas';
import { ETIQUETA_CAMPO, claseArea } from '../estilos';
import Aviso from '../Aviso';
import { legible } from '../../utils/nombreTecnico';
import BotonCerrar from '../BotonCerrar';

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
        <div className="encabezado-d bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white">ANULAR PAGO DE LA ORDEN</h2>
            <p className="text-xs text-zinc-300 mt-1 truncate">{orden.codigo || 'S/C'} · {legible(tecnico)} · {dolares(orden.monto)}</p>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <label htmlFor="motivo-anular-pago-orden" className={`${ETIQUETA_CAMPO} ml-1`}>
              Motivo<span className="font-normal text-red-700 dark:text-red-400"> (obligatorio, lo verá {legible(tecnico)})</span>
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
            {error && <p role="alert" className="text-xs text-red-700 dark:text-red-400 font-bold ml-1">{error}</p>}
            <Aviso nivel="info" compact className="mt-2">
              La orden vuelve a estar por pagar y el resto del pago sigue como está. {legible(tecnico)} recibe un aviso con el motivo. Si el dinero ya salió, ajústalo con un descuento.
            </Aviso>
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
