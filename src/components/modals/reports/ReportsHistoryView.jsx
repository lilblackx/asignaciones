import { Calendar, Eye, FileText } from 'lucide-react';
import BotonExportar from '../../BotonExportar';
import AccionesEncabezado from '../../AccionesEncabezado';
import { exportReportToCsv } from '../../../utils/exportReport';
import CierreAutomaticoConfig from './CierreAutomaticoConfig';
import AvisoCargarAnteriores from '../../AvisoCargarAnteriores';
import Boton from '../../Boton';
import EstadoVacio from '../../EstadoVacio';
import { oracion } from '../../../utils/oracion';

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
      <div className="mb-4 p-6 bg-card border border-transparent rounded-card shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between shadow-card">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-700 dark:text-red-400" /> Cierre de Jornada
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Esta acción archiva todas las órdenes con estado <strong>Finalizado</strong> y <strong>Cancelado</strong> en el historial de reportes y limpia la tabla principal.
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

      <h3 className="text-sm font-bold text-muted-foreground mb-4">Historial de Reportes</h3>

      {reports.length === 0 ? (
        <EstadoVacio titulo="Aún no hay reportes de cierre">Se generan cuando se hace el cierre del día.</EstadoVacio>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((rep) => (
            <div key={rep.id} className="bg-card border border-transparent rounded-card p-4 shadow-sm flex flex-col justify-between shadow-card">
              <div>
                <div className="flex justify-between items-start mb-3 border-b border-border pb-3">
                  <div>
                    <h4 className="font-black text-foreground flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-muted-foreground" /> {rep.fechaCierre}
                      {rep.tipoReporte === 'CANCELADOS' && <span className="ml-1 text-etiqueta bg-red-600 text-white px-2 py-0.5 rounded">Cancelados</span>}
                      {(!rep.tipoReporte || rep.tipoReporte === 'CIERRE') && <span className="ml-1 text-etiqueta bg-blue-600 text-white px-2 py-0.5 rounded">Cierre</span>}
                    </h4>
                    <span className="text-etiqueta text-muted-foreground font-bold">{rep.horaCierre} - OP: {rep.operador}</span>
                    {rep.canceladas !== undefined && (
                      <span className="block mt-1 text-etiqueta font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400">{rep.finalizadas} finalizadas</span>
                        <span className="text-muted-foreground"> · </span>
                        <span className="text-red-700 dark:text-red-400">{rep.canceladas} canceladas</span>
                      </span>
                    )}
                  </div>
                  <div className="bg-secondary text-card-foreground px-3 py-1 rounded-campo text-center">
                    <span className="block text-xs font-bold leading-none">Total</span>
                    <span className="block text-xl font-black leading-none mt-1">{rep.total}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-medium mb-4">
                  {Object.entries(rep.desglose || {}).map(([tipo, cantidad]) => (
                     <div key={tipo} className="flex justify-between items-center bg-sunken p-2 rounded border border-border">
                        <span className="text-muted-foreground truncate pr-2">{oracion(tipo)}</span>
                        <span className="font-bold text-foreground text-sm bg-card px-2 rounded shadow-sm">{cantidad}</span>
                     </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onViewReport(rep)}
                  className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-foreground font-bold rounded-campo text-xs flex items-center justify-center gap-1.5 transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                  <Eye className="w-4 h-4 text-muted-foreground" /> Ver Órdenes
                </button>
                <BotonExportar onClick={() => exportReportToCsv(rep)} title="Descargar CSV" ariaLabel="Descargar CSV" />
              </div>
            </div>
          ))}
        </div>
      )}

      <AvisoCargarAnteriores variante="cierres" hayMas={hasMoreReports} cargando={isLoadingReports} onCargar={onLoadMoreReports} className="mt-4" />
    </>
  );
}
