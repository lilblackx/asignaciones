import { useState } from 'react';
import { Ban, X } from 'lucide-react';
import Modal from '../Modal';
import Spinner from '../Spinner';
import AvisoCambioDeOrden from '../AvisoCambioDeOrden';
import { stripEmojis } from '../../utils/sanitizeInput';
import { MAX_LARGO_MOTIVO_CANCELACION, parseMotivoCancelacion } from '../../utils/cancelacion';
import { cambioMientrasAbierta } from '../../utils/concurrencia';

// Cancelar una orden (el único estado de "baja" que existe: ya no hay eliminadas). Pide el motivo, que se ve en la lista, el historial, ventas y los
// reportes. `ticket` es la orden en vivo: si otra persona la cancela o la finaliza mientras se escribe el motivo, se avisa y no se deja cancelar.
// `onConfirmar(ticket, motivo)` guarda y avisa al técnico; devuelve true si se pudo.
export default function CancelarOrdenModal({ ticket, onConfirmar, onClose }) {
  const [abierta] = useState(ticket);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const cambio = cambioMientrasAbierta(abierta, ticket);

  const confirmar = async () => {
    if (cambio) return;
    const revisado = parseMotivoCancelacion(motivo);
    if (revisado.error) { setError(revisado.error); return; }
    setEnviando(true);
    const ok = await onConfirmar(ticket, revisado.valor);
    setEnviando(false);
    if (ok) onClose();
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-[70]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-wide">CANCELAR ORDEN</span>
              <span className="text-xs font-bold text-red-400">{ticket.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate">{ticket.nombre}</h2>
            <AvisoCambioDeOrden texto={cambio} encabezado />
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <label htmlFor="motivo-cancelar-orden" className="text-xs font-bold text-red-600 dark:text-red-400 ml-1 flex items-center gap-1">
              <Ban className="w-3.5 h-3.5" aria-hidden="true" /> MOTIVO DE LA CANCELACIÓN <span className="font-normal">(obligatorio)</span>
            </label>
            <textarea
              id="motivo-cancelar-orden"
              value={motivo}
              onChange={(e) => { setMotivo(stripEmojis(e.target.value)); setError(''); }}
              rows={3}
              maxLength={MAX_LARGO_MOTIVO_CANCELACION}
              autoFocus
              aria-invalid={!!error}
              placeholder="Ej. El cliente ya no quiere el servicio, no hay cobertura en la zona, la orden se cargó por error..."
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 rounded-xl p-3 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            {error && <p role="alert" className="text-[11px] text-red-500 font-bold ml-1">{error}</p>}
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 ml-1">
              La orden queda CANCELADA y se ve en la lista, el historial, ventas y los reportes.{ticket.tecnico ? ` ${ticket.tecnico} recibe un aviso con el motivo.` : ''}
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={enviando} className="flex-1 py-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50">Volver</button>
            <button type="button" onClick={confirmar} disabled={enviando || Boolean(cambio)} className="flex-1 py-3 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50">{enviando && <Spinner />}{enviando ? 'Cancelando...' : 'Cancelar la orden'}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
