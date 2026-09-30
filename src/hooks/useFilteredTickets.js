import { useMemo, useState } from 'react';
import { instalacionSinUbicacion } from '../utils/ubicacion';

const PAGE_SIZE = 50;

function parseFecha(fechaStr) {
  const [day, month, year] = String(fechaStr || '').split('/');
  return new Date(year, (month || 1) - 1, day).getTime() || 0;
}

export function useFilteredTickets(tickets) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [sortBy, setSortBy] = useState('DEFECTO');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredTickets = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    let result = tickets.filter(t => {
      const matchesSearch = String(t.nombre || '').toLowerCase().includes(searchLower) ||
                            String(t.codigo || '').toLowerCase().includes(searchLower) ||
                            String(t.cedula || '').toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === 'TODOS' ? (t.estado === 'PENDIENTE' || t.estado === 'PRE-FINALIZADO' || t.estado === 'PRE-FINALIZADA')
        : statusFilter === 'PRE-FINALIZADO' ? (t.estado === 'PRE-FINALIZADO' || t.estado === 'PRE-FINALIZADA')
        : statusFilter === 'ELIMINADOS' ? t.estado === 'ELIMINADO'
        : statusFilter === 'INSTALACION_SIN_UBICACION' ? instalacionSinUbicacion(t)
        : statusFilter === 'PENDIENTE_SIN_TECNICO' ? t.estado === 'PENDIENTE' && (!t.tecnico || t.tecnico.trim() === '')
        : t.estado?.toUpperCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (sortBy.startsWith('TEC:')) {
      const selectedTech = sortBy.substring(4);
      result = result.filter(t => t.tecnico === selectedTech);
    }

    if (sortBy === 'TECNICO') {
      result.sort((a, b) => {
        const techA = (a.tecnico || 'ZZZ').toUpperCase();
        const techB = (b.tecnico || 'ZZZ').toUpperCase();
        return techA.localeCompare(techB);
      });
    } else if (sortBy === 'TIPO_TRABAJO') {
      result.sort((a, b) => {
        const tipoA = (a.tipoTrabajo || '').toUpperCase();
        const tipoB = (b.tipoTrabajo || '').toUpperCase();
        return tipoA.localeCompare(tipoB);
      });
    } else if (sortBy === 'FECHA') {
      result.sort((a, b) => parseFecha(b.fecha) - parseFecha(a.fecha));
    }

    return result;
  }, [tickets, searchTerm, statusFilter, sortBy]);

  const visibleTickets = filteredTickets.slice(0, visibleCount);
  const hasMore = filteredTickets.length > visibleCount;
  const loadMore = () => setVisibleCount(c => c + PAGE_SIZE);

  const setSearchTermAndReset = (v) => { setVisibleCount(PAGE_SIZE); setSearchTerm(v); };
  const setStatusFilterAndReset = (v) => { setVisibleCount(PAGE_SIZE); setStatusFilter(v); };
  const setSortByAndReset = (v) => { setVisibleCount(PAGE_SIZE); setSortBy(v); };

  return {
    searchTerm, setSearchTerm: setSearchTermAndReset,
    statusFilter, setStatusFilter: setStatusFilterAndReset,
    sortBy, setSortBy: setSortByAndReset,
    filteredTickets,
    visibleTickets,
    hasMore,
    loadMore
  };
}
