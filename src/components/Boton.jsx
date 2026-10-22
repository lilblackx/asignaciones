import { claseBoton } from './estilos';

// El botón de la app. `variante`: principal (la acción de la pantalla, rojo), secundario (borde gris), peligro (borde rojo, para anular o borrar)
// o discreto (sin borde). `tamano`: compacto (dentro de una fila), normal o grande. Con `icono` (un componente de lucide) lleva el icono antes del texto.
// `girando`: el icono da vueltas (mientras algo se actualiza).
// El resto de las props (onClick, disabled, title, aria-label, type...) pasan al botón.
export default function Boton({ variante = 'secundario', tamano = 'normal', icono: Icono = null, girando = false, className = '', type = 'button', children, ...resto }) {
  return (
    <button type={type} className={`${claseBoton(variante, tamano)} ${className}`} {...resto}>
      {Icono && <Icono className={`${tamano === 'compacto' ? 'w-3.5 h-3.5' : 'w-4 h-4'} shrink-0 ${girando ? 'animate-spin' : ''}`} aria-hidden="true" />}
      {children}
    </button>
  );
}
