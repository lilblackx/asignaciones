// Un selector de pocas opciones excluyentes (dos o tres vistas de lo mismo): una pastilla gris con la opción activa en blanco, distinta de los chips de filtro y de las pestañas de sección.
// `compacto`: más bajo, para usarlo junto a un buscador. `opciones`: [{ id, etiqueta }]. `valor` / `onCambiar(id)`. `ariaLabel`: lo que se está eligiendo ("Qué ver").
export default function Segmentado({ opciones, valor, onCambiar, ariaLabel, compacto = false, className = '' }) {
  return (
    <div role="group" aria-label={ariaLabel} className={`inline-flex max-w-full overflow-x-auto rounded-boton bg-black/[0.06] dark:bg-white/10 p-1 gap-1 ${className}`}>
      {opciones.map(({ id, etiqueta }) => (
        <button
          key={id}
          type="button"
          aria-pressed={valor === id}
          onClick={() => onCambiar(id)}
          className={`min-w-0 shrink-0 ${compacto ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm'} rounded-campo font-bold whitespace-nowrap transition-colors ${valor === id ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'}`}
        >{etiqueta}</button>
      ))}
    </div>
  );
}
