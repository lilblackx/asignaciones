// Las pestañas de sección de una pantalla (hojas de un registro, secciones de un módulo): texto con el subrayado rojo en la activa, sobre una línea fina. Distintas de los chips de filtro y de `Segmentado`.
// `opciones`: [{ id, etiqueta }]. `valor` / `onCambiar(id)`. `ariaLabel`: qué se está eligiendo. En celular, si no caben, se desplazan de lado.
export default function Pestanas({ opciones, valor, onCambiar, ariaLabel, className = '' }) {
  return (
    <div className={`border-b border-border ${className}`}>
      <div role="tablist" aria-label={ariaLabel} className="flex overflow-x-auto [scrollbar-width:none]">
        {opciones.map(({ id, etiqueta }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={valor === id}
            onClick={() => onCambiar(id)}
            className={`shrink-0 h-11 px-3 sm:px-4 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${valor === id ? 'border-red-600 text-red-700 dark:text-red-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >{etiqueta}</button>
        ))}
      </div>
    </div>
  );
}
