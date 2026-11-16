import { ClipboardCheck } from 'lucide-react';
import Modal from '../Modal';
import Spinner from '../Spinner';
import { FichaDelPago } from '../PagoDelCliente';
import { formatoMontoBs, textoMonto } from '../../utils/cobro';
import { TIPO_PAGO } from '../../utils/pagoEnOrden';

const TITULO = { [TIPO_PAGO.PAGO]: '¿Registrar este pago?', [TIPO_PAGO.DESPUES]: '¿El cliente paga después?', [TIPO_PAGO.JUNTO]: '¿Pagó junto con otra orden?' };
const ACCION = { [TIPO_PAGO.PAGO]: 'Sí, registrar el pago', [TIPO_PAGO.DESPUES]: 'Sí, paga después', [TIPO_PAGO.JUNTO]: 'Sí, pagó junto con esa orden' };
const AVISO = {
  [TIPO_PAGO.PAGO]: 'Revisa que el monto, la forma de pago y la referencia estén bien.',
  [TIPO_PAGO.DESPUES]: 'Queda anotado que el cliente todavía no pagó.',
  [TIPO_PAGO.JUNTO]: 'Queda anotado que el cliente pagó esta orden junto con la otra.',
};

// Confirmación antes de registrar el pago del cliente: el técnico ve lo que va a quedar escrito y lo confirma, para no cargar datos de pago erróneos. Una vez registrado ya no lo puede cambiar: si se equivocó, solo
// el administrador puede corregirlo. `decision`: { tipo, pago, nota, compartidoCon, monedaDistinta, diferencia } (ver utils/pagoEnOrden); `cobro`: lo que la oficina cobró ({ monto, moneda }) o null (instalaciones).
// "Volver" va primero para que sea el botón con el cursor al abrir: un toque o un Enter de más no registra el pago por error.
export default function ConfirmarPagoModal({ ticket, decision, cobro = null, isSubmitting = false, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} zIndexClass="z-[120]">
      <div role="alertdialog" aria-labelledby="confirmar-pago-titulo" className="bg-card rounded-card shadow-2xl w-full max-w-sm max-h-[92dvh] flex flex-col overflow-hidden border border-border">
        <div className="overflow-y-auto px-6 pt-6 pb-4 text-center">
          <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <ClipboardCheck className="w-9 h-9 text-amber-600 dark:text-amber-500" aria-hidden="true" />
          </div>
          <h2 id="confirmar-pago-titulo" className="text-xl font-black text-foreground mb-1">{TITULO[decision.tipo]}</h2>
          <p className="text-sm font-bold text-foreground break-words">{ticket?.codigo || 'S/C'}{ticket?.nombre ? ` - ${ticket.nombre}` : ''}</p>
          {cobro && decision.tipo === TIPO_PAGO.PAGO && <p className="text-xs text-muted-foreground mt-0.5">Cobro de la orden: {textoMonto(formatoMontoBs(cobro.monto), cobro.moneda)}</p>}

          <div className="mt-3 rounded-campo bg-zinc-100 dark:bg-zinc-950 border border-border p-3 text-left">
            <FichaDelPago pago={decision} />
          </div>

          <p className="text-muted-foreground text-sm mt-3">
            {AVISO[decision.tipo]} Una vez registrado no lo puedes cambiar: si te equivocas, solo el administrador puede corregirlo.
          </p>
        </div>
        <div className="shrink-0 p-4 bg-sunken flex gap-3 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 min-h-[48px] py-3 text-card-foreground font-bold bg-card border-2 border-input hover:bg-secondary rounded-card transition-colors disabled:opacity-50 shadow-card">
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex-1 min-h-[48px] py-3 px-2 text-sm text-black font-black rounded-boton transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-400'}`}>
            {isSubmitting && <Spinner />}{isSubmitting ? 'Guardando...' : ACCION[decision.tipo]}
          </button>
        </div>
      </div>
    </Modal>
  );
}
