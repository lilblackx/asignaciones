// Una tabla de reporte dentro de su tarjeta. columnas: [{ titulo, derecha? }]; filas: arreglos de celdas (texto o elementos).
export default function TablaReporte({ titulo, nota, columnas, filas, vacio = 'Sin datos en este periodo. Amplía el rango (7 días, Este mes o Rango).' }) {
  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{titulo}</h3>
      {nota && <p className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 mt-1">{nota}</p>}
      {filas.length === 0 ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-400 text-center py-6">{vacio}</p>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] max-lg:text-xs uppercase text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                {columnas.map(({ titulo: t, derecha }) => <th key={t} className={`py-2 pr-3 font-bold whitespace-nowrap ${derecha ? 'text-right' : 'text-left'}`}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/60">
                  {fila.map((celda, j) => <td key={j} className={`py-2 pr-3 ${columnas[j]?.derecha ? 'text-right font-black whitespace-nowrap' : ''} ${columnas[j]?.sinSalto ? 'whitespace-nowrap' : ''} ${j === 0 ? 'font-bold' : ''}`}>{celda}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
