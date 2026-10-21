import { useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import ResumenCifras from './ResumenCifras';
import AvisoHistorial from '../modals/reports/AvisoHistorial';
import ConfirmModal from '../modals/ConfirmModal';
import Colapsable from '../Colapsable';
import ListaTecnicos from './ListaTecnicos';
import DetalleTecnico from './DetalleTecnico';
import PanelPago from './PanelPago';
import PanelAdelanto from './PanelAdelanto';
import DetalleOrdenFinanzas from './DetalleOrdenFinanzas';
import { BOTON_FILA, TITULO_SECCION } from './estilos';
import { SIN_TECNICO, adelantosDelPeriodo, cifrasPagos, dolares, grupoDePago, pagosDelPeriodo, sumaPagado, textoOrdenes } from '../../utils/finanzas';
import { saldoAdelanto } from '../../utils/adelantos';
import { diaLegible, etiquetaRango } from '../../utils/periodoReporte';
import { useEsPantallaGrande } from '../../hooks/useEsPantallaGrande';

// La pantalla de pago a técnicos: arriba las cifras y los avisos, y debajo la lista de técnicos a la izquierda y todo lo del técnico elegido a la derecha (en el celular, la lista y,
// al elegir uno, su pantalla con un botón para volver). "Pagar" y "Adelanto" abren su formulario en esa misma pantalla, no en una ventana.
// `adelantos`: los adelantos; `onPagar(fila, { datosPago, notificar, nota })`, `onAdelanto(tecnico, entrada, { notificar })` y `onAnularAdelanto(adelanto)` devuelven true si se guardó.
export default function TecnicosFinanzas({ filas, items, sinTipo = [], onTipoMudanza, tarifas, pagos, adelantos = [], pagadasPorTecnico, rango, tasa, ocupado, historial, onPagar, onAnular, onAdelanto, onAnularAdelanto }) {
  const grande = useEsPantallaGrande();
  const [elegido, setElegido] = useState(null);
  const [modo, setModo] = useState('detalle');
  const [detalleOrden, setDetalleOrden] = useState(null);
  const [anulando, setAnulando] = useState(null);
  const [anulandoAdelanto, setAnulandoAdelanto] = useState(null);
  const [verSinTecnico, setVerSinTecnico] = useState(false);
  const [verSinTipo, setVerSinTipo] = useState(false);
  const zonaDetalle = useRef(null);

  const tecnicos = filas.filter((f) => f.tecnico !== SIN_TECNICO);
  // En PC siempre hay un técnico elegido (el primero); en el celular, hasta que se elige uno se ve la lista.
  const actual = tecnicos.find((f) => f.tecnico === elegido) || (grande ? tecnicos[0] : null) || null;
  const ordenesSinTecnico = items.filter((i) => i.tecnico === SIN_TECNICO);
  const registrados = pagosDelPeriodo(pagos, rango);
  // Los adelantos del periodo y, aunque sean de antes, los que todavía tienen algo por descontar.
  const adelantosVisibles = [...new Map([...adelantosDelPeriodo(adelantos, rango), ...adelantos.filter((a) => saldoAdelanto(a) > 0)].map((a) => [a.id, a])).values()].sort((a, b) => (Number(b.pagadoEn) || 0) - (Number(a.pagadoEn) || 0));

  // En el celular, al elegir un técnico se salta directo a su pantalla (arriba hay filtros y cifras que no hacen falta para pagarle).
  const elegir = (tecnico) => {
    setElegido(tecnico);
    setModo('detalle');
    if (!grande) setTimeout(() => zonaDetalle.current?.scrollIntoView({ block: 'start' }), 50);
  };
  const volverALaLista = () => { setElegido(null); setModo('detalle'); };
  // En el celular, dentro de la pantalla de un técnico no se repiten las cifras ni los avisos de arriba.
  const enDetalleMovil = !grande && Boolean(actual);

  const confirmarAnular = async () => { await onAnular(anulando); setAnulando(null); };
  const confirmarAnularAdelanto = async () => { await onAnularAdelanto(anulandoAdelanto); setAnulandoAdelanto(null); };

  const alerta = 'rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-base text-amber-900 dark:text-amber-100 space-y-3';

  return (
    <div className="space-y-5">
      {!enDetalleMovil && <AvisoHistorial {...historial} />}
      {!enDetalleMovil && <ResumenCifras items={cifrasPagos(tecnicos, sumaPagado(Object.values(pagadasPorTecnico)), tasa)} />}

      {!enDetalleMovil && ordenesSinTecnico.length > 0 && (
        <div className={alerta}>
          <p className="flex items-start gap-2"><TriangleAlert className="w-6 h-6 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{textoOrdenes(ordenesSinTecnico.length)} finalizada{ordenesSinTecnico.length === 1 ? '' : 's'} sin técnico en su ficha: no hay a quién pagarla{ordenesSinTecnico.length === 1 ? '' : 's'}. La oficina debe asignarle el técnico a la orden.{' '}
              <button type="button" aria-expanded={verSinTecnico} onClick={() => setVerSinTecnico((v) => !v)} className="font-bold underline">{verSinTecnico ? 'Ocultar' : 'Ver cuál'}</button></span>
          </p>
          <Colapsable>{verSinTecnico && (
            <ul className="divide-y divide-amber-300 dark:divide-amber-900/60">
              {ordenesSinTecnico.map((item) => (
                <li key={item.clave} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0"><button type="button" onClick={() => setDetalleOrden(item)} aria-label={`Ver el detalle de la orden ${item.orden.codigo || 'sin código'}`} className="font-bold underline">{item.orden.codigo || 'S/C'}</button> · {item.orden.nombre}</span>
                  <span>{diaLegible(item.dia).slice(0, 5)} · {grupoDePago(item.concepto)}</span>
                </li>
              ))}
            </ul>
          )}</Colapsable>
        </div>
      )}

      {!enDetalleMovil && sinTipo.length > 0 && (
        <div className={alerta}>
          <p className="flex items-start gap-2"><TriangleAlert className="w-6 h-6 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{sinTipo.length === 1 ? '1 mudanza finalizada no tiene' : `${sinTipo.length} mudanzas finalizadas no tienen`} tipo (interna o externa) y no se paga{sinTipo.length === 1 ? '' : 'n'} hasta que se lo pongas, porque cada tipo tiene su precio. Elígelo aquí mismo: las órdenes de un cierre ya no se pueden editar.{' '}
              <button type="button" aria-expanded={verSinTipo} onClick={() => setVerSinTipo((v) => !v)} className="font-bold underline">{verSinTipo ? 'Ocultar' : 'Ver cuáles'}</button></span>
          </p>
          <Colapsable>{verSinTipo && (
            <ul className="divide-y divide-amber-300 dark:divide-amber-900/60">
              {sinTipo.map((item) => (
                <li key={item.clave} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0 basis-full sm:basis-auto"><span className="font-bold">{item.orden.codigo || 'S/C'}</span> · {item.orden.nombre} · {diaLegible(item.dia).slice(0, 5)} · {item.tecnico === SIN_TECNICO ? 'sin técnico' : item.tecnico}</span>
                  <span className="inline-flex gap-2">
                    {['INTERNA', 'EXTERNA'].map((tipo) => (
                      <button key={tipo} type="button" disabled={ocupado} onClick={() => onTipoMudanza(item.clave, tipo)} aria-label={`Mudanza ${tipo.toLowerCase()}: ${item.orden.codigo || 'sin código'}`} className={BOTON_FILA}>{tipo === 'INTERNA' ? 'Interna' : 'Externa'}</button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}</Colapsable>
        </div>
      )}

      {!enDetalleMovil && <h2 className={TITULO_SECCION}>Técnicos · {etiquetaRango(rango)}</h2>}

      {tecnicos.length === 0 ? (
        <p className="text-lg text-zinc-700 dark:text-zinc-200 text-center py-10">Ninguna orden pagable en este periodo.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(20rem,26rem)_1fr] items-start">
          <div className={actual ? 'hidden lg:block lg:sticky lg:top-20' : ''}>
            <ListaTecnicos filas={tecnicos} elegido={actual?.tecnico} tasa={tasa} onElegir={elegir} />
          </div>
          {actual && (
            <div ref={zonaDetalle} className="min-w-0 scroll-mt-4" key={`${actual.tecnico}-${modo}`}>
              {modo === 'pagar' ? (
                <PanelPago fila={actual} rango={rango} tasa={tasa} ocupado={ocupado} onConfirmar={(opciones) => onPagar(actual, opciones)} onVolver={() => setModo('detalle')} />
              ) : modo === 'adelanto' ? (
                <PanelAdelanto tecnico={actual.tecnico} porDescontar={actual.adelantos} tasa={tasa} ocupado={ocupado} onGuardar={(entrada, opciones) => onAdelanto(actual.tecnico, entrada, opciones)} onVolver={() => setModo('detalle')} />
              ) : (
                <DetalleTecnico
                  fila={actual}
                  tarifas={tarifas}
                  tasa={tasa}
                  rango={rango}
                  pagos={registrados.filter((p) => p.tecnico === actual.tecnico)}
                  adelantos={adelantosVisibles.filter((a) => a.tecnico === actual.tecnico)}
                  pagado={pagadasPorTecnico[actual.tecnico]}
                  ocupado={ocupado}
                  onPagar={() => setModo('pagar')}
                  onAdelanto={() => setModo('adelanto')}
                  onVerOrden={setDetalleOrden}
                  onAnularPago={setAnulando}
                  onAnularAdelanto={setAnulandoAdelanto}
                  onVolver={volverALaLista}
                />
              )}
            </div>
          )}
        </div>
      )}

      {detalleOrden && <DetalleOrdenFinanzas item={detalleOrden} tarifas={tarifas} tasa={tasa} onClose={() => setDetalleOrden(null)} />}
      {anulandoAdelanto && (
        <ConfirmModal
          color="red"
          title="¿Anular este adelanto?"
          description={`El adelanto de ${dolares(anulandoAdelanto.monto)} a ${anulandoAdelanto.tecnico} queda anulado y ya no se descuenta de sus pagos.`}
          confirmLabel="Sí, anular"
          processingLabel="Anulando..."
          onCancel={() => setAnulandoAdelanto(null)}
          onConfirm={confirmarAnularAdelanto}
        />
      )}
      {anulando && (
        <ConfirmModal
          color="red"
          title="¿Anular este pago?"
          description={`El pago de ${dolares(anulando.neto ?? anulando.total)} a ${anulando.tecnico} queda anulado: sus ${textoOrdenes(anulando.cantidadOrdenes)} vuelven a estar por pagar${anulando.descuento > 0 ? ` y los ${dolares(anulando.descuento)} de adelantos, por descontar` : ''}.`}
          confirmLabel="Sí, anular"
          processingLabel="Anulando..."
          onCancel={() => setAnulando(null)}
          onConfirm={confirmarAnular}
        />
      )}
    </div>
  );
}
