import { useState } from 'react';
import { Cable, User, X } from 'lucide-react';
import Modal from '../Modal';
import CobroSelector from './CobroSelector';
import { COBRO_EXONERADO, COBRO_OTRO, MONEDA_BS, parseMontoBs } from '../../utils/cobro';
import { consultaCobroDe, respuestaVigente, textoRespuesta } from '../../utils/consultaCobro';
import Spinner from '../Spinner';

// La oficina responde cuánto se cobra el recableado que consultó el técnico (ver utils/consultaCobro). Si ya había una
// respuesta para esos metros se puede cambiar. `onResponder(ticket, { exonerado, otro, moneda })` guarda y avisa al técnico.
export default function ResponderCobroModal({ ticket, onResponder, onClose }) {
  const consulta = consultaCobroDe(ticket);
  const respuesta = respuestaVigente(ticket);
  const [seleccion, setSeleccion] = useState({ modo: COBRO_OTRO, otro: '', moneda: MONEDA_BS });
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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-amber-500 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-black text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded tracking-wide">COBRO DEL RECABLEADO</span>
              <span className="text-xs font-bold text-amber-400">{ticket.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate">{ticket.nombre}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!consulta ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Esta orden ya no tiene una consulta de cobro.</p>
          ) : (
            <>
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                {ticket.tecnico && <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />Técnico: <span className="font-bold">{ticket.tecnico}</span></p>}
                <p className="flex items-center gap-1.5"><Cable className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />Drop que va a usar: <span className="font-black text-sm">{consulta.metros} m</span></p>
                {respuesta && <p className="pt-1 text-[11px] max-lg:text-xs">Ya respondiste: <span className="font-black">{textoRespuesta(respuesta)}</span>. Puedes cambiarlo.</p>}
              </div>
              <CobroSelector
                idBase="cobro-recableado"
                modos={[COBRO_OTRO, COBRO_EXONERADO]}
                tituloOtro="Monto"
                seleccion={seleccion}
                onChange={(siguiente) => { setSeleccion(siguiente); setError(''); }}
                error={error}
              />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} disabled={enviando} className="flex-1 py-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={confirmar} disabled={enviando} className="flex-1 py-3 text-xs font-black text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors disabled:opacity-50">{enviando && <Spinner />}{enviando ? 'Enviando...' : 'Enviar al técnico'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
