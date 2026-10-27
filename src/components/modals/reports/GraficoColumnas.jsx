import { useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { etiquetaMes } from '../../../utils/totalesMes';

// Columnas agrupadas por mes. Colores de la paleta de dataviz (azul y naranja, validados para claro y oscuro); el color sigue a la serie,
// no a su posición. Todo lo que muestra el tooltip también está en la tabla (botón "Ver tabla").
//   series: [{ nombre, color: clases de fondo }]; meses: [{ mes, etiqueta, enCurso?, valores: [uno por serie] }]
const alto = 'h-44 sm:h-52';

// Un paso "redondo" (1, 2, 5, 10 × potencia de 10) para que el eje tenga 4 tramos con números limpios.
function pasoDelEje(maximo) {
  const crudo = Math.max(maximo, 1) / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  return [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= crudo);
}
const compacto = (n) => (n >= 1000 ? `${n / 1000}K` : String(n));

export default function GraficoColumnas({ titulo, subtitulo, series, meses }) {
  const [activo, setActivo] = useState(null);
  const [tabla, setTabla] = useState(false);

  const maxDato = Math.max(0, ...meses.flatMap((m) => m.valores));
  const paso = pasoDelEje(maxDato);
  const maximo = paso * 4;
  const marcas = [0, 1, 2, 3, 4].map((i) => i * paso);
  const ultimo = meses.length - 1;

  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{titulo}</h3>
          {subtitulo && <p className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{subtitulo}</p>}
        </div>
        <button type="button" onClick={() => setTabla((v) => !v)} className="shrink-0 flex items-center gap-1.5 text-[11px] max-lg:text-xs font-bold px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          {tabla ? <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> : <Table2 className="w-3.5 h-3.5" aria-hidden="true" />} {tabla ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </header>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3" aria-label="Series">
        {series.map((s) => (
          <li key={s.nombre} className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <span className={`inline-block w-3 h-3 rounded-[3px] ${s.color}`} aria-hidden="true" /> {s.nombre}
          </li>
        ))}
      </ul>

      {tabla ? (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] max-lg:text-xs uppercase text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2 pr-3 text-left font-bold">Mes</th>
                {series.map((s) => <th key={s.nombre} className="py-2 pr-3 text-right font-bold whitespace-nowrap">{s.nombre}</th>)}
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-b border-zinc-100 dark:border-zinc-800/60">
                  <th scope="row" className="py-2 pr-3 text-left font-bold capitalize">{etiquetaMes(m.mes)}{m.enCurso ? ' (en curso)' : ''}</th>
                  {m.valores.map((v, i) => <td key={i} className="py-2 pr-3 text-right font-black">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : maxDato === 0 ? (
        <p className="mt-4 py-10 text-center text-sm text-zinc-700 dark:text-zinc-300">Aún no hay órdenes finalizadas en los meses cargados. La gráfica aparece cuando haya al menos una.</p>
      ) : (
        <div className="mt-4 flex gap-2">
          <div className={`relative w-7 shrink-0 ${alto}`} aria-hidden="true">
            {marcas.map((v) => (
              <span key={v} className="absolute right-0 translate-y-1/2 text-[11px] max-lg:text-xs leading-none text-zinc-600 dark:text-zinc-400" style={{ bottom: `${(v / maximo) * 100}%` }}>{compacto(v)}</span>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`relative ${alto}`}>
              {marcas.map((v) => (
                <span key={v} className={`absolute inset-x-0 h-px ${v === 0 ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-zinc-200 dark:bg-zinc-800'}`} style={{ bottom: `${(v / maximo) * 100}%` }} aria-hidden="true" />
              ))}
              <div className="absolute inset-0 flex" onPointerLeave={() => setActivo(null)}>
                {meses.map((m, i) => (
                  <div
                    key={m.mes}
                    tabIndex={0}
                    role="img"
                    aria-label={`${etiquetaMes(m.mes)}${m.enCurso ? ' (en curso)' : ''}: ${series.map((s, k) => `${s.nombre} ${m.valores[k]}`).join(', ')}`}
                    onPointerEnter={() => setActivo(i)}
                    onFocus={() => setActivo(i)}
                    onBlur={() => setActivo(null)}
                    className="group relative flex-1 min-w-0 flex items-end justify-center gap-0.5 px-0.5 outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-800/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 rounded-t"
                  >
                    {m.valores.map((v, k) => (
                      <div key={series[k].nombre} className="relative flex-1 max-w-6 h-full flex items-end">
                        <div
                          className={`w-full rounded-t-[4px] ${series[k].color} origin-bottom lg:animate-crecer-y group-hover:brightness-110 transition-[filter]`}
                          style={{ height: v > 0 ? `max(2px, ${(v / maximo) * 100}%)` : 0 }}
                        />
                        {i === ultimo && v > 0 && (
                          <span className="absolute inset-x-0 text-center text-[11px] max-lg:text-xs font-bold leading-none text-zinc-700 dark:text-zinc-200" style={{ bottom: `calc(${(v / maximo) * 100}% + 3px)` }}>{v}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {activo !== null && (
                <div
                  className="pointer-events-none absolute z-10 top-0 -translate-x-1/2 min-w-[8.5rem] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 shadow-lg"
                  style={{ left: `clamp(4.5rem, ${((activo + 0.5) / meses.length) * 100}%, calc(100% - 4.5rem))` }}
                  role="status"
                >
                  <div className="text-[11px] max-lg:text-xs font-bold capitalize text-zinc-600 dark:text-zinc-300 mb-1">{etiquetaMes(meses[activo].mes)}{meses[activo].enCurso ? ' (en curso)' : ''}</div>
                  {series.map((s, k) => (
                    <div key={s.nombre} className="flex items-center justify-between gap-4 text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300"><span className={`inline-block w-2.5 h-[3px] rounded ${s.color}`} aria-hidden="true" />{s.nombre}</span>
                      <span className="font-black text-zinc-900 dark:text-white">{meses[activo].valores[k]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex mt-1.5" aria-hidden="true">
              {meses.map((m) => <span key={m.mes} className="flex-1 min-w-0 text-center text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 truncate">{m.etiqueta}{m.enCurso ? '*' : ''}</span>)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
