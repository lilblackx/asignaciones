import { ClipboardCheck } from 'lucide-react';
import DialogoConfirmacion from './DialogoConfirmacion';
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
    <DialogoConfirmacion
      nivel="atencion"
      icono={ClipboardCheck}
      ariaId="confirmar-pago-titulo"
      zIndexClass="z-[120]"
      titulo={TITULO[decision.tipo]}
      subtitulo={`${ticket?.codigo || 'S/C'}${ticket?.nombre ? ` - ${ticket.nombre}` : ''}`}
      confirmLabel={ACCION[decision.tipo]}
      procesando={isSubmitting}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {cobro && decision.tipo === TIPO_PAGO.PAGO && <p className="text-xs -mt-2">Cobro de la orden: {textoMonto(formatoMontoBs(cobro.monto), cobro.moneda)}</p>}
      <div className="rounded-campo bg-muted border border-border p-3">
        <FichaDelPago pago={decision} />
      </div>
      <p>{AVISO[decision.tipo]} Una vez registrado no lo puedes cambiar: si te equivocas, solo el administrador puede corregirlo.</p>
    </DialogoConfirmacion>
  );
}
