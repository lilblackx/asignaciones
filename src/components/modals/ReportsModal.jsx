import { useState } from 'react';
import { BarChart, LineChart, Search, X } from 'lucide-react';
import ReportDetailsView from './reports/ReportDetailsView';
import ArchivedSearchResults from './reports/ArchivedSearchResults';
import ReportsHistoryView from './reports/ReportsHistoryView';
import AnalyticsView from './reports/AnalyticsView';
import Modal from '../Modal';

export default function ReportsModal({
  tickets,
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
  onClose
}) {
  const [activeTab, setActiveTab] = useState('HISTORIAL');

  const closeModal = () => {
    setSelectedReportForDetails(null);
    setReportSearchTerm('');
    onClose();
  };

  return (
    <Modal onClose={closeModal} zIndexClass="z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-zinc-300 dark:border-zinc-800 flex flex-col">
        {selectedReportForDetails ? (
          <ReportDetailsView
            report={selectedReportForDetails}
            getTecnicoColor={getTecnicoColor}
            onBack={() => setSelectedReportForDetails(null)}
            onClose={closeModal}
          />
        ) : (
          <>
            <div className="bg-black px-6 py-4 border-b-2 border-red-600 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-black text-white flex items-center gap-2"><BarChart className="w-5 h-5 text-red-500" /> REPORTES DIARIOS</h2>
              <button onClick={closeModal} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 pt-4 flex gap-2 shrink-0 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab('HISTORIAL')}
                className={`px-4 py-2 text-xs font-black uppercase rounded-t-lg border-b-2 transition-colors ${activeTab === 'HISTORIAL' ? 'border-red-600 text-red-600 dark:text-red-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Historial
              </button>
              <button
                onClick={() => setActiveTab('ESTADISTICAS')}
                className={`px-4 py-2 text-xs font-black uppercase rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'ESTADISTICAS' ? 'border-red-600 text-red-600 dark:text-red-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                <LineChart className="w-3.5 h-3.5" /> Estadísticas
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-zinc-50 dark:bg-zinc-950">
              {activeTab === 'HISTORIAL' ? (
                <>
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
                    />
                  )}
                </>
              ) : (
                <AnalyticsView
                  tickets={tickets}
                  reports={reports}
                  getTecnicoColor={getTecnicoColor}
                  hasMoreReports={hasMoreReports}
                  isLoadingReports={isLoadingReports}
                  onLoadMoreReports={onLoadMoreReports}
                />
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
