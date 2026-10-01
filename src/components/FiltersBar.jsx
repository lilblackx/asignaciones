import { useState } from 'react';
import { ArrowDownAZ, ChevronDown, Filter, Search, SlidersHorizontal } from 'lucide-react';

export default function FiltersBar({
  searchTerm, setSearchTerm,
  statusFilter, setStatusFilter,
  sortBy, setSortBy,
  technicians,
  isTecnico = false
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFiltersCount = (statusFilter !== 'TODOS' ? 1 : 0) + (sortBy !== 'DEFECTO' ? 1 : 0);

  return (
    <div className="mb-3 flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" aria-hidden="true" />
        <label htmlFor="ticket-search" className="sr-only">Buscar órdenes</label>
        <input id="ticket-search" type="text" placeholder="Buscar por nombre, código o cédula..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-red-600 outline-none shadow-sm transition-colors" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <button
        type="button"
        onClick={() => setFiltersOpen(!filtersOpen)}
        aria-expanded={filtersOpen}
        className="sm:hidden relative shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-sm font-bold text-sm text-zinc-700 dark:text-zinc-300"
      >
        <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> Filtros
        {activeFiltersCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFiltersCount}</span>
        )}
      </button>

      <div className={`${filtersOpen ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row gap-3`}>
        <div className="flex items-center gap-2 sm:w-48">
          <Filter className="text-zinc-500 dark:text-zinc-400 w-4 h-4 shrink-0" aria-hidden="true" />
          <label htmlFor="status-filter" className="sr-only">Filtrar por estado</label>
          <div className="relative w-full">
            <select id="status-filter" className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl py-2.5 pl-3 pr-8 focus:ring-2 focus:ring-red-600 outline-none font-medium text-sm shadow-sm transition-colors" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="TODOS">Activas</option>
              <option value="PRE-FINALIZADO">Pre-finalizados</option>
              {!isTecnico && <option value="PENDIENTE_SIN_TECNICO">Sin técnico</option>}
              <option value="INSTALACION_SIN_UBICACION">Instalaciones sin ubicación</option>
              <optgroup label="Programadas">
                <option value="PROG_HOY">Programadas: hoy / vencidas</option>
                <option value="PROG_MANANA">Programadas: mañana</option>
                <option value="PROG_FUTURAS">Programadas: futuras</option>
              </optgroup>
              <option value="FINALIZADO">Finalizados</option>
              <option value="CANCELADO">Cancelados</option>
              <option value="ELIMINADOS">Eliminados</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          </div>
        </div>
        {/* Para TECNICO, sus órdenes ya están aisladas a él mismo: ordenar u
            filtrar "por técnico" no tiene sentido (siempre sería él). */}
        {!isTecnico && (
          <div className="flex items-center gap-2 sm:w-56">
            <ArrowDownAZ className="text-zinc-500 dark:text-zinc-400 w-4 h-4 shrink-0" aria-hidden="true" />
            <label htmlFor="sort-by" className="sr-only">Ordenar por</label>
            <div className="relative w-full">
              <select id="sort-by" className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl py-2.5 pl-3 pr-8 focus:ring-2 focus:ring-red-600 outline-none font-medium text-sm shadow-sm transition-colors" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="DEFECTO">Más recientes</option>
                <option value="TECNICO">Técnico (A-Z)</option>
                <option value="TIPO_TRABAJO">Tipo de Trabajo (A-Z)</option>
                <option value="PROGRAMADA">Fecha programada (próximas primero)</option>
                <optgroup label="Filtrar por Técnico">
                  {technicians.map(t => (
                    <option key={t.id} value={"TEC:" + t.name}>Solo: {t.name}</option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
