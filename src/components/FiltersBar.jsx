import { useState } from 'react';
import { ArrowDownAZ, Filter, Search, Wrench, X } from 'lucide-react';
import { TIPOS_TRABAJO } from '../constants';
import SelectMenu from './SelectMenu';
import BotonLimpiarBusqueda from './BotonLimpiarBusqueda';
import Colapsable from './Colapsable';
import BotonFiltros from './BotonFiltros';
import { BUSCADOR } from './estilos';
import { oracion } from '../utils/oracion';

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
    { value: 'TODOS', label: 'Todos' },
    ...TIPOS_TRABAJO.map(tipo => ({ value: tipo.toUpperCase(), label: oracion(tipo) }))
  ];
  const sortItems = [
    { value: 'DEFECTO', label: 'Más recientes' },
    { value: 'TECNICO', label: 'Técnico (A-Z)' },
    { value: 'TIPO_TRABAJO', label: 'Tipo de Trabajo (A-Z)' },
    { value: 'PROGRAMADA', label: 'Fecha programada (próximas primero)' },
    { group: 'Filtrar por Técnico', options: technicians.map(t => ({ value: 'TEC:' + t.name, label: 'Solo: ' + t.name })) }
  ];

  const ETIQUETA = 'text-[11px] max-lg:text-xs font-bold text-muted-foreground';

  return (
    <div className="mb-3 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" aria-hidden="true" />
          <label htmlFor="ticket-search" className="sr-only">Buscar órdenes</label>
          <input
            id="ticket-search"
            type="search"
            placeholder="Nombre, código o cédula..."
            className={BUSCADOR}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <BotonLimpiarBusqueda valor={searchTerm} onLimpiar={() => setSearchTerm('')} />
        </div>
        <BotonFiltros abierto={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} cuenta={activeFiltersCount} />
      </div>

      <Colapsable>{filtersOpen && (
        <div className="rounded-card shadow-card border border-transparent bg-card p-3 space-y-2.5">
          {/* El título del panel y, a la derecha, "Limpiar filtros" (solo con algún filtro puesto): siempre en el mismo sitio, sin gastar una fila debajo. */}
          <div className="flex items-center justify-between gap-2 min-h-8">
            <h3 className="text-sm font-black text-foreground">Filtros</h3>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="relative inline-flex items-center gap-1 px-1 font-bold text-xs text-red-700 dark:text-red-400 hover:underline max-lg:after:absolute max-lg:after:-inset-x-1 max-lg:after:-inset-y-3"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" /> Limpiar filtros ({activeFiltersCount})
              </button>
            )}
          </div>
          {/* PC: los tres desplegables se reparten el ancho. Celular: el estado (las opciones más largas) arriba y, debajo, el trabajo y el orden lado a lado. */}
          <div className={`grid gap-2.5 ${isTecnico ? 'grid-cols-2' : 'grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:grid-cols-3'}`}>
            <div className={`flex flex-col gap-1 min-w-0 ${isTecnico ? '' : 'max-md:col-span-2'}`}>
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
        </div>
      )}</Colapsable>
    </div>
  );
}
