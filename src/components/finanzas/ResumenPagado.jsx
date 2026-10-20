import ResumenCifras from './ResumenCifras';
import { bolivares, cifrasResumenPagado, dolares, frasePagado, textoGrupos, textoOrdenes } from '../../utils/finanzas';
import { diaDe } from '../../utils/totalesMes';
import { diaLegible, etiquetaRango } from '../../utils/periodoReporte';

// El reporte de Finanzas: lo que se pagó en el periodo, por técnico (cuánto y por cuántas órdenes). Mismas tarjetas que las de los técnicos y las de ventas.
const ETIQUETA = 'text-[10px] font-semibold uppercase tracking-wide text-zinc-500';
const CIFRA = 'text-2xl font-black text-zinc-900 dark:text-white tabular-nums leading-tight mt-0.5 whitespace-nowrap';

export default function ResumenPagado({ resumen, rango }) {
  return (
    <div className="space-y-3">
      <ResumenCifras items={cifrasResumenPagado(resumen)} />

      <h3 className="text-sm font-bold text-zinc-900 dark:text-white pt-1">Pagado a cada técnico · {etiquetaRango(rango)}</h3>
      {resumen.porTecnico.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-10">Ningún pago registrado en este periodo.</p>
      ) : (
        <ul className="grid gap-2.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {resumen.porTecnico.map((f) => (
            <li key={f.tecnico} className="h-full flex flex-col min-w-0 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="bg-black px-3 py-2 flex items-center gap-2">
                <span className="text-lg font-black text-white leading-none truncate min-w-0">{f.tecnico}</span>
                <span className="ml-auto shrink-0 text-[10px] font-black uppercase tracking-wide rounded px-2 py-1 leading-none bg-emerald-600 text-white">Pagado</span>
              </div>

              <div className="p-3 flex-1 flex flex-col gap-3">
                <p className="text-sm text-zinc-900 dark:text-zinc-100">{frasePagado(f)}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <p className={ETIQUETA}>Órdenes pagadas</p>
                    <p className={CIFRA}>{f.ordenes}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className={ETIQUETA}>Total pagado</p>
                    <p className={CIFRA}>{dolares(f.total)}</p>
                    {f.bs > 0 && <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">{bolivares(f.bs)}</p>}
                  </div>
                </div>
                <div>
                  <p className={ETIQUETA}>Detalle</p>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100 mt-0.5 break-words">
                    {textoGrupos(f.cantidades) || '—'}
                  </p>
                </div>
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 min-h-12 flex items-center justify-between gap-2">
                <span className={ETIQUETA}>{f.pagos === 1 ? '1 pago' : `${f.pagos} pagos`}</span>
                <span className={`${ETIQUETA} tabular-nums`}>Último {diaLegible(diaDe(f.ultimo))}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-zinc-400 text-center pt-2">{textoOrdenes(resumen.ordenes)} pagadas en total. Los pagos anulados no suman.</p>
    </div>
  );
}
