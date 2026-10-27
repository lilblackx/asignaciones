import { Calendar, Eye, FileText } from 'lucide-react';
import BotonExportar from '../../BotonExportar';
import AccionesEncabezado from '../../AccionesEncabezado';
import { exportReportToCsv } from '../../../utils/exportReport';
import CierreAutomaticoConfig from './CierreAutomaticoConfig';
import Spinner from '../../Spinner';
import Boton from '../../Boton';

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
      <div className="mb-4 p-6 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-500" /> Cierre de Jornada
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Esta acción archiva todas las órdenes con estado <strong>FINALIZADO</strong> y <strong>CANCELADO</strong> en el historial de reportes y limpia la tabla principal.
          </p>
        </div>
        {/* En PC el botón está en el encabezado; aquí queda en pantallas angostas. */}
        <AccionesEncabezado
          className="w-full sm:w-auto shrink-0"
          encabezado={<Boton variante="principal" onClick={() => onRequestCierre(todayIsoDate())}>Ejecutar cierre</Boton>}
        >
          <Boton variante="principal" tamano="grande" onClick={() => onRequestCierre(todayIsoDate())} className="w-full sm:w-auto">Ejecutar cierre</Boton>
        </AccionesEncabezado>
      </div>

      <CierreAutomaticoConfig isAdmin={isAdmin} usuario={usuario} />

      <h3 className="text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-4">Historial de Reportes</h3>

      {reports.length === 0 ? (
        <p className="text-center text-zinc-600 dark:text-zinc-400 py-10 font-medium">Aún no se han generado reportes de cierre de día.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((rep) => (
            <div key={rep.id} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div>
                    <h4 className="font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-zinc-600 dark:text-zinc-400" /> {rep.fechaCierre}
                      {rep.tipoReporte === 'CANCELADOS' && <span className="ml-1 text-[11px] max-lg:text-xs bg-red-600 text-white px-2 py-0.5 rounded">CANCELADOS</span>}
                      {(!rep.tipoReporte || rep.tipoReporte === 'CIERRE') && <span className="ml-1 text-[11px] max-lg:text-xs bg-blue-600 text-white px-2 py-0.5 rounded">CIERRE</span>}
                    </h4>
                    <span className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 font-bold">{rep.horaCierre} - OP: {rep.operador}</span>
                    {rep.canceladas !== undefined && (
                      <span className="block mt-1 text-[11px] max-lg:text-xs font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400">{rep.finalizadas} finalizadas</span>
                        <span className="text-zinc-400"> · </span>
                        <span className="text-red-600 dark:text-red-400">{rep.canceladas} canceladas</span>
                      </span>
                    )}
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
                  <Eye className="w-4 h-4 text-zinc-600 dark:text-zinc-400" /> Ver Órdenes
                </button>
                <BotonExportar onClick={() => exportReportToCsv(rep)} title="Descargar CSV" ariaLabel="Descargar CSV" />
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
            {isLoadingReports && <Spinner />}{isLoadingReports ? 'Cargando...' : 'Cargar reportes anteriores'}
          </button>
        </div>
      )}
    </>
  );
}
