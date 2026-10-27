import { useMemo, useState } from 'react';
import NombreTecnico from '../NombreTecnico';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, History, Search } from 'lucide-react';
import { TIPOS_TRABAJO } from '../../constants';
import { motivoCancelacion } from '../../utils/cancelacion';
import { fechaDeOrden } from '../../utils/fechaOrden';
import { formatCedula, getEstadoColor } from '../../utils/ticketDisplay';
import { exportOrdersToCsv, exportResumenTecnicosToCsv } from '../../utils/exportReport';
import Modal, { CENTRADO_AMPLIO, PANEL_COMPLETO, PANEL_PAGINA } from '../Modal';
import EncabezadoModulo from '../EncabezadoModulo';
import HistorialTimeline from '../HistorialTimeline';
import CampoFecha from '../CampoFecha';
import SelectMenu from '../SelectMenu';
import PlantillaFinalModal from './PlantillaFinalModal';
import Colapsable from '../Colapsable';
import BotonExportar from '../BotonExportar';
import BotonLimpiarBusqueda from '../BotonLimpiarBusqueda';
import BotonFiltros from '../BotonFiltros';
import { BUSCADOR, CAMPO_FECHA, SELECTOR } from '../estilos';

const PAGE_SIZE = 25;
const ESTADOS = ['PENDIENTE', 'PRE-FINALIZADO', 'FINALIZADO', 'CANCELADO'];

// "dd/mm/yyyy" (formato de ticket.fecha) -> timestamp; 0 si no se puede leer.
function parseFecha(fecha) {
  const [d, m, y] = String(fecha || '').split('/').map(Number);
  if (!d || !m || !y) return 0;
  return new Date(y, m - 1, d).getTime();
}

// La fecha con la que se filtra Desde/Hasta: la misma de todos los módulos (utils/fechaOrden): la de finalización o cancelación; una orden abierta,
// la de creación. Las archivadas sin esa fecha usan el día del cierre que las guardó.
const fechaDeFiltro = (t, cierreMs = 0, archivadoMs = 0) => fechaDeOrden(t, { diaCierreMs: cierreMs, ...(archivadoMs ? { ahoraMs: archivadoMs } : {}) }) || parseFecha(t.fecha);

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');


// `puedeVerPlantilla` (solo ADMIN y usuarios con permiso de cierre, los que llegan a este historial) muestra en cada orden con
// plantilla (de cualquier trabajo y estado) el botón "Ver plantilla"; `plantillaDe(orden)` arma el texto (vacío si no hay) y
// `onCopy(texto, mensaje)` copia y avisa con el toast.
export default function OrdersHistoryModal({ tickets, reports, hasMoreReports, isLoadingReports, onLoadMoreReports, getTecnicoColor, puedeVerPlantilla = false, plantillaDe: armarPlantilla, onCopy, onClose, enPagina = false }) {
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(0);
  const [expandedKey, setExpandedKey] = useState(null);
  const [plantillaAbierta, setPlantillaAbierta] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const allOrders = useMemo(() => {
    const seen = new Set();
    const list = [];
    tickets.forEach(t => {
      seen.add(t.id);
      list.push({ ...t, _key: `act-${t.id}`, _origen: 'Activa', _ts: t.createdAt || parseFecha(t.fecha), _tsFiltro: fechaDeFiltro(t) });
    });
    reports.forEach(rep => {
      (rep.ticketsDetalle || []).forEach(t => {
        if (seen.has(t.id)) return;
        seen.add(t.id);
        list.push({
          ...t,
          _key: `${rep.id}-${t.id}`,
          _origen: `${rep.tipoReporte === 'CANCELADOS' || (rep.canceladas !== undefined && t.estado === 'CANCELADO') ? 'Cancelados' : 'Cierre'} ${rep.fechaCierre}`,
          _ts: t.createdAt || parseFecha(t.fecha),
          _tsFiltro: fechaDeFiltro(t, parseFecha(rep.fechaCierre) + 12 * 3600000, rep.createdAt)
        });
      });
    });
    list.sort((a, b) => b._ts - a._ts);
    return list;
  }, [tickets, reports]);

  const tecnicos = useMemo(
    () => [...new Set(allOrders.map(o => o.tecnico).filter(Boolean))].sort(),
    [allOrders]
  );

  const filtered = useMemo(() => {
    const term = norm(search.trim());
    const from = desde ? new Date(`${desde}T00:00:00`).getTime() : null;
    const to = hasta ? new Date(`${hasta}T23:59:59.999`).getTime() : null;
    return allOrders.filter(o => {
      if (estado && o.estado !== estado) return false;
      if (tipo && o.tipoTrabajo !== tipo) return false;
      if (tecnico && o.tecnico !== tecnico) return false;
      if (from !== null && o._tsFiltro < from) return false;
      if (to !== null && o._tsFiltro > to) return false;
      if (term) {
        const haystack = norm([o.codigo, o.nombre, o.cedula, o.direccion, o.tecnico, o.telefono, o.falla].join(' '));
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [allOrders, search, estado, tipo, tecnico, desde, hasta]);

  const hasFilters = search || estado || tipo || tecnico || desde || hasta;
  const activeFiltersCount = [estado, tipo, tecnico, desde, hasta].filter(Boolean).length;
  const describirFiltros = () => [
    search && `búsqueda "${search.trim()}"`,
    estado && `estado ${estado}`,
    tipo && `trabajo ${tipo}`,
    tecnico && `técnico ${tecnico}`,
    desde && `desde ${desde}`,
    hasta && `hasta ${hasta}`,
  ].filter(Boolean).join(', ');
  const clearFilters = () => {
    setSearch(''); setEstado(''); setTipo(''); setTecnico(''); setDesde(''); setHasta('');
    setPage(0);
  };
  // Cada cambio de filtro vuelve a la primera página.
  const withReset = (setter) => (e) => { setter(e.target.value); setPage(0); setExpandedKey(null); };
  const withResetValue = (setter) => (v) => { setter(v); setPage(0); setExpandedKey(null); };
  const estadoItems = [{ value: '', label: 'Estado: todos' }, ...ESTADOS.map(s => ({ value: s, label: s }))];
  const tipoItems = [{ value: '', label: 'Trabajo: todos' }, ...TIPOS_TRABAJO.map(s => ({ value: s, label: s }))];
  const tecnicoItems = [{ value: '', label: 'Técnico: todos' }, ...tecnicos.map(s => ({ value: s, label: s }))];

  // Se renderiza solo una página a la vez: el DOM nunca pasa de PAGE_SIZE filas,
  // sin importar cuánto historial haya cargado.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const shown = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const goToPage = (p) => { setPage(p); setExpandedKey(null); };

  return (
    <>
    {/* Con la plantilla abierta, Escape cierra solo la plantilla y no el historial. */}
    <Modal enPagina={enPagina} onClose={plantillaAbierta ? () => {} : onClose} zIndexClass="z-[60]" completa>
      <div className={enPagina ? PANEL_PAGINA : `bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-zinc-300 dark:border-zinc-800 flex flex-col ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={History} titulo="Historial de órdenes" onClose={onClose} enPagina={enPagina} />

        <div className={`px-6 py-4 shrink-0 bg-fondo border-b border-zinc-200 dark:border-zinc-800 space-y-3 ${CENTRADO_AMPLIO}`}>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" aria-hidden="true" />
              <label htmlFor="history-search" className="sr-only">Buscar en el historial</label>
              <input id="history-search" type="search" value={search} onChange={withReset(setSearch)} placeholder="Buscar por código, nombre, cédula, dirección, teléfono o técnico..." className={BUSCADOR} />
              <BotonLimpiarBusqueda valor={search} onLimpiar={() => { setSearch(''); setPage(0); setExpandedKey(null); }} />
            </div>
            <BotonFiltros abierto={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} cuenta={activeFiltersCount} />
          </div>

          <Colapsable>{filtersOpen && (
            <div className="rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 [&>*]:min-w-0">
                <SelectMenu ariaLabel="Estado" value={estado} onChange={withResetValue(setEstado)} items={estadoItems} className={SELECTOR} />
                <SelectMenu ariaLabel="Tipo de trabajo" value={tipo} onChange={withResetValue(setTipo)} items={tipoItems} className={SELECTOR} />
                <SelectMenu ariaLabel="Técnico" value={tecnico} onChange={withResetValue(setTecnico)} items={tecnicoItems} className={SELECTOR} />
                <CampoFecha ariaLabel="Desde" vacio="Desde" valor={desde} max={hasta || undefined} onChange={(v) => withReset(setDesde)({ target: { value: v } })} permitirBorrar flotante clase={CAMPO_FECHA} />
                <CampoFecha ariaLabel="Hasta" vacio="Hasta" valor={hasta} min={desde || undefined} onChange={(v) => withReset(setHasta)({ target: { value: v } })} permitirBorrar flotante derecha clase={CAMPO_FECHA} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400">
                <BotonExportar
                  onClick={() => exportOrdersToCsv(filtered, describirFiltros())}
                  disabled={filtered.length === 0}
                  title="Descarga las órdenes que ves con los filtros aplicados"
                  etiqueta="Exportar CSV"
                />
                <BotonExportar
                  onClick={() => exportResumenTecnicosToCsv(filtered, describirFiltros())}
                  disabled={filtered.length === 0}
                  title="Un renglón por técnico: órdenes, finalizadas, canceladas y potencia promedio"
                  etiqueta="Resumen por técnico"
                />
              </div>
            </div>
          )}</Colapsable>

          <div className="flex items-center justify-between gap-2 text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400">
            <span>
              {filtered.length} {filtered.length === 1 ? 'orden' : 'órdenes'}
            </span>
            {hasFilters && <button type="button" onClick={clearFilters} className="font-bold underline hover:text-zinc-800 dark:hover:text-zinc-200">Limpiar filtros</button>}
          </div>
          {hasMoreReports && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              Búsqueda sobre el historial ya cargado. Hay cierres más antiguos sin cargar -{' '}
              <button type="button" onClick={onLoadMoreReports} disabled={isLoadingReports} className="font-bold underline disabled:opacity-50">
                {isLoadingReports ? 'cargando...' : 'cargar más'}
              </button>
            </p>
          )}
        </div>

        <div className={`p-4 sm:p-6 overflow-y-auto flex-1 bg-fondo space-y-3 ${CENTRADO_AMPLIO}`}>
          {shown.map(o => {
            const isOpen = expandedKey === o._key;
            return (
              <div key={o._key} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-sm">
                <button type="button" onClick={() => setExpandedKey(isOpen ? null : o._key)} aria-expanded={isOpen} className="w-full text-left p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-red-600 dark:text-red-400 text-sm">{o.codigo || 'S/C'}</span>
                      <span className={`px-2 py-0.5 text-[11px] max-lg:text-xs font-bold rounded leading-none ${getEstadoColor(o.estado)}`}>{o.estado}</span>
                      <span className="text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400">{o.fecha}</span>
                    </div>
                    <h5 className="font-bold text-zinc-950 dark:text-white text-sm leading-tight mt-1 truncate">{o.nombre}</h5>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      <span className="font-bold text-red-600 dark:text-red-400">{o.tipoTrabajo}</span>
                      {o.falla && o.falla !== o.tipoTrabajo ? ` - ${o.falla}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      {o.tecnico
                        ? <NombreTecnico nombre={o.tecnico} getTecnicoColor={getTecnicoColor} />
                        : <span className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 italic">Sin técnico</span>}
                      <div className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 mt-1">{o._origen}</div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </div>
                </button>

                <Colapsable>
                  {isOpen && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 text-xs space-y-1.5 text-zinc-700 dark:text-zinc-300">
                      <p><span className="font-semibold">Cédula:</span> {formatCedula(o.cedula, o.tipoDocumento) || '-'}</p>
                      {o.telefono && <p><span className="font-semibold">Teléfono:</span> {o.telefono}</p>}
                      <p><span className="font-semibold">Dirección:</span> {o.direccion || '-'}</p>
                      {o.nap && <p><span className="font-semibold">NAP:</span> {o.nap}</p>}
                      {o.fechaProgramada && <p><span className="font-semibold">Programada:</span> {o.fechaProgramada}</p>}
                      <p><span className="font-semibold">Observación:</span> {o.observacion || '-'}</p>
                      {o.observacionTecnico && <p><span className="font-semibold">Obs. del técnico:</span> {o.observacionTecnico}</p>}
                      {o.creado && <p><span className="font-semibold">Creada por:</span> {o.creado}</p>}
                      {puedeVerPlantilla && armarPlantilla?.(o) && (
                        <div className="pt-1.5">
                          <button
                            type="button"
                            onClick={() => setPlantillaAbierta(o)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-red-600 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Ver plantilla
                          </button>
                        </div>
                      )}
                      {motivoCancelacion(o) && <p><span className="font-semibold">Motivo de la cancelación:</span> {motivoCancelacion(o)}{o.canceladaPor ? ` (${o.canceladaPor})` : ''}</p>}
                      {(o.historialEdiciones || []).length > 0 && (
                        <div className="pt-1.5 mt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                          <p className="font-semibold mb-2">Historial de cambios</p>
                          <HistorialTimeline ticket={o} />
                        </div>
                      )}
                    </div>
                  )}
                </Colapsable>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center text-zinc-600 dark:text-zinc-400 py-10 text-sm">No se encontraron órdenes.</div>
          )}

        </div>

        {totalPages > 1 && (
          <div className="px-6 py-3 shrink-0 border-t border-zinc-300 dark:border-zinc-800 bg-fondo flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
            <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Anterior
            </button>
            <span>Página {currentPage + 1} de {totalPages}</span>
            <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages - 1} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Siguiente <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </Modal>
    {plantillaAbierta && <PlantillaFinalModal orden={plantillaAbierta} texto={armarPlantilla(plantillaAbierta)} titulo="PLANTILLA" onCopy={onCopy} onClose={() => setPlantillaAbierta(null)} zIndexClass="z-[70]" />}
    </>
  );
}
