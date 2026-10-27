import { useMemo, useState } from 'react';
import { ClipboardList, ClipboardPen, Gauge, Hourglass, Receipt, LayoutDashboard, LineChart, ShieldCheck, Timer, TrendingUp, UserCheck, Wrench } from 'lucide-react';
import AnalyticsView from './reports/AnalyticsView';
import ActivacionTecnicosView from './reports/ActivacionTecnicosView';
import TiempoAtencionView from './reports/TiempoAtencionView';
import EsperasCicloView from './reports/EsperasCicloView';
import CobrosView from './reports/CobrosView';
import RegistroEstadisticasView from './reports/RegistroEstadisticasView';
import ProductividadView from './reports/ProductividadView';
import CalidadView from './reports/CalidadView';
import ResumenEjecutivoView from './reports/ResumenEjecutivoView';
import CausasAveriaView from './reports/CausasAveriaView';
import TendenciaMensualView from './reports/TendenciaMensualView';
import FiltrosReporte from './reports/FiltrosReporte';
import Modal, { CENTRADO_AMPLIO, PANEL_COMPLETO, PANEL_PAGINA } from '../Modal';
import SelectMenu from '../SelectMenu';
import EncabezadoModulo from '../EncabezadoModulo';
import { csvActivacionTecnicos } from '../../utils/logTecnico';
import { VENTANAS_MESES, csvTendencia, mesesDeLaTendencia, tendenciaMensual } from '../../utils/tendenciaMensual';
import { csvDeDocumento, csvReporte, lineasPeriodo } from '../../utils/csvReporte';
import { META_HORAS, calidad, pendientesMasAntiguas, productividad, seccionesCalidad, seccionesProductividad, seccionesTiempoAtencion, tiempoDeAtencion, todasLasOrdenes } from '../../utils/gestionTecnicos';
import { descargarCsv } from '../../utils/exportarOrdenes';
import { exportarDocumento } from '../../utils/exportarDocumento';
import { documentoActivacion, documentoCalidad, documentoCausasAveria, documentoCobros, documentoEsperasCiclo, documentoEstadisticas, documentoProductividad, documentoRegistroEstadisticas, documentoResumenEjecutivo, documentoTendencia, documentoTiempoAtencion } from '../../utils/modelosReporte';
import { diaDe } from '../../utils/totalesMes';
import { useRegistroVnTa } from '../../hooks/useRegistroVnTa';
import { rangoDe } from '../../utils/periodoReporte';

// Los reportes, agrupados por tema. Para sumar uno: agrega aquí su entrada y su vista más abajo.
//   documento(contexto): el contenido del PDF y del Word (ver modelosReporte.js). contexto = { eventos, ordenes, rango, tecnico, metaHoras, contadores, tickets, ventana, ahora, generadoPor }.
//   exportar(contexto): si el reporte también se puede bajar a CSV, devuelve { texto, nombre }.
//   usaLog / usaTotales: el reporte lee el registro de activación / los totales mensuales (muestra el botón de actualizar).
//   sinFiltros: el reporte es del negocio completo y no usa el periodo ni el técnico de arriba.
const GRUPOS = [
  {
    titulo: 'Operación',
    reportes: [
      {
        id: 'RESUMEN', nombre: 'Resumen ejecutivo', Icono: LayoutDashboard, usaLog: true, usaTotales: true, documento: documentoResumenEjecutivo,
        exportar: (contexto) => ({ texto: csvDeDocumento(documentoResumenEjecutivo(contexto)), nombre: `resumen-ejecutivo_${contexto.rango.desde}_${contexto.rango.hasta}.csv` }),
      },
      {
        id: 'ESTADISTICAS', nombre: 'Estadísticas', Icono: LineChart, documento: documentoEstadisticas,
        exportar: (contexto) => ({ texto: csvDeDocumento(documentoEstadisticas(contexto)), nombre: `estadisticas_${contexto.rango.desde}_${contexto.rango.hasta}.csv` }),
      },
      {
        id: 'REGISTRO', nombre: 'Registro de estadísticas', Icono: ClipboardPen, documento: documentoRegistroEstadisticas,
        exportar: (contexto) => ({ texto: csvDeDocumento(documentoRegistroEstadisticas(contexto)), nombre: `registro-de-estadisticas_${contexto.rango.desde}_${contexto.rango.hasta}.csv` }),
      },
      {
        id: 'CAUSAS', nombre: 'Causas de avería', Icono: Wrench, documento: documentoCausasAveria,
        exportar: (contexto) => ({ texto: csvDeDocumento(documentoCausasAveria(contexto)), nombre: `causas-de-averia_${contexto.rango.desde}_${contexto.rango.hasta}.csv` }),
      },
      {
        id: 'COBROS', nombre: 'Cobros y exoneraciones', Icono: Receipt, documento: documentoCobros,
        exportar: (contexto) => ({ texto: csvDeDocumento(documentoCobros(contexto)), nombre: `cobros_${contexto.rango.desde}_${contexto.rango.hasta}.csv` }),
      },
      {
        id: 'TENDENCIA', nombre: 'Tendencia mensual', Icono: TrendingUp, usaTotales: true, sinFiltros: true, documento: documentoTendencia,
        exportar: ({ contadores, tickets, ventana, ahora }) => ({
          texto: csvTendencia(tendenciaMensual(contadores, tickets, mesesDeLaTendencia(contadores, ahora, ventana), ahora)),
          nombre: 'tendencia-mensual.csv',
        }),
      },
    ],
  },
  {
    titulo: 'Gestión de técnicos',
    reportes: [
      {
        id: 'TIEMPO', nombre: 'Tiempo de atención', Icono: Timer, documento: documentoTiempoAtencion,
        exportar: ({ ordenes, rango, tecnico, metaHoras, ahora }) => ({
          texto: csvReporte(['Tiempo de atención', ...lineasPeriodo(rango, tecnico)], seccionesTiempoAtencion(tiempoDeAtencion(ordenes, rango, { tecnico, metaMs: metaHoras * 3600000 }), pendientesMasAntiguas(ordenes, ahora, { tecnico }), metaHoras)),
          nombre: `tiempo-de-atencion_${rango.desde}_${rango.hasta}.csv`,
        }),
      },
      {
        id: 'ESPERAS', nombre: 'Esperas del ciclo', Icono: Hourglass, documento: documentoEsperasCiclo,
        exportar: (contexto) => ({ texto: csvDeDocumento(documentoEsperasCiclo(contexto)), nombre: `esperas-del-ciclo_${contexto.rango.desde}_${contexto.rango.hasta}.csv` }),
      },
      {
        id: 'PRODUCTIVIDAD', nombre: 'Productividad', Icono: Gauge, usaLog: true, documento: documentoProductividad,
        exportar: ({ ordenes, eventos, rango, tecnico, ahora }) => ({
          texto: csvReporte(['Productividad por técnico', ...lineasPeriodo(rango, tecnico)], seccionesProductividad(productividad(ordenes, eventos, rango, ahora, { tecnico }))),
          nombre: `productividad_${rango.desde}_${rango.hasta}.csv`,
        }),
      },
      {
        id: 'CALIDAD', nombre: 'Calidad y reincidencias', Icono: ShieldCheck, documento: documentoCalidad,
        exportar: ({ ordenes, rango, tecnico }) => ({
          texto: csvReporte(['Calidad y reincidencias', ...lineasPeriodo(rango, tecnico)], seccionesCalidad(calidad(ordenes, rango, { tecnico }))),
          nombre: `calidad_${rango.desde}_${rango.hasta}.csv`,
        }),
      },
      {
        id: 'ACTIVACION', nombre: 'Activación de técnicos', Icono: UserCheck, usaLog: true, documento: documentoActivacion,
        exportar: ({ eventos, rango, tecnico }) => ({
          texto: csvActivacionTecnicos(eventos, { ...rango, tecnico: tecnico || undefined }),
          nombre: `activacion-tecnicos_${rango.desde}_${rango.hasta}.csv`,
        }),
      },
    ],
  },
];
const REPORTES = GRUPOS.flatMap((g) => g.reportes);

export default function ReportesModal({
  tickets,
  reports,
  technicians,
  hasMoreReports,
  isLoadingReports,
  onLoadMoreReports,
  getTecnicoColor,
  logTecnicos,
  totalesMensuales,
  usuario,
  nombreUsuario,
  esAdmin = false,
  firebaseUser,
  onClose, enPagina = false }) {
  const [reporteId, setReporteId] = useState(REPORTES[0].id);
  // El periodo y el técnico valen para todos los reportes: al cambiar de reporte se conservan.
  const [periodo, setPeriodo] = useState('7_DIAS');
  const [hoy] = useState(() => diaDe(Date.now()));
  const [personalizado, setPersonalizado] = useState(() => ({ desde: rangoDe('7_DIAS').desde, hasta: hoy }));
  const [tecnico, setTecnico] = useState('');
  const [metaHoras, setMetaHoras] = useState(META_HORAS[1]);
  const [ventanaMeses, setVentanaMeses] = useState(VENTANAS_MESES[1]);

  const reporte = REPORTES.find((r) => r.id === reporteId);
  const rango = useMemo(() => rangoDe(periodo, personalizado), [periodo, personalizado]);
  const nombresTecnicos = useMemo(() => technicians.map((t) => t.name).filter(Boolean).sort(), [technicians]);

  // El registro de VN y TA se llena a mano: solo se escucha mientras se ve el Registro de estadísticas.
  // Con un detalle abierto encima (en el Registro de estadísticas), Escape y "atrás" cierran solo el detalle.
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const vnta = useRegistroVnTa({ firebaseUser, activo: reporteId === 'REGISTRO', rango, usuario, nombre: nombreUsuario });

  // Las órdenes de los reportes de gestión: las vivas y las ya archivadas en los cierres cargados.
  const ordenes = useMemo(() => todasLasOrdenes(tickets, reports), [tickets, reports]);
  const historial = { hasMoreReports, isLoadingReports, onLoadMoreReports };

  // Lo que se baja: PDF y Word en todos los reportes; CSV solo en los que tienen datos tabulares.
  const [exportando, setExportando] = useState(null);
  const [errorExportar, setErrorExportar] = useState('');
  const formatosExportar = ['pdf', 'docx', ...(reporte.exportar ? ['csv'] : [])];
  const exportar = async (formato) => {
    setErrorExportar('');
    setExportando(formato);
    try {
      const contexto = { registrosVnTa: vnta.registros, eventos: logTecnicos.eventos, ordenes, rango, tecnico, metaHoras, contadores: totalesMensuales.contadores, tickets, ventana: ventanaMeses, ahora: Date.now(), generadoPor: usuario };
      if (formato === 'csv') {
        const { texto, nombre } = reporte.exportar(contexto);
        descargarCsv(texto, nombre);
      } else {
        await exportarDocumento(reporte.documento(contexto), formato, reporte.sinFiltros ? null : rango);
      }
    } catch (error) {
      console.error('No se pudo generar el archivo:', error);
      setErrorExportar('No se pudo generar el archivo. Intenta de nuevo.');
    } finally {
      setExportando(null);
    }
  };

  return (
    <Modal enPagina={enPagina} onClose={detalleAbierto ? () => {} : onClose} zIndexClass="z-[60]" completa>
      <div className={enPagina ? PANEL_PAGINA : `bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-zinc-300 dark:border-zinc-800 flex flex-col ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={ClipboardList} titulo="Reportes" onClose={onClose} enPagina={enPagina} />

        <div className={`flex flex-col ${enPagina ? '' : 'lg:flex-row'} flex-1 min-h-0`}>
          {/* Ventana en pantallas angostas: un selector con los reportes. */}
          <div className={`${enPagina ? 'hidden' : 'lg:hidden'} shrink-0 px-4 sm:px-6 py-3 bg-fondo border-b border-zinc-200 dark:border-zinc-800`}>
            <label htmlFor="reporte-elegido" className="sr-only">Reporte</label>
            <select
              id="reporte-elegido"
              value={reporteId}
              onChange={(e) => setReporteId(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-red-600"
            >
              {GRUPOS.map((g) => (
                <optgroup key={g.titulo} label={g.titulo}>
                  {g.reportes.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Como página dentro del marco el menú lateral de la app ya ocupa la izquierda: el reporte se elige en un dropdown arriba (no un segundo menú lateral). */}
          {enPagina && (
            <div className="shrink-0 px-4 sm:px-6 lg:px-[max(1.5rem,calc((100%-80rem)/2))] pt-3">
              <label htmlFor="reporte-pagina" className="block text-[11px] max-lg:text-xs font-black text-zinc-600 dark:text-zinc-400 mb-1 ml-1">Reporte</label>
              <div className="w-full sm:w-80">
                <SelectMenu
                  id="reporte-pagina"
                  ariaLabel="Reporte"
                  icon={REPORTES.find((r) => r.id === reporteId)?.Icono}
                  value={reporteId}
                  onChange={setReporteId}
                  items={GRUPOS.map((g) => ({ group: g.titulo, options: g.reportes.map((r) => ({ value: r.id, label: r.nombre })) }))}
                />
              </div>
            </div>
          )}

          {/* PC: la lista de reportes a la izquierda. */}
          {!enPagina && (
          <nav aria-label="Reportes" className="hidden lg:flex flex-col gap-5 w-64 shrink-0 overflow-y-auto p-4 bg-zinc-200 dark:bg-zinc-900 border-r border-zinc-300 dark:border-zinc-800">
            {GRUPOS.map((g) => (
              <div key={g.titulo}>
                <div className="px-2 mb-1.5 text-[11px] max-lg:text-xs font-black text-zinc-600 dark:text-zinc-400">{g.titulo}</div>
                <ul className="flex flex-col gap-1">
                  {g.reportes.map(({ id, nombre, Icono }) => (
                    <li key={id}>
                      <button
                        onClick={() => setReporteId(id)}
                        aria-current={reporteId === id ? 'page' : undefined}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm font-bold transition-colors ${reporteId === id ? 'bg-red-600 text-white shadow' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                      >
                        <Icono className="w-4 h-4 shrink-0" aria-hidden="true" /> {nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          )}

          <main className={`flex-1 min-w-0 overflow-y-auto bg-fondo px-4 sm:px-6 pb-6 ${enPagina ? '' : 'lg:pt-1'} ${CENTRADO_AMPLIO}`}>
            <FiltrosReporte
              soloAcciones={reporte.sinFiltros}
              periodo={periodo}
              onPeriodo={setPeriodo}
              personalizado={personalizado}
              onPersonalizado={setPersonalizado}
              hoy={hoy}
              tecnico={tecnico}
              onTecnico={setTecnico}
              tecnicos={nombresTecnicos}
              cargando={Boolean((reporte.usaLog && logTecnicos.cargando) || (reporte.usaTotales && totalesMensuales.cargando))}
              onRecargar={reporte.usaLog || reporte.usaTotales ? () => { if (reporte.usaLog) logTecnicos.recargar(); if (reporte.usaTotales) totalesMensuales.recargar(); } : undefined}
              formatosExportar={formatosExportar}
              onExportar={exportar}
              exportando={exportando}
            />
            {errorExportar && <p role="alert" className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4">{errorExportar}</p>}
            <div key={reporteId} className="lg:animate-fade-in">
              {reporteId === 'RESUMEN' && <ResumenEjecutivoView ordenes={ordenes} eventos={logTecnicos.eventos} contadores={totalesMensuales.contadores} tickets={tickets} rango={rango} tecnico={tecnico} getTecnicoColor={getTecnicoColor} historial={historial} />}
              {reporteId === 'REGISTRO' && <RegistroEstadisticasView ordenes={ordenes} rango={rango} tecnico={tecnico} historial={historial} onDetalleAbierto={setDetalleAbierto} vnta={{ ...vnta, tecnicos: nombresTecnicos, hoy, puedeBorrar: (r) => esAdmin || r.creadoPor === usuario }} />}
              {reporteId === 'CAUSAS' && <CausasAveriaView ordenes={ordenes} rango={rango} tecnico={tecnico} historial={historial} />}
              {reporteId === 'TENDENCIA' && <TendenciaMensualView contadores={totalesMensuales.contadores} cargando={totalesMensuales.cargando} error={totalesMensuales.error} tickets={tickets} ventana={ventanaMeses} onVentana={setVentanaMeses} />}
              {reporteId === 'COBROS' && <CobrosView ordenes={ordenes} rango={rango} tecnico={tecnico} getTecnicoColor={getTecnicoColor} historial={historial} />}
              {reporteId === 'ESPERAS' &&<EsperasCicloView ordenes={ordenes} rango={rango} tecnico={tecnico} getTecnicoColor={getTecnicoColor} historial={historial} />}
              {reporteId === 'TIEMPO' &&<TiempoAtencionView ordenes={ordenes} rango={rango} tecnico={tecnico} metaHoras={metaHoras} onMeta={setMetaHoras} getTecnicoColor={getTecnicoColor} historial={historial} />}
              {reporteId === 'PRODUCTIVIDAD' && <ProductividadView ordenes={ordenes} eventos={logTecnicos.eventos} rango={rango} tecnico={tecnico} getTecnicoColor={getTecnicoColor} historial={historial} />}
              {reporteId === 'CALIDAD' && <CalidadView ordenes={ordenes} rango={rango} tecnico={tecnico} getTecnicoColor={getTecnicoColor} historial={historial} />}
              {reporteId === 'ESTADISTICAS' && (
                <AnalyticsView
                  ordenes={ordenes}
                  rango={rango}
                  tecnico={tecnico}
                  getTecnicoColor={getTecnicoColor}
                  hasMoreReports={hasMoreReports}
                  isLoadingReports={isLoadingReports}
                  onLoadMoreReports={onLoadMoreReports}
                />
              )}
              {reporteId === 'ACTIVACION' && (
                <ActivacionTecnicosView
                  eventos={logTecnicos.eventos}
                  cargando={logTecnicos.cargando}
                  error={logTecnicos.error}
                  truncado={logTecnicos.truncado}
                  rango={rango}
                  tecnico={tecnico}
                  getTecnicoColor={getTecnicoColor}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </Modal>
  );
}
