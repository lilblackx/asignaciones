import NumeroContado from '../../NumeroContado';

// Las cifras grandes de arriba de cada reporte. items: [{ etiqueta, valor, detalle?, onClick? }]. Con `onClick` la cifra es un botón (por ejemplo,
// para abrir el detalle de las órdenes que la forman).
const CAJA = 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl px-4 py-3 shadow-sm min-w-0';

function Contenido({ etiqueta, valor, detalle }) {
  return (
    <>
      <div className="text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400 leading-tight">{etiqueta}</div>
      <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white leading-tight mt-1 break-words"><NumeroContado valor={valor} /></div>
      {detalle && <div className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 truncate">{detalle}</div>}
    </>
  );
}

// Las pocas cifras que más se miran: grandes, con la línea roja arriba (la misma de los encabezados).
export function CifrasDestacadas({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
      {items.map(({ etiqueta, valor, detalle, onClick }) => {
        const clases = 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 border-t-4 border-t-red-600 rounded-xl px-4 py-4 min-w-0 text-left';
        const contenido = (
          <>
            <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300 leading-tight">{etiqueta}</div>
            <div className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white leading-none mt-2 break-words"><NumeroContado valor={valor} /></div>
            {detalle && <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">{detalle}</div>}
          </>
        );
        return onClick
          ? <button key={etiqueta} type="button" onClick={onClick} aria-label={`${etiqueta}: ${valor}. Ver detalle`} className={`${clases} cursor-pointer hover:border-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500`}>{contenido}</button>
          : <div key={etiqueta} className={clases}>{contenido}</div>;
      })}
    </div>
  );
}

// El resto de las cifras, en una sola tarjeta: nombre a la izquierda, valor a la derecha y el detalle debajo.
export function CifrasLista({ items }) {
  return (
    <dl className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800 mb-4">
      {items.map(({ etiqueta, valor, detalle, onClick }) => {
        const fila = (
          <>
            <div className="min-w-0">
              <dt className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{etiqueta}</dt>
              {detalle && <dd className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{detalle}</dd>}
            </div>
            <span className="shrink-0 text-lg font-black text-zinc-900 dark:text-white"><NumeroContado valor={valor} /></span>
          </>
        );
        const clases = 'w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left';
        return onClick
          ? <div key={etiqueta}><button type="button" onClick={onClick} aria-label={`${etiqueta}: ${valor}. Ver detalle`} className={`${clases} cursor-pointer hover:bg-red-50/40 dark:hover:bg-red-950/20`}>{fila}</button></div>
          : <div key={etiqueta} className={clases}>{fila}</div>;
      })}
    </dl>
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
