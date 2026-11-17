// Un selector de pocas opciones excluyentes (dos o tres vistas de lo mismo): una pastilla gris con la opción activa en blanco, distinta de los chips de filtro y de las pestañas de sección.
// `opciones`: [{ id, etiqueta }]. `valor` / `onCambiar(id)`. `ariaLabel`: lo que se está eligiendo ("Qué ver").
export default function Segmentado({ opciones, valor, onCambiar, ariaLabel, className = '' }) {
  return (
    <div role="group" aria-label={ariaLabel} className={`inline-flex max-w-full rounded-boton bg-black/[0.06] dark:bg-white/10 p-1 gap-1 ${className}`}>
      {opciones.map(({ id, etiqueta }) => (
        <button
          key={id}
          type="button"
          aria-pressed={valor === id}
          onClick={() => onCambiar(id)}
          className={`min-w-0 h-9 px-4 rounded-campo text-sm font-bold transition-colors ${valor === id ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'}`}
        >{etiqueta}</button>
      ))}
    </div>
  );
}
