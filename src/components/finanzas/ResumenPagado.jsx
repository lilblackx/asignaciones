import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import ResumenCifras from './ResumenCifras';
import Colapsable from '../Colapsable';
import DetalleOrdenFinanzas from './DetalleOrdenFinanzas';
import { BOTON, CHIP, ESTADO, TARJETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { agruparOrdenes, bolivares, cifrasResumenPagado, dolares, frasePagado, grupoDePago, textoGrupos, textoOrdenes } from '../../utils/finanzas';
import { diaDe } from '../../utils/totalesMes';
import { diaLegible, etiquetaRango } from '../../utils/periodoReporte';

// El reporte de Finanzas: lo que se pagó en el periodo, por técnico (cuánto y por cuántas órdenes), en filas grandes y sin cajas. "Ver órdenes" muestra las órdenes ya pagadas del
// técnico agrupadas como en los reportes, con la marca Pagada. `ordenesPagadas`: las órdenes ya pagadas del periodo (ordenesYaPagadas).
export default function ResumenPagado({ resumen, rango, ordenesPagadas = [], tarifas = {}, tasa = null }) {
  const [abierto, setAbierto] = useState(null);
  const [detalle, setDetalle] = useState(null);
  return (
    <div className="space-y-5">
      <ResumenCifras items={cifrasResumenPagado(resumen)} />

      <h2 className={TITULO_SECCION}>Pagado a cada técnico · {etiquetaRango(rango)}</h2>
      {resumen.porTecnico.length === 0 ? (
        <p className="text-base text-zinc-700 dark:text-zinc-200 text-center py-10">Ningún pago registrado en este periodo. Amplía el rango de fechas para ver pagos anteriores.</p>
      ) : (
        <ul className={`${TARJETA} px-4 divide-y divide-zinc-200 dark:divide-zinc-800`}>
          {resumen.porTecnico.map((f) => {
            const ordenes = ordenesPagadas.filter((o) => o.tecnico === f.tecnico);
            const expandido = abierto === f.tecnico;
            return (
              <li key={f.tecnico} className="py-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white break-words">{f.tecnico}</h3>
                      <span className={`${CHIP} ${ESTADO.PAGADO.clase}`}>Pagado</span>
                    </div>
                    <p className="text-sm text-zinc-800 dark:text-zinc-100 mt-1">{frasePagado(f)}</p>
                    <p className={TEXTO_SUAVE}>{textoGrupos(f.cantidades) || '-'} · {f.pagos === 1 ? '1 pago' : `${f.pagos} pagos`} · último {diaLegible(diaDe(f.ultimo))}</p>
                    {f.descuento > 0 && <p className="text-sm font-bold text-sky-800 dark:text-sky-300 mt-1">Adelantos descontados {dolares(f.descuento)} · neto entregado {dolares(f.neto)}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Total pagado</p>
                    <p className="text-xl font-extrabold tabular-nums text-zinc-900 dark:text-white whitespace-nowrap">{dolares(f.total)}</p>
                    {f.bs > 0 && <p className="text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{bolivares(f.bs)}</p>}
                  </div>
                </div>

                {ordenes.length > 0 && (
                  <>
                    <button type="button" onClick={() => setAbierto(expandido ? null : f.tecnico)} aria-expanded={expandido} className={BOTON}>
                      {expandido ? <ChevronUp className="w-5 h-5" aria-hidden="true" /> : <ChevronDown className="w-5 h-5" aria-hidden="true" />} {expandido ? 'Ocultar las órdenes' : `Ver las ${ordenes.length} órdenes`}
                    </button>
                    <Colapsable>{expandido && (
                      <div className="space-y-5 pt-2">
                        {agruparOrdenes(ordenes).map((g) => (
                          <div key={g.id}>
                            <h4 className="flex items-center justify-between gap-3 text-sm font-bold text-zinc-900 dark:text-white pb-1 border-b border-zinc-400 dark:border-zinc-700">
                              <span>{g.titulo} · {g.items.length}</span>
                              <span className="tabular-nums">{dolares(g.items.reduce((suma, i) => suma + i.monto, 0))}</span>
                            </h4>
                            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                              {g.items.map((item) => (
                                <li key={item.clave} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                                  <span className="min-w-0">
                                    <span className="block text-sm text-zinc-900 dark:text-zinc-100 break-words">
                                      {item.conDetalle ? (
                                        <button type="button" onClick={() => setDetalle(item)} aria-label={`Ver el detalle de la orden ${item.orden.codigo || 'sin código'}`} className="font-bold underline decoration-2 underline-offset-2 hover:text-red-600 dark:hover:text-red-400">{item.orden.codigo || 'S/C'}</button>
                                      ) : <span className="font-bold">{item.orden.codigo || 'S/C'}</span>}
                                      {item.orden.nombre ? ` · ${item.orden.nombre}` : ''}
                                    </span>
                                    <span className={TEXTO_SUAVE}>{diaLegible(item.dia).slice(0, 5)} · {grupoDePago(item.concepto)}</span>
                                  </span>
                                  <span className="flex items-center gap-3">
                                    <span className={`${CHIP} bg-emerald-700 text-white gap-1`}><CheckCircle2 className="w-4 h-4" aria-hidden="true" />Pagada</span>
                                    <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-white">{dolares(item.monto)}</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}</Colapsable>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {detalle && <DetalleOrdenFinanzas item={detalle} tarifas={tarifas} tasa={tasa} onClose={() => setDetalle(null)} />}
      <p className={`${TEXTO_SUAVE} text-center pt-2`}>{textoOrdenes(resumen.ordenes)} pagadas en total. Los pagos anulados no suman.</p>
    </div>
  );
}
