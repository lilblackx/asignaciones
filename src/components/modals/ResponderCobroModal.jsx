import { useState } from 'react';
import { Cable, User } from 'lucide-react';
import Modal from '../Modal';
import CobroSelector from './CobroSelector';
import CobroAcordadoAviso from './CobroAcordadoAviso';
import { cobroInicialDeOrden } from '../../utils/cobroAcordado';
import { COBRO_EXONERADO, COBRO_OTRO, COBRO_VISITA, MONEDA_BS, parseMontoBs } from '../../utils/cobro';
import { consultaCobroDe, respuestaVigente, textoRespuesta } from '../../utils/consultaCobro';
import { AccionesConfirmacion } from './DialogoConfirmacion';
import { legible } from '../../utils/nombreTecnico';
import BotonCerrar from '../BotonCerrar';

// La oficina responde cuánto se cobra el recableado que consultó el técnico (ver utils/consultaCobro). Si ya había una
// respuesta para esos metros se puede cambiar. `onResponder(ticket, { exonerado, otro, moneda })` guarda y avisa al técnico.
export default function ResponderCobroModal({ ticket, onResponder, onClose }) {
  const consulta = consultaCobroDe(ticket);
  const respuesta = respuestaVigente(ticket);
  // Si al crear la orden se acordó un monto o la exoneración, el selector viene con eso ("Visita técnica" no aplica aquí).
  const [seleccion, setSeleccion] = useState(() => {
    const acordado = cobroInicialDeOrden(ticket);
    return acordado.modo === COBRO_VISITA ? { modo: COBRO_OTRO, otro: '', moneda: MONEDA_BS } : acordado;
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    const exonerado = seleccion.modo === COBRO_EXONERADO;
    if (!exonerado) {
      const monto = parseMontoBs(seleccion.otro);
      if (monto.error) { setError(monto.error); return; }
    }
    setEnviando(true);
    const ok = await onResponder(ticket, { exonerado, otro: seleccion.otro, moneda: seleccion.moneda });
    setEnviando(false);
    if (ok) onClose();
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-card rounded-card shadow-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto border border-border">
        <div className="encabezado-d bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white">COBRO DEL RECABLEADO</h2>
            <p className="text-xs text-zinc-300 mt-1 truncate">{ticket.codigo || 'S/C'} · {ticket.nombre}</p>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>

        <div className="p-4 space-y-4">
          {!consulta ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Esta orden ya no tiene una consulta de cobro.</p>
          ) : (
            <>
              <div className="rounded-campo border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                {ticket.tecnico && <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />Técnico: <span className="font-bold">{legible(ticket.tecnico)}</span></p>}
                <p className="flex items-center gap-1.5"><Cable className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />Drop que va a usar: <span className="font-black text-sm">{consulta.metros} m</span></p>
                {respuesta && <p className="pt-1 text-xs">Ya respondiste: <span className="font-black">{textoRespuesta(respuesta)}</span>. Puedes cambiarlo.</p>}
              </div>
              <CobroAcordadoAviso ticket={ticket} />
              <CobroSelector
                idBase="cobro-recableado"
                modos={[COBRO_OTRO, COBRO_EXONERADO]}
                tituloOtro="Monto"
                seleccion={seleccion}
                onChange={(siguiente) => { setSeleccion(siguiente); setError(''); }}
                error={error}
              />
              <AccionesConfirmacion
                nivel="atencion"
                cancelLabel="Cancelar"
                confirmLabel="Enviar al técnico"
                procesando={enviando}
                procesandoLabel="Enviando..."
                onCancel={onClose}
                onConfirm={confirmar}
                className="pt-1"
              />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
