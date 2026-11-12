import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw, Search } from 'lucide-react';
import Modal, { CENTRADO_AMPLIO, PANEL_COMPLETO } from '../Modal';
import EncabezadoModulo from '../EncabezadoModulo';
import SelectMenu from '../SelectMenu';
import AvisoHistorial from '../modals/reports/AvisoHistorial';
import ConfirmModal from '../modals/ConfirmModal';
import DetalleOrdenFinanzas from '../finanzas/DetalleOrdenFinanzas';
import FilaRevision from './FilaRevision';
import RegistrarPagoOficinaModal from './RegistrarPagoOficinaModal';
import ResumenCifras from '../finanzas/ResumenCifras';
import BotonLimpiarBusqueda from '../BotonLimpiarBusqueda';
import { BUSCADOR } from '../estilos';
import { BOTON, CHIP, SELECTOR, TARJETA, TEXTO_SUAVE, TITULO_SECCION } from '../finanzas/estilos';
import { DIAS_POR_PAGAR, corteTodaviaNoLlega, textoFechaCorte, SIN_TECNICO, agruparOrdenes, claveOrden, dolares, ordenesPagables, rangoDeLectura, rangoPagable, rangoPorRevisar } from '../../utils/finanzas';
import { ESTADOS_REVISION, ETIQUETA_REVISION, aprobarPendientes, armarRevision, filtrarPorBusqueda, garantiasPorResolver, itemsParaRevisar, motivoSinPago, resumenRevision, revisar } from '../../utils/revisionPagos';
import { faltaElPago } from '../../utils/pagoCliente';
import { normalizarFormasPago } from '../../utils/formasPago';
import { leerResumenDePago, registrarPagoPorAdmin } from '../../lib/pagosOrdenes';
import { PERIODOS, diaLegible, etiquetaRango, rangoDe } from '../../utils/periodoReporte';
import { todasLasOrdenes } from '../../utils/gestionTecnicos';
import { diaDe } from '../../utils/totalesMes';
import { useRevisionPagos } from '../../hooks/useRevisionPagos';
import { useCargarHastaCubrir } from '../../hooks/useCargarHastaCubrir';
import { useTasaDolar } from '../../hooks/useTasaDolar';
import Chip from '../Chip';
import Boton from '../Boton';
import RangoFechas from '../RangoFechas';

// `enPagina`: el mismo contenido como página dentro del marco del administrador (sin ventana ni barra negra propia: el título y el menú los pone la pantalla que la contiene).
// Revisión de órdenes (solo ADMIN): la barrera entre las órdenes y Finanzas. Aquí un administrador revisa lo que se va a pagar y solo lo que aprueba llega a Finanzas. Lo ya pagado no
// aparece. Respeta la misma fecha de corte de Finanzas (lo anterior no se cuenta). Las correcciones de técnico y de concepto valen para Finanzas aunque la orden esté en un cierre.

// Lo que no se aprueba de golpe: las que necesitan una corrección (sin técnico o sin concepto) y las escaladas a infraestructura, que se aprueban una por una.
function textoOmitidas(omitidas, verbo) {
  const escaladas = omitidas.filter((o) => o.escalada).length;
  const sinPago = omitidas.filter((o) => o.sinPago).length;
  const otras = omitidas.length - escaladas - sinPago;
  const partes = [
    sinPago > 0 && `${sinPago} ${sinPago === 1 ? 'espera' : 'esperan'} el pago del cliente (lo registra el técnico o lo registras tú)`,
    otras > 0 && `${otras} ${verbo} una corrección primero (sin técnico o sin concepto)`,
    escaladas > 0 && `${escaladas} ${escaladas === 1 ? 'está escalada' : 'están escaladas'} a infraestructura y se ${escaladas === 1 ? 'aprueba' : 'aprueban'} una por una`,
  ].filter(Boolean);
  return partes.length > 0 ? ` ${partes.join('; ')}.` : '';
}

export default function RevisionPagosModal({ technicians, tickets, reports, hasMoreReports, isLoadingReports, onLoadMoreReports, onActualizar, usuario, firebaseUser, formasPago = null, setToastMsg, onClose, enPagina = false }) {
  // Abre en "Pendientes": las órdenes de los últimos 35 días (con tope en el corte), para que ninguna quede sin revisar por no haber elegido fechas.
  const [periodo, setPeriodo] = useState('POR_REVISAR');
  const [hoy] = useState(() => diaDe(Date.now()));
  const [personalizado, setPersonalizado] = useState(() => ({ desde: rangoDe('7_DIAS').desde, hasta: hoy }));
  const [tecnico, setTecnico] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE');
  const [detalle, setDetalle] = useState(null);
  const [aprobando, setAprobando] = useState(null);
  // La orden a la que el administrador le registra el pago a nombre del técnico, y los pagos ya leídos de las órdenes que lo esperaban (id de la orden -> pago, o null si no hay).
  const [registrandoPago, setRegistrandoPago] = useState(null);
  const [pagosLeidos, setPagosLeidos] = useState({});

  const rango = useMemo(() => (periodo === 'POR_REVISAR' ? rangoPorRevisar(Date.parse(`${hoy}T12:00:00-04:00`)) : rangoDe(periodo, personalizado)), [periodo, personalizado, hoy]);
  const rangoRevision = useMemo(() => rangoPagable(rango), [rango]);
  // Lo que se lee de Firestore no cambia al pasar entre Pendientes, Hoy, 7 días y Este mes (cada cambio costaría releer todas las revisiones de la ventana): el periodo se filtra aquí, en pantalla.
  const rangoLectura = useMemo(() => rangoDeLectura(rango, Date.parse(`${hoy}T12:00:00-04:00`)), [rango, hoy]);
  const datos = useRevisionPagos({ firebaseUser, activo: true, rango: rangoLectura, setToastMsg });
  // "Pendientes" tiene que ver todas las órdenes de la ventana: carga los cierres anteriores hasta cubrirla.
  useCargarHastaCubrir({ activo: periodo === 'POR_REVISAR', reportes: reports, hayMas: hasMoreReports, cargando: isLoadingReports, onCargarMas: onLoadMoreReports, desdeDia: rangoRevision.desde });
  const bcv = useTasaDolar();
  const tasa = bcv.tasa;

  const ordenes = useMemo(() => todasLasOrdenes(tickets, reports), [tickets, reports]);
  const nombresTecnicos = useMemo(() => (technicians || []).map((t) => t.name).filter(Boolean).sort(), [technicians]);

  // Todo lo que se revisa (sin lo ya pagado), con su estado. El filtro de técnico se aplica al técnico efectivo (el corregido, si lo hay).
  const sinPagoLeido = useMemo(
    () => revisar(itemsParaRevisar({ ordenes, rango: rangoRevision, rangoElegido: rango, registros: datos.registros, tiposMudanza: datos.tiposMudanza }), datos.revisiones).filter((i) => !datos.idsPagadas.has(i.clave)),
    [ordenes, rangoRevision, rango, datos.registros, datos.tiposMudanza, datos.revisiones, datos.idsPagadas],
  );
  // Las órdenes que esperan el pago: si la oficina ya lo registró y la orden está archivada en un Cierre, su copia no lo trae; se lee del pago guardado (una lectura por orden que lo espera, una sola vez).
  const idsSinPago = useMemo(() => sinPagoLeido.filter((i) => i.orden?.id && faltaElPago(i.orden)).map((i) => String(i.orden.id)), [sinPagoLeido]);
  useEffect(() => {
    const nuevos = idsSinPago.filter((id) => !(id in pagosLeidos)).slice(0, 60);
    if (nuevos.length === 0) return undefined;
    let vigente = true;
    Promise.all(nuevos.map((id) => leerResumenDePago(id).then((r) => [id, r]).catch(() => [id, null]))).then((pares) => {
      if (vigente) setPagosLeidos((previos) => ({ ...previos, ...Object.fromEntries(pares) }));
    });
    return () => { vigente = false; };
  }, [idsSinPago, pagosLeidos]);
  const todos = useMemo(
    () => sinPagoLeido.map((i) => (pagosLeidos[String(i.orden?.id)] && !i.orden.pagoCliente ? { ...i, orden: { ...i.orden, pagoCliente: pagosLeidos[String(i.orden.id)] } } : i)),
    [sinPagoLeido, pagosLeidos],
  );
  // La búsqueda recorta lo mismo que el técnico: las cifras de arriba y los botones de aprobar valen para lo que se busca.
  const delTecnico = useMemo(() => filtrarPorBusqueda(todos.filter((i) => !tecnico || i.tecnico === tecnico), busqueda), [todos, tecnico, busqueda]);
  const buscando = busqueda.trim() !== '';
  // Una orden con descuento no se paga como orden a nadie: solo mueve ese monto de un técnico a otro (se ve en su fila).
  const precio = (i) => (i.concepto && !(i.descuento > 0) ? datos.tarifas[i.concepto] || 0 : 0);
  const resumen = useMemo(() => resumenRevision(delTecnico, precio), [delTecnico, datos.tarifas]); // eslint-disable-line react-hooks/exhaustive-deps
  // Garantías de otro técnico que esperan decisión: no se pueden aprobar hasta decidir si se descuenta de la orden original.
  const porResolver = useMemo(() => garantiasPorResolver(delTecnico), [delTecnico]);
  // Lo escalado a infraestructura que espera revisión: tiene su alerta en la fila y se aprueba una por una.
  const escaladasPendientes = useMemo(() => delTecnico.filter((i) => i.escalada && i.estadoRevision === 'PENDIENTE'), [delTecnico]);
  // Las que esperan el pago del cliente (lo registra el técnico o la oficina por él): no se pueden aprobar todavía.
  const esperanPago = useMemo(() => delTecnico.filter((i) => motivoSinPago(i) && (i.estadoRevision === 'PENDIENTE' || i.estadoRevision === 'RETENIDA')), [delTecnico]);
  const tecnicosSinPago = useMemo(() => [...new Set(esperanPago.map((i) => i.orden.tecnico || i.tecnico).filter(Boolean))], [esperanPago]);

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
  // El administrador registra el pago por el técnico: se guarda y la orden queda lista para aprobarse (el pago leído se actualiza al instante).
  const registrarPago = async (item, { valor = null, nota = '', pagaDespues = false }) => {
    try {
      const r = await registrarPagoPorAdmin(item.orden, { valor, nota, pagaDespues }, { por: usuario });
      if (r.repetida) return r;
      setPagosLeidos((previos) => ({ ...previos, [String(item.orden.id)]: r.resumen }));
      setToastMsg?.({ type: 'success', text: pagaDespues ? 'Queda anotado que el cliente paga después: la orden ya se puede aprobar.' : 'Pago registrado a nombre del técnico: la orden ya se puede aprobar.' });
      return { ok: true };
    } catch (error) {
      console.error('No se pudo registrar el pago por el técnico:', error);
      return { error: 'No se pudo guardar el pago. Revisa tu conexión e intenta de nuevo.' };
    }
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
      <div className={enPagina ? 'w-full flex flex-col' : `bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92dvh] overflow-hidden border border-zinc-300 dark:border-zinc-800 flex flex-col ${PANEL_COMPLETO}`}>
        {!enPagina && <EncabezadoModulo Icono={ClipboardCheck} titulo="Revisión de órdenes" onClose={onClose} />}

        <div className={enPagina ? 'flex-1 min-w-0 bg-fondo px-4 sm:px-6 py-4 space-y-4 text-sm max-w-[1400px] mx-auto w-full' : `flex-1 min-w-0 overflow-y-auto bg-fondo px-4 sm:px-6 py-4 space-y-4 text-sm ${CENTRADO_AMPLIO}`}>
          <p className={TEXTO_SUAVE}>Aquí se revisa lo que va a llegar a Finanzas: solo lo que apruebes se podrá pagar. Lo ya pagado no aparece.{corteTodaviaNoLlega() ? ` Comienza a contar a partir del ${textoFechaCorte()}.` : ''}</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <div role="group" aria-label="Periodo" className="grid grid-cols-3 gap-2 w-full sm:flex sm:w-auto">
              {[['POR_REVISAR', 'Pendientes'], ...PERIODOS].map(([id, texto]) => (
                <Chip activo={periodo === id} tamano="angosto" key={id} type="button" onClick={() => setPeriodo(id)}>{texto}</Chip>
              ))}
            </div>
            {periodo === 'RANGO' && (
              <RangoFechas desde={personalizado.desde} hasta={personalizado.hasta} onDesde={(v) => setPersonalizado({ ...personalizado, desde: v })} onHasta={(v) => setPersonalizado({ ...personalizado, hasta: v })} maximo={hoy} grande />
            )}
            <div className="w-full sm:w-60 min-w-0">
              <SelectMenu id="revision-tecnico" ariaLabel="Técnico" className={SELECTOR} value={tecnico} onChange={setTecnico} items={[{ value: '', label: 'Todos los técnicos' }, ...nombresTecnicos.map((t) => ({ value: t, label: t }))]} />
            </div>
            {onActualizar && (
              <button type="button" onClick={onActualizar} disabled={isLoadingReports} className={BOTON}><RefreshCw className={`w-4 h-4 ${isLoadingReports ? 'animate-spin' : ''}`} aria-hidden="true" /> Actualizar</button>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input type="search" aria-label="Buscar por código, cliente, cédula o técnico" placeholder="Código, cliente, cédula o técnico" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoComplete="off" className={BUSCADOR} />
            <BotonLimpiarBusqueda valor={busqueda} onLimpiar={() => setBusqueda('')} />
          </div>

          {periodo === 'POR_REVISAR' && (
            <p role="status" className={`${TEXTO_SUAVE} rounded-xl border border-zinc-400 dark:border-zinc-700 bg-zinc-200/70 dark:bg-zinc-900 px-4 py-3`}>
              Pendientes muestra las órdenes de los últimos {DIAS_POR_PAGAR} días (del {diaLegible(rango.desde)} al {diaLegible(rango.hasta)}). Para algo anterior, elige un Rango.
            </p>
          )}

          <ResumenCifras
            items={ESTADOS_REVISION.map((e) => ({ clave: e, etiqueta: e === 'PENDIENTE' ? 'Pendientes' : `${ETIQUETA_REVISION[e]}s`, valor: resumen[e].cantidad, detalle: dolares(resumen[e].total) }))}
            elegida={filtroEstado}
            onElegir={(e) => setFiltroEstado((actual) => (actual === e ? 'TODAS' : e))}
          />

          {porResolver.length > 0 && (
            <p role="status" className="rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              {porResolver.length === 1 ? '1 garantía de otro técnico espera' : `${porResolver.length} garantías de otro técnico esperan`} tu decisión ({porResolver.slice(0, 4).map((i) => i.orden.codigo || 'S/C').join(', ')}{porResolver.length > 4 ? '...' : ''}): descuenta de la orden original o déjala sin descuento. No se pueden aprobar hasta decidir.
            </p>
          )}

          {esperanPago.length > 0 && (
            <p role="status" className="rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              {esperanPago.length === 1 ? '1 orden espera' : `${esperanPago.length} órdenes esperan`} el pago del cliente y no se {esperanPago.length === 1 ? 'puede' : 'pueden'} aprobar todavía ({esperanPago.slice(0, 4).map((i) => i.orden.codigo || 'S/C').join(', ')}{esperanPago.length > 4 ? '...' : ''}). Lo registra {tecnicosSinPago.length === 1 ? 'el técnico' : 'cada técnico'}{tecnicosSinPago.length > 0 ? ` (${tecnicosSinPago.slice(0, 3).join(', ')}${tecnicosSinPago.length > 3 ? '...' : ''})` : ''}; si no puede, usa "Registrar el pago" en la orden.
            </p>
          )}

          {escaladasPendientes.length > 0 && (
            <p role="status" className="rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              {escaladasPendientes.length === 1 ? '1 orden escalada a infraestructura espera' : `${escaladasPendientes.length} órdenes escaladas a infraestructura esperan`} tu revisión ({escaladasPendientes.slice(0, 4).map((i) => i.orden.codigo || 'S/C').join(', ')}{escaladasPendientes.length > 4 ? '...' : ''}): llevan la etiqueta Infraestructura y se aprueban una por una, no con el botón de aprobar todas.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={TEXTO_SUAVE}>Pulsa una cifra para ver esas órdenes; vuelve a pulsarla para verlas todas.</p>
            {resumen.PENDIENTE.cantidad > 0 && (
              <Boton variante="principal" tamano="normal" type="button" onClick={() => prepararAprobacion(delTecnico, buscando ? 'las pendientes de la búsqueda' : 'todas las pendientes')} disabled={datos.ocupado}>{buscando ? 'Aprobar las pendientes de la búsqueda' : 'Aprobar todas las pendientes'} ({resumen.PENDIENTE.cantidad})</Boton>
            )}
          </div>

          <h2 className={TITULO_SECCION}>{filtroEstado === 'TODAS' ? 'Todas las órdenes' : filtroEstado === 'PENDIENTE' ? 'Pendientes de revisión' : `${ETIQUETA_REVISION[filtroEstado]}s`} · {etiquetaRango(rango)}</h2>
          {datos.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">No se pudieron leer algunos datos de la revisión. Recarga la página.</p>}

          {secciones.length === 0 ? (
            <p className="text-base text-zinc-700 dark:text-zinc-200 text-center py-10">{rangoRevision.desde > rangoRevision.hasta ? `Este periodo es anterior al corte: se cuenta a partir del ${textoFechaCorte()}.` : buscando ? (delTecnico.length > 0 ? 'Lo que buscas está en otro estado: pulsa otra de las cifras de arriba para verlo.' : 'Ninguna orden de este periodo coincide con lo que buscas. La búsqueda solo recorre el periodo y el técnico elegidos.') : filtroEstado === 'PENDIENTE' ? 'No hay nada pendiente de revisar en este periodo.' : 'No hay órdenes con ese estado en este periodo.'}</p>
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
                {agruparOrdenes(lista.map((i) => (i.concepto ? i : { ...i, concepto: 'AVERIA' })), { masNuevasPrimero: true }).map((g) => (
                  <div key={g.id}>
                    <h4 className="flex items-center justify-between gap-3 text-sm font-bold text-zinc-900 dark:text-white pb-1 border-b border-zinc-400 dark:border-zinc-700"><span>{g.titulo} · {g.items.length}</span></h4>
                    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {g.items.map((item) => (
                        <FilaRevision key={item.clave} item={lista.find((i) => i.clave === item.clave)} precio={precio(item)} tasa={tasa} tecnicos={nombresTecnicos} ocupado={datos.ocupado} onAccion={accion} onDeshacer={(i) => datos.deshacer(i)} ordenesBusqueda={ordenes} precioOrigen={precioOrigen} tecnicoDe={tecnicoDe} onVerOrden={setDetalle} onRegistrarPago={setRegistrandoPago} />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
          <AvisoHistorial hasMoreReports={hasMoreReports} isLoadingReports={isLoadingReports} onLoadMoreReports={onLoadMoreReports} />
        </div>
      </div>

      {registrandoPago && (
        <RegistrarPagoOficinaModal
          orden={registrandoPago.orden}
          cuentasEmpresa={normalizarFormasPago(formasPago)}
          onRegistrar={(valor, nota) => registrarPago(registrandoPago, { valor, nota })}
          onPagaDespues={({ nota }) => registrarPago(registrandoPago, { nota, pagaDespues: true })}
          onClose={() => setRegistrandoPago(null)}
        />
      )}
      {detalle && <DetalleOrdenFinanzas item={{ ...detalle, concepto: detalle.concepto || detalle.conceptoOriginal || 'AVERIA' }} tarifas={datos.tarifas} tasa={tasa} verTodoPago onClose={() => setDetalle(null)} />}
      {aprobando && (
        <ConfirmModal
          color="blue"
          title={`¿Aprobar ${aprobando.titulo}?`}
          description={aprobando.documentos.length === 0
            ? `No hay nada que se pueda aprobar ahora.${textoOmitidas(aprobando.omitidas, 'necesitan')}`
            : `Se aprueban ${aprobando.documentos.length} ${aprobando.documentos.length === 1 ? 'orden' : 'órdenes'} y pasan a Finanzas.${textoOmitidas(aprobando.omitidas, 'quedan pendientes porque necesitan')}`}
          confirmLabel={aprobando.documentos.length === 0 ? 'Entendido' : 'Sí, aprobar'}
          processingLabel="Guardando..."
          onCancel={() => setAprobando(null)}
          onConfirm={confirmarAprobacion}
        />
      )}
    </>
  );
}
