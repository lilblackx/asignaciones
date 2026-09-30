import { useMemo, useState } from 'react';

export function useArchivedSearch(reports) {
  const [reportSearchTerm, setReportSearchTerm] = useState('');

  const archivedSearchResults = useMemo(() => {
    if (!reportSearchTerm.trim()) return [];
    const searchLower = reportSearchTerm.toLowerCase();
    let results = [];
    reports.forEach(rep => {
      (rep.ticketsDetalle || []).forEach(ticket => {
        if (
          String(ticket.nombre || '').toLowerCase().includes(searchLower) ||
          String(ticket.codigo || '').toLowerCase().includes(searchLower) ||
          String(ticket.cedula || '').toLowerCase().includes(searchLower)
        ) {
          results.push({
            ...ticket,
            _reportFecha: rep.fechaCierre,
            _reportTipo: rep.tipoReporte || 'CIERRE'
          });
        }
      });
    });
    return results;
  }, [reports, reportSearchTerm]);

  return { reportSearchTerm, setReportSearchTerm, archivedSearchResults };
}
