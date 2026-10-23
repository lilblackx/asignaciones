import { useState } from 'react';
import { HardHat, X } from 'lucide-react';
import Modal from '../Modal';
import Spinner from '../Spinner';
import { stripEmojis } from '../../utils/sanitizeInput';
import { MAX_LARGO_MOTIVO, parseMotivo, puedeEscalar } from '../../utils/infraestructura';
import { cambioMientrasAbierta } from '../../utils/concurrencia';
import AvisoCambioDeOrden from '../AvisoCambioDeOrden';
import AvisoRevision from '../AvisoRevision';

// El técnico (o la oficina) deja la orden esperando a infraestructura, con el motivo (ver utils/infraestructura).
// `onConfirmar(ticket, motivo)` guarda y avisa; devuelve true si se pudo. `esTecnico` solo cambia lo que se explica.
export default function EscalarInfraestructuraModal({ ticket, otrosRevisando = [], esTecnico = false, onConfirmar, onClose }) {
  const [abierta] = useState(ticket);
  // Si otra persona la cambió mientras tanto (la finalizó, la canceló, ya la escaló...), se avisa y no se deja escalar.
  const cambio = cambioMientrasAbierta(abierta, ticket) || (puedeEscalar(abierta) && !puedeEscalar(ticket) ? 'Ya no se puede escalar a infraestructura.' : null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (cambio) return;
    const revisado = parseMotivo(motivo);
    if (revisado.error) { setError(revisado.error); return; }
    setEnviando(true);
    const ok = await onConfirmar(ticket, revisado.valor);
    setEnviando(false);
    if (ok) onClose();
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-orange-500 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-orange-500 text-black text-[10px] font-black px-2 py-0.5 rounded tracking-wide">INFRAESTRUCTURA</span>
              <span className="text-xs font-bold text-orange-400">{ticket.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate">{ticket.nombre}</h2>
            <AvisoCambioDeOrden texto={cambio} encabezado />
            {!cambio && <AvisoRevision nombres={otrosRevisando} encabezado />}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <label htmlFor="motivo-infraestructura" className="text-xs font-bold text-orange-700 dark:text-orange-400 ml-1 flex items-center gap-1">
              <HardHat className="w-3.5 h-3.5" aria-hidden="true" /> ¿QUÉ HACE FALTA DE INFRAESTRUCTURA? <span className="font-normal">(obligatorio)</span>
            </label>
            <textarea
              id="motivo-infraestructura"
              value={motivo}
              onChange={(e) => { setMotivo(stripEmojis(e.target.value)); setError(''); }}
              rows={4}
              maxLength={MAX_LARGO_MOTIVO}
              autoFocus
              aria-invalid={!!error}
              placeholder="Ej. Falta un poste frente a la casa, la NAP está sin puertos..."
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 rounded-xl p-3 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            {error && <p role="alert" className="text-[11px] text-red-500 font-bold ml-1">{error}</p>}
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 ml-1">
              {esTecnico
                ? 'La orden sale de tu lista y la oficina recibe un aviso. Cuando infraestructura termine, la oficina decide cómo sigue.'
                : `La orden sale de la lista del técnico${ticket.tecnico ? ` (${ticket.tecnico})` : ''} y queda esperando en "En infraestructura". Tú decides cómo sigue.`}
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={enviando} className="flex-1 py-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
            <button type="button" onClick={confirmar} disabled={enviando || Boolean(cambio)} className="flex-1 py-3 text-xs font-black text-black bg-orange-500 hover:bg-orange-400 rounded-xl transition-colors disabled:opacity-50">{enviando && <Spinner />}{enviando ? 'Escalando...' : 'Escalar a infraestructura'}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
