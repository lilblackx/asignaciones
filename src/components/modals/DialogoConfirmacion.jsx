import { AlertTriangle } from 'lucide-react';
import Modal from '../Modal';
import Spinner from '../Spinner';
import { NIVELES } from '../nivelesAviso';

// Los botones de toda confirmación: "Volver" primero en el DOM (es el que recibe el foco con Tab, así un Enter de más no confirma por error) y la acción
// principal en cápsula con el brillo de su color. En celular van apilados con la acción arriba (a un pulgar de distancia); en PC, en fila.
//   nivel: 'error' (rojo: borrar, cancelar), 'atencion' (ámbar: pre-finalizar, registrar), 'info' (azul) o 'exito' (verde).
export function AccionesConfirmacion({ nivel = 'atencion', cancelLabel = 'Volver', confirmLabel = 'Confirmar', procesando = false, procesandoLabel = 'Guardando...', onCancel, onConfirm, confirmDisabled = false, className = '' }) {
  const n = NIVELES[nivel] || NIVELES.atencion;
  return (
    <div className={`flex flex-col-reverse gap-2.5 sm:flex-row sm:gap-3 ${className}`}>
      <button
        type="button"
        onClick={onCancel}
        disabled={procesando}
        className="sm:flex-1 min-h-12 px-4 rounded-boton border-2 border-input bg-card hover:bg-secondary text-card-foreground text-sm font-bold transition-colors disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={procesando || confirmDisabled}
        className={`sm:flex-1 min-h-12 px-4 rounded-boton inline-flex items-center justify-center gap-2 text-sm font-black transition-colors disabled:opacity-60 disabled:shadow-none ${n.boton}`}
      >
        {procesando && <Spinner />}{procesando ? procesandoLabel : confirmLabel}
      </button>
    </div>
  );
}

// La ventana de confirmación de la app (estilo D): un cuadro de ícono suave con el título al lado, el detalle, y los botones abajo.
//   titulo / subtitulo: la pregunta y, debajo, la orden o el dato que se confirma. children: el detalle. `pie`: algo entre el detalle y los botones.
//   El resto de props son las de AccionesConfirmacion. `ariaId`: id del título para el nombre accesible.
export default function DialogoConfirmacion({ nivel = 'atencion', icono: Icono = AlertTriangle, titulo, subtitulo, children, ariaId = 'confirmacion-titulo', zIndexClass = 'z-[70]', ancho = 'max-w-sm', ...acciones }) {
  const n = NIVELES[nivel] || NIVELES.atencion;
  return (
    <Modal onClose={acciones.onCancel} zIndexClass={zIndexClass}>
      <div role="alertdialog" aria-labelledby={ariaId} className={`bg-card rounded-card shadow-2xl w-full ${ancho} max-h-[92dvh] flex flex-col overflow-hidden border border-border`}>
        <div className="overflow-y-auto p-6 pb-4">
          <div className="flex items-start gap-3.5">
            <div className={`shrink-0 w-12 h-12 rounded-campo flex items-center justify-center ${n.tile}`}>
              <Icono className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 id={ariaId} className="text-lg font-black leading-tight text-foreground">{titulo}</h2>
              {subtitulo && <p className="text-sm font-bold text-muted-foreground mt-0.5 break-words">{subtitulo}</p>}
            </div>
          </div>
          {children && <div className="mt-4 text-sm text-muted-foreground space-y-3 [&_strong]:text-foreground">{children}</div>}
        </div>
        <AccionesConfirmacion nivel={nivel} className="shrink-0 px-6 pb-6 pt-2" {...acciones} />
      </div>
    </Modal>
  );
}
