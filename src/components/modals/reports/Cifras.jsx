// Las cifras grandes de arriba de cada reporte. items: [{ etiqueta, valor, detalle?, onClick? }]. Con `onClick` la cifra es un botón (por ejemplo,
// para abrir el detalle de las órdenes que la forman).
const CAJA = 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl px-4 py-3 shadow-sm min-w-0';

function Contenido({ etiqueta, valor, detalle }) {
  return (
    <>
      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 leading-tight">{etiqueta}</div>
      <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white leading-tight mt-1 break-words">{valor}</div>
      {detalle && <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{detalle}</div>}
    </>
  );
}

export default function Cifras({ items }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {items.map(({ etiqueta, valor, detalle, onClick }) => (
        onClick ? (
          <button
            key={etiqueta}
            type="button"
            onClick={onClick}
            aria-label={`${etiqueta}: ${valor}. Ver detalle`}
            className={`${CAJA} text-left cursor-pointer transition-colors hover:border-red-500 hover:bg-red-50/40 dark:hover:bg-red-950/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500`}
          >
            <Contenido etiqueta={etiqueta} valor={valor} detalle={detalle} />
          </button>
        ) : (
          <div key={etiqueta} className={CAJA}>
            <Contenido etiqueta={etiqueta} valor={valor} detalle={detalle} />
          </div>
        )
      ))}
    </div>
  );
}
