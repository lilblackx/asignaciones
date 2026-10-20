import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react';
import ResumenCifras from './ResumenCifras';
import AvisoHistorial from '../modals/reports/AvisoHistorial';
import ConfirmModal from '../modals/ConfirmModal';
import DetalleOrdenFinanzas from './DetalleOrdenFinanzas';
import { CONCEPTOS_PAGO, SIN_TECNICO, cifrasPagos, conceptosSinTarifa, dolares, pagosDelPeriodo, sumaPagado, textoOrdenes } from '../../utils/finanzas';
import { diaLegible, etiquetaRango } from '../../utils/periodoReporte';

// Las tarjetas siguen el estilo de las de ventas (TarjetaInstalacion): cabecera negra con el nombre y el estado en sólido, etiquetas pequeñas en
// mayúsculas, esquinas secas y un pie con la acción, siempre abajo aunque las tarjetas tengan distinto largo.
const ETIQUETA = 'text-[10px] font-semibold uppercase tracking-wide text-zinc-500';
const CIFRA = 'text-2xl font-black text-zinc-900 dark:text-white tabular-nums leading-tight mt-0.5 whitespace-nowrap';
const TARJETA = 'h-full flex flex-col min-w-0 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden';
const BOTON = 'inline-flex items-center gap-1 text-[11px] font-bold rounded border border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50';
const BOTON_PRINCIPAL = 'inline-flex items-center gap-1.5 text-xs font-black rounded bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 transition-colors disabled:opacity-50';
const nombreConcepto = (id) => CONCEPTOS_PAGO.find((c) => c.id === id)?.nombre || id;
const ESTADO = {
  POR_PAGAR: { texto: 'Por pagar', clase: 'bg-amber-400 text-black' },
  PAGADO: { texto: 'Pagado', clase: 'bg-emerald-600 text-white' },
  ANULADO: { texto: 'Anulado', clase: 'bg-red-600 text-white' },
};

function Cabecera({ titulo, estado }) {
  return (
    <div className="bg-black px-3 py-2 flex items-center gap-2">
      <span className="text-lg font-black text-white leading-none truncate min-w-0">{titulo}</span>
      <span className={`ml-auto shrink-0 text-[10px] font-black uppercase tracking-wide rounded px-2 py-1 leading-none ${ESTADO[estado].clase}`}>{ESTADO[estado].texto}</span>
    </div>
  );
}

// Pago a técnicos: una tarjeta por técnico con sus órdenes y lo que se le debe, y un botón para marcarlo pagado. Se le debe lo que el Registro de
// estadísticas cuenta como pagado a técnico y todavía no está en ningún pago; el total sale del tabulador de precios.
export default function PagosFinanzas({ filas, items, tarifas, pagos, pagadasPorTecnico, rango, ocupado, historial, onPagar, onAnular }) {
  const [abierto, setAbierto] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [anulando, setAnulando] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const registrados = pagosDelPeriodo(pagos, rango);
  const sinTecnico = items.filter((i) => i.tecnico === SIN_TECNICO).length;
  const tarjetas = filas.filter((f) => f.tecnico !== SIN_TECNICO);

  const confirmarPago = async () => {
    await onPagar(pagando);
    setPagando(null);
  };
  const confirmarAnular = async () => {
    await onAnular(anulando);
    setAnulando(null);
  };

  return (
    <div className="space-y-3">
      <AvisoHistorial {...historial} />
      <ResumenCifras items={cifrasPagos(tarjetas, sumaPagado(Object.values(pagadasPorTecnico)))} />

      <h3 className="text-sm font-bold text-zinc-900 dark:text-white pt-1">Técnicos · {etiquetaRango(rango)}</h3>
      {sinTecnico > 0 && <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">{textoOrdenes(sinTecnico)} sin técnico asignado: no se pueden pagar.</p>}
      {tarjetas.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-8">Ninguna orden pagable en este periodo.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {tarjetas.map((fila) => {
            const pendientes = fila.pendientes.length;
            const pagado = pagadasPorTecnico[fila.tecnico];
            const sinTarifa = conceptosSinTarifa(fila, tarifas);
            const expandido = abierto === fila.tecnico;
            const desglose = CONCEPTOS_PAGO.filter(({ id }) => fila.cantidades[id] > 0).map(({ id, singular, plural }) => `${fila.cantidades[id]} ${fila.cantidades[id] === 1 ? singular : plural}`).join(' · ');
            return (
              <li key={fila.tecnico} className={TARJETA}>
                <Cabecera titulo={fila.tecnico} estado={pendientes > 0 ? 'POR_PAGAR' : 'PAGADO'} />

                {sinTarifa.length > 0 && (
                  <div className="w-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide bg-amber-400 text-black">
                    <TriangleAlert className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>Sin precio: {sinTarifa.join(', ')}</span>
                  </div>
                )}

                <div className="p-3 flex-1 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <p className={ETIQUETA}>Órdenes</p>
                      <p className={CIFRA}>{pendientes}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className={ETIQUETA}>Total a pagar</p>
                      <p className={CIFRA}>{dolares(fila.total)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {desglose && (
                      <div>
                        <p className={ETIQUETA}>Detalle</p>
                        <p className="text-sm text-zinc-900 dark:text-zinc-100 mt-0.5 break-words">{desglose}</p>
                      </div>
                    )}
                    {pagado && (
                      <div>
                        <p className={ETIQUETA}>Ya pagado en el periodo</p>
                        <p className="text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">{dolares(pagado.total)} · {textoOrdenes(pagado.ordenes)}</p>
                      </div>
                    )}
                  </div>

                  {expandido && (
                    <ul className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded text-[11px]">
                      {fila.pendientes.map((item) => (
                        <li key={item.clave} className="flex items-center justify-between gap-2 px-3 py-1.5">
                          <span className="min-w-0 truncate"><button type="button" onClick={() => setDetalle(item)} aria-label={`Ver el detalle de la orden ${item.orden.codigo || 'sin código'}`} className="font-bold underline decoration-dotted underline-offset-2 hover:text-red-600 dark:hover:text-red-400">{item.orden.codigo || 'S/C'}</button> · {item.orden.nombre}</span>
                          <span className="shrink-0 text-zinc-500">{diaLegible(item.dia).slice(0, 5)} · {nombreConcepto(item.concepto)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 min-h-12 flex items-center justify-between gap-2">
                  {pendientes > 0 ? (
                    <>
                      <button type="button" onClick={() => setAbierto(expandido ? null : fila.tecnico)} aria-expanded={expandido} className={BOTON}>
                        {expandido ? <ChevronUp className="w-3 h-3" aria-hidden="true" /> : <ChevronDown className="w-3 h-3" aria-hidden="true" />} Ver órdenes
                      </button>
                      <button type="button" onClick={() => setPagando(fila)} disabled={ocupado || fila.total <= 0} className={BOTON_PRINCIPAL}>
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Marcar pagado
                      </button>
                    </>
                  ) : (
                    <span className={ETIQUETA}>Nada por pagar</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="text-sm font-bold text-zinc-900 dark:text-white pt-3">Pagos registrados en el periodo</h3>
      {registrados.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6">Ningún pago registrado en este periodo.</p>
      ) : (
        <ul className="grid gap-2.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {registrados.map((p) => (
            <li key={p.id} className={`${TARJETA} ${p.anulado ? 'opacity-70' : ''}`}>
              <Cabecera titulo={p.tecnico} estado={p.anulado ? 'ANULADO' : 'PAGADO'} />
              <div className="p-3 flex-1 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className={ETIQUETA}>Periodo</p>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">{etiquetaRango({ desde: p.desde, hasta: p.hasta })}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{textoOrdenes(p.cantidadOrdenes)}</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className={ETIQUETA}>Total</p>
                  <p className={`${CIFRA} ${p.anulado ? 'line-through text-zinc-500 dark:text-zinc-500' : ''}`}>{dolares(p.total)}</p>
                </div>
              </div>
              <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 min-h-12 flex items-center justify-between gap-2">
                <span className={`${ETIQUETA} truncate`}>{p.por}{p.nota ? ` · ${p.nota}` : ''}</span>
                {!p.anulado && <button type="button" onClick={() => setAnulando(p)} disabled={ocupado} className={BOTON}>Anular</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {detalle && <DetalleOrdenFinanzas item={detalle} tarifas={tarifas} onClose={() => setDetalle(null)} />}
      {pagando && (
        <ConfirmModal
          color="blue"
          icon={CheckCircle2}
          title={`¿Marcar pagado a ${pagando.tecnico}?`}
          description={`${textoOrdenes(pagando.pendientes.length)} por ${dolares(pagando.total)} (${etiquetaRango(rango)}). Quedan pagadas y no se pueden pagar otra vez.`}
          confirmLabel="Sí, marcar pagado"
          processingLabel="Guardando..."
          onCancel={() => setPagando(null)}
          onConfirm={confirmarPago}
        />
      )}
      {anulando && (
        <ConfirmModal
          color="red"
          title="¿Anular este pago?"
          description={`El pago de ${dolares(anulando.total)} a ${anulando.tecnico} queda anulado y sus ${textoOrdenes(anulando.cantidadOrdenes)} vuelven a estar por pagar.`}
          confirmLabel="Sí, anular"
          processingLabel="Anulando..."
          onCancel={() => setAnulando(null)}
          onConfirm={confirmarAnular}
        />
      )}
    </div>
  );
}
