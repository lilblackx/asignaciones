import { formatCedula, getEstadoColor } from '../../../utils/ticketDisplay';

export default function ArchivedSearchResults({ archivedSearchResults, hasMoreReports, isLoadingReports, onLoadMoreReports }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Resultados de Búsqueda ({archivedSearchResults.length})</h3>
      {hasMoreReports && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4">
          Esta búsqueda solo cubre el historial ya cargado. Hay reportes más antiguos sin cargar —{' '}
          <button onClick={onLoadMoreReports} disabled={isLoadingReports} className="font-bold underline disabled:opacity-50">
            {isLoadingReports ? 'cargando...' : 'cargar más'}
          </button>{' '}
          para ampliar la búsqueda.
        </p>
      )}

      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-bold border-b border-zinc-200 dark:border-zinc-800 uppercase text-[10px]">
              <th className="px-4 py-3 w-[15%]">Fecha Archivo</th>
              <th className="px-4 py-3 w-[10%]">Código</th>
              <th className="px-4 py-3 w-[25%]">Nombre Cliente</th>
              <th className="px-4 py-3 w-[25%]">Dirección</th>
              <th className="px-4 py-3 w-[15%]">Tipo y Trabajo</th>
              <th className="px-4 py-3 w-[10%] text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {archivedSearchResults.map((ticket, i) => (
              <tr key={`${ticket.id}-${i}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                <td className="px-4 py-3 align-middle">
                  <div className="font-black text-zinc-900 dark:text-white">{ticket._reportFecha}</div>
                  <div className={`text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded w-max ${ticket._reportTipo === 'CANCELADOS' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    {ticket._reportTipo === 'CANCELADOS' ? 'CANCELADO' : 'FINALIZADO'}
                  </div>
                </td>
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
                <td className="px-4 py-3 text-center align-middle">
                  <span className={`inline-flex items-center justify-center px-2 py-1 text-[9px] font-bold rounded leading-none ${getEstadoColor(ticket.estado)}`}>
                    {ticket.estado}
                  </span>
                </td>
              </tr>
            ))}
            {archivedSearchResults.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-zinc-500">No se encontraron resultados en el archivo.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {archivedSearchResults.map((ticket, i) => (
          <div key={`${ticket.id}-${i}`} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-sm flex flex-col gap-2 relative">
            <div className="absolute top-4 right-4 text-right">
              <div className="text-[10px] font-black text-zinc-500">{ticket._reportFecha}</div>
              <div className={`text-[8px] font-bold mt-0.5 px-1 py-0.5 rounded w-max ml-auto ${ticket._reportTipo === 'CANCELADOS' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                {ticket._reportTipo === 'CANCELADOS' ? 'CANCELADO' : 'FINALIZADO'}
              </div>
            </div>
            <div className="pr-20">
              <span className="font-black text-red-600 dark:text-red-400 text-sm block mb-1">{ticket.codigo}</span>
              <h5 className="font-bold text-zinc-950 dark:text-white text-sm leading-tight">{ticket.nombre}</h5>
              <p className="text-xs text-zinc-500">C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</p>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-snug"><span className="font-semibold text-zinc-800 dark:text-zinc-100">Dirección:</span> {ticket.direccion}</p>
            <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-2 flex flex-col gap-1 text-xs">
              <p><span className="font-semibold">Trabajo:</span> <span className="font-bold text-red-600 dark:text-red-400">{ticket.tipoTrabajo}</span> - {ticket.falla}</p>
              <p><span className="font-semibold">Técnico:</span> {ticket.tecnico || 'SIN TÉCNICO'}</p>
            </div>
          </div>
        ))}
        {archivedSearchResults.length === 0 && (
          <div className="text-center text-zinc-500 py-8 text-sm">No se encontraron resultados.</div>
        )}
      </div>
    </div>
  );
}
