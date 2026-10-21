import NumeroContado from '../NumeroContado';

// Las cifras de arriba de Finanzas, sin cajas, como los totales del mes de ventas (TotalesMes): el número grande, su etiqueta y una nota.
// items: [{ etiqueta, valor, detalle? }]
export default function ResumenCifras({ items }) {
  return (
    <section aria-label="Resumen" className="flex flex-wrap gap-x-8 gap-y-3 pt-3">
      {items.map(({ etiqueta, valor, detalle }, i) => (
        <div key={etiqueta} className={`min-w-0 ${i > 0 ? 'sm:border-l sm:border-zinc-300 sm:dark:border-zinc-700 sm:pl-8' : ''}`}>
          <p className="text-3xl font-black tabular-nums leading-none text-zinc-900 dark:text-white whitespace-nowrap"><NumeroContado valor={valor} /></p>
          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{etiqueta}</p>
          {detalle && <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{detalle}</p>}
        </div>
      ))}
    </section>
  );
}
