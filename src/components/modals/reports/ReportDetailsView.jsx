import { Download, X } from 'lucide-react';
import { exportReportToCsv } from '../../../utils/exportReport';
import { formatCedula } from '../../../utils/ticketDisplay';

export default function ReportDetailsView({ report, getTecnicoColor, onBack, onClose }) {
  return (
    <>
      <div className="bg-black px-6 py-4 border-b-2 border-red-600 flex justify-between items-center shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors shrink-0"
          >
            ← Volver al Historial
          </button>
          <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider truncate">
            Órdenes de Cierre ({report.fechaCierre})
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => exportReportToCsv(report)}
            title="Descargar CSV"
            className="flex items-center gap-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={onClose}
            className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1 bg-zinc-50 dark:bg-zinc-950">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-black text-zinc-900 dark:text-white text-lg">Resumen de Jornada</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">
              Procesado por <span className="font-bold text-zinc-800 dark:text-zinc-200">{report.operador}</span> a las <span className="font-bold text-zinc-800 dark:text-zinc-200">{report.horaCierre}</span>
            </p>
          </div>
          <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-5 py-2 rounded-xl text-center shadow-inner shrink-0 self-stretch sm:self-auto flex sm:flex-col justify-between items-center">
            <span className="text-[10px] font-black tracking-wider uppercase">Cerradas</span>
            <span className="text-2xl font-black">{report.total}</span>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Distribución de Trabajos</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(report.desglose || {}).map(([tipo, count]) => (
              <span key={tipo} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-sm">
                {tipo}: <span className="text-red-600 dark:text-red-400 font-black ml-1">{count}</span>
              </span>
            ))}
          </div>
        </div>

        <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Detalles de la Carga de Trabajo</h4>

        <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-bold border-b border-zinc-200 dark:border-zinc-800 uppercase text-[10px]">
                <th className="px-4 py-3 w-[10%]">Código</th>
                <th className="px-4 py-3 w-[25%]">Nombre Cliente</th>
                <th className="px-4 py-3 w-[25%]">Dirección</th>
                <th className="px-4 py-3 w-[15%]">Tipo y Trabajo</th>
                <th className="px-4 py-3 w-[12%]">Técnico</th>
                <th className="px-4 py-3 w-[13%]">Observación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {(report.ticketsDetalle || []).map((ticket) => (
                <tr key={ticket.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                  <td className="px-4 py-3 font-black text-red-600 dark:text-red-400 align-middle">{ticket.codigo}</td>
                  <td className="px-4 py-3 align-middle">
                    <div className="font-bold text-zinc-900 dark:text-white leading-tight">{ticket.nombre}</div>
                    <div className="text-[10px] text-zinc-500 mt-1">C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 leading-snug align-middle">{ticket.direccion}</td>
                  <td className="px-4 py-3 align-middle">
                    <span className="block text-[10px] font-black text-red-600 dark:text-red-400 uppercase mb-1">{ticket.tipoTrabajo}</span>
                    <div className="text-zinc-700 dark:text-zinc-300 leading-tight">{ticket.falla}</div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {ticket.tecnico ? (
                      <span className={`inline-block px-2 py-1 text-[10px] font-bold rounded ${getTecnicoColor(ticket.tecnico)}`}>
                        {ticket.tecnico}
                      </span>
                    ) : (
                      <span className="text-zinc-400 italic">No asignado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 italic leading-snug align-middle">{ticket.observacion || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-3 md:hidden">
          {(report.ticketsDetalle || []).map((ticket) => (
            <div key={ticket.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-black text-red-600 dark:text-red-400 text-sm">{ticket.codigo}</span>
                <span className="text-zinc-400 text-xs font-bold">{ticket.fecha}</span>
              </div>
              <div>
                <h5 className="font-bold text-zinc-950 dark:text-white text-sm leading-tight">{ticket.nombre}</h5>
                <p className="text-xs text-zinc-500">C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</p>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-snug"><span className="font-semibold text-zinc-800 dark:text-zinc-100">Dirección:</span> {ticket.direccion}</p>
              <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-2 flex flex-col gap-1 text-xs">
                <p><span className="font-semibold">Trabajo:</span> <span className="font-bold text-red-600 dark:text-red-400">{ticket.tipoTrabajo}</span> - {ticket.falla}</p>
                <p><span className="font-semibold">Técnico:</span> {ticket.tecnico || 'SIN TÉCNICO'}</p>
                {ticket.observacion && <p className="text-zinc-500 italic"><span className="font-semibold">Obs:</span> {ticket.observacion}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
