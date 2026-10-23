// Las cifras de arriba de Finanzas y de Revisión de órdenes, sin cajas: el número grande, su etiqueta y una nota, con letra legible y contraste alto. En el celular van más compactas.
// items: [{ etiqueta, valor, detalle?, clave? }]. Si se pasa `onElegir`, cada cifra es un botón que elige su `clave` (la elegida, `elegida`, va en rojo y subrayada).
import { TARJETA } from './estilos';

export default function ResumenCifras({ items, onElegir, elegida }) {
  return (
    <section aria-label="Resumen" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} className={`${TARJETA} grid gap-x-3 sm:gap-x-8 p-4`}>
      {items.map(({ etiqueta, valor, detalle, clave }, i) => {
        const elegido = Boolean(onElegir) && elegida === clave;
        const contenido = (
          <>
            <p className={`text-base sm:text-lg lg:text-xl font-extrabold tabular-nums leading-none break-words ${elegido ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>{valor}</p>
            <p className={`mt-1 text-xs sm:text-xs font-semibold text-zinc-800 dark:text-zinc-100 ${elegido ? 'underline decoration-2 underline-offset-4 decoration-red-600' : ''}`}>{etiqueta}</p>
            {detalle && <p className="text-xs sm:text-xs text-zinc-600 dark:text-zinc-300 break-words">{detalle}</p>}
          </>
        );
        const borde = i > 0 ? 'border-l border-zinc-400 dark:border-zinc-700 pl-3 sm:pl-8' : '';
        return onElegir ? (
          <button key={etiqueta} type="button" onClick={() => onElegir(clave)} aria-pressed={elegido} className={`min-w-0 text-left hover:opacity-80 transition-opacity ${borde}`}>{contenido}</button>
        ) : (
          <div key={etiqueta} className={`min-w-0 ${borde}`}>{contenido}</div>
        );
      })}
    </section>
  );
}
