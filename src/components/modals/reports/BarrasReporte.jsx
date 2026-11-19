// Barras horizontales de una sola serie (ranking). filas: [{ etiqueta, valor, texto }]. Rojo de marca, la misma paleta de los PDF;
// la etiqueta y el valor van en texto neutro, y la tabla de abajo de cada reporte trae los mismos números.
export default function BarrasReporte({ titulo, subtitulo, filas }) {
  if (filas.length === 0) return null;
  const maximo = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <section className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-sm mb-4">
      <h3 className="text-sm font-bold text-foreground">{titulo}</h3>
      {subtitulo && <p className="text-etiqueta text-muted-foreground mt-0.5">{subtitulo}</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {filas.map((f) => (
          <li key={f.etiqueta} className="flex items-center gap-3">
            <span className="w-28 sm:w-40 shrink-0 break-words text-xs font-bold text-card-foreground leading-tight" title={f.etiqueta}>{f.etiqueta}</span>
            <div className="flex-1 min-w-0 h-4 flex items-center">
              <div className="h-full rounded-r-[4px] bg-[#dc2626] dark:bg-[#ef4444] origin-left animate-crecer-x" style={{ width: `${Math.max((f.valor / maximo) * 100, f.valor > 0 ? 1.5 : 0)}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-xs font-black text-foreground">{f.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
