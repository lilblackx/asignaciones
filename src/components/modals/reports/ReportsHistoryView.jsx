import { Calendar, Download, Eye, FileText } from 'lucide-react';
import { exportReportToCsv } from '../../../utils/exportReport';
import CierreAutomaticoConfig from './CierreAutomaticoConfig';

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function ReportsHistoryView({ reports, hasMoreReports, isLoadingReports, onLoadMoreReports, onRequestCierre, onViewReport, isAdmin, usuario }) {
  return (
    <>
      <div className="mb-4 p-6 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900/50 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Cierre de Jornada
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Esta acción archiva todas las órdenes con estado <strong>FINALIZADO</strong> y <strong>CANCELADO</strong> en el historial de reportes y limpia la tabla principal.
          </p>
        </div>
        <button onClick={() => onRequestCierre(todayIsoDate())} className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-black uppercase rounded-xl hover:bg-blue-700 transition-colors shadow-md shrink-0">
          Ejecutar Cierre
        </button>
      </div>

      <CierreAutomaticoConfig isAdmin={isAdmin} usuario={usuario} />

      <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-4 uppercase tracking-wider">Historial de Reportes</h3>

      {reports.length === 0 ? (
        <p className="text-center text-zinc-500 py-10 font-medium">Aún no se han generado reportes de cierre de día.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((rep) => (
            <div key={rep.id} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div>
                    <h4 className="font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-zinc-500" /> {rep.fechaCierre}
                      {rep.tipoReporte === 'CANCELADOS' && <span className="ml-1 text-[9px] bg-red-600 text-white px-2 py-0.5 rounded">CANCELADOS</span>}
                      {(!rep.tipoReporte || rep.tipoReporte === 'CIERRE') && <span className="ml-1 text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded">CIERRE</span>}
                    </h4>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">{rep.horaCierre} - OP: {rep.operador}</span>
                  </div>
                  <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-lg text-center">
                    <span className="block text-xs font-bold leading-none">TOTAL</span>
                    <span className="block text-xl font-black leading-none mt-1">{rep.total}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-medium mb-4">
                  {Object.entries(rep.desglose || {}).map(([tipo, cantidad]) => (
                     <div key={tipo} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-100 dark:border-zinc-800">
                        <span className="text-zinc-600 dark:text-zinc-400 truncate pr-2">{tipo}</span>
                        <span className="font-bold text-zinc-900 dark:text-white text-sm bg-white dark:bg-zinc-900 px-2 rounded shadow-sm">{cantidad}</span>
                     </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onViewReport(rep)}
                  className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                  <Eye className="w-4 h-4 text-zinc-500" /> Ver Órdenes
                </button>
                <button
                  onClick={() => exportReportToCsv(rep)}
                  title="Descargar CSV"
                  aria-label="Descargar CSV"
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900/50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMoreReports && (
        <div className="flex justify-center mt-6">
          <button
            onClick={onLoadMoreReports}
            disabled={isLoadingReports}
            className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-50"
          >
            {isLoadingReports ? 'Cargando...' : 'Cargar reportes anteriores'}
          </button>
        </div>
      )}
    </>
  );
}
