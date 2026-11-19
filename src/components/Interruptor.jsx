// El interruptor de la app (encender o apagar algo): un botón `role="switch"` con la pista y la perilla. El área táctil de 44 px la pone index.css (el `::after` de los switch).
// `tono`: el color de la pista encendida: 'exito' (verde, lo normal) o 'atencion' (ámbar: encendido significa una alerta, como pausar lo automático).
const PISTA_ENCENDIDA = { exito: 'bg-emerald-600', atencion: 'bg-amber-600' };

export default function Interruptor({ id, activo, onCambiar, ariaLabel, ariaDescribedBy, titulo, deshabilitado = false, tono = 'exito', className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={activo}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      title={titulo}
      disabled={deshabilitado}
      onClick={() => onCambiar(!activo)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${activo ? PISTA_ENCENDIDA[tono] : 'bg-muted-foreground/70'} ${className}`}
    >
      <span aria-hidden="true" className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-5' : ''}`} />
    </button>
  );
}
