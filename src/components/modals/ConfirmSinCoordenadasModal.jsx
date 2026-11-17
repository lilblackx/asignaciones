import DialogoConfirmacion from './DialogoConfirmacion';

// Aviso cuando la orden tiene NAP escrita pero no sus coordenadas: la plantilla
// de WhatsApp saldría sin la ubicación de la NAP. El usuario decide si guarda igual.
export default function ConfirmSinCoordenadasModal({ nap, isSubmitting, onCancel, onConfirm, textoConfirmar }) {
  return (
    <DialogoConfirmacion
      nivel="atencion"
      titulo="Faltan las coordenadas de la NAP"
      confirmLabel="Sí, guardar"
      procesando={isSubmitting}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p>La NAP <strong>{nap}</strong> no tiene coordenadas, así que la plantilla saldrá sin su ubicación. ¿{textoConfirmar} así?</p>
    </DialogoConfirmacion>
  );
}
