import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import DialogoConfirmacion from './DialogoConfirmacion';
import CampoFecha from '../CampoFecha';
import { claseFecha } from '../estilos';

// El color de cada confirmación se traduce al nivel del diálogo común: rojo = error, azul = info, amarillo = atención.
const NIVEL_DE = { red: 'error', blue: 'info', yellow: 'atencion' };

// Confirmación genérica (Eliminar / Retirar asignación / Confirmar cierre, etc.)
// — un solo componente con tema por color en vez de tres modales casi idénticos.
export default function ConfirmModal({
  color = 'red',
  icon: Icon = AlertTriangle,
  title,
  description,
  confirmLabel = 'Confirmar',
  processingLabel = 'Procesando...',
  cancelLabel = 'Cancelar',
  dateInput,
  setDateInput,
  isProcessing: externalProcessing,
  zIndexClass = 'z-[70]',
  children,
  onCancel,
  onConfirm
}) {
  const [internalProcessing, setInternalProcessing] = useState(false);
  // Cierre de jornada controla su propio isProcessing desde afuera (lo comparte
  // con otras acciones); Eliminar/Retirar lo manejan solos alrededor de onConfirm.
  const isControlled = externalProcessing !== undefined;
  const isProcessing = isControlled ? externalProcessing : internalProcessing;

  const handleConfirm = async () => {
    if (isControlled) {
      onConfirm();
      return;
    }
    setInternalProcessing(true);
    await onConfirm();
    setInternalProcessing(false);
  };

  return (
    <DialogoConfirmacion
      nivel={NIVEL_DE[color] || 'error'}
      icono={Icon}
      titulo={title}
      zIndexClass={zIndexClass}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      procesando={isProcessing}
      procesandoLabel={processingLabel}
      onCancel={onCancel}
      onConfirm={handleConfirm}
    >
      {description && <p>{description}</p>}
      {children}
      {dateInput !== undefined && setDateInput && (
        <div className="space-y-1">
          <label htmlFor="confirm-fecha" className="text-xs font-bold text-muted-foreground ml-1">Fecha del reporte</label>
          <CampoFecha id="confirm-fecha" ariaLabel="Fecha del reporte" valor={dateInput} onChange={(v) => v && setDateInput(v)} clase={claseFecha('grande')} />
        </div>
      )}
    </DialogoConfirmacion>
  );
}
