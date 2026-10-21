import { ArrowLeft, HandCoins, CheckCircle2, TriangleAlert } from 'lucide-react';
import { BOTON, BOTON_FILA, BOTON_GRANDE, CHIP, ESTADO, ETIQUETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { aBs, agruparOrdenes, bolivares, conceptosSinTarifa, desglosePorConcepto, dolares, estadoDeAdelanto, fechaHoraLegiblePago, grupoDePago, textoDatosPago, textoGrupos, textoOrdenes } from '../../utils/finanzas';
import { saldoAdelanto, sePuedeAnularAdelanto } from '../../utils/adelantos';
import { diaLegible, etiquetaRango } from '../../utils/periodoReporte';

// Todo lo de un técnico en una sola pantalla, sin cajas: cuánto se le debe (en grande), lo que se paga por concepto con cantidad, precio y subtotal en $ y Bs, los adelantos,
// las órdenes en los grupos de los reportes, y sus pagos y adelantos del periodo. "Pagar" y "Adelanto" abren el formulario en esta misma pantalla.
const montoBs = (usd, tasa) => (tasa > 0 ? bolivares(aBs(usd, tasa)) : null);

// Un monto en dólares con sus bolívares debajo.
function Monto({ usd, tasa, grande = false, className = '' }) {
  return (
    <span className={`text-right shrink-0 ${className}`}>
      <span className={`block font-bold tabular-nums whitespace-nowrap text-zinc-900 dark:text-white ${grande ? 'text-lg' : 'text-base'}`}>{dolares(usd)}</span>
      {tasa > 0 && <span className="block text-sm font-semibold tabular-nums whitespace-nowrap text-zinc-600 dark:text-zinc-300">{montoBs(usd, tasa)}</span>}
    </span>
  );
}

function Seccion({ titulo, nota, children }) {
  return (
    <section className="pt-4 border-t-2 border-zinc-300 dark:border-zinc-700">
      <h3 className={TITULO_SECCION}>{titulo}</h3>
      {nota && <p className={`${TEXTO_SUAVE} mt-0.5`}>{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function DetalleTecnico({ fila, tarifas, tasa, rango, pagos, adelantos, pagado, ocupado, onPagar, onAdelanto, onVerOrden, onAnularPago, onAnularAdelanto, onVolver }) {
  const sinTarifa = conceptosSinTarifa(fila, tarifas);
  const desglose = desglosePorConcepto(fila.cantidades, tarifas);
  const neto = fila.neto ?? fila.total;
  const descuento = fila.descuento ?? 0;
  const saldoQueda = Math.max(0, (fila.adelantos ?? 0) - descuento);
  const pendientes = fila.pendientes.length;
  const estado = pendientes > 0 ? ESTADO.POR_PAGAR : fila.adelantos > 0 ? ESTADO.CON_ADELANTO : ESTADO.PAGADO;

  return (
    <div className="space-y-4 lg:animate-fade-in">
      <div>
        {onVolver && <button type="button" onClick={onVolver} className={`${BOTON} mb-3 lg:hidden`}><ArrowLeft className="w-5 h-5" aria-hidden="true" /> Técnicos</button>}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white break-words">{fila.tecnico}</h2>
          <span className={`${CHIP} ${estado.clase}`}>{estado.texto}</span>
        </div>
        <p className={`${TEXTO_SUAVE} mt-1`}>{etiquetaRango(rango)}</p>
      </div>

      <div className="pb-1">
        <p className={ETIQUETA}>Total pendiente por pagar</p>
        <p className="text-3xl font-extrabold tabular-nums text-zinc-900 dark:text-white leading-tight">{dolares(neto)}</p>
        {tasa > 0 && <p className="text-lg font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{bolivares(aBs(neto, tasa))}</p>}
        {fila.adelantos > 0 && <p className="text-base font-bold text-sky-800 dark:text-sky-300 mt-2">Adelanto: {dolares(fila.adelantos)}</p>}
        {sinTarifa.length > 0 && (
          <p role="alert" className="mt-3 inline-flex items-start gap-2 rounded-md bg-amber-400 text-black text-base font-bold px-3 py-2">
            <TriangleAlert className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" /> Sin precio: {sinTarifa.join(', ')}. Ponlo en el Tabulador de precios antes de pagar.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {pendientes > 0 && (
            <button type="button" onClick={onPagar} disabled={ocupado || fila.total <= 0 || sinTarifa.length > 0} className={`${BOTON_GRANDE} bg-red-600 hover:bg-red-700 text-white`}>
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> Pagar
            </button>
          )}
          <button type="button" onClick={onAdelanto} disabled={ocupado} className={`${BOTON_GRANDE} border-2 border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
            <HandCoins className="w-5 h-5" aria-hidden="true" /> Adelanto
          </button>
        </div>
      </div>

      {pendientes > 0 ? (
        <Seccion titulo="Lo que se paga" nota={`${textoOrdenes(pendientes)}: ${textoGrupos(fila.cantidades)}`}>
          <div className="hidden lg:grid grid-cols-[1fr_5rem_9rem_9rem_12rem] gap-x-4 pb-2 border-b-2 border-zinc-300 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            <span>Concepto</span><span className="text-right">Cantidad</span><span className="text-right">Precio</span><span className="text-right">Subtotal $</span><span className="text-right">Subtotal Bs</span>
          </div>
          <ul className="divide-y-2 divide-zinc-200 dark:divide-zinc-800">
            {desglose.map((d) => (
              <li key={d.id} className="py-3 grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_5rem_9rem_9rem_12rem] items-center gap-x-4 gap-y-1">
                <span className="min-w-0">
                  <span className="block text-base font-bold text-zinc-900 dark:text-white">{d.nombre}</span>
                  <span className={`${TEXTO_SUAVE} tabular-nums lg:hidden`}>{d.cantidad} × {dolares(d.precio)}{tasa > 0 ? ` (${montoBs(d.precio, tasa)})` : ''}</span>
                </span>
                <span className="hidden lg:block text-right text-base font-bold tabular-nums text-zinc-900 dark:text-white">{d.cantidad}</span>
                <span className="hidden lg:block text-right text-base tabular-nums text-zinc-900 dark:text-white">{dolares(d.precio)}</span>
                <span className="hidden lg:block text-right text-base font-bold tabular-nums text-zinc-900 dark:text-white">{dolares(d.subtotal)}</span>
                <span className="hidden lg:block text-right text-base font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{montoBs(d.subtotal, tasa) || '—'}</span>
                <Monto usd={d.subtotal} tasa={tasa} className="lg:hidden" />
              </li>
            ))}
          </ul>
          <dl className="mt-1 border-t-2 border-zinc-300 dark:border-zinc-700 divide-y divide-zinc-200 dark:divide-zinc-800">
            <div className="py-3 flex items-center justify-between gap-4"><dt className="text-base font-bold text-zinc-900 dark:text-white">Total de órdenes</dt><dd><Monto usd={fila.total} tasa={tasa} /></dd></div>
            {descuento > 0 && (
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-base font-bold text-zinc-900 dark:text-white">Adelantos descontados</dt>
                <dd className="text-right"><span className="block text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-300 whitespace-nowrap">− {dolares(descuento)}</span>{tasa > 0 && <span className="block text-sm font-semibold tabular-nums text-zinc-600 dark:text-zinc-300 whitespace-nowrap">− {montoBs(descuento, tasa)}</span>}</dd>
              </div>
            )}
            <div className="py-3 flex items-center justify-between gap-4 bg-zinc-100 dark:bg-zinc-900 px-3 -mx-3 rounded-lg"><dt className="text-base font-bold text-zinc-900 dark:text-white">Total pendiente por pagar</dt><dd><Monto usd={neto} tasa={tasa} grande /></dd></div>
          </dl>
          {saldoQueda > 0 && <p className={`${TEXTO_SUAVE} mt-2`}>Le quedan {dolares(saldoQueda)} de adelantos por descontar en un próximo pago.</p>}
        </Seccion>
      ) : (
        <p className="text-base text-zinc-700 dark:text-zinc-200">No hay órdenes por pagar en este periodo.{fila.adelantos > 0 ? ` Tiene ${dolares(fila.adelantos)} de adelantos por descontar en su próximo pago.` : ''}</p>
      )}

      {pendientes > 0 && (
        <Seccion titulo="Las órdenes" nota="Agrupadas como en los reportes. Pulsa el código para ver el detalle de una orden.">
          <div className="space-y-5">
            {agruparOrdenes(fila.pendientes).map((g) => (
              <div key={g.id}>
                <h4 className="flex items-center justify-between gap-3 text-base font-bold text-zinc-900 dark:text-white pb-1 border-b-2 border-zinc-300 dark:border-zinc-700">
                  <span>{g.titulo} · {g.items.length}</span>
                  <span className="tabular-nums">{dolares(g.items.reduce((suma, i) => suma + (tarifas[i.concepto] || 0), 0))}</span>
                </h4>
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {g.items.map((item) => (
                    <li key={item.clave} className="py-2.5 flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-base text-zinc-900 dark:text-zinc-100 break-words"><button type="button" onClick={() => onVerOrden(item)} aria-label={`Ver el detalle de la orden ${item.orden.codigo || 'sin código'}`} className="font-bold underline decoration-2 underline-offset-2 hover:text-red-600 dark:hover:text-red-400">{item.orden.codigo || 'S/C'}</button> · {item.orden.nombre}</span>
                        <span className={TEXTO_SUAVE}>{diaLegible(item.dia).slice(0, 5)} · {grupoDePago(item.concepto)}</span>
                      </span>
                      <Monto usd={tarifas[item.concepto] || 0} tasa={tasa} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {pagado && (
        <Seccion titulo="Ya pagado en el periodo">
          <p className="text-lg text-zinc-900 dark:text-white">{dolares(pagado.total)}{pagado.bs > 0 ? ` (${bolivares(pagado.bs)})` : ''} · {textoOrdenes(pagado.ordenes)}</p>
        </Seccion>
      )}

      {pagos.length > 0 && (
        <Seccion titulo="Pagos registrados">
          <ul className="divide-y-2 divide-zinc-200 dark:divide-zinc-800">
            {pagos.map((p) => (
              <li key={p.id} className={`py-3 flex flex-wrap items-center justify-between gap-3 ${p.anulado ? 'opacity-70' : ''}`}>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2"><span className="text-base font-bold text-zinc-900 dark:text-white">{etiquetaRango({ desde: p.desde, hasta: p.hasta })}</span><span className={`${CHIP} ${p.anulado ? ESTADO.ANULADO.clase : 'bg-emerald-600 text-white'}`}>{p.anulado ? 'Anulado' : 'Pagado'}</span></span>
                  <span className={`block ${TEXTO_SUAVE}`}>{textoOrdenes(p.cantidadOrdenes)}{p.descuento > 0 ? ` · ${dolares(p.total)} − ${dolares(p.descuento)} de adelantos` : ''}</span>
                  {p.forma && <span className={`block ${TEXTO_SUAVE}`}>{textoDatosPago(p)}</span>}
                  {p.nota && <span className={`block ${TEXTO_SUAVE}`}>{p.nota}</span>}
                </span>
                <span className="flex items-center gap-4">
                  <Monto usd={p.neto ?? p.total} tasa={p.tasa > 0 ? p.tasa : tasa} className={p.anulado ? 'line-through' : ''} />
                  {!p.anulado && <button type="button" onClick={() => onAnularPago(p)} disabled={ocupado} className={BOTON_FILA}>Anular</button>}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {adelantos.length > 0 && (
        <Seccion titulo="Adelantos">
          <ul className="divide-y-2 divide-zinc-200 dark:divide-zinc-800">
            {adelantos.map((a) => (
              <li key={a.id} className={`py-3 flex flex-wrap items-center justify-between gap-3 ${a.anulado ? 'opacity-70' : ''}`}>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2"><span className="text-base font-bold text-zinc-900 dark:text-white">{fechaHoraLegiblePago(Number(a.pagadoEn) || Number(a.creadoEn))}</span><span className={`${CHIP} ${a.anulado ? ESTADO.ANULADO.clase : saldoAdelanto(a) > 0 ? ESTADO.CON_ADELANTO.clase : 'bg-emerald-600 text-white'}`}>{a.anulado ? 'Anulado' : saldoAdelanto(a) > 0 ? 'Por descontar' : 'Descontado'}</span></span>
                  <span className={`block ${TEXTO_SUAVE}`}>{[a.forma, a.banco, a.referencia && `Ref. ${a.referencia}`].filter(Boolean).join(' · ')}</span>
                  {!a.anulado && Number(a.aplicado) > 0 && <span className={`block ${TEXTO_SUAVE}`}>{estadoDeAdelanto(a)}</span>}
                  {a.nota && <span className={`block ${TEXTO_SUAVE}`}>{a.nota}</span>}
                </span>
                <span className="flex items-center gap-4">
                  <Monto usd={a.monto} tasa={tasa} className={a.anulado ? 'line-through' : ''} />
                  {sePuedeAnularAdelanto(a) && <button type="button" onClick={() => onAnularAdelanto(a)} disabled={ocupado} className={BOTON_FILA}>Anular</button>}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      )}
    </div>
  );
}
