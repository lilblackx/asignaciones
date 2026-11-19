import { X } from 'lucide-react';

// El botón X del encabezado de toda ventana (modal): redondo, con el mismo gris suave en claro y oscuro, y el área táctil de 44 px en celular
// (el círculo mide 32 px; el resto es un borde invisible que también responde al toque).
//   onClick: cierra la ventana. grande: la X de 20 px (los encabezados con título largo). className: lo que cambia de sitio (por ejemplo `ml-auto`).
export default function BotonCerrar({ onClick, grande = false, className = '', title = 'Cerrar' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Cerrar"
      title={title}
      className={`relative shrink-0 inline-flex items-center justify-center p-2 rounded-full bg-secondary hover:bg-accent text-foreground transition-colors max-lg:after:absolute max-lg:after:-inset-1.5 ${className}`}
    >
      <X className={grande ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden="true" />
    </button>
  );
}
