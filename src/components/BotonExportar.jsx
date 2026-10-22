import { Download } from 'lucide-react';

// El aspecto de todos los botones de exportar de la app (borde, fondo y letra), para que se vean igual en cualquier módulo.
//   `grande`: la medida de los botones que van junto a una barra de búsqueda; sin ella, la de los botones de las barras de filtros.
export const CLASE_EXPORTAR = 'inline-flex items-center justify-center gap-1.5 border-2 border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-bold text-zinc-700 dark:text-zinc-200 hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const MEDIDA_EXPORTAR = 'px-3 py-2 rounded-lg text-xs';
export const MEDIDA_EXPORTAR_GRANDE = 'px-3 py-2.5 rounded-xl text-sm';

// `etiqueta`: el texto del botón (sin él, queda solo el icono); `etiquetaSoloPc`: en el celular se oculta el texto y queda el icono.
export default function BotonExportar({ onClick, disabled, title, ariaLabel, etiqueta, etiquetaSoloPc = false, grande = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || (etiqueta ? undefined : title)}
      className={`shrink-0 ${CLASE_EXPORTAR} ${grande ? MEDIDA_EXPORTAR_GRANDE : MEDIDA_EXPORTAR} ${className}`}
    >
      <Download className={grande ? 'w-4 h-4' : 'w-3.5 h-3.5'} aria-hidden="true" />
      {etiqueta && <span className={etiquetaSoloPc ? 'hidden sm:inline' : ''}>{etiqueta}</span>}
    </button>
  );
}
