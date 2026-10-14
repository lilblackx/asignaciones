import { useState } from 'react';
import ConfirmModal from './ConfirmModal';
import CobroSelector from './CobroSelector';
import { COBRO_INICIAL, llevaCobro, resolverCobro } from '../../utils/cobro';

// Finalizar una orden directo desde la tabla. Si la orden lleva cobro (visita de conector o instalación),
// antes de finalizar se elige el cobro que verá el técnico: "Visita técnica" (el de siempre), "Otro monto" o "Exonerar".
export default function FinalizarOrdenModal({ ticket, montoBs, onCancel, onConfirm }) {
  const conCobro = llevaCobro(ticket);
  const [cobro, setCobro] = useState(COBRO_INICIAL);
  const [error, setError] = useState('');

  const confirmar = async () => {
    if (!conCobro) {
      await onConfirm();
      return;
    }
    const resuelto = resolverCobro(cobro, montoBs);
    if (resuelto.error) {
      setError(resuelto.error);
      return;
    }
    await onConfirm({ montoBs: resuelto.cobroBs, cobroTipo: resuelto.tipo });
  };

  return (
    <ConfirmModal
      color="blue"
      title="¿Finalizar Orden?"
      description={`La orden ${ticket.codigo || ''} (${ticket.nombre || 'sin nombre'}) pasará a FINALIZADO y quedará registrado en el historial.`}
      confirmLabel="Sí, Finalizar"
      processingLabel="Finalizando..."
      zIndexClass="z-[70]"
      onCancel={onCancel}
      onConfirm={confirmar}
    >
      {conCobro && (
        <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-xl p-3">
          <CobroSelector
            idBase="cobro-finalizar"
            montoVisita={montoBs}
            seleccion={cobro}
            onChange={(siguiente) => { setCobro(siguiente); setError(''); }}
            error={error}
          />
        </div>
      )}
    </ConfirmModal>
  );
}
