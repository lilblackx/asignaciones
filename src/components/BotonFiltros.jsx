import { SlidersHorizontal } from 'lucide-react';
import { BOTON_BARRA, BOTON_BARRA_ACTIVO, BOTON_BARRA_NORMAL } from './estilos';

// El botón "Filtros" que va junto a la barra de búsqueda y abre o cierra el panel de filtros. Muestra cuántos filtros hay puestos (`cuenta`).
export default function BotonFiltros({ abierto, onClick, cuenta = 0 }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={abierto} aria-label="Filtros" className={`${BOTON_BARRA} ${abierto ? BOTON_BARRA_ACTIVO : BOTON_BARRA_NORMAL}`}>
      <SlidersHorizontal className={`w-4 h-4 transition-transform duration-200 ${abierto ? 'lg:rotate-90' : ''}`} aria-hidden="true" />
      <span className="hidden sm:inline">Filtros</span>
      {cuenta > 0 && <span className="rounded-full bg-red-600 text-white text-[10px] leading-none px-1.5 py-1">{cuenta}</span>}
    </button>
  );
}
