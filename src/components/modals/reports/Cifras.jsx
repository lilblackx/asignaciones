// Las cifras grandes de arriba de cada reporte. items: [{ etiqueta, valor, detalle? }]
export default function Cifras({ items }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {items.map(({ etiqueta, valor, detalle }) => (
        <div key={etiqueta} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl px-4 py-3 shadow-sm min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 leading-tight">{etiqueta}</div>
          <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white leading-tight mt-1 break-words">{valor}</div>
          {detalle && <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{detalle}</div>}
        </div>
      ))}
    </div>
  );
}
