import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Download, History, Search, X } from 'lucide-react';
import { TIPOS_TRABAJO } from '../../constants';
import { formatCedula, getEstadoColor } from '../../utils/ticketDisplay';
import { exportOrdersToCsv, exportResumenTecnicosToCsv } from '../../utils/exportReport';
import Modal from '../Modal';
import SelectMenu from '../SelectMenu';

const PAGE_SIZE = 25;
const ESTADOS = ['PENDIENTE', 'PRE-FINALIZADO', 'FINALIZADO', 'CANCELADO', 'ELIMINADO'];

// "dd/mm/yyyy" (formato de ticket.fecha) -> timestamp; 0 si no se puede leer.
function parseFecha(fecha) {
  const [d, m, y] = String(fecha || '').split('/').map(Number);
  if (!d || !m || !y) return 0;
  return new Date(y, m - 1, d).getTime();
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const selectClass = 'w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 pl-2 pr-7 py-2 rounded-lg text-xs text-zinc-900 dark:text-white outline-none focus:border-red-500';
const inputClass = 'w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-2 py-2 rounded-lg text-xs text-zinc-900 dark:text-white outline-none focus:border-red-500 [color-scheme:light] dark:[color-scheme:dark]';

export default function OrdersHistoryModal({ tickets, reports, hasMoreReports, isLoadingReports, onLoadMoreReports, getTecnicoColor, onClose }) {
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(0);
  const [expandedKey, setExpandedKey] = useState(null);

  const allOrders = useMemo(() => {
    const seen = new Set();
    const list = [];
    tickets.forEach(t => {
      seen.add(t.id);
      list.push({ ...t, _key: `act-${t.id}`, _origen: 'Activa', _ts: t.createdAt || parseFecha(t.fecha) });
    });
    reports.forEach(rep => {
      (rep.ticketsDetalle || []).forEach(t => {
        if (seen.has(t.id)) return;
        seen.add(t.id);
        list.push({
          ...t,
          _key: `${rep.id}-${t.id}`,
          _origen: `${rep.tipoReporte === 'CANCELADOS' ? 'Cancelados' : 'Cierre'} ${rep.fechaCierre}`,
          _ts: t.createdAt || parseFecha(t.fecha)
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
      if (from !== null && o._ts < from) return false;
      if (to !== null && o._ts > to) return false;
      if (term) {
        const haystack = norm([o.codigo, o.nombre, o.cedula, o.direccion, o.tecnico, o.telefono, o.falla].join(' '));
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [allOrders, search, estado, tipo, tecnico, desde, hasta]);

  const hasFilters = search || estado || tipo || tecnico || desde || hasta;
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
    <Modal onClose={onClose} zIndexClass="z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-zinc-300 dark:border-zinc-800 flex flex-col">
        <div className="bg-black px-6 py-4 border-b-2 border-red-600 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-black text-white flex items-center gap-2"><History className="w-5 h-5 text-red-500" /> HISTORIAL DE ÓRDENES</h2>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 shrink-0 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" aria-hidden="true" />
            <label htmlFor="history-search" className="sr-only">Buscar en el historial</label>
            <input id="history-search" type="text" value={search} onChange={withReset(setSearch)} placeholder="Buscar por código, nombre, cédula, dirección, teléfono o técnico..." className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-red-500 outline-none text-sm" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <SelectMenu ariaLabel="Estado" value={estado} onChange={withResetValue(setEstado)} items={estadoItems} className={selectClass} chevronClassName="w-3 h-3 right-2" />
            <SelectMenu ariaLabel="Tipo de trabajo" value={tipo} onChange={withResetValue(setTipo)} items={tipoItems} className={selectClass} chevronClassName="w-3 h-3 right-2" />
            <SelectMenu ariaLabel="Técnico" value={tecnico} onChange={withResetValue(setTecnico)} items={tecnicoItems} className={selectClass} chevronClassName="w-3 h-3 right-2" />
            <input type="date" aria-label="Desde" title="Desde" value={desde} onChange={withReset(setDesde)} className={inputClass} />
            <input type="date" aria-label="Hasta" title="Hasta" value={hasta} onChange={withReset(setHasta)} className={inputClass} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>
              {filtered.length} {filtered.length === 1 ? 'orden' : 'órdenes'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {hasFilters && <button type="button" onClick={clearFilters} className="font-bold underline hover:text-zinc-800 dark:hover:text-zinc-200">Limpiar filtros</button>}
              <button
                type="button"
                onClick={() => exportOrdersToCsv(filtered, describirFiltros())}
                disabled={filtered.length === 0}
                title="Descarga las órdenes que ves con los filtros aplicados"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" /> Exportar CSV
              </button>
              <button
                type="button"
                onClick={() => exportResumenTecnicosToCsv(filtered, describirFiltros())}
                disabled={filtered.length === 0}
                title="Un renglón por técnico: órdenes, finalizadas, canceladas y potencia promedio"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" /> Resumen por técnico
              </button>
            </div>
          </div>
          {hasMoreReports && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              Búsqueda sobre el historial ya cargado. Hay cierres más antiguos sin cargar —{' '}
              <button type="button" onClick={onLoadMoreReports} disabled={isLoadingReports} className="font-bold underline disabled:opacity-50">
                {isLoadingReports ? 'cargando...' : 'cargar más'}
              </button>
            </p>
          )}
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-zinc-50 dark:bg-zinc-950 space-y-3">
          {shown.map(o => {
            const isOpen = expandedKey === o._key;
            return (
              <div key={o._key} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-sm">
                <button type="button" onClick={() => setExpandedKey(isOpen ? null : o._key)} aria-expanded={isOpen} className="w-full text-left p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-red-600 dark:text-red-400 text-sm">{o.codigo || 'S/C'}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded leading-none ${getEstadoColor(o.estado)}`}>{o.estado}</span>
                      <span className="text-[10px] font-bold text-zinc-500">{o.fecha}</span>
                    </div>
                    <h5 className="font-bold text-zinc-950 dark:text-white text-sm leading-tight mt-1 truncate">{o.nombre}</h5>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      <span className="font-bold text-red-600 dark:text-red-400">{o.tipoTrabajo}</span>
                      {o.falla && o.falla !== o.tipoTrabajo ? ` - ${o.falla}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      {o.tecnico
                        ? <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${getTecnicoColor(o.tecnico)}`}>{o.tecnico}</span>
                        : <span className="text-[10px] text-zinc-400 italic">Sin técnico</span>}
                      <div className="text-[9px] text-zinc-400 mt-1">{o._origen}</div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 text-xs space-y-1.5 text-zinc-700 dark:text-zinc-300">
                    <p><span className="font-semibold">Cédula:</span> {formatCedula(o.cedula, o.tipoDocumento) || '-'}</p>
                    {o.telefono && <p><span className="font-semibold">Teléfono:</span> {o.telefono}</p>}
                    <p><span className="font-semibold">Dirección:</span> {o.direccion || '-'}</p>
                    {o.nap && <p><span className="font-semibold">NAP:</span> {o.nap}</p>}
                    {o.fechaProgramada && <p><span className="font-semibold">Programada:</span> {o.fechaProgramada}</p>}
                    <p><span className="font-semibold">Observación:</span> {o.observacion || '-'}</p>
                    {o.creado && <p><span className="font-semibold">Creada por:</span> {o.creado}</p>}
                    {o.estado === 'ELIMINADO' && <p><span className="font-semibold">Eliminada por:</span> {o.eliminadoPor} ({o.fechaEliminacion})</p>}
                    {(o.historialEdiciones || []).length > 0 && (
                      <div className="pt-1.5 mt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="font-semibold mb-1">Historial de cambios</p>
                        <ul className="space-y-1">
                          {o.historialEdiciones.map((h, i) => (
                            <li key={i} className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              <span className="font-bold">{h.fecha}</span> · {h.operador} · {h.detalle}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center text-zinc-500 py-10 text-sm">No se encontraron órdenes.</div>
          )}

        </div>

        {totalPages > 1 && (
          <div className="px-6 py-3 shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
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
  );
}
