import { etiquetaFiltroEstado } from '../utils/estadoInstalacion';

// Cuántas órdenes tiene cada promotor en cada grupo de estados, de lo que se está viendo (la categoría y la fecha elegidas arriba).
// Tocar una fila filtra la lista por ese promotor; tocarla de nuevo quita el filtro.
export default function ResumenPromotores({ filas, vista, elegida, onElegir }) {
  const instaladas = etiquetaFiltroEstado('INSTALADA', vista);
  const total = filas.reduce((acc, f) => ({ instaladas: acc.instaladas + f.instaladas, enRevision: acc.enRevision + f.enRevision, enCurso: acc.enCurso + f.enCurso, canceladas: acc.canceladas + f.canceladas, total: acc.total + f.total }), { instaladas: 0, enRevision: 0, enCurso: 0, canceladas: 0, total: 0 });
  const encabezado = 'px-2 py-2 text-right text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400';
  const celda = 'px-2 py-2 text-right tabular-nums';

  if (filas.length === 0) return <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-3">No hay órdenes para resumir.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th scope="col" className="px-3 py-2 text-left text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400">Promotor</th>
            <th scope="col" className={encabezado}>{instaladas}</th>
            <th scope="col" className={encabezado}>En revisión</th>
            <th scope="col" className={encabezado}>En curso</th>
            <th scope="col" className={encabezado}>Canceladas</th>
            <th scope="col" className={encabezado}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {filas.map((f) => (
            <tr key={f.clave || '-'} className={elegida === (f.clave || '-') ? 'bg-red-50 dark:bg-red-950/30' : ''}>
              <th scope="row" className="px-3 py-0 text-left font-bold text-zinc-800 dark:text-zinc-100 max-w-[10rem]">
                <button type="button" onClick={() => onElegir(f.clave || '-')} aria-pressed={elegida === (f.clave || '-')} className="w-full text-left py-2 truncate hover:text-red-600 dark:hover:text-red-400">{f.nombre}</button>
              </th>
              <td className={`${celda} font-black text-emerald-700 dark:text-emerald-400`}>{f.instaladas}</td>
              <td className={celda}>{f.enRevision}</td>
              <td className={celda}>{f.enCurso}</td>
              <td className={celda}>{f.canceladas}</td>
              <td className={`${celda} font-bold`}>{f.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-zinc-400 dark:border-zinc-700 font-black text-zinc-900 dark:text-white">
            <th scope="row" className="px-3 py-2 text-left">Total</th>
            <td className={celda}>{total.instaladas}</td>
            <td className={celda}>{total.enRevision}</td>
            <td className={celda}>{total.enCurso}</td>
            <td className={celda}>{total.canceladas}</td>
            <td className={celda}>{total.total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
