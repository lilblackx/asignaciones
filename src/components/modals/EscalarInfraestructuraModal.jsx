import { useState } from 'react';
import { HardHat, X } from 'lucide-react';
import Modal from '../Modal';
import { AccionesConfirmacion } from './DialogoConfirmacion';
import { stripEmojis } from '../../utils/sanitizeInput';
import { MAX_LARGO_MOTIVO, parseMotivo, puedeEscalar } from '../../utils/infraestructura';
import { cambioMientrasAbierta } from '../../utils/concurrencia';
import AvisoCambioDeOrden from '../AvisoCambioDeOrden';
import AvisoRevision from '../AvisoRevision';
import { claseArea } from '../estilos';

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
      <div className="bg-card rounded-card shadow-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto border border-border">
        <div className="encabezado-d bg-black px-4 py-3.5 border-b-2 border-orange-500 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-orange-500 text-black text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded tracking-wide">INFRAESTRUCTURA</span>
              <span className="text-xs font-bold text-orange-400">{ticket.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate">{ticket.nombre}</h2>
            <AvisoCambioDeOrden texto={cambio} encabezado />
            {!cambio && <AvisoRevision nombres={otrosRevisando} encabezado />}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 inline-flex items-center justify-center relative bg-zinc-800 p-1.5 rounded-full max-lg:after:absolute max-lg:after:-inset-2 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
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
              className={`${claseArea('normal')} resize-none`}
            />
            {error && <p role="alert" className="text-[11px] max-lg:text-xs text-red-700 dark:text-red-400 font-bold ml-1">{error}</p>}
            <p className="text-[11px] max-lg:text-xs text-muted-foreground ml-1">
              {esTecnico
                ? 'La orden sale de tu lista y la oficina recibe un aviso. Cuando infraestructura termine, la oficina decide cómo sigue.'
                : `La orden sale de la lista del técnico${ticket.tecnico ? ` (${ticket.tecnico})` : ''} y queda esperando en "En infraestructura". Tú decides cómo sigue.`}
            </p>
          </div>
          <AccionesConfirmacion
            nivel="atencion"
            cancelLabel="Cancelar"
            confirmLabel="Escalar la orden"
            procesando={enviando}
            procesandoLabel="Escalando..."
            confirmDisabled={Boolean(cambio)}
            onCancel={onClose}
            onConfirm={confirmar}
            className="pt-1"
          />
        </div>
      </div>
    </Modal>
  );
}
