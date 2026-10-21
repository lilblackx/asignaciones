import { useState } from 'react';
import { ArrowDownAZ, Filter, Search, SlidersHorizontal, Wrench, X } from 'lucide-react';
import { TIPOS_TRABAJO } from '../constants';
import SelectMenu from './SelectMenu';
import BotonLimpiarBusqueda from './BotonLimpiarBusqueda';
import Colapsable from './Colapsable';

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
    ...(!isTecnico ? [
      { value: 'PENDIENTE_SIN_TECNICO', label: 'Sin técnico' },
      { value: 'EN_CAMINO', label: 'En camino' },
      { value: 'EN_SITIO', label: 'En sitio' },
      { value: 'EN_INFRAESTRUCTURA', label: 'En infraestructura' }
    ] : []),
    { value: 'INSTALACION_SIN_UBICACION', label: 'Instalaciones sin ubicación' },
    { group: 'Programadas', options: [
      { value: 'PROG_HOY', label: 'Hoy / vencidas' },
      { value: 'PROG_MANANA', label: 'Mañana' },
      { value: 'PROG_FUTURAS', label: 'Futuras' }
    ] },
    { value: 'FINALIZADO', label: 'Finalizados' },
    { value: 'CANCELADO', label: 'Cancelados' }
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

  const ETIQUETA = 'text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400';

  return (
    <div className="mb-3 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" aria-hidden="true" />
          <label htmlFor="ticket-search" className="sr-only">Buscar órdenes</label>
          <input
            id="ticket-search"
            type="search"
            placeholder="Buscar por nombre, código o cédula..."
            className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-400 dark:border-zinc-700 pl-9 pr-10 py-2.5 rounded-xl text-sm focus:ring-0 focus:border-red-600 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <BotonLimpiarBusqueda valor={searchTerm} onLimpiar={() => setSearchTerm('')} />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          aria-expanded={filtersOpen}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl border-2 text-xs font-bold transition-colors bg-white dark:bg-zinc-900 ${filtersOpen ? 'border-red-600 text-red-600 dark:text-red-400' : 'border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400'}`}
        >
          <SlidersHorizontal className={`w-4 h-4 transition-transform duration-200 ${filtersOpen ? 'lg:rotate-90' : ''}`} aria-hidden="true" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFiltersCount > 0 && <span className="rounded-full bg-red-600 text-white text-[10px] leading-none px-1.5 py-1">{activeFiltersCount}</span>}
        </button>
      </div>

      <Colapsable>{filtersOpen && (
        <div className="rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-3">
          <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${isTecnico ? 'md:max-w-xl' : 'md:grid-cols-3 md:max-w-3xl'}`}>
            <div className="flex flex-col gap-1 min-w-0">
              <span className={ETIQUETA}>Estado</span>
              <SelectMenu id="status-filter" ariaLabel="Filtrar por estado" icon={Filter} value={statusFilter} onChange={setStatusFilter} items={statusItems} />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <span className={ETIQUETA}>Trabajo</span>
              <SelectMenu id="tipo-filter" ariaLabel="Filtrar por tipo de trabajo" icon={Wrench} value={tipoFilter} onChange={setTipoFilter} items={tipoItems} />
            </div>
            {/* Para TECNICO, sus órdenes ya están aisladas a él mismo: ordenar u
                filtrar "por técnico" no tiene sentido (siempre sería él). */}
            {!isTecnico && (
              <div className="flex flex-col gap-1 min-w-0">
                <span className={ETIQUETA}>Ordenar</span>
                <SelectMenu id="sort-by" ariaLabel="Ordenar por" icon={ArrowDownAZ} value={sortBy} onChange={setSortBy} items={sortItems} />
              </div>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1 font-bold text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" /> Limpiar filtros
            </button>
          )}
        </div>
      )}</Colapsable>
    </div>
  );
}
