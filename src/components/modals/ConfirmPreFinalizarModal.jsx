import { ClipboardCheck } from 'lucide-react';
import DialogoConfirmacion from './DialogoConfirmacion';
import { ETIQUETA } from '../estilos';

// Confirmación antes de pre-finalizar: la orden pasa a revisión de la oficina y el técnico ya no la puede cambiar ni deshacer.
// "Volver" va primero para que sea el botón con el cursor al abrir: un toque o un Enter de más no pre-finaliza por error.
// `datos`: lo que se va a enviar (ver utils/confirmarPreFinalizar: serial, VLAN, NAP, metraje...), para que el técnico lo revise; el serial sale grande.
// `pago` (una instalación): el pago del cliente que el técnico anotó (ver FormularioPagoCliente); se le muestra para que lo revise, porque una vez enviado solo el administrador puede corregirlo.
export default function ConfirmPreFinalizarModal({ ticket, visita, datos = [], isSubmitting, onCancel, onConfirm }) {
  return (
    <DialogoConfirmacion
      nivel="atencion"
      icono={ClipboardCheck}
      ariaId="confirmar-prefinalizar-titulo"
      titulo="¿Pre-finalizar esta orden?"
      subtitulo={`${ticket.codigo || 'S/C'}${ticket.nombre ? ` - ${ticket.nombre}` : ''}`}
      confirmLabel="Sí, pre-finalizar"
      procesando={isSubmitting}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {visita && <p className="text-xs -mt-2">{visita}</p>}
      {datos.length > 0 && (
        <div className="rounded-campo bg-muted border border-border p-3 space-y-2.5">
          <p className="text-xs font-black tracking-wide text-card-foreground">DATOS QUE SE ENVÍAN</p>
          {datos.map((d) => (
            <div key={d.etiqueta} className="min-w-0">
              <p className={ETIQUETA}>{d.etiqueta}</p>
              <p className={`text-foreground whitespace-pre-line ${d.destacado ? 'text-xl font-black tracking-wide break-all' : 'text-sm font-bold break-words'}`}>{d.valor}</p>
            </div>
          ))}
        </div>
      )}
      <p>Pasa a revisión de la oficina y ya no podrás cambiarla. Si te equivocaste, solo la oficina puede devolvértela.</p>
    </DialogoConfirmacion>
  );
}
