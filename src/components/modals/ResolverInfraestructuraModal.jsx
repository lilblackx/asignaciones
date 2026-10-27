import { useState } from 'react';
import { CheckCircle2, HardHat, Undo2, User, X } from 'lucide-react';
import Modal from '../Modal';
import Spinner from '../Spinner';
import { stripEmojis } from '../../utils/sanitizeInput';
import AvisoRevision from '../AvisoRevision';
import { MAX_LARGO_MOTIVO, RESULTADO_CERRADA, RESULTADO_DEVUELTA, enInfraestructura, infraestructuraDe, textoOrigen } from '../../utils/infraestructura';

const OPCIONES = [
  {
    resultado: RESULTADO_DEVUELTA,
    titulo: 'Volver al técnico',
    detalle: 'Infraestructura ya hizo lo suyo. La orden regresa a la lista del técnico para que la termine. Para pasarla a otro técnico, cámbialo después desde Editar.',
    Icono: Undo2,
  },
  {
    resultado: RESULTADO_CERRADA,
    titulo: 'Cerrar como trabajo adicional (TA)',
    detalle: 'La visita termina aquí: se finaliza sin cobro y cuenta como "trabajos adicionales (infra)" en los reportes.',
    Icono: CheckCircle2,
  },
];

// La oficina resuelve una orden que está esperando a infraestructura (ver utils/infraestructura). `onResolver(ticket, { resultado, nota })`
// guarda y avisa al técnico; devuelve true si se pudo.
export default function ResolverInfraestructuraModal({ ticket, otrosRevisando = [], onResolver, onClose }) {
  const infra = infraestructuraDe(ticket);
  const [resultado, setResultado] = useState(RESULTADO_DEVUELTA);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const espera = enInfraestructura(ticket);

  const confirmar = async () => {
    setEnviando(true);
    const ok = await onResolver(ticket, { resultado, nota });
    setEnviando(false);
    if (ok) onClose();
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-orange-500 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-orange-500 text-black text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded tracking-wide">EN INFRAESTRUCTURA</span>
              <span className="text-xs font-bold text-orange-400">{ticket.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate">{ticket.nombre}</h2>
            <AvisoRevision nombres={otrosRevisando} encabezado />
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!espera ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Esta orden ya no está esperando a infraestructura.</p>
          ) : (
            <>
              <div className="rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/30 p-3 space-y-1 text-xs text-orange-900 dark:text-orange-200">
                {ticket.tecnico && <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />Técnico: <span className="font-bold">{ticket.tecnico}</span></p>}
                <p className="flex items-start gap-1.5"><HardHat className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" /><span className="min-w-0 break-words">Escalada por {textoOrigen(infra)}{infra.por ? ` (${infra.por})` : ''}: <span className="font-black">{infra.motivo}</span></span></p>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1 mb-1">¿CÓMO SIGUE?</legend>
                {OPCIONES.map(({ resultado: valor, titulo, detalle, Icono }) => (
                  <label key={valor} className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors ${resultado === valor ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30' : 'border-zinc-400 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                    <input type="radio" name="resultado-infraestructura" value={valor} checked={resultado === valor} onChange={() => setResultado(valor)} className="mt-0.5 accent-orange-600" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-black text-zinc-900 dark:text-white"><Icono className="w-4 h-4 shrink-0" aria-hidden="true" />{titulo}</span>
                      <span className="block text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 leading-snug mt-0.5">{detalle}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="space-y-1">
                <label htmlFor="nota-infraestructura" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">NOTA PARA EL TÉCNICO <span className="font-normal text-zinc-600 dark:text-zinc-400">(opcional)</span></label>
                <textarea
                  id="nota-infraestructura"
                  value={nota}
                  onChange={(e) => setNota(stripEmojis(e.target.value))}
                  rows={2}
                  maxLength={MAX_LARGO_MOTIVO}
                  placeholder="Ej. Poste instalado, ya puedes tender el cable."
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 rounded-xl p-3 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} disabled={enviando} className="flex-1 py-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={confirmar} disabled={enviando} className="flex-1 py-3 text-xs font-black text-black bg-orange-500 hover:bg-orange-400 rounded-xl transition-colors disabled:opacity-50">{enviando && <Spinner />}{enviando ? 'Guardando...' : resultado === RESULTADO_CERRADA ? 'Cerrar como TA' : 'Devolver al técnico'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
