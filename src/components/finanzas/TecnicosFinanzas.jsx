import { useRef, useState } from 'react';
import { HandCoins, MinusCircle, TriangleAlert } from 'lucide-react';
import ResumenCifras from './ResumenCifras';
import AvisoHistorial from '../modals/reports/AvisoHistorial';
import ConfirmModal from '../modals/ConfirmModal';
import Colapsable from '../Colapsable';
import SelectMenu from '../SelectMenu';
import Boton from '../Boton';
import ListaTecnicos from './ListaTecnicos';
import DetalleTecnico from './DetalleTecnico';
import PanelPago from './PanelPago';
import PanelAdelanto from './PanelAdelanto';
import PanelDescuento from './PanelDescuento';
import DetalleOrdenFinanzas from './DetalleOrdenFinanzas';
import { BOTON_FILA, ETIQUETA, SELECTOR, TARJETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { SIN_TECNICO, adelantosDelPeriodo, cifrasPagos, descuentosDelPeriodo, dolares, grupoDePago, pagosDelPeriodo, sumaPagado, textoOrdenes } from '../../utils/finanzas';
import { saldoAdelanto } from '../../utils/adelantos';
import { diaLegible, etiquetaRango } from '../../utils/periodoReporte';
import { useEsPantallaGrande } from '../../hooks/useEsPantallaGrande';

// La pantalla de pago a técnicos: arriba las cifras y los avisos, y debajo la lista de técnicos a la izquierda y todo lo del técnico elegido a la derecha (en el celular, la lista y,
// al elegir uno, su pantalla con un botón para volver). "Pagar", "Adelanto" y "Descuento" abren su formulario en esa misma pantalla, no en una ventana.
// `adelantos` y `descuentos`: los adelantos y los descuentos con motivo; `onPagar(fila, { datosPago, notificar, nota })`, `onAdelanto(tecnico, entrada, { notificar })`, `onDescuento(tecnico, entrada, { notificar })`,
// `onAnularAdelanto(adelanto)` y `onAnularDescuento(descuento)` devuelven true si se guardó.
export default function TecnicosFinanzas({ filas, items, esperandoRevision = 0, sinTipo = [], onTipoMudanza, tarifas, pagos, adelantos = [], descuentos = [], ajustes = [], ajustesTodos = ajustes, garantiasPendientes = new Set(), pagadasPorTecnico, rango, tasa, ocupado, historial, onPagar, onAnular, onAdelanto, onAnularAdelanto, onDescuento, onAnularDescuento, tecnicosTodos = [] }) {
  const grande = useEsPantallaGrande();
  const [elegido, setElegido] = useState(null);
  const [modo, setModo] = useState('detalle');
  const [detalleOrden, setDetalleOrden] = useState(null);
  const [anulando, setAnulando] = useState(null);
  const [anulandoAdelanto, setAnulandoAdelanto] = useState(null);
  const [anulandoDescuento, setAnulandoDescuento] = useState(null);
  const [verSinTecnico, setVerSinTecnico] = useState(false);
  const [verSinTipo, setVerSinTipo] = useState(false);
  // "Descuento" y "Adelanto" generales: a cualquier técnico, tenga o no órdenes por pagar (no dependen de que exista su tarjeta).
  const [general, setGeneral] = useState(null); // null | 'descuento' | 'adelanto'
  const [tecnicoGeneral, setTecnicoGeneral] = useState('');
  const cerrarGeneral = () => { setGeneral(null); setTecnicoGeneral(''); };
  const abrirGeneral = (tipo) => { setGeneral(tipo); setTecnicoGeneral(''); };
  const zonaDetalle = useRef(null);

  const tecnicos = filas.filter((f) => f.tecnico !== SIN_TECNICO);
  // En PC siempre hay un técnico elegido (el primero); en el celular, hasta que se elige uno se ve la lista.
  const actual = tecnicos.find((f) => f.tecnico === elegido) || (grande ? tecnicos[0] : null) || null;
  const ordenesSinTecnico = items.filter((i) => i.tecnico === SIN_TECNICO);
  const registrados = pagosDelPeriodo(pagos, rango);
  // Los adelantos del periodo y, aunque sean de antes, los que todavía tienen algo por descontar.
  const adelantosVisibles = [...new Map([...adelantosDelPeriodo(adelantos, rango), ...adelantos.filter((a) => saldoAdelanto(a) > 0)].map((a) => [a.id, a])).values()].sort((a, b) => (Number(b.pagadoEn) || 0) - (Number(a.pagadoEn) || 0));
  // Lo mismo con los descuentos con motivo: los del periodo y los que todavía tienen algo por descontar.
  const descuentosVisibles = [...new Map([...descuentosDelPeriodo(descuentos, rango), ...descuentos.filter((d) => saldoAdelanto(d) > 0)].map((d) => [d.id, d])).values()].sort((a, b) => (Number(b.creadoEn) || 0) - (Number(a.creadoEn) || 0));

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
  const confirmarAnularDescuento = async () => { await onAnularDescuento(anulandoDescuento); setAnulandoDescuento(null); };

  const alerta = 'rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 space-y-3';

  return (
    <div className="space-y-5">
      {!enDetalleMovil && <AvisoHistorial {...historial} />}
      {!enDetalleMovil && <ResumenCifras items={cifrasPagos(tecnicos, sumaPagado(Object.values(pagadasPorTecnico)), tasa)} />}

      {!enDetalleMovil && esperandoRevision > 0 && (
        <div className={alerta}>
          <p className="flex items-start gap-2"><TriangleAlert className="w-6 h-6 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{esperandoRevision === 1 ? '1 orden espera' : `${esperandoRevision} órdenes esperan`} la revisión de un administrador y todavía no se {esperandoRevision === 1 ? 'puede' : 'pueden'} pagar. Aquí solo aparece lo que ya aprobó.</span>
          </p>
        </div>
      )}

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

      {!enDetalleMovil && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={TITULO_SECCION}>Técnicos · {etiquetaRango(rango)}</h2>
          {!general && (
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" tamano="normal" icono={MinusCircle} onClick={() => abrirGeneral('descuento')} disabled={ocupado}>Nuevo descuento</Boton>
              <Boton variante="secundario" tamano="normal" icono={HandCoins} onClick={() => abrirGeneral('adelanto')} disabled={ocupado}>Nuevo adelanto</Boton>
            </div>
          )}
        </div>
      )}

      {general ? (
        <div className={`${TARJETA} p-4 sm:p-5 space-y-4 max-w-3xl`}>
          <div className="space-y-1">
            <h3 className={TITULO_SECCION}>{general === 'descuento' ? 'Nuevo descuento' : 'Nuevo adelanto'}</h3>
            <p className={TEXTO_SUAVE}>Elige a quién. No hace falta que tenga órdenes por pagar: queda por descontar de su próximo pago.</p>
          </div>
          <div>
            <label htmlFor="general-tecnico" className={ETIQUETA}>Técnico</label>
            <div className="mt-1">
              <SelectMenu id="general-tecnico" ariaLabel={general === 'descuento' ? 'Técnico del descuento' : 'Técnico del adelanto'} className={SELECTOR} value={tecnicoGeneral} onChange={setTecnicoGeneral} items={[{ value: '', label: 'Elige el técnico' }, ...tecnicosTodos.map((t) => ({ value: t, label: t }))]} />
            </div>
          </div>
          {!tecnicoGeneral ? (
            <Boton variante="secundario" tamano="normal" onClick={cerrarGeneral}>Cancelar</Boton>
          ) : general === 'descuento' ? (
            <PanelDescuento key={`d-${tecnicoGeneral}`} tecnico={tecnicoGeneral} neto={filas.find((f) => f.tecnico === tecnicoGeneral)?.neto ?? filas.find((f) => f.tecnico === tecnicoGeneral)?.total ?? 0} porDescontar={filas.find((f) => f.tecnico === tecnicoGeneral)?.descuentosLibres ?? 0} tasa={tasa} ocupado={ocupado} onGuardar={(entrada, opciones) => onDescuento(tecnicoGeneral, entrada, opciones)} onVolver={cerrarGeneral} volverTexto="Cancelar" />
          ) : (
            <PanelAdelanto key={`a-${tecnicoGeneral}`} tecnico={tecnicoGeneral} porDescontar={filas.find((f) => f.tecnico === tecnicoGeneral)?.adelantos ?? 0} tasa={tasa} ocupado={ocupado} onGuardar={(entrada, opciones) => onAdelanto(tecnicoGeneral, entrada, opciones)} onVolver={cerrarGeneral} volverTexto="Cancelar" />
          )}
        </div>
      ) : tecnicos.length === 0 ? (
        <p className="text-base text-zinc-700 dark:text-zinc-200 text-center py-10">Ninguna orden pagable en este periodo. Aquí solo aparecen las que Revisión de órdenes ya aprobó: amplía el rango de fechas o aprueba las pendientes en Revisión de órdenes.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(20rem,26rem)_1fr] items-start">
          <div className={actual ? 'hidden lg:block lg:sticky lg:top-20' : ''}>
            <ListaTecnicos filas={tecnicos} elegido={actual?.tecnico} tasa={tasa} onElegir={elegir} />
          </div>
          {actual && (
            <div ref={zonaDetalle} className={`min-w-0 scroll-mt-4 ${TARJETA} p-4 sm:p-5`} key={`${actual.tecnico}-${modo}`}>
              {modo === 'pagar' ? (
                <PanelPago fila={actual} rango={rango} tasa={tasa} ocupado={ocupado} onConfirmar={(opciones) => onPagar(actual, opciones)} onVolver={() => setModo('detalle')} />
              ) : modo === 'adelanto' ? (
                <PanelAdelanto tecnico={actual.tecnico} porDescontar={actual.adelantos} tasa={tasa} ocupado={ocupado} onGuardar={(entrada, opciones) => onAdelanto(actual.tecnico, entrada, opciones)} onVolver={() => setModo('detalle')} />
              ) : modo === 'descuento' ? (
                <PanelDescuento tecnico={actual.tecnico} neto={actual.neto ?? actual.total} porDescontar={actual.descuentosLibres} tasa={tasa} ocupado={ocupado} onGuardar={(entrada, opciones) => onDescuento(actual.tecnico, entrada, opciones)} onVolver={() => setModo('detalle')} />
              ) : (
                <DetalleTecnico
                  fila={actual}
                  tarifas={tarifas}
                  tasa={tasa}
                  rango={rango}
                  pagos={registrados.filter((p) => p.tecnico === actual.tecnico)}
                  adelantos={adelantosVisibles.filter((a) => a.tecnico === actual.tecnico)}
                  descuentos={descuentosVisibles.filter((d) => d.tecnico === actual.tecnico)}
                  ajustes={ajustes.filter((a) => a.tecnico === actual.tecnico && saldoAdelanto(a) > 0)}
                  garantiasPendientes={garantiasPendientes}
                  pagado={pagadasPorTecnico[actual.tecnico]}
                  ocupado={ocupado}
                  onPagar={() => setModo('pagar')}
                  onAdelanto={() => setModo('adelanto')}
                  onDescuento={() => setModo('descuento')}
                  onVerOrden={setDetalleOrden}
                  onAnularPago={setAnulando}
                  onAnularAdelanto={setAnulandoAdelanto}
                  onAnularDescuento={setAnulandoDescuento}
                  onVolver={volverALaLista}
                />
              )}
            </div>
          )}
        </div>
      )}

      {detalleOrden && <DetalleOrdenFinanzas item={detalleOrden} tarifas={tarifas} tasa={tasa} ajustes={ajustesTodos} onClose={() => setDetalleOrden(null)} />}
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
      {anulandoDescuento && (
        <ConfirmModal
          color="red"
          title="¿Anular este descuento?"
          description={`El descuento de ${dolares(anulandoDescuento.monto)} a ${anulandoDescuento.tecnico} queda anulado y ya no se resta de sus pagos.`}
          confirmLabel="Sí, anular"
          processingLabel="Anulando..."
          onCancel={() => setAnulandoDescuento(null)}
          onConfirm={confirmarAnularDescuento}
        />
      )}
      {anulando && (
        <ConfirmModal
          color="red"
          title="¿Anular este pago?"
          description={`El pago de ${dolares(anulando.neto ?? anulando.total)} a ${anulando.tecnico} queda anulado: sus ${textoOrdenes(anulando.cantidadOrdenes)} vuelven a estar por pagar${anulando.descuento > 0 ? ` y los ${dolares(anulando.descuento)} de adelantos y descuentos, por descontar` : ''}.`}
          confirmLabel="Sí, anular"
          processingLabel="Anulando..."
          onCancel={() => setAnulando(null)}
          onConfirm={confirmarAnular}
        />
      )}
    </div>
  );
}
