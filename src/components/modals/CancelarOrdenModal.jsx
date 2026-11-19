import { useState } from 'react';
import { Ban } from 'lucide-react';
import Modal from '../Modal';
import { AccionesConfirmacion } from './DialogoConfirmacion';
import AvisoCambioDeOrden from '../AvisoCambioDeOrden';
import { stripEmojis } from '../../utils/sanitizeInput';
import { MAX_LARGO_MOTIVO_CANCELACION, parseMotivoCancelacion } from '../../utils/cancelacion';
import { cambioMientrasAbierta } from '../../utils/concurrencia';
import { claseArea } from '../estilos';
import BotonCerrar from '../BotonCerrar';

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
      <div className="bg-card rounded-card shadow-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto border border-border">
        <div className="encabezado-d bg-black px-4 py-3.5 border-b-2 border-red-600 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-red-600 text-white text-etiqueta font-black px-2 py-0.5 rounded">Cancelar orden</span>
              <span className="text-xs font-bold text-red-400">{ticket.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate">{ticket.nombre}</h2>
            <AvisoCambioDeOrden texto={cambio} encabezado />
          </div>
          <BotonCerrar onClick={onClose} />
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <label htmlFor="motivo-cancelar-orden" className="text-xs font-bold text-red-700 dark:text-red-400 ml-1 flex items-center gap-1">
              <Ban className="w-3.5 h-3.5" aria-hidden="true" /> Motivo de la cancelación <span className="font-normal">(obligatorio)</span>
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
              className={`${claseArea('normal')} resize-none`}
            />
            {error && <p role="alert" className="text-etiqueta text-red-700 dark:text-red-400 font-bold ml-1">{error}</p>}
            <p className="text-etiqueta text-muted-foreground ml-1">
              La orden queda CANCELADA y se ve en la lista, el historial, ventas y los reportes.{ticket.tecnico ? ` ${ticket.tecnico} recibe un aviso con el motivo.` : ''}
            </p>
          </div>
          <AccionesConfirmacion
            nivel="error"
            cancelLabel="Volver"
            confirmLabel="Cancelar la orden"
            procesando={enviando}
            procesandoLabel="Cancelando..."
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
