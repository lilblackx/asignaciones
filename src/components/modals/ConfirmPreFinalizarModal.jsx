import { ClipboardCheck } from 'lucide-react';
import Modal from '../Modal';
import Spinner from '../Spinner';
import { FichaDelPago } from '../PagoDelCliente';
import { ETIQUETA } from '../estilos';

// Confirmación antes de pre-finalizar: la orden pasa a revisión de la oficina y el técnico ya no la puede cambiar ni deshacer.
// "Volver" va primero para que sea el botón con el cursor al abrir: un toque o un Enter de más no pre-finaliza por error.
// `datos`: lo que se va a enviar (ver utils/confirmarPreFinalizar: serial, VLAN, NAP, metraje...), para que el técnico lo revise; el serial sale grande.
// `pago` (una instalación): el pago del cliente que el técnico anotó (ver FormularioPagoCliente); se le muestra para que lo revise, porque una vez enviado solo el administrador puede corregirlo.
export default function ConfirmPreFinalizarModal({ ticket, visita, datos = [], pago = null, isSubmitting, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} zIndexClass="z-[70]">
      <div role="alertdialog" aria-labelledby="confirmar-prefinalizar-titulo" className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm max-h-[92dvh] flex flex-col overflow-hidden text-center border border-zinc-300 dark:border-zinc-800">
        <div className="overflow-y-auto pt-6 pb-4 px-6 flex flex-col items-center">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full mb-4">
            <ClipboardCheck className="w-10 h-10 text-amber-600 dark:text-amber-500" aria-hidden="true" />
          </div>
          <h2 id="confirmar-prefinalizar-titulo" className="text-xl font-black text-zinc-900 dark:text-white mb-2">¿Pre-finalizar esta orden?</h2>
          <p className="text-sm font-bold text-zinc-900 dark:text-white break-words">
            {ticket.codigo || 'S/C'}{ticket.nombre ? ` - ${ticket.nombre}` : ''}
          </p>
          {visita && <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{visita}</p>}
          {datos.length > 0 && (
            <div className="mt-3 w-full rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 text-left space-y-2.5">
              <p className="text-xs font-black tracking-wide text-zinc-700 dark:text-zinc-300">DATOS QUE SE ENVÍAN</p>
              {datos.map((d) => (
                <div key={d.etiqueta} className="min-w-0">
                  <p className={ETIQUETA}>{d.etiqueta}</p>
                  <p className={`text-zinc-900 dark:text-white whitespace-pre-line ${d.destacado ? 'text-xl font-black tracking-wide break-all' : 'text-sm font-bold break-words'}`}>{d.valor}</p>
                </div>
              ))}
            </div>
          )}
          {pago && (
            <div className="mt-3 w-full rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-3 text-left">
              <p className="text-xs font-black tracking-wide text-zinc-700 dark:text-zinc-300 mb-1.5">PAGO DEL CLIENTE</p>
              <FichaDelPago pago={pago} />
            </div>
          )}
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-3">
            Pasa a revisión de la oficina y ya no podrás cambiarla. Si te equivocaste, solo la oficina puede devolvértela.
            {pago ? ' Lo mismo con el pago: revisa que esté bien, porque solo el administrador puede corregirlo.' : ''}
          </p>
        </div>
        <div className="shrink-0 p-6 bg-zinc-50 dark:bg-zinc-950 flex gap-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 min-h-[48px] py-3 text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 border-2 border-zinc-400 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50">
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex-1 min-h-[48px] py-3 text-black font-black rounded-xl transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-400'}`}>
            {isSubmitting && <Spinner />}{isSubmitting ? 'Guardando...' : 'Sí, pre-finalizar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
