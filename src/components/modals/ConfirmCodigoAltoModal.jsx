import DialogoConfirmacion from './DialogoConfirmacion';

// Confirmación cuando un código escrito a mano se salta números del correlativo
// (ej. "AO150" cuando el último es AO15): el contador se movería hasta ese número.
export default function ConfirmCodigoAltoModal({ salto, isSubmitting, onCancel, onConfirm }) {
  return (
    <DialogoConfirmacion
      nivel="atencion"
      titulo="¿Código fuera de secuencia?"
      cancelLabel="Corregir"
      confirmLabel="Sí, usar ese"
      procesando={isSubmitting}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p>El último código es el número <strong>{salto.ultimo}</strong> y escribiste <strong>{salto.codigo}</strong>. El siguiente en la secuencia sería el <strong>{salto.esperado}</strong>.</p>
      <p>Si continúas, las próximas órdenes automáticas seguirán desde {salto.codigo}. ¿Es correcto?</p>
    </DialogoConfirmacion>
  );
}
