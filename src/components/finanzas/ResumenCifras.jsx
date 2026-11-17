// Las cifras de arriba de Finanzas y de Revisión de órdenes, sin cajas: el número grande, su etiqueta y una nota, con letra legible y contraste alto. En el celular van más compactas.
// items: [{ etiqueta, valor, detalle?, clave? }]. Si se pasa `onElegir`, cada cifra es un botón que elige su `clave` (la elegida, `elegida`, va en rojo y subrayada).
import { TARJETA } from './estilos';

// `variante="tarjetas"`: una tarjeta por cifra, con el número grande (Revisión de órdenes); la elegida lleva borde rojo. Sin ella, la fila única de siempre (Finanzas).
export default function ResumenCifras({ items, onElegir, elegida, variante = 'unica' }) {
  if (variante === 'tarjetas') {
    return (
      <section aria-label="Resumen" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(({ etiqueta, valor, detalle, clave }) => {
          const elegido = Boolean(onElegir) && elegida === clave;
          const clases = `min-w-0 text-left p-4 bg-card rounded-card shadow-card border-2 ${elegido ? 'border-red-600' : 'border-transparent'}`;
          const contenido = (
            <>
              <p className="text-xs font-semibold text-muted-foreground">{etiqueta}</p>
              <p className={`mt-1 text-3xl font-black tabular-nums leading-none break-words ${elegido ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>{valor}</p>
              {detalle && <p className="mt-1.5 text-xs font-semibold text-muted-foreground break-words">{detalle}</p>}
            </>
          );
          return onElegir ? (
            <button key={etiqueta} type="button" onClick={() => onElegir(clave)} aria-pressed={elegido} className={`${clases} hover:shadow-md transition-shadow`}>{contenido}</button>
          ) : (
            <div key={etiqueta} className={clases}>{contenido}</div>
          );
        })}
      </section>
    );
  }
  return (
    <section aria-label="Resumen" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} className={`${TARJETA} grid gap-x-3 sm:gap-x-8 p-4`}>
      {items.map(({ etiqueta, valor, detalle, clave }, i) => {
        const elegido = Boolean(onElegir) && elegida === clave;
        const contenido = (
          <>
            <p className={`text-base sm:text-lg lg:text-xl font-extrabold tabular-nums leading-none break-words ${elegido ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>{valor}</p>
            <p className={`mt-1 text-xs sm:text-xs font-semibold text-zinc-800 dark:text-zinc-100 ${elegido ? 'underline decoration-2 underline-offset-4 decoration-red-600' : ''}`}>{etiqueta}</p>
            {detalle && <p className="text-xs sm:text-xs text-zinc-600 dark:text-zinc-300 break-words">{detalle}</p>}
          </>
        );
        const borde = i > 0 ? 'border-l border-input pl-3 sm:pl-8' : '';
        return onElegir ? (
          <button key={etiqueta} type="button" onClick={() => onElegir(clave)} aria-pressed={elegido} className={`min-w-0 text-left hover:opacity-80 transition-opacity ${borde}`}>{contenido}</button>
        ) : (
          <div key={etiqueta} className={`min-w-0 ${borde}`}>{contenido}</div>
        );
      })}
    </section>
  );
}
