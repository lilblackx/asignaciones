import { SearchX } from 'lucide-react';
import { formatCedula, getEstadoColor } from '../../../utils/ticketDisplay';
import AvisoCargarAnteriores from '../../AvisoCargarAnteriores';
import EstadoVacio from '../../EstadoVacio';
import { oracion } from '../../../utils/oracion';
import { legible } from '../../../utils/nombreTecnico';

export default function ArchivedSearchResults({ archivedSearchResults, hasMoreReports, isLoadingReports, onLoadMoreReports }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-muted-foreground mb-2">Resultados de Búsqueda ({archivedSearchResults.length})</h3>

      <div className="hidden md:block bg-card rounded-card border border-transparent overflow-hidden shadow-sm shadow-card">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-secondary text-card-foreground font-bold border-b border-border text-[11px] max-lg:text-xs">
              <th className="px-4 py-3 w-[15%]">Fecha Archivo</th>
              <th className="px-4 py-3 w-[10%]">Código</th>
              <th className="px-4 py-3 w-[25%]">Nombre Cliente</th>
              <th className="px-4 py-3 w-[25%]">Dirección</th>
              <th className="px-4 py-3 w-[15%]">Tipo y Trabajo</th>
              <th className="px-4 py-3 w-[10%] text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {archivedSearchResults.map((ticket, i) => (
              <tr key={`${ticket.id}-${i}`} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 align-middle">
                  <div className="font-black text-foreground">{ticket._reportFecha}</div>
                  <div className={`text-[11px] max-lg:text-xs font-bold mt-1 px-1.5 py-0.5 rounded w-max ${ticket._reportTipo === 'CANCELADOS' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    {ticket._reportTipo === 'CANCELADOS' ? 'CANCELADO' : 'FINALIZADO'}
                  </div>
                </td>
                <td className="px-4 py-3 font-black text-red-700 dark:text-red-400 align-middle">{ticket.codigo}</td>
                <td className="px-4 py-3 align-middle">
                  <div className="font-bold text-foreground leading-tight">{ticket.nombre}</div>
                  <div className="text-[11px] max-lg:text-xs text-muted-foreground mt-1">C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground leading-snug align-middle">{ticket.direccion}</td>
                <td className="px-4 py-3 align-middle">
                  <span className="block text-[11px] max-lg:text-xs font-black text-red-700 dark:text-red-400 mb-1">{oracion(ticket.tipoTrabajo)}</span>
                  <div className="text-card-foreground leading-tight">{ticket.falla}</div>
                </td>
                <td className="px-4 py-3 text-center align-middle">
                  <span className={`inline-flex items-center justify-center px-2 py-1 text-[11px] max-lg:text-xs font-bold rounded leading-none ${getEstadoColor(ticket.estado)}`}>
                    {oracion(ticket.estado)}
                  </span>
                </td>
              </tr>
            ))}
            {archivedSearchResults.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">No se encontraron resultados en el archivo.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {archivedSearchResults.map((ticket, i) => (
          <div key={`${ticket.id}-${i}`} className="bg-card p-4 rounded-card border border-transparent shadow-sm flex flex-col gap-2 relative shadow-card">
            <div className="absolute top-4 right-4 text-right">
              <div className="text-[11px] max-lg:text-xs font-black text-muted-foreground">{ticket._reportFecha}</div>
              <div className={`text-[11px] max-lg:text-xs font-bold mt-0.5 px-1 py-0.5 rounded w-max ml-auto ${ticket._reportTipo === 'CANCELADOS' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                {ticket._reportTipo === 'CANCELADOS' ? 'CANCELADO' : 'FINALIZADO'}
              </div>
            </div>
            <div className="pr-20">
              <span className="font-black text-red-700 dark:text-red-400 text-sm block mb-1">{ticket.codigo}</span>
              <h5 className="font-bold text-foreground text-sm leading-tight">{ticket.nombre}</h5>
              <p className="text-xs text-muted-foreground">C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</p>
            </div>
            <p className="text-xs text-muted-foreground leading-snug"><span className="font-semibold text-foreground">Dirección:</span> {ticket.direccion}</p>
            <div className="border-t border-border/80 pt-2 flex flex-col gap-1 text-xs">
              <p><span className="font-semibold">Trabajo:</span> <span className="font-bold text-red-700 dark:text-red-400">{oracion(ticket.tipoTrabajo)}</span> - {ticket.falla}</p>
              <p><span className="font-semibold">Técnico:</span> {legible(ticket.tecnico || 'Sin técnico')}</p>
            </div>
          </div>
        ))}
        {archivedSearchResults.length === 0 && (
          <EstadoVacio icono={SearchX} compacto titulo="No se encontraron resultados">Prueba con otro código, nombre o cédula.</EstadoVacio>
        )}
      </div>
      <AvisoCargarAnteriores variante="busqueda" hayMas={hasMoreReports} cargando={isLoadingReports} onCargar={onLoadMoreReports} className="mt-4" />
    </div>
  );
}
