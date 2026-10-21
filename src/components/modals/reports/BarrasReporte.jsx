// Barras horizontales de una sola serie (ranking). filas: [{ etiqueta, valor, texto }]. Azul de la paleta de dataviz, con su paso para modo oscuro;
// la etiqueta y el valor van en texto neutro, y la tabla de abajo de cada reporte trae los mismos números.
export default function BarrasReporte({ titulo, subtitulo, filas }) {
  if (filas.length === 0) return null;
  const maximo = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{titulo}</h3>
      {subtitulo && <p className="text-[11px] text-zinc-600 dark:text-zinc-500 mt-0.5">{subtitulo}</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {filas.map((f) => (
          <li key={f.etiqueta} className="flex items-center gap-3">
            <span className="w-28 sm:w-40 shrink-0 truncate text-xs font-bold text-zinc-700 dark:text-zinc-200" title={f.etiqueta}>{f.etiqueta}</span>
            <div className="flex-1 min-w-0 h-4 flex items-center">
              <div className="h-full rounded-r-[4px] bg-[#2a78d6] dark:bg-[#3987e5] origin-left lg:animate-crecer-x" style={{ width: `${Math.max((f.valor / maximo) * 100, f.valor > 0 ? 1.5 : 0)}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-xs font-black text-zinc-800 dark:text-zinc-100">{f.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
