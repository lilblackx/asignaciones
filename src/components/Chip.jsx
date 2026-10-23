import { claseChip } from './estilos';

// Un chip de filtro: botón que se marca en rojo cuando está elegido (`activo`). `tamano`: normal, compacto (letra pequeña) o angosto (para filas apretadas en el celular).
export default function Chip({ activo, tamano = 'normal', className = '', type = 'button', children, ...resto }) {
  return <button type={type} aria-pressed={activo} className={`${claseChip(activo, tamano)} ${className}`} {...resto}>{children}</button>;
}
