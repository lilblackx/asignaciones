import { useMemo, useState } from 'react';
import NombreTecnico from '../NombreTecnico';
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardList, FileText, History, Search } from 'lucide-react';
import DetalleOrdenModal from './DetalleOrdenModal';
import { TIPOS_TRABAJO } from '../../constants';
import { motivoCancelacion } from '../../utils/cancelacion';
import { fechaDeOrden } from '../../utils/fechaOrden';
import { pagoClienteDe, textoDelPago } from '../../utils/pagoEnOrden';
import { formatCedula, getEstadoPastel, getTipoTrabajoEstilo } from '../../utils/ticketDisplay';
import { exportOrdersToCsv, exportResumenTecnicosToCsv } from '../../utils/exportReport';
import AvisoCargarAnteriores from '../AvisoCargarAnteriores';
import Modal, { CENTRADO_AMPLIO, PANEL_COMPLETO, PANEL_PAGINA } from '../Modal';
import EncabezadoModulo from '../EncabezadoModulo';
import CampoFecha from '../CampoFecha';
import SelectMenu from '../SelectMenu';
import PlantillaFinalModal from './PlantillaFinalModal';
import Colapsable from '../Colapsable';
import BotonExportar from '../BotonExportar';
import BotonLimpiarBusqueda from '../BotonLimpiarBusqueda';
import BotonFiltros from '../BotonFiltros';
import Chip from '../Chip';
import { BUSCADOR, CAMPO_FECHA, SELECTOR } from '../estilos';
import { fallaVisible } from '../../utils/fallaVisible';
import { oracion } from '../../utils/oracion';

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


// `verCobro` (la oficina que edita órdenes): el "Ver detalle completo" de cada orden incluye su cobro y sus fotos; `verRevision` (solo ADMIN) también si se aprobó sin los detalles.
// `puedeVerPlantilla` (solo ADMIN y usuarios con permiso de cierre, los que llegan a este historial) muestra en cada orden con
// plantilla (de cualquier trabajo y estado) el botón "Ver plantilla"; `plantillaDe(orden)` arma el texto (vacío si no hay) y
// `onCopy(texto, mensaje)` copia y avisa con el toast.
export default function OrdersHistoryModal({ tickets, reports, hasMoreReports, isLoadingReports, onLoadMoreReports, getTecnicoColor, puedeVerPlantilla = false, verCobro = false, verRevision = false, plantillaDe: armarPlantilla, onCopy, onClose, enPagina = false, clasePagina = PANEL_PAGINA }) {
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(0);
  const [expandedKey, setExpandedKey] = useState(null);
  const [plantillaAbierta, setPlantillaAbierta] = useState(null);
  const [detalleAbierto, setDetalleAbierto] = useState(null);
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
  const estadoItems = [{ value: '', label: 'Estado: todos' }, ...ESTADOS.map(s => ({ value: s, label: oracion(s) }))];
  const tipoItems = [{ value: '', label: 'Trabajo: todos' }, ...TIPOS_TRABAJO.map(s => ({ value: s, label: oracion(s) }))];
  const tecnicoItems = [{ value: '', label: 'Técnico: todos' }, ...tecnicos.map(s => ({ value: s, label: oracion(s) }))];

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
      <div className={enPagina ? clasePagina : `bg-card rounded-card shadow-2xl w-full max-w-4xl max-h-[90dvh] overflow-hidden border border-border flex flex-col ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={History} titulo="Historial de órdenes" onClose={onClose} enPagina={enPagina} />

        <div className={`px-6 py-4 shrink-0 bg-fondo border-b border-border space-y-3 ${CENTRADO_AMPLIO}`}>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" aria-hidden="true" />
              <label htmlFor="history-search" className="sr-only">Buscar en el historial</label>
              <input id="history-search" type="search" value={search} onChange={withReset(setSearch)} placeholder="Código, nombre o cédula..." title="Busca por código, nombre, cédula, dirección, teléfono o técnico" className={BUSCADOR} />
              <BotonLimpiarBusqueda valor={search} onLimpiar={() => { setSearch(''); setPage(0); setExpandedKey(null); }} />
            </div>
            <BotonFiltros abierto={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} cuenta={activeFiltersCount} />
          </div>

          {/* Atajos por estado, siempre a la vista (antes solo estaban dentro del panel de Filtros). */}
          <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
            <Chip activo={estado === ''} tamano="compacto" type="button" onClick={() => withResetValue(setEstado)('')}>Todas <span className="font-medium">({allOrders.length})</span></Chip>
            {ESTADOS.map((s) => {
              const n = allOrders.filter((o) => o.estado === s).length;
              return n > 0 ? (
                <Chip key={s} activo={estado === s} tamano="compacto" type="button" onClick={() => withResetValue(setEstado)(estado === s ? '' : s)}>{s} <span className="font-medium">({n})</span></Chip>
              ) : null;
            })}
          </div>

          <Colapsable>{filtersOpen && (
            <div className="rounded-card border border-transparent bg-card p-3 space-y-3 shadow-card">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 [&>*]:min-w-0">
                <SelectMenu ariaLabel="Estado" value={estado} onChange={withResetValue(setEstado)} items={estadoItems} className={SELECTOR} />
                <SelectMenu ariaLabel="Tipo de trabajo" value={tipo} onChange={withResetValue(setTipo)} items={tipoItems} className={SELECTOR} />
                <SelectMenu ariaLabel="Técnico" value={tecnico} onChange={withResetValue(setTecnico)} items={tecnicoItems} className={SELECTOR} />
                <CampoFecha ariaLabel="Desde" vacio="Desde" valor={desde} max={hasta || undefined} onChange={(v) => withReset(setDesde)({ target: { value: v } })} permitirBorrar flotante clase={CAMPO_FECHA} />
                <CampoFecha ariaLabel="Hasta" vacio="Hasta" valor={hasta} min={desde || undefined} onChange={(v) => withReset(setHasta)({ target: { value: v } })} permitirBorrar flotante derecha clase={CAMPO_FECHA} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-etiqueta text-muted-foreground">
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

          <div className="flex items-center justify-between gap-2 text-etiqueta text-muted-foreground">
            <span>
              {filtered.length} {filtered.length === 1 ? 'orden' : 'órdenes'}
            </span>
            {hasFilters && <button type="button" onClick={clearFilters} className="font-bold underline hover:text-zinc-800 dark:hover:text-zinc-200">Limpiar filtros</button>}
          </div>
        </div>

        <div className={`p-4 sm:p-6 overflow-y-auto flex-1 bg-fondo space-y-3 ${CENTRADO_AMPLIO}`}>
          {/* El encabezado de las columnas (solo PC), alineado con las filas. */}
          {shown.length > 0 && (
            <div className="hidden lg:flex gap-3 px-4 text-etiqueta font-bold text-muted-foreground">
              <div className="flex-1 grid grid-cols-[17rem_minmax(0,1fr)] gap-6"><span>Orden</span><span>Cliente y trabajo</span></div>
              <span className="w-56 text-right pr-6">Técnico</span>
            </div>
          )}
          {shown.map(o => {
            const isOpen = expandedKey === o._key;
            return (
              <div key={o._key} className="bg-card rounded-card border border-transparent shadow-sm shadow-card">
                <button type="button" onClick={() => setExpandedKey(isOpen ? null : o._key)} aria-expanded={isOpen} className="w-full text-left p-4 flex items-start lg:items-center justify-between gap-3">
                  {/* En PC la fila va en columnas (código y estado | cliente y trabajo | técnico) para que se lea de corrido y no quede un hueco en el medio. */}
                  <div className="min-w-0 flex-1 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-center lg:gap-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-foreground text-sm">{o.codigo || 'S/C'}</span>
                      <span className={`px-2.5 py-0.5 text-etiqueta font-black rounded-full leading-tight ${getEstadoPastel(o.estado)}`}>{oracion(o.estado)}</span>
                      <span className="text-etiqueta font-bold text-muted-foreground">{o.fecha}</span>
                    </div>
                    <div className="min-w-0 mt-1 lg:mt-0">
                      <h5 className="font-bold text-zinc-950 dark:text-white text-sm leading-tight truncate">{o.nombre}</h5>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className={`text-etiqueta font-black px-1.5 py-0.5 rounded ${getTipoTrabajoEstilo(o.tipoTrabajo || 'AVERÍA').badge}`}>{oracion(o.tipoTrabajo || 'AVERÍA')}</span>
                        {fallaVisible(o) && <span className="font-medium text-card-foreground">{fallaVisible(o)}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 shrink-0 lg:w-56">
                    <div className="flex flex-col items-end gap-1 min-w-0">
                      {o.tecnico
                        ? <NombreTecnico nombre={o.tecnico} getTecnicoColor={getTecnicoColor} />
                        : <span className="text-etiqueta text-muted-foreground italic">Sin técnico</span>}
                      {o._origen !== 'Activa' && <span className="text-etiqueta font-bold text-muted-foreground">{o._origen}</span>}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </div>
                </button>

                <Colapsable>
                  {isOpen && (
                    <div className="border-t border-border px-4 py-3 text-xs space-y-1.5 text-card-foreground">
                      <p><span className="font-bold">Cédula:</span> {formatCedula(o.cedula, o.tipoDocumento) || '-'}</p>
                      {o.telefono && <p><span className="font-bold">Teléfono:</span> {o.telefono}</p>}
                      <p><span className="font-bold">Dirección:</span> {o.direccion || '-'}</p>
                      {o.nap && <p><span className="font-bold">NAP:</span> {o.nap}</p>}
                      {o.fechaProgramada && <p><span className="font-bold">Programada:</span> {o.fechaProgramada}</p>}
                      <p><span className="font-bold">Observación:</span> {o.observacion || '-'}</p>
                      {o.observacionTecnico && <p><span className="font-bold">Obs. del técnico:</span> {o.observacionTecnico}</p>}
                      {pagoClienteDe(o) && <p><span className="font-bold">Pago del cliente:</span> {textoDelPago(o)}</p>}
                      {o.creado && <p><span className="font-bold">Creada por:</span> {o.creado}</p>}
                      <div className="pt-1.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setDetalleAbierto(o)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-campo border-2 border-input bg-white dark:bg-zinc-950 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-red-600 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" /> Ver detalle completo
                        </button>
                      {puedeVerPlantilla && armarPlantilla?.(o) && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPlantillaAbierta(o)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-campo border-2 border-input bg-white dark:bg-zinc-950 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-red-600 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Ver plantilla
                          </button>
                        </>
                      )}
                      </div>
                      {motivoCancelacion(o) && <p><span className="font-bold">Motivo de la cancelación:</span> {motivoCancelacion(o)}{o.canceladaPor ? ` (${o.canceladaPor})` : ''}</p>}
                    </div>
                  )}
                </Colapsable>
              </div>
            );
          })}

          {/* Los cierres más antiguos se leen solo a pedido (cada tanda son lecturas de Firestore): el botón sale al final de la lista, o en lugar de ella si lo buscado no aparece. */}
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground pt-10 pb-6 text-sm">
              <p>No se encontraron órdenes.</p>
              <AvisoCargarAnteriores variante="vacio" hayMas={hasMoreReports} cargando={isLoadingReports} onCargar={onLoadMoreReports} />
            </div>
          )}
          {filtered.length > 0 && currentPage >= totalPages - 1 && (
            <AvisoCargarAnteriores variante="lista" hayMas={hasMoreReports} cargando={isLoadingReports} onCargar={onLoadMoreReports} />
          )}
        </div>

        {totalPages > 1 && (
          <div className={`px-4 sm:px-6 py-2.5 lg:py-1.5 shrink-0 border-t border-border bg-fondo flex items-center justify-between gap-3 text-xs max-lg:text-sm font-bold text-card-foreground ${CENTRADO_AMPLIO}`}>
            <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Página anterior" className="flex items-center justify-center gap-1 h-11 min-w-11 px-3 lg:h-8 rounded-campo bg-secondary hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4 lg:w-3.5 lg:h-3.5" aria-hidden="true" /> <span className="max-sm:hidden">Anterior</span>
            </button>
            <span className="text-center whitespace-nowrap">Página {currentPage + 1} de {totalPages}</span>
            <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages - 1} aria-label="Página siguiente" className="flex items-center justify-center gap-1 h-11 min-w-11 px-3 lg:h-8 rounded-campo bg-secondary hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <span className="max-sm:hidden">Siguiente</span> <ChevronRight className="w-4 h-4 lg:w-3.5 lg:h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </Modal>
    {detalleAbierto && <DetalleOrdenModal ticket={detalleAbierto} verCobro={verCobro} verRevision={verRevision} onCopy={onCopy} onClose={() => setDetalleAbierto(null)} zIndexClass="z-[70]" />}
    {plantillaAbierta && <PlantillaFinalModal orden={plantillaAbierta} texto={armarPlantilla(plantillaAbierta)} titulo="Plantilla" onCopy={onCopy} onClose={() => setPlantillaAbierta(null)} zIndexClass="z-[70]" />}
    </>
  );
}
