// Las cifras de arriba de Finanzas, sin cajas: el número grande, su etiqueta y una nota, con letra legible y contraste alto. En el celular van en tres columnas más compactas.
// items: [{ etiqueta, valor, detalle? }]
export default function ResumenCifras({ items }) {
  return (
    <section aria-label="Resumen" className="grid grid-cols-3 gap-x-3 sm:gap-x-8 pt-2">
      {items.map(({ etiqueta, valor, detalle }, i) => (
        <div key={etiqueta} className={`min-w-0 ${i > 0 ? 'border-l-2 border-zinc-300 dark:border-zinc-700 pl-3 sm:pl-8' : ''}`}>
          <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold tabular-nums leading-none text-zinc-900 dark:text-white break-words">{valor}</p>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-100">{etiqueta}</p>
          {detalle && <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 break-words">{detalle}</p>}
        </div>
      ))}
    </section>
  );
}
