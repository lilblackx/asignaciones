import { BarChart, Search, X } from 'lucide-react';
import ReportDetailsView from './reports/ReportDetailsView';
import ArchivedSearchResults from './reports/ArchivedSearchResults';
import ReportsHistoryView from './reports/ReportsHistoryView';
import Modal, { CENTRADO_AMPLIO, PANEL_COMPLETO } from '../Modal';
import EncabezadoModulo from '../EncabezadoModulo';

export default function ReportsModal({
  reports,
  hasMoreReports,
  isLoadingReports,
  onLoadMoreReports,
  selectedReportForDetails,
  setSelectedReportForDetails,
  reportSearchTerm,
  setReportSearchTerm,
  archivedSearchResults,
  getTecnicoColor,
  onRequestCierre,
  isAdmin,
  usuario,
  onClose
}) {
  const closeModal = () => {
    setSelectedReportForDetails(null);
    setReportSearchTerm('');
    onClose();
  };

  return (
    <Modal onClose={closeModal} onVolver={selectedReportForDetails ? () => setSelectedReportForDetails(null) : undefined} zIndexClass="z-[60]" completa>
      <div className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-zinc-300 dark:border-zinc-800 flex flex-col ${PANEL_COMPLETO}`}>
        {selectedReportForDetails ? (
          <ReportDetailsView
            report={selectedReportForDetails}
            getTecnicoColor={getTecnicoColor}
            onBack={() => setSelectedReportForDetails(null)}
            onClose={closeModal}
          />
        ) : (
          <>
            <EncabezadoModulo Icono={BarChart} titulo="CIERRE DIARIO" onClose={closeModal} />

            <div className={`p-6 overflow-y-auto flex-1 bg-zinc-50 dark:bg-zinc-950 ${CENTRADO_AMPLIO}`}>
                  <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" aria-hidden="true" />
                    <label htmlFor="report-search" className="sr-only">Buscar en el archivo</label>
                    <input id="report-search" type="text" placeholder="Buscar en el archivo por código, nombre o cédula..." className="w-full pl-11 pr-10 py-3 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-red-500 outline-none shadow-sm text-sm" value={reportSearchTerm} onChange={(e) => setReportSearchTerm(e.target.value)} />
                    {reportSearchTerm && (
                      <button onClick={() => setReportSearchTerm('')} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><X className="w-5 h-5" /></button>
                    )}
                  </div>

                  {reportSearchTerm.trim() !== '' ? (
                    <ArchivedSearchResults
                      archivedSearchResults={archivedSearchResults}
                      hasMoreReports={hasMoreReports}
                      isLoadingReports={isLoadingReports}
                      onLoadMoreReports={onLoadMoreReports}
                    />
                  ) : (
                    <ReportsHistoryView
                      reports={reports}
                      hasMoreReports={hasMoreReports}
                      isLoadingReports={isLoadingReports}
                      onLoadMoreReports={onLoadMoreReports}
                      onRequestCierre={onRequestCierre}
                      onViewReport={setSelectedReportForDetails}
                      isAdmin={isAdmin}
                      usuario={usuario}
                    />
                  )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
