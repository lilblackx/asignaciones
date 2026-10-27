import { FileText, MessageSquareText, Wrench } from 'lucide-react';
import NombreTecnico from '../../NombreTecnico';
import BotonExportar from '../../BotonExportar';
import { exportReportToCsv } from '../../../utils/exportReport';
import { formatCedula } from '../../../utils/ticketDisplay';
import { motivoCancelacion } from '../../../utils/cancelacion';
import { CENTRADO_AMPLIO } from '../../Modal';
import EncabezadoModulo from '../../EncabezadoModulo';

// Los cierres nuevos traen en un solo reporte las órdenes finalizadas y las canceladas; cada una se marca con su estado.
function EstadoOrden({ ticket }) {
  return (
    <span className={`block mt-1 text-[11px] max-lg:text-xs font-black uppercase ${ticket.estado === 'CANCELADO' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
      {ticket.estado === 'CANCELADO' ? 'Cancelada' : 'Finalizada'}
    </span>
  );
}

export default function ReportDetailsView({ report, getTecnicoColor, onBack, onClose }) {
  const conCanceladas = report.canceladas !== undefined;
  return (
    <>
      <EncabezadoModulo
        Icono={FileText}
        titulo={`ÓRDENES DE CIERRE (${report.fechaCierre})`}
        onClose={onClose}
        onVolver={onBack}
        acciones={(
          <BotonExportar onClick={() => exportReportToCsv(report)} title="Descargar CSV" etiqueta="CSV" etiquetaSoloPc />
        )}
      />

      <div className={`p-6 overflow-y-auto flex-1 bg-fondo ${CENTRADO_AMPLIO}`}>
        <button onClick={onBack} className="lg:hidden mb-4 text-xs font-bold bg-white border border-zinc-300 dark:border-transparent dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white px-3 py-1.5 rounded-lg border border-zinc-400 dark:border-zinc-700 transition-colors">← Volver al Historial</button>
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-black text-zinc-900 dark:text-white text-lg">Resumen de Jornada</h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1">
              Procesado por <span className="font-bold text-zinc-800 dark:text-zinc-200">{report.operador}</span> a las <span className="font-bold text-zinc-800 dark:text-zinc-200">{report.horaCierre}</span>
            </p>
          </div>
          <div className="flex gap-2 shrink-0 self-stretch sm:self-auto">
            <div className="flex-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-5 py-2 rounded-xl text-center shadow-inner flex sm:flex-col justify-between items-center gap-2 sm:gap-0">
              <span className="text-[11px] max-lg:text-xs font-black">{conCanceladas ? 'Finalizadas' : 'Cerradas'}</span>
              <span className="text-2xl font-black">{conCanceladas ? report.finalizadas : report.total}</span>
            </div>
            {conCanceladas && (
              <div className="flex-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-5 py-2 rounded-xl text-center shadow-inner flex sm:flex-col justify-between items-center gap-2 sm:gap-0">
                <span className="text-[11px] max-lg:text-xs font-black">Canceladas</span>
                <span className="text-2xl font-black">{report.canceladas}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-3">Distribución de Trabajos</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(report.desglose || {}).map(([tipo, count]) => (
              <span key={tipo} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-sm">
                {tipo}: <span className="text-red-600 dark:text-red-400 font-black ml-1">{count}</span>
              </span>
            ))}
          </div>
        </div>

        <h4 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-3">Detalles de la Carga de Trabajo</h4>

        <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-bold border-b border-zinc-200 dark:border-zinc-800 uppercase text-[11px] max-lg:text-xs">
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
                  <td className="px-4 py-3 align-middle"><span className="font-black text-red-600 dark:text-red-400">{ticket.codigo}</span>{conCanceladas && <EstadoOrden ticket={ticket} />}</td>
                  <td className="px-4 py-3 align-middle">
                    <div className="font-bold text-zinc-900 dark:text-white leading-tight">{ticket.nombre}</div>
                    <div className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 mt-1">C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 leading-snug align-middle">{ticket.direccion}</td>
                  <td className="px-4 py-3 align-middle">
                    <span className="block text-[11px] max-lg:text-xs font-black text-red-600 dark:text-red-400 uppercase mb-1">{ticket.tipoTrabajo}</span>
                    <div className="text-zinc-700 dark:text-zinc-300 leading-tight">{ticket.falla}</div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {ticket.tecnico ? (
                      <NombreTecnico nombre={ticket.tecnico} getTecnicoColor={getTecnicoColor} />
                    ) : (
                      <span className="text-zinc-400 italic">No asignado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 italic leading-snug align-middle">
                    {ticket.observacion || (ticket.observacionTecnico ? '' : '-')}
                    {ticket.observacionTecnico && <span className={`block not-italic text-amber-700 dark:text-amber-400 ${ticket.observacion ? 'mt-1' : ''}`}><span className="font-semibold">Técnico:</span> {ticket.observacionTecnico}</span>}
                    {motivoCancelacion(ticket) && <span className="block not-italic text-red-700 dark:text-red-300 mt-1"><span className="font-semibold">Cancelada:</span> {motivoCancelacion(ticket)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-3 md:hidden">
          {(report.ticketsDetalle || []).map((ticket) => (
            <div key={ticket.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-black text-red-600 dark:text-red-400 text-sm">{ticket.codigo}{conCanceladas && <span className={`ml-2 text-[11px] max-lg:text-xs uppercase ${ticket.estado === 'CANCELADO' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{ticket.estado === 'CANCELADO' ? 'Cancelada' : 'Finalizada'}</span>}</span>
                <span className="text-zinc-600 dark:text-zinc-400 text-xs font-bold">{ticket.fecha}</span>
              </div>
              <div>
                <h5 className="font-bold text-zinc-950 dark:text-white text-sm leading-tight">{ticket.nombre}</h5>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</p>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-snug"><span className="font-semibold text-zinc-800 dark:text-zinc-100">Dirección:</span> {ticket.direccion}</p>
              <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-2 flex flex-col gap-1 text-xs">
                <p><span className="font-semibold">Trabajo:</span> <span className="font-bold text-red-600 dark:text-red-400">{ticket.tipoTrabajo}</span> - {ticket.falla}</p>
                <p><span className="font-semibold">Técnico:</span> {ticket.tecnico || 'SIN TÉCNICO'}</p>
                {motivoCancelacion(ticket) && <p className="text-red-700 dark:text-red-300"><span className="font-semibold">Motivo de la cancelación:</span> {motivoCancelacion(ticket)}</p>}
                {ticket.observacion && (
                  <p className="flex items-start gap-1.5 text-zinc-600 dark:text-zinc-300">
                    <MessageSquareText className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-px" aria-label="Observación" role="img" />
                    <span>{ticket.observacion}</span>
                  </p>
                )}
                {ticket.observacionTecnico && (
                  <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                    <Wrench className="w-3.5 h-3.5 shrink-0 mt-px" aria-label="Observación del técnico" role="img" />
                    <span>{ticket.observacionTecnico}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
