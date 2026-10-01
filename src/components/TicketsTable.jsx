import { ArrowDownAZ, CheckCheck, CheckCircle2, Clock, Edit, ExternalLink, History, MapPin, MapPinOff, MessageCircle, Navigation, Send, Trash2, TriangleAlert, Wrench } from 'lucide-react';
import { getEnlaceNavegacion, instalacionSinUbicacion } from '../utils/ubicacion';
import { formatCedula, getEnvioInfo, getEstadoColor, getEtiquetaDia, getTipoTrabajoEstilo, renderCedulaConSaltos, renderProgramadaBadge } from '../utils/ticketDisplay';
import { buildSmartOltUrl } from '../utils/smartolt';
import { esProgramadaFutura } from '../utils/programada';
import RowMenu from './RowMenu';

const COLUMNAS = 9;

export default function TicketsTable({
  filteredTickets,
  canEditTickets,
  isTecnico = false,
  hasAnyTickets = true,
  sortBy,
  setSortBy,
  getTecnicoColor,
  onToggleAsignado,
  onEdit,
  onDelete,
  onCopyWhatsApp,
  onPegarUbicacion,
  onVerHistorial,
  onPreFinalizar,
  onAprobarFinalizar,
  onFinalizar
}) {
  // Con orden "más recientes" o por fecha las órdenes de un mismo día quedan
  // juntas: se agrupan bajo un encabezado. Con otros órdenes la fecha va en la fila.
  const agrupado = sortBy === 'DEFECTO' || sortBy === 'FECHA';

  return (
    <div className="hidden lg:block bg-white dark:bg-zinc-900 rounded-xl shadow-md dark:shadow-sm border border-zinc-300 dark:border-zinc-800 overflow-hidden transition-colors w-full">
      <table className="w-full text-xs text-left table-fixed">
        <thead className="text-[10px] text-white uppercase bg-black border-b-2 border-red-600">
          <tr>
            <th className="px-3 py-3 border-r border-zinc-800 w-[7%] align-middle text-center">CÓDIGO</th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[20%] align-middle text-center">NOMBRE</th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[11%] align-middle text-center">CÉDULA</th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[14%] align-middle text-center">DIRECCIÓN</th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[16%] align-middle group cursor-pointer hover:bg-zinc-800 transition-colors" onClick={() => setSortBy(sortBy === 'TIPO_TRABAJO' ? 'DEFECTO' : 'TIPO_TRABAJO')} title="Ordenar por Tipo de Trabajo">
              <div className="flex items-center justify-center gap-1">
                FALLA / TRABAJO
                <ArrowDownAZ className={`w-3 h-3 ${sortBy === 'TIPO_TRABAJO' ? 'text-red-500' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              </div>
            </th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[9%] align-middle text-center">TÉCNICO</th>
            <th className="px-2 py-3 border-r border-zinc-800 w-[6%] align-middle text-center">ENVIADO</th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[8%] align-middle text-center">ESTADO</th>
            <th className="px-2 py-3 align-middle text-center text-red-500 w-[9%]">ACC</th>
          </tr>
        </thead>
        <tbody>
          {filteredTickets.map((ticket, index) => {
            const tipoEstilo = getTipoTrabajoEstilo(ticket.tipoTrabajo);
            const envio = getEnvioInfo(ticket);
            const enlaceNavegacion = getEnlaceNavegacion(ticket.ubicacion);
            const eliminado = ticket.estado === 'ELIMINADO';
            const nuevoDia = agrupado && (index === 0 || filteredTickets[index - 1].fecha !== ticket.fecha);
            const dia = nuevoDia ? getEtiquetaDia(ticket.fecha, ticket.estado) : null;
            return [
              nuevoDia && (
                <tr key={`dia-${ticket.id}`} className="bg-zinc-200/70 dark:bg-zinc-950 border-b border-zinc-300 dark:border-zinc-800">
                  <td colSpan={COLUMNAS} className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${dia.atrasado ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    {dia.texto}
                  </td>
                </tr>
              ),
              <tr key={ticket.id} className={`border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-100/70 dark:bg-zinc-900/50'} ${eliminado ? 'opacity-60' : ''} ${esProgramadaFutura(ticket) ? 'opacity-60 hover:opacity-100' : ''}`}>
                <td className={`px-3 py-3 border-r border-zinc-200 dark:border-zinc-800 border-l-4 ${eliminado ? 'border-l-zinc-500' : tipoEstilo.borde} font-bold text-zinc-800 dark:text-zinc-100 whitespace-normal break-words align-middle`} title={ticket.creado ? `Creada por ${ticket.creado}` : undefined}>
                  <div className="min-h-[2rem] flex items-center">{ticket.codigo}</div>
                </td>
                <td className="px-3 py-3 border-r border-zinc-200 dark:border-zinc-800 whitespace-normal leading-tight align-middle">
                  <div className="flex flex-col justify-center h-full min-h-[2rem] gap-0.5">
                    <span className="font-medium">{ticket.nombre}</span>
                    {!agrupado && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{ticket.fecha}</span>}
                    {ticket.estado === 'PENDIENTE' && renderProgramadaBadge(ticket.fechaProgramada, ticket.tecnico)}
                    {ticket.observacion && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2" title={ticket.observacion}>{ticket.observacion}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 border-r border-zinc-200 dark:border-zinc-800 whitespace-normal align-middle">
                  <div className="flex items-center h-full min-h-[2rem]">
                    {ticket.cedula && !isTecnico ? (
                      <a
                        href={buildSmartOltUrl(ticket.cedula, ticket.tipoDocumento)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Buscar cliente en SmartOLT"
                        aria-label={`Buscar cédula ${ticket.cedula} en SmartOLT`}
                        className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 underline decoration-dotted underline-offset-2 hover:decoration-solid"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>{renderCedulaConSaltos(formatCedula(ticket.cedula, ticket.tipoDocumento))}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                      </a>
                    ) : renderCedulaConSaltos(formatCedula(ticket.cedula, ticket.tipoDocumento))}
                  </div>
                </td>
                <td className="px-3 py-3 border-r border-zinc-200 dark:border-zinc-800 whitespace-normal leading-tight align-middle">
                  <div className="flex items-center h-full min-h-[2rem]"><span className="line-clamp-2" title={ticket.direccion}>{ticket.direccion}</span></div>
                </td>
                <td className="px-3 py-3 border-r border-zinc-200 dark:border-zinc-800 whitespace-normal leading-tight font-medium align-middle">
                  <div className="flex flex-col items-start justify-center h-full min-h-[2rem] gap-1">
                    <span className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded ${tipoEstilo.badge}`}>{ticket.tipoTrabajo}</span>
                    {ticket.falla !== ticket.tipoTrabajo && ticket.falla}
                    {instalacionSinUbicacion(ticket) && (
                      canEditTickets ? (
                        <button type="button" onClick={() => onPegarUbicacion(ticket)} title="Copia el enlace de ubicación y haz clic para guardarlo" className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">
                          <MapPinOff className="w-3 h-3" aria-hidden="true" /> Sin ubicación · pegar
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                          <MapPinOff className="w-3 h-3" aria-hidden="true" /> Sin ubicación
                        </span>
                      )
                    )}
                  </div>
                </td>
                <td className="px-2 py-3 border-r border-zinc-200 dark:border-zinc-800 text-center align-middle">
                  <div className="flex items-center justify-center h-full min-h-[2rem]">
                    {ticket.tecnico && (
                      <span className={`inline-flex items-center justify-center px-2 py-1.5 text-[11px] font-bold rounded leading-none ${getTecnicoColor(ticket.tecnico)}`}>{ticket.tecnico}</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-3 border-r border-zinc-200 dark:border-zinc-800 text-center align-middle bg-zinc-50/50 dark:bg-zinc-900/20">
                  <div className="flex items-center justify-center h-full min-h-[2rem]">
                    <button
                      type="button"
                      onClick={() => onToggleAsignado(ticket)}
                      disabled={!canEditTickets || eliminado || isTecnico}
                      aria-label={`Orden ${ticket.codigo || ticket.id}: ${envio.detalle}`}
                      aria-pressed={envio.enviado}
                      title={envio.detalle}
                      className={`p-1.5 rounded-full transition-colors disabled:cursor-not-allowed ${
                        envio.cambioTrasEnvio
                          ? 'bg-amber-500 text-black hover:bg-amber-400'
                          : envio.enviado
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:hover:bg-zinc-200 dark:disabled:hover:bg-zinc-800'
                      }`}
                    >
                      {envio.cambioTrasEnvio ? <TriangleAlert className="w-3.5 h-3.5" /> : envio.enviado ? <CheckCheck className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
                <td className="px-2 py-3 border-r border-zinc-200 dark:border-zinc-800 text-center align-middle">
                  <div className="flex items-center justify-center h-full min-h-[2rem]">
                    <span className={`inline-flex items-center justify-center px-2 py-1.5 text-[10px] font-bold rounded leading-tight text-center ${getEstadoColor(ticket.estado)}`}>{ticket.estado}</span>
                  </div>
                </td>
                <td className="px-1.5 py-2 text-center align-middle">
                  <div className="flex flex-wrap items-center justify-center h-full min-h-[2rem] gap-1">
                    {eliminado ? (
                      <span className="text-[10px] text-red-500 font-bold">Por: {ticket.eliminadoPor}</span>
                    ) : isTecnico ? (
                      <>
                        <button onClick={() => onCopyWhatsApp(ticket)} aria-label={`Copiar plantilla WhatsApp de orden ${ticket.codigo || ticket.id}`} className="p-1 text-green-700 dark:text-green-500 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded transition-colors" title="Copiar plantilla WhatsApp"><MessageCircle className="w-3.5 h-3.5" /></button>
                        {enlaceNavegacion && (
                          <a href={enlaceNavegacion} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a la orden ${ticket.codigo || ticket.id}`} title="Cómo llegar" className="p-1 text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-900/50 rounded transition-colors"><Navigation className="w-3.5 h-3.5" /></a>
                        )}
                        {ticket.estado === 'PENDIENTE' ? (
                          <button onClick={() => onPreFinalizar(ticket)} aria-label={`Pre-finalizar orden ${ticket.codigo || ticket.id}`} className="p-1 text-black bg-amber-500 hover:bg-amber-400 rounded font-bold transition-colors" title="Pre-finalizar orden"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                        ) : ticket.estado === 'PRE-FINALIZADO' ? (
                          <span className="p-1 text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 rounded" title="Pre-finalizada: esperando aprobación de administración"><Clock className="w-3.5 h-3.5" /></span>
                        ) : null}
                        <button onClick={() => onEdit(ticket)} aria-label={`Ver detalles de orden ${ticket.codigo || ticket.id}`} className="p-1 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors" title="Ver detalles / notas"><Edit className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => onCopyWhatsApp(ticket)} aria-label={`Copiar plantilla WhatsApp de orden ${ticket.codigo || ticket.id}`} className="p-1 text-green-700 dark:text-green-500 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded transition-colors" title="Copiar plantilla WhatsApp (marca como enviada)"><MessageCircle className="w-3.5 h-3.5" /></button>
                        {canEditTickets ? (
                          <>
                            {ticket.estado === 'PENDIENTE' && (
                              <button onClick={() => onFinalizar(ticket)} aria-label={`Finalizar orden ${ticket.codigo || ticket.id}`} className="p-1 text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 rounded transition-colors" title="Finalizar orden"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                            )}
                            {ticket.estado === 'PRE-FINALIZADO' && (
                              <button onClick={() => onAprobarFinalizar(ticket)} aria-label={`Aprobar y finalizar orden ${ticket.codigo || ticket.id}`} className="p-1 text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors" title="Aprobar y Finalizar orden"><CheckCheck className="w-3.5 h-3.5" /></button>
                            )}
                            <button onClick={() => onPegarUbicacion(ticket)} aria-label={`${ticket.ubicacion ? 'Cambiar' : 'Pegar'} ubicación de orden ${ticket.codigo || ticket.id}`} title={ticket.ubicacion ? 'Cambiar ubicación' : 'Pegar ubicación desde el portapapeles'} className={`p-1 rounded transition-colors ${ticket.ubicacion ? 'text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-900/50' : 'text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}><MapPin className="w-3.5 h-3.5" /></button>
                            <RowMenu
                              label={`Más acciones de orden ${ticket.codigo || ticket.id}`}
                              items={[
                                { label: 'Editar', icon: Edit, onClick: () => onEdit(ticket) },
                                { label: 'Historial', icon: History, onClick: () => onVerHistorial(ticket) },
                                { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => onDelete(ticket.id) },
                              ]}
                            />
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-400 font-bold">-</span>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ];
          })}
          {filteredTickets.length === 0 && (
            <tr>
              <td colSpan={COLUMNAS} className="px-4 py-12 text-center text-zinc-500 dark:text-zinc-400 font-medium">
                {isTecnico && !hasAnyTickets ? (
                  <div className="flex flex-col items-center gap-2">
                    <Wrench className="w-6 h-6 text-zinc-400 dark:text-zinc-600" aria-hidden="true" />
                    <span>No tienes asignaciones en este momento.</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">Cuando te asignen una orden, aparecerá aquí.</span>
                  </div>
                ) : isTecnico ? (
                  'No tienes asignaciones que coincidan con los filtros actuales.'
                ) : (
                  'No hay registros activos para mostrar con los filtros actuales.'
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
