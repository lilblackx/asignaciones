import { useMemo, useState } from 'react';
import { Banknote, RefreshCw } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useTema } from '../hooks/useTema';
import { useDatosAlmacen } from '../hooks/useDatosAlmacen';
import { useCargarHastaCubrir } from '../hooks/useCargarHastaCubrir';
import { useFinanzas } from '../hooks/useFinanzas';
import { usePagosFinanzas } from '../hooks/usePagosOrdenes';
import { useCobrosFinanzas } from '../hooks/useCobrosClientes';
import { useTasaDolar } from '../hooks/useTasaDolar';
import { useTasasDolar } from '../hooks/useTasasDolar';
import { etiquetaDia, opcionElegida } from '../utils/tasasDolar';
import { todasLasOrdenes } from '../utils/gestionTecnicos';
import { rangoDe } from '../utils/periodoReporte';
import { diaDe } from '../utils/totalesMes';
import { claveOrden, corteTodaviaNoLlega, textoFechaCorte, pagosDelPeriodo, rangoPagable, rangoPorPagar, ordenesYaPagadas, resumenPagado, resumenPagos, totalesPagados } from '../utils/finanzas';
import { detalleDePagos } from '../utils/detallePagos';
import { itemsParaRevisar, paraFinanzas, revisar } from '../utils/revisionPagos';
import { csvDeDocumento } from '../utils/csvReporte';
import { descargarCsv } from '../utils/exportarOrdenes';
import { exportarDocumento, nombreDeArchivo } from '../utils/exportarDocumento';
import { documentoPagosClientes, documentoPagosDetallados, documentoPagosTecnicos, documentoResumenPagos } from '../utils/modelosReporte';
import Toast from './Toast';
import EncabezadoSimple from './EncabezadoSimple';
import PieVersion from './PieVersion';
import BarraFinanzas from './finanzas/BarraFinanzas';
import AccionesEncabezado from './AccionesEncabezado';
import MenuExportar from './modals/reports/MenuExportar';
import TasaBcv from './finanzas/TasaBcv';
import TecnicosFinanzas from './finanzas/TecnicosFinanzas';
import TamanoLetra from './finanzas/TamanoLetra';
import { useTamanoLetra } from '../hooks/useTamanoLetra';
import ResumenPagado from './finanzas/ResumenPagado';
import PagosClientes from './finanzas/PagosClientes';
import TabuladorPrecios from './finanzas/TabuladorPrecios';
import TabuladorAdicionales from './finanzas/TabuladorAdicionales';

// "3:45 p. m." (hora de Caracas) de cuando se leyeron las órdenes por última vez.
const horaLegible = (ms) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms));

// `documento` y `archivo`: lo que se baja con "Exportar" en esa sección (el tabulador no tiene).
// Mientras no está abierta "Pagos de clientes" no se lee nada de pagosOrdenes (un rango vacío no consulta).
const SIN_LEER = { desde: '', hasta: '' };

const SECCIONES = [
  { id: 'PAGOS', nombre: 'Técnicos', corto: 'Técnicos', documento: documentoPagosTecnicos, archivo: 'pago-a-tecnicos' },
  { id: 'CLIENTES', nombre: 'Pagos de clientes', corto: 'Clientes', documento: documentoPagosClientes, archivo: 'pagos-de-clientes' },
  { id: 'PRECIOS', nombre: 'Tabulador de precios', corto: 'Precios' },
  { id: 'REPORTE', nombre: 'Reporte de pagos', corto: 'Reporte', documento: documentoResumenPagos, archivo: 'resumen-de-pagos' },
];

// En "Reporte de pagos" el menú Exportar trae dos reportes: el Resumen de pagos (el de siempre) y los Pagos detallados, que se comparten con cada técnico.
const GRUPOS_REPORTE = [
  { clave: 'resumen', titulo: 'Resumen de pagos', detalle: 'Lo pagado a cada técnico, con los adelantos y descuentos.', formatos: ['pdf', 'docx', 'csv'] },
  { clave: 'detallado', titulo: 'Pagos detallados', detalle: 'Cada pago con sus órdenes, descuentos y bonos. Para compartirlo con un técnico, elígelo antes en el filtro.', formatos: ['pdf', 'docx', 'csv'] },
];

// Pantalla de FINANZAS: pagar a los técnicos, el tabulador de precios y el reporte de lo pagado. No toca las órdenes: lo que guarda va en sus propias colecciones.
// `onAbrirMenu`: cuando un administrador está aquí dentro del menú lateral, el botón ☰ que lo abre en el celular.
export default function FinanzasApp({ auth, onAbrirMenu }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout } = auth;
  const [isDarkMode, setIsDarkMode] = useTema(currentUser);
  const { toastMsg, setToastMsg } = useToast();
  // Sin listeners en vivo sobre las órdenes (ver useDatosAlmacen): se leen al abrir y con "Actualizar".
  const { tickets, technicians, reports, cargado, error, actualizadoEn, actualizando, actualizar, hayMasReportes, cargandoReportes, cargarReportesAnteriores } = useDatosAlmacen(firebaseUser);

  const [nivelLetra, setNivelLetra] = useTamanoLetra();
  const [seccion, setSeccion] = useState('PAGOS');
  // Abre en "Por pagar" (solo en Técnicos): todo lo aprobado y sin pagar, de cualquier fecha, sin tener que elegir fechas.
  const [periodo, setPeriodo] = useState('POR_PAGAR');
  const [hoy] = useState(() => diaDe(Date.now()));
  const [personalizado, setPersonalizado] = useState(() => ({ desde: rangoDe('7_DIAS').desde, hasta: hoy }));
  const [tecnico, setTecnico] = useState('');
  const [exportando, setExportando] = useState(null);
  const [errorExportar, setErrorExportar] = useState('');

  const rango = useMemo(() => (periodo === 'POR_PAGAR' ? rangoPorPagar(Date.parse(`${hoy}T12:00:00-04:00`)) : rangoDe(periodo, personalizado)), [periodo, personalizado, hoy]);
  // "Por pagar" solo existe en Técnicos: al pasar a otra sección vuelve a los 7 días de antes.
  const elegirSeccion = (id) => { setSeccion(id); if (id !== 'PAGOS' && periodo === 'POR_PAGAR') setPeriodo('7_DIAS'); };
  // "Por pagar": no se lee por fechas sino lo marcado como aprobado y sin pagar (pendientePago), sea de cuando sea; `rango` (los últimos 35 días) solo sirve ahí para lo ya pagado que se muestra.
  const soloPendientes = periodo === 'POR_PAGAR' && seccion === 'PAGOS';
  const finanzas = useFinanzas({ firebaseUser, rango, usuario: currentUser, setToastMsg, soloPendientes });
  // El rango con que se arman las órdenes: con "Por pagar", del día más antiguo de lo aprobado sin pagar a hoy; en los demás periodos, el elegido.
  const rangoItems = useMemo(() => (soloPendientes ? { desde: finanzas.desdePendientes || hoy, hasta: hoy } : rango), [soloPendientes, finanzas.desdePendientes, hoy, rango]);
  // Para armar esas órdenes hacen falta sus cierres: se cargan los anteriores hasta cubrir el día más antiguo.
  useCargarHastaCubrir({ activo: soloPendientes, reportes: reports, hayMas: hayMasReportes, cargando: cargandoReportes, onCargarMas: cargarReportesAnteriores, desdeDia: rangoItems.desde });
  // Lo que pagaron los clientes por instalaciones y cambios de equipo (lo registra el técnico); solo se lee cuando se abre esa sección.
  const pagosClientes = usePagosFinanzas(firebaseUser, seccion === 'CLIENTES' ? rango : SIN_LEER);
  const cobrosClientes = useCobrosFinanzas(firebaseUser, seccion === 'CLIENTES' ? rango : SIN_LEER);
  // La tasa BCV del dólar, para mostrar los bolívares y pagar (cada pago guarda la de su momento). Se guardan las de los últimos 7 días y se puede pagar con la de un día anterior
  // (el martes con la del lunes): `diaTasa` es el día elegido (null: la más reciente) y `tasa` la de ese día; sin historial (no llegó ni de la API ni de lo guardado) es la de ahora.
  const bcv = useTasaDolar();
  const tasas = useTasasDolar(firebaseUser, currentUser, bcv);
  const [diaTasa, setDiaTasa] = useState(null);
  const tasaElegida = opcionElegida(tasas.opciones, diaTasa);
  const tasa = tasaElegida ? tasaElegida.tasa : bcv.tasa;
  // Lo que se agrega al texto de los bolívares al pagar: de qué día es la tasa, solo si no es la de hoy.
  const etiquetaTasa = tasaElegida && !tasaElegida.esHoy ? `tasa del ${etiquetaDia(tasaElegida.dia)}` : '';
  const ordenes = useMemo(() => todasLasOrdenes(tickets, reports), [tickets, reports]);
  const nombresTecnicos = useMemo(() => technicians.map((t) => t.name).filter(Boolean).sort(), [technicians]);
  const historial = { hasMoreReports: hayMasReportes, isLoadingReports: cargandoReportes, onLoadMoreReports: cargarReportesAnteriores };

  // Lo que se debe cuenta desde la fecha de corte: lo anterior del periodo elegido no se muestra.
  const rangoDeuda = useMemo(() => rangoPagable(rangoItems), [rangoItems]);
  // Finanzas solo ve lo que un administrador aprobó (ver el módulo Revisión de órdenes) y lo que ya se pagó. `revisados` trae todo con su estado de revisión.
  const revisados = useMemo(
    () => revisar(itemsParaRevisar({ ordenes, rango: rangoDeuda, rangoElegido: rangoItems, tecnico, registros: finanzas.registros, tiposMudanza: finanzas.tiposMudanza, tarifas: finanzas.tarifas }), finanzas.revisiones),
    [ordenes, rangoDeuda, rangoItems, tecnico, finanzas.registros, finanzas.tiposMudanza, finanzas.tarifas, finanzas.revisiones],
  );
  const items = useMemo(() => paraFinanzas(revisados, finanzas.idsPagadas), [revisados, finanzas.idsPagadas]);
  // Lo que todavía espera la revisión del administrador (no está aprobado, retenido ni excluido).
  // Con "Por pagar" solo se leen las aprobadas sin pagar: no se sabe cuáles de las demás esperan revisión (están sin leer), así que no se cuentan.
  const esperandoRevision = useMemo(() => (soloPendientes ? 0 : revisados.filter((i) => i.estadoRevision === 'PENDIENTE' && !finanzas.idsPagadas.has(i.clave)).length), [soloPendientes, revisados, finanzas.idsPagadas]);
  // Las originales que tienen una garantía de otro técnico por revisar (todavía sin aprobar): su descuento puede llegar después de pagarlas.
  const garantiasPendientes = useMemo(() => new Set(revisados.filter((i) => i.garantiaDe?.id && i.estadoRevision !== 'APROBADA' && i.estadoRevision !== 'EXCLUIDA').map((i) => i.garantiaDe.id)), [revisados]);
  const sinTipo = [];
  // Los adelantos del técnico elegido arriba (o de todos).
  const adelantosVisibles = useMemo(() => finanzas.adelantos.filter((a) => !tecnico || String(a.tecnico).toUpperCase() === tecnico.toUpperCase()), [finanzas.adelantos, tecnico]);
  // Los descuentos y bonos por órdenes corregidas del técnico elegido (o de todos): entran en su próximo pago.
  const ajustesVisibles = useMemo(() => finanzas.ajustes.filter((a) => !tecnico || String(a.tecnico).toUpperCase() === tecnico.toUpperCase()), [finanzas.ajustes, tecnico]);
  // Los descuentos con motivo del técnico elegido (o de todos): se restan de su próximo pago.
  const descuentosVisibles = useMemo(() => finanzas.descuentos.filter((d) => !tecnico || String(d.tecnico).toUpperCase() === tecnico.toUpperCase()), [finanzas.descuentos, tecnico]);
  // Los pagos adicionales del técnico elegido (o de todos): se suman a su próximo pago.
  const adicionalesVisibles = useMemo(() => finanzas.adicionales.filter((a) => !tecnico || String(a.tecnico).toUpperCase() === tecnico.toUpperCase()), [finanzas.adicionales, tecnico]);
  const filasPagos = useMemo(() => resumenPagos(items, finanzas.tarifas, finanzas.idsPagadas, adelantosVisibles, ajustesVisibles, descuentosVisibles, hoy, adicionalesVisibles), [items, finanzas.tarifas, finanzas.idsPagadas, adelantosVisibles, ajustesVisibles, descuentosVisibles, hoy, adicionalesVisibles]);
  // Lo ya pagado en el periodo (los pagos hechos en esos días), por técnico y en total (respeta el técnico elegido arriba).
  const pagado = useMemo(() => resumenPagado(finanzas.pagos, rango, { tecnico, tasa }), [finanzas.pagos, rango, tecnico, tasa]);
  // Lo ya pagado en el periodo por técnico. Con "Por pagar" no se leen las órdenes pagadas: sale de los pagos hechos en los últimos 35 días.
  const pagadasPorTecnico = useMemo(
    () => {
      if (soloPendientes) return Object.fromEntries(pagado.porTecnico.map((f) => [f.tecnico, { ordenes: f.ordenes, total: f.total, bs: f.bs }]));
      const tasaDe = (pagoId) => finanzas.pagos.find((p) => p.id === pagoId)?.tasa || tasa;
      return totalesPagados(finanzas.pagadas.filter((p) => !tecnico || String(p.tecnico).toUpperCase() === tecnico.toUpperCase()), tasaDe);
    },
    [soloPendientes, pagado, finanzas.pagadas, finanzas.pagos, tecnico, tasa],
  );
  const yaPagadas = useMemo(
    () => ordenesYaPagadas(finanzas.pagadas.filter((p) => !tecnico || String(p.tecnico).toUpperCase() === tecnico.toUpperCase()), items),
    [finanzas.pagadas, items, tecnico],
  );

  const actual = SECCIONES.find((s) => s.id === seccion);

  // El cliente de cada orden pagada, si se conoce (las órdenes leídas y las filas del periodo): los Pagos detallados lo ponen junto al código.
  const clientePorClave = useMemo(() => {
    const mapa = new Map();
    for (const o of ordenes) if (o.nombre) mapa.set(claveOrden(o), o.nombre);
    for (const i of items) if (i.orden?.nombre && !mapa.has(i.clave)) mapa.set(i.clave, i.orden.nombre);
    return mapa;
  }, [ordenes, items]);

  // `clave`: qué reporte baja el menú cuando la sección tiene más de uno (ver GRUPOS_REPORTE); sin clave, el de la sección.
  const exportar = async (formato, clave) => {
    setErrorExportar('');
    setExportando(formato);
    try {
      // Los Pagos detallados llevan, pago por pago, las órdenes que entraron y lo que se sumó o descontó: se leen las órdenes de los pagos del periodo que todavía no están leídas (solo al exportar).
      const detallado = seccion === 'REPORTE' && clave === 'detallado';
      let detalle = [];
      if (detallado) {
        const vigentes = pagosDelPeriodo(finanzas.pagos, rango).filter((p) => !p.anulado && (!tecnico || String(p.tecnico).toUpperCase() === tecnico.toUpperCase()));
        const ordenesDeLosPagos = await finanzas.leerOrdenesDePagos(vigentes, finanzas.pagadas);
        detalle = detalleDePagos({ pagos: vigentes, ordenesPagadas: ordenesDeLosPagos, nombreDe: (id) => clientePorClave.get(id) || '', adelantos: finanzas.adelantos, ajustes: finanzas.ajustes, descuentos: finanzas.descuentos, adicionales: finanzas.adicionales, tasa });
      }
      const contexto = { rango, tecnico, ahora: Date.now(), generadoPor: currentUser, pagosClientes: pagosClientes.pagos, cobrosClientes: cobrosClientes.cobros, pagosFinanzas: { filas: filasPagos, pagos: finanzas.pagos, pagadasPorTecnico, tasa, adelantos: adelantosVisibles, descuentos: descuentosVisibles, detalle } };
      const documento = (detallado ? documentoPagosDetallados : actual.documento)(contexto);
      if (formato === 'csv') descargarCsv(csvDeDocumento(documento), `${detallado ? nombreDeArchivo(documento, rango) : `${actual.archivo}_${rango.desde}_${rango.hasta}`}.csv`);
      else await exportarDocumento(documento, formato, rango);
    } catch (e) {
      console.error('No se pudo generar el archivo:', e);
      setErrorExportar('No se pudo generar el archivo. Intenta de nuevo.');
    } finally {
      setExportando(null);
    }
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-dvh bg-fondo text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />
        <EncabezadoSimple onAbrirMenu={onAbrirMenu} contexto={cargado ? (error ? 'No se pudo actualizar.' : `Última actualización: ${horaLegible(actualizadoEn)}`) : ''} titulo="Finanzas" icono={Banknote} nombre={currentUserName || currentUser} rol={role} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} />

        {cargado && seccion !== 'PRECIOS' && (
          <AccionesEncabezado
            encabezado={(
              <>
                <button
                  type="button"
                  onClick={actualizar}
                  disabled={actualizando}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className={`w-4 h-4 ${actualizando ? 'animate-spin' : ''}`} aria-hidden="true" /> {actualizando ? 'Actualizando...' : 'Actualizar'}
                </button>
                <MenuExportar formatos={['pdf', 'docx', 'csv']} grupos={seccion === 'REPORTE' ? GRUPOS_REPORTE : undefined} onElegir={exportar} ocupado={exportando} extra="h-9! px-3! text-xs! bg-zinc-800! border-zinc-700! text-white! hover:bg-zinc-700!" />
              </>
            )}
          />
        )}

        <main className="p-4 sm:p-6 w-full flex-1 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Secciones de Finanzas" className="flex gap-2 w-full md:w-auto">
              {SECCIONES.map(({ id, nombre, corto }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={seccion === id}
                  onClick={() => elegirSeccion(id)}
                  className={`flex-1 md:flex-none min-w-0 h-9 px-1 sm:px-4 rounded-xl text-sm max-sm:text-[13px] font-semibold border transition-colors ${seccion === id ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                >
                  <span className="sm:hidden">{corto}</span><span className="hidden sm:inline">{nombre}</span>
                </button>
              ))}
            </div>
            <TamanoLetra nivel={nivelLetra} onNivel={setNivelLetra} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <TasaBcv tasa={tasa} fecha={bcv.fecha} cargando={bcv.cargando} error={bcv.error} onActualizar={() => { bcv.actualizar(); tasas.actualizar(); }} opciones={tasas.opciones} dia={tasaElegida?.dia ?? null} onElegir={(dia) => setDiaTasa(dia === tasas.opciones[0]?.dia ? null : dia)} />
            {cargado && (
              <span role="status" className="sm:ml-auto lg:hidden text-xs text-zinc-600 dark:text-zinc-300">{error ? 'No se pudo actualizar.' : `Última actualización: ${horaLegible(actualizadoEn)}`}</span>
            )}
          </div>

          {error && !actualizadoEn ? (
            <p role="alert" className="text-base text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar los datos. Revisa tu conexión e intenta de nuevo.</p>
          ) : !cargado ? (
            <p role="status" className="text-base text-zinc-600 dark:text-zinc-300 text-center py-10">Cargando...</p>
          ) : (
            <>
              {seccion !== 'PRECIOS' && (
                <BarraFinanzas
                  periodo={periodo}
                  onPeriodo={setPeriodo}
                  conPorPagar={seccion === 'PAGOS'}
                  personalizado={personalizado}
                  onPersonalizado={setPersonalizado}
                  hoy={hoy}
                  tecnico={tecnico}
                  onTecnico={setTecnico}
                  tecnicos={nombresTecnicos}
                  cargando={actualizando}
                  onRecargar={() => { actualizar(); if (seccion === 'CLIENTES') { pagosClientes.recargar(); cobrosClientes.recargar(); } }}
                  formatosExportar={['pdf', 'docx', 'csv']}
                  gruposExportar={seccion === 'REPORTE' ? GRUPOS_REPORTE : undefined}
                  onExportar={exportar}
                  exportando={exportando}
                />
              )}
              {errorExportar && <p role="alert" className="text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl px-4 py-3">{errorExportar}</p>}
              {finanzas.error && <p role="alert" className="text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl px-4 py-3">No se pudieron leer los datos de Finanzas (tarifas o pagos). Recarga la página.</p>}

              {seccion === 'PAGOS' && corteTodaviaNoLlega() && (
                <p role="status" className="text-sm text-zinc-700 dark:text-zinc-200 bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-700 rounded-xl px-4 py-3">
                  Comienza a contar a partir del {textoFechaCorte()}: lo anterior de este periodo no se muestra.
                </p>
              )}
              <div key={seccion} className="lg:animate-fade-in space-y-4">
              {seccion === 'PAGOS' && (
                <TecnicosFinanzas
                  filas={filasPagos}
                  items={items}
                  sinTipo={sinTipo}
                  esperandoRevision={esperandoRevision}
                  onTipoMudanza={finanzas.guardarTipoMudanza}
                  tarifas={finanzas.tarifas}
                  pagos={finanzas.pagos}
                  adelantos={adelantosVisibles}
                  descuentos={descuentosVisibles}
                  adicionales={adicionalesVisibles}
                  itemsAdicionales={finanzas.itemsPagoAdicional}
                  ajustes={ajustesVisibles}
                  ajustesTodos={finanzas.ajustes}
                  garantiasPendientes={garantiasPendientes}
                  pagadasPorTecnico={pagadasPorTecnico}
                  rango={rango}
                  etiquetaPeriodo={soloPendientes ? 'Por pagar' : undefined}
                  tasa={tasa}
                  etiquetaTasa={etiquetaTasa}
                  ocupado={finanzas.ocupado}
                  historial={historial}
                  onPagar={(fila, opciones) => finanzas.pagar(fila, rangoDeuda, { ...opciones, tasa })}
                  onAnular={finanzas.anular}
                  tecnicosTodos={nombresTecnicos}
                  onAdelanto={finanzas.registrarAdelanto}
                  onAnularAdelanto={finanzas.anularAdelanto}
                  onDescuento={finanzas.registrarDescuento}
                  onAnularDescuento={finanzas.anularDescuento}
                  onAdicional={finanzas.registrarAdicional}
                  onAnularAdicional={finanzas.anularAdicional}
                />
              )}
              {seccion === 'CLIENTES' && <PagosClientes cobros={cobrosClientes} pagos={pagosClientes} rango={rango} tecnico={tecnico} />}
              {seccion === 'PRECIOS' && (
                <div className="space-y-10">
                  <TabuladorPrecios tasa={tasa} tarifas={finanzas.tarifas} tarifasCargadas={finanzas.tarifasCargadas} ocupado={finanzas.ocupado} onGuardar={finanzas.guardarTarifas} />
                  <TabuladorAdicionales tasa={tasa} items={finanzas.itemsPagoAdicional} cargado={finanzas.catalogoCargado} ocupado={finanzas.ocupado} onGuardar={finanzas.guardarItemsAdicionales} />
                </div>
              )}
              {seccion === 'REPORTE' && <ResumenPagado resumen={pagado} rango={rango} ordenesPagadas={yaPagadas} tarifas={finanzas.tarifas} tasa={tasa} />}
              </div>
            </>
          )}
        </main>
        <PieVersion />
      </div>
    </div>
  );
}
