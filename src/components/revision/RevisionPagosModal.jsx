import { useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import Modal, { CENTRADO_AMPLIO, PANEL_COMPLETO } from '../Modal';
import EncabezadoModulo from '../EncabezadoModulo';
import SelectMenu from '../SelectMenu';
import AvisoHistorial from '../modals/reports/AvisoHistorial';
import ConfirmModal from '../modals/ConfirmModal';
import CampoFecha from '../CampoFecha';
import DetalleOrdenFinanzas from '../finanzas/DetalleOrdenFinanzas';
import FilaRevision from './FilaRevision';
import ResumenCifras from '../finanzas/ResumenCifras';
import { BOTON, CHIP, ETIQUETA, SELECTOR, TARJETA, TEXTO_SUAVE, TITULO_SECCION, CAMPO_FECHA } from '../finanzas/estilos';
import { FECHA_CORTE, SIN_TECNICO, agruparOrdenes, claveOrden, dolares, ordenesPagables, rangoPagable } from '../../utils/finanzas';
import { ESTADOS_REVISION, ETIQUETA_REVISION, aprobarPendientes, armarRevision, garantiasPorResolver, itemsParaRevisar, resumenRevision, revisar } from '../../utils/revisionPagos';
import { PERIODOS, diaLegible, etiquetaRango, rangoDe } from '../../utils/periodoReporte';
import { todasLasOrdenes } from '../../utils/gestionTecnicos';
import { diaDe } from '../../utils/totalesMes';
import { useRevisionPagos } from '../../hooks/useRevisionPagos';
import { useTasaDolar } from '../../hooks/useTasaDolar';

// `enPagina`: el mismo contenido como página dentro del marco del administrador (sin ventana ni barra negra propia: el título y el menú los pone la pantalla que la contiene).
// Revisión de órdenes (solo ADMIN): la barrera entre las órdenes y Finanzas. Aquí un administrador revisa lo que se va a pagar y solo lo que aprueba llega a Finanzas. Lo ya pagado no
// aparece. Respeta la misma fecha de corte de Finanzas (lo anterior no se cuenta). Las correcciones de técnico y de concepto valen para Finanzas aunque la orden esté en un cierre.

export default function RevisionPagosModal({ technicians, tickets, reports, hasMoreReports, isLoadingReports, onLoadMoreReports, onActualizar, usuario, firebaseUser, setToastMsg, onClose, enPagina = false }) {
  const [periodo, setPeriodo] = useState('7_DIAS');
  const [hoy] = useState(() => diaDe(Date.now()));
  const [personalizado, setPersonalizado] = useState(() => ({ desde: rangoDe('7_DIAS').desde, hasta: hoy }));
  const [tecnico, setTecnico] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE');
  const [detalle, setDetalle] = useState(null);
  const [aprobando, setAprobando] = useState(null);

  const rango = useMemo(() => rangoDe(periodo, personalizado), [periodo, personalizado]);
  const rangoRevision = useMemo(() => rangoPagable(rango), [rango]);
  const datos = useRevisionPagos({ firebaseUser, activo: true, rango, setToastMsg });
  const bcv = useTasaDolar();
  const tasa = bcv.tasa;

  const ordenes = useMemo(() => todasLasOrdenes(tickets, reports), [tickets, reports]);
  const nombresTecnicos = useMemo(() => (technicians || []).map((t) => t.name).filter(Boolean).sort(), [technicians]);

  // Todo lo que se revisa (sin lo ya pagado), con su estado. El filtro de técnico se aplica al técnico efectivo (el corregido, si lo hay).
  const todos = useMemo(
    () => revisar(itemsParaRevisar({ ordenes, rango: rangoRevision, registros: datos.registros, tiposMudanza: datos.tiposMudanza }), datos.revisiones).filter((i) => !datos.idsPagadas.has(i.clave)),
    [ordenes, rangoRevision, datos.registros, datos.tiposMudanza, datos.revisiones, datos.idsPagadas],
  );
  const delTecnico = useMemo(() => todos.filter((i) => !tecnico || i.tecnico === tecnico), [todos, tecnico]);
  // Una orden con descuento no se paga como orden a nadie: solo mueve ese monto de un técnico a otro (se ve en su fila).
  const precio = (i) => (i.concepto && !(i.descuento > 0) ? datos.tarifas[i.concepto] || 0 : 0);
  const resumen = useMemo(() => resumenRevision(delTecnico, precio), [delTecnico, datos.tarifas]); // eslint-disable-line react-hooks/exhaustive-deps
  // Garantías de otro técnico que esperan decisión: no se pueden aprobar hasta decidir si se descuenta de la orden original.
  const porResolver = useMemo(() => garantiasPorResolver(delTecnico), [delTecnico]);

  // La original de una garantía se busca entre todas las órdenes; su técnico es el efectivo en la revisión (el corregido, si lo hay) y su precio, lo que paga el tabulador por ella.
  const tecnicoDe = (o) => datos.revisiones[claveOrden(o)]?.tecnicoCorregido || o.tecnico;
  const porClave = useMemo(() => new Map(ordenes.map((o) => [claveOrden(o), o])), [ordenes]);
  const precioOrigen = (id) => {
    const o = porClave.get(id);
    if (!o) return null;
    const [pagable] = ordenesPagables([o], { desde: '0000-01-01', hasta: '9999-12-31' }, {});
    const concepto = datos.revisiones[id]?.conceptoCorregido || pagable?.concepto || (/INSTAL/i.test(o.tipoTrabajo || '') ? 'INSTALACION' : null);
    return concepto ? datos.tarifas[concepto] || 0 : null;
  };
  const visibles = useMemo(() => delTecnico.filter((i) => filtroEstado === 'TODAS' || i.estadoRevision === filtroEstado), [delTecnico, filtroEstado]);

  // Una sección por técnico (el efectivo), con los sin técnico al final.
  const secciones = useMemo(() => {
    const mapa = new Map();
    for (const i of visibles) {
      if (!mapa.has(i.tecnico)) mapa.set(i.tecnico, []);
      mapa.get(i.tecnico).push(i);
    }
    return [...mapa.entries()].sort(([a], [b]) => (a === SIN_TECNICO) - (b === SIN_TECNICO) || a.localeCompare(b));
  }, [visibles]);

  const accion = async (item, que, extra) => {
    const ahora = Date.now();
    const opciones = { por: usuario, ahora, ...extra };
    if (que === 'CORREGIR') {
      // Una orden aprobada vuelve a pendiente al corregirla, para aprobar lo corregido.
      const r = armarRevision(item, 'PENDIENTE', { ...opciones, correccion: extra.correccion });
      if (r.error) return r.error;
      return (await datos.guardar([r], 'Corrección guardada: queda pendiente para aprobarla.')) === true;
    }
    if (que === 'GARANTIA') {
      // La decisión de la garantía se guarda aparte de aprobar: la orden queda pendiente (resuelta) para aprobarla después; si estaba aprobada, vuelve a pendiente.
      const g = armarRevision(item, 'PENDIENTE', { ...opciones, garantia: extra.garantia });
      if (g.error) return g.error;
      return (await datos.guardar([g], 'Decisión de la garantía guardada: ya se puede aprobar la orden.')) === true;
    }
    const r = armarRevision(item, que === 'APROBAR' ? 'APROBAR' : que, opciones);
    if (r.error) return r.error;
    return (await datos.guardar([r], que === 'APROBAR' ? (r.ajustes.length > 0 ? `Orden aprobada: el descuento y el bono (${dolares(item.descuento)}) ya los ve Finanzas y se avisó a los dos técnicos.` : 'Orden aprobada: ya puede verla Finanzas.') : que === 'RETENER' ? 'Orden retenida.' : 'Orden excluida.')) === true;
  };
  const confirmarAprobacion = async () => {
    const { documentos } = aprobando;
    if (documentos.length > 0) await datos.guardar(documentos, `${documentos.length} ${documentos.length === 1 ? 'orden aprobada' : 'órdenes aprobadas'}: ya las ve Finanzas.`);
    setAprobando(null);
  };
  const prepararAprobacion = (lista, titulo) => {
    const r = aprobarPendientes(lista, { por: usuario, ahora: Date.now() });
    setAprobando({ ...r, titulo });
  };

  const marco = (hijos) => (enPagina ? <>{hijos}</> : <Modal onClose={onClose} completa>{hijos}</Modal>);

  return marco(
    <>
      <div className={enPagina ? 'w-full flex flex-col' : `bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden border border-zinc-300 dark:border-zinc-800 flex flex-col ${PANEL_COMPLETO}`}>
        {!enPagina && <EncabezadoModulo Icono={ClipboardCheck} titulo="REVISIÓN DE ÓRDENES" onClose={onClose} />}

        <div className={enPagina ? 'flex-1 min-w-0 bg-fondo px-3 sm:px-4 py-4 space-y-4 text-sm max-w-[1400px] mx-auto w-full' : `flex-1 min-w-0 overflow-y-auto bg-fondo px-4 sm:px-6 py-4 space-y-4 text-sm ${CENTRADO_AMPLIO}`}>
          <p className={TEXTO_SUAVE}>Aquí se revisa lo que va a llegar a Finanzas: solo lo que apruebes se podrá pagar. Lo ya pagado no aparece.{FECHA_CORTE ? ` Cuenta desde el ${diaLegible(FECHA_CORTE)}.` : ''}</p>
          <AvisoHistorial hasMoreReports={hasMoreReports} isLoadingReports={isLoadingReports} onLoadMoreReports={onLoadMoreReports} />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <div role="group" aria-label="Periodo" className="grid grid-cols-4 gap-2 w-full sm:flex sm:w-auto">
              {PERIODOS.map(([id, texto]) => (
                <button key={id} type="button" aria-pressed={periodo === id} onClick={() => setPeriodo(id)} className={`h-9 px-1 sm:px-4 whitespace-nowrap rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${periodo === id ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>{texto}</button>
              ))}
            </div>
            {periodo === 'RANGO' && (
              <>
                <div className="flex items-center gap-2"><span className={ETIQUETA}>Desde</span><CampoFecha ariaLabel="Desde" valor={personalizado.desde} max={personalizado.hasta} onChange={(v) => v && setPersonalizado({ ...personalizado, desde: v })} flotante grande clase={CAMPO_FECHA} ancho="w-48" /></div>
                <div className="flex items-center gap-2"><span className={ETIQUETA}>Hasta</span><CampoFecha ariaLabel="Hasta" valor={personalizado.hasta} min={personalizado.desde} max={hoy} onChange={(v) => v && setPersonalizado({ ...personalizado, hasta: v })} flotante grande clase={CAMPO_FECHA} ancho="w-48" /></div>
              </>
            )}
            <div className="w-full sm:w-60 min-w-0">
              <SelectMenu id="revision-tecnico" ariaLabel="Técnico" className={SELECTOR} value={tecnico} onChange={setTecnico} items={[{ value: '', label: 'Todos los técnicos' }, ...nombresTecnicos.map((t) => ({ value: t, label: t }))]} />
            </div>
            {onActualizar && (
              <button type="button" onClick={onActualizar} disabled={isLoadingReports} className={BOTON}><RefreshCw className={`w-4 h-4 ${isLoadingReports ? 'animate-spin' : ''}`} aria-hidden="true" /> Actualizar</button>
            )}
          </div>

          <ResumenCifras
            items={ESTADOS_REVISION.map((e) => ({ clave: e, etiqueta: e === 'PENDIENTE' ? 'Pendientes' : `${ETIQUETA_REVISION[e]}s`, valor: resumen[e].cantidad, detalle: dolares(resumen[e].total) }))}
            elegida={filtroEstado}
            onElegir={(e) => setFiltroEstado((actual) => (actual === e ? 'TODAS' : e))}
          />

          {porResolver.length > 0 && (
            <p role="status" className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              {porResolver.length === 1 ? '1 garantía de otro técnico espera' : `${porResolver.length} garantías de otro técnico esperan`} tu decisión ({porResolver.slice(0, 4).map((i) => i.orden.codigo || 'S/C').join(', ')}{porResolver.length > 4 ? '...' : ''}): descuenta de la orden original o déjala sin descuento. No se pueden aprobar hasta decidir.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={TEXTO_SUAVE}>Pulsa una cifra para ver esas órdenes; vuelve a pulsarla para verlas todas.</p>
            {resumen.PENDIENTE.cantidad > 0 && (
              <button type="button" onClick={() => prepararAprobacion(delTecnico, 'todas las pendientes')} disabled={datos.ocupado} className={`${BOTON} !bg-red-600 !border-red-600 !text-white`}>Aprobar todas las pendientes ({resumen.PENDIENTE.cantidad})</button>
            )}
          </div>

          <h2 className={TITULO_SECCION}>{filtroEstado === 'TODAS' ? 'Todas las órdenes' : filtroEstado === 'PENDIENTE' ? 'Pendientes de revisión' : `${ETIQUETA_REVISION[filtroEstado]}s`} · {etiquetaRango(rangoRevision)}</h2>
          {datos.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">No se pudieron leer algunos datos de la revisión. Recarga la página.</p>}

          {secciones.length === 0 ? (
            <p className="text-base text-zinc-700 dark:text-zinc-200 text-center py-10">{filtroEstado === 'PENDIENTE' ? 'No hay nada pendiente de revisar en este periodo.' : 'No hay órdenes con ese estado en este periodo.'}</p>
          ) : secciones.map(([nombre, lista]) => {
            const pendientes = lista.filter((i) => i.estadoRevision === 'PENDIENTE');
            return (
              <section key={nombre} aria-label={nombre} className={`${TARJETA} p-4 space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{nombre === SIN_TECNICO ? 'Sin técnico en la ficha' : nombre}</h3>
                    <span className={`${CHIP} bg-white border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100`}>{lista.length} {lista.length === 1 ? 'orden' : 'órdenes'} · {dolares(lista.reduce((s, i) => s + precio(i), 0))}</span>
                  </div>
                  {pendientes.length > 0 && nombre !== SIN_TECNICO && (
                    <button type="button" onClick={() => prepararAprobacion(lista, `las pendientes de ${nombre}`)} disabled={datos.ocupado} className={BOTON}>Aprobar las {pendientes.length} pendientes</button>
                  )}
                </div>
                {agruparOrdenes(lista.map((i) => (i.concepto ? i : { ...i, concepto: 'AVERIA' }))).map((g) => (
                  <div key={g.id}>
                    <h4 className="flex items-center justify-between gap-3 text-sm font-bold text-zinc-900 dark:text-white pb-1 border-b border-zinc-400 dark:border-zinc-700"><span>{g.titulo} · {g.items.length}</span></h4>
                    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {g.items.map((item) => (
                        <FilaRevision key={item.clave} item={lista.find((i) => i.clave === item.clave)} precio={precio(item)} tasa={tasa} tecnicos={nombresTecnicos} ocupado={datos.ocupado} onAccion={accion} onDeshacer={(i) => datos.deshacer(i)} ordenesBusqueda={ordenes} precioOrigen={precioOrigen} tecnicoDe={tecnicoDe} onVerOrden={setDetalle} />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>

      {detalle && <DetalleOrdenFinanzas item={{ ...detalle, concepto: detalle.concepto || detalle.conceptoOriginal || 'AVERIA' }} tarifas={datos.tarifas} tasa={tasa} onClose={() => setDetalle(null)} />}
      {aprobando && (
        <ConfirmModal
          color="blue"
          title={`¿Aprobar ${aprobando.titulo}?`}
          description={aprobando.documentos.length === 0
            ? `No hay nada que se pueda aprobar ahora.${aprobando.omitidas.length > 0 ? ` ${aprobando.omitidas.length} necesitan una corrección primero (sin técnico o sin concepto).` : ''}`
            : `Se aprueban ${aprobando.documentos.length} ${aprobando.documentos.length === 1 ? 'orden' : 'órdenes'} y pasan a Finanzas.${aprobando.omitidas.length > 0 ? ` ${aprobando.omitidas.length} quedan pendientes porque necesitan una corrección (sin técnico o sin concepto).` : ''}`}
          confirmLabel={aprobando.documentos.length === 0 ? 'Entendido' : 'Sí, aprobar'}
          processingLabel="Guardando..."
          onCancel={() => setAprobando(null)}
          onConfirm={confirmarAprobacion}
        />
      )}
    </>
  );
}
