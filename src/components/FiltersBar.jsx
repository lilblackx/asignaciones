import { useState } from 'react';
import { ArrowDownAZ, Filter, Search, SlidersHorizontal, Wrench, X } from 'lucide-react';
import { TIPOS_TRABAJO } from '../constants';
import SelectMenu from './SelectMenu';

export default function FiltersBar({
  searchTerm, setSearchTerm,
  statusFilter, setStatusFilter,
  tipoFilter, setTipoFilter,
  sortBy, setSortBy,
  technicians,
  isTecnico = false
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const limpiarFiltros = () => {
    setStatusFilter('TODOS');
    setTipoFilter('TODOS');
    setSortBy('DEFECTO');
  };
  const activeFiltersCount = (statusFilter !== 'TODOS' ? 1 : 0) + (tipoFilter !== 'TODOS' ? 1 : 0) + (sortBy !== 'DEFECTO' ? 1 : 0);

  const statusItems = [
    { value: 'TODOS', label: 'Activas' },
    { value: 'PRE-FINALIZADO', label: 'Pre-finalizados' },
    ...(!isTecnico ? [{ value: 'PENDIENTE_SIN_TECNICO', label: 'Sin técnico' }] : []),
    { value: 'INSTALACION_SIN_UBICACION', label: 'Instalaciones sin ubicación' },
    { group: 'Programadas', options: [
      { value: 'PROG_HOY', label: 'Hoy / vencidas' },
      { value: 'PROG_MANANA', label: 'Mañana' },
      { value: 'PROG_FUTURAS', label: 'Futuras' }
    ] },
    { value: 'FINALIZADO', label: 'Finalizados' },
    { value: 'CANCELADO', label: 'Cancelados' },
    { value: 'ELIMINADOS', label: 'Eliminados' }
  ];
  const tipoItems = [
    { value: 'TODOS', label: 'Todos los trabajos' },
    ...TIPOS_TRABAJO.map(tipo => ({ value: tipo.toUpperCase(), label: tipo }))
  ];
  const sortItems = [
    { value: 'DEFECTO', label: 'Más recientes' },
    { value: 'TECNICO', label: 'Técnico (A-Z)' },
    { value: 'TIPO_TRABAJO', label: 'Tipo de Trabajo (A-Z)' },
    { value: 'PROGRAMADA', label: 'Fecha programada (próximas primero)' },
    { group: 'Filtrar por Técnico', options: technicians.map(t => ({ value: 'TEC:' + t.name, label: 'Solo: ' + t.name })) }
  ];

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
        <div className="sm:w-48">
          <SelectMenu id="status-filter" ariaLabel="Filtrar por estado" icon={Filter} value={statusFilter} onChange={setStatusFilter} items={statusItems} />
        </div>
        <div className="sm:w-48">
          <SelectMenu id="tipo-filter" ariaLabel="Filtrar por tipo de trabajo" icon={Wrench} value={tipoFilter} onChange={setTipoFilter} items={tipoItems} />
        </div>
        {/* Para TECNICO, sus órdenes ya están aisladas a él mismo: ordenar u
            filtrar "por técnico" no tiene sentido (siempre sería él). */}
        {!isTecnico && (
          <div className="sm:w-56">
            <SelectMenu id="sort-by" ariaLabel="Ordenar por" icon={ArrowDownAZ} value={sortBy} onChange={setSortBy} items={sortItems} />
          </div>
        )}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="shrink-0 self-center flex items-center justify-center gap-1 px-1 py-1.5 font-bold text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
