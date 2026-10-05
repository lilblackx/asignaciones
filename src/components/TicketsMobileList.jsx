import { esProgramadaFutura } from '../utils/programada';
import { Calendar, CheckCheck, CheckCircle2, ClipboardCopy, Clock, Edit, ExternalLink, MapPin, MapPinOff, Navigation, Network, Send, Trash2, TriangleAlert, Wrench } from 'lucide-react';
import { getEnlaceLlamada, getEnlaceWhatsApp, parseTelefonos } from '../utils/telefono';
import TelefonoAccion from './TelefonoAccion';
import { getEnlaceNavegacion, getEnlaceNavegacionNap, instalacionSinUbicacion } from '../utils/ubicacion';
import { formatCedula, getCreadoColor, getEnvioInfo, getEstadoColor, getFechaStyles, getTipoTrabajoEstilo, renderProgramadaBadge } from '../utils/ticketDisplay';
import { buildSmartOltUrl } from '../utils/smartolt';

export default function TicketsMobileList({
  filteredTickets,
  canEditTickets,
  isTecnico = false,
  hasAnyTickets = true,
  getTecnicoColor,
  onToggleAsignado,
  onEdit,
  onDelete,
  onCopyWhatsApp,
  onPegarUbicacion,
  onPreFinalizar,
  onAprobarFinalizar,
  onFinalizar
}) {
  if (filteredTickets.length === 0) {
    return (
      <div className="lg:hidden bg-white dark:bg-zinc-900 rounded-xl shadow-md dark:shadow-sm border border-zinc-300 dark:border-zinc-800 px-4 py-12 text-center text-zinc-500 dark:text-zinc-400 font-medium transition-colors">
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
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:hidden">
      {filteredTickets.map(ticket => {
        const hayTelefono = parseTelefonos(ticket.telefono).some(t => getEnlaceLlamada(t) || getEnlaceWhatsApp(t));
        const enlaceUbicacion = getEnlaceNavegacion(ticket.ubicacion);
        const enlaceNap = getEnlaceNavegacionNap(ticket.napCoordenadas);
        const envio = getEnvioInfo(ticket);
        return (
        <div key={ticket.id} className={`bg-white dark:bg-zinc-900 rounded-xl shadow-md dark:shadow-sm border overflow-hidden flex flex-col transition-colors ${ticket.estado === 'ELIMINADO' ? 'border-red-500/50 dark:border-red-900/50' : ticket.estado === 'PRE-FINALIZADO' || ticket.estado === 'PRE-FINALIZADA' ? 'border-amber-400/60 dark:border-amber-600/40' : 'border-zinc-300 dark:border-zinc-800'} ${esProgramadaFutura(ticket) ? 'opacity-60 hover:opacity-100' : ''}`}>
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-start sm:items-center bg-zinc-50 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-black text-lg text-zinc-900 dark:text-white leading-none">{ticket.codigo || 'S/C'}</span>
              <div className="flex flex-col">
                <span className={`text-xs font-bold flex items-center gap-1 ${getFechaStyles(ticket.fecha, ticket.estado)}`}><Calendar className="w-3.5 h-3.5" /> {ticket.fecha}</span>
                {ticket.estado === 'PENDIENTE' && renderProgramadaBadge(ticket.fechaProgramada, ticket.tecnico)}
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded ${getEstadoColor(ticket.estado)}`}>
              {ticket.estado}
            </span>
          </div>
          <div className={`p-4 flex-1 flex flex-col gap-3 ${ticket.estado === 'ELIMINADO' ? 'opacity-60' : ''}`}>
            <div>
              <h3 className="font-black text-zinc-900 dark:text-white leading-tight">{ticket.nombre}</h3>
              <p className="text-sm text-zinc-500 font-medium">
                C.I: {ticket.cedula && !isTecnico ? (
                  <a
                    href={buildSmartOltUrl(ticket.cedula, ticket.tipoDocumento)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Buscar cliente en SmartOLT"
                    aria-label={`Buscar cédula ${ticket.cedula} en SmartOLT`}
                    className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 underline decoration-dotted underline-offset-2 hover:decoration-solid"
                  >
                    {formatCedula(ticket.cedula, ticket.tipoDocumento)}
                    <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </a>
                ) : formatCedula(ticket.cedula, ticket.tipoDocumento)}
              </p>
            </div>
            <div className="flex items-start gap-2 text-sm mt-1">
              <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span className="text-zinc-700 dark:text-zinc-300 leading-tight">{ticket.direccion}</span>
            </div>
            {instalacionSinUbicacion(ticket) && (
              canEditTickets ? (
                <button type="button" onClick={() => onPegarUbicacion(ticket)} className="self-start inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">
                  <MapPinOff className="w-4 h-4" aria-hidden="true" /> Sin ubicación · pegar
                </button>
              ) : (
                <span className="self-start inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                  <MapPinOff className="w-4 h-4" aria-hidden="true" /> Sin ubicación todavía
                </span>
              )
            )}
            {ticket.estado !== 'ELIMINADO' && (hayTelefono || enlaceUbicacion || enlaceNap) && (
              // Una sola fila (los que existan se reparten el ancho); texto corto y
              // aria-label completo para no gastar dos filas de alto por tarjeta.
              <div className="flex gap-2">
                {enlaceUbicacion && (
                  <a href={enlaceUbicacion} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a la orden ${ticket.codigo || ticket.id}`} title="Cómo llegar" className="flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 text-xs font-bold hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors">
                    <Navigation className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">Llegar</span>
                  </a>
                )}
                {enlaceNap && (
                  <a href={enlaceNap} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a la NAP de la orden ${ticket.codigo || ticket.id}`} title="Cómo llegar a la NAP" className="flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 text-xs font-bold hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors">
                    <Network className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">NAP</span>
                  </a>
                )}
                <TelefonoAccion telefono={ticket.telefono} tipo="llamar" nombre={ticket.nombre} className="flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" />
                <TelefonoAccion telefono={ticket.telefono} tipo="chat" nombre={ticket.nombre} className="flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors" />
              </div>
            )}
            <div className="flex items-start gap-2 text-sm">
              <Wrench className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className={`self-start text-[10px] font-black px-1.5 py-0.5 rounded mb-0.5 ${getTipoTrabajoEstilo(ticket.tipoTrabajo || 'AVERÍA').badge}`}>{ticket.tipoTrabajo || 'AVERÍA'}</span>
                {/* Sin falla, la orden guarda el tipo de trabajo como falla: no se repite. */}
                {ticket.falla && ticket.falla !== ticket.tipoTrabajo && (
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium leading-tight">{ticket.falla}</span>
                )}
              </div>
            </div>
            {ticket.observacion && (
              <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30 text-xs text-zinc-800 dark:text-zinc-300 mt-1">
                <span className="font-bold text-red-700 dark:text-red-400">Obs:</span> {ticket.observacion}
              </div>
            )}
            {!isTecnico && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => onToggleAsignado(ticket)}
                  disabled={!canEditTickets || ticket.estado === 'ELIMINADO'}
                  aria-pressed={envio.enviado}
                  aria-label={`Orden ${ticket.codigo || ticket.id}: ${envio.detalle}`}
                  title={envio.detalle}
                  className="inline-flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 disabled:cursor-not-allowed"
                >
                  <span className={`p-1.5 rounded-full transition-colors ${
                    envio.cambioTrasEnvio ? 'bg-amber-500 text-black'
                      : envio.enviado ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {envio.cambioTrasEnvio ? <TriangleAlert className="w-3.5 h-3.5" aria-hidden="true" /> : envio.enviado ? <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" /> : <Send className="w-3.5 h-3.5" aria-hidden="true" />}
                  </span>
                  {envio.cambioTrasEnvio
                    ? <span className="font-black text-amber-600 dark:text-amber-400">Enviado · cambió, reenviar</span>
                    : envio.enviado
                      ? <span className="font-black text-emerald-600 dark:text-emerald-400">Enviado</span>
                      : <span>Marcar como enviado</span>}
                </button>
              </div>
            )}
          </div>
          {/* El técnico solo ve sus propias órdenes: repetir su nombre (y el creador,
              que no le sirve) en cada tarjeta solo gasta alto de pantalla. */}
          {!isTecnico && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs">
              <div className={`px-2.5 py-1.5 rounded font-bold ${getTecnicoColor(ticket.tecnico)}`}>
                {ticket.tecnico || 'SIN TÉCNICO'}
              </div>
              {ticket.creado && (
                <div className={`px-2 py-1 rounded text-[10px] font-bold ${getCreadoColor(ticket.creado)}`}>
                  {ticket.creado}
                </div>
              )}
            </div>
          )}

          {ticket.estado !== 'ELIMINADO' ? (
            isTecnico ? (
              <div className="bg-zinc-100 dark:bg-zinc-800 flex divide-x divide-zinc-200 dark:divide-zinc-700 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => onCopyWhatsApp(ticket)} aria-label="Copiar plantilla de WhatsApp" title="Copiar plantilla de WhatsApp" className="flex-1 py-3 flex items-center justify-center gap-1 text-green-700 dark:text-green-500 font-bold hover:bg-green-50 dark:hover:bg-green-900/20 text-sm transition-colors">
                  <ClipboardCopy className="w-4 h-4" /> Plantilla
                </button>
                {ticket.estado === 'PENDIENTE' ? (
                  <button onClick={() => onPreFinalizar(ticket)} className="flex-1 py-3 flex items-center justify-center gap-1.5 text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15 hover:bg-amber-200 dark:hover:bg-amber-500/25 font-bold text-sm transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Pre-finalizar
                  </button>
                ) : ticket.estado === 'PRE-FINALIZADO' || ticket.estado === 'PRE-FINALIZADA' ? (
                  <div className="flex-1 py-3 flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-sm">
                    <Clock className="w-4 h-4" /> En espera
                  </div>
                ) : null}
                <button onClick={() => onEdit(ticket)} className="flex-1 py-3 flex items-center justify-center gap-1 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm transition-colors">
                  <Edit className="w-4 h-4" /> Detalles
                </button>
              </div>
            ) : (
              <div className="bg-zinc-100 dark:bg-zinc-800 flex divide-x divide-zinc-200 dark:divide-zinc-700 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => onCopyWhatsApp(ticket)} className="flex-1 py-3 flex items-center justify-center gap-1 text-green-700 dark:text-green-500 font-bold hover:bg-green-50 dark:hover:bg-green-900/20 text-sm transition-colors"><ClipboardCopy className="w-4 h-4" /> Plantilla</button>
                {canEditTickets ? (
                  <>
                    {ticket.estado === 'PENDIENTE' && (
                      <button onClick={() => onFinalizar(ticket)} className="flex-1 py-3 flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-sm transition-colors">
                        <CheckCircle2 className="w-4 h-4" /> Finalizar
                      </button>
                    )}
                    {(ticket.estado === 'PRE-FINALIZADO' || ticket.estado === 'PRE-FINALIZADA') && (
                      <button onClick={() => onAprobarFinalizar(ticket)} className="flex-1 py-3 flex items-center justify-center gap-1 text-blue-700 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm transition-colors">
                        <CheckCheck className="w-4 h-4" /> Aprobar
                      </button>
                    )}
                    <button onClick={() => onEdit(ticket)} className="flex-1 py-3 flex items-center justify-center gap-1 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm transition-colors"><Edit className="w-4 h-4" /> Editar</button>
                    <button onClick={() => onDelete(ticket.id)} className="flex-1 py-3 flex items-center justify-center gap-1 text-red-600 dark:text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 text-sm transition-colors"><Trash2 className="w-4 h-4" /> Eliminar</button>
                  </>
                ) : (
                  <div className="flex-1 py-3 text-center text-xs text-zinc-500 font-medium">Solo visualización</div>
                )}
              </div>
            )
          ) : (
            <div className="bg-zinc-900 dark:bg-black text-white p-2 text-xs text-center font-medium border-t border-zinc-800">
              Log: Eliminado por <span className="font-bold text-red-400">{ticket.eliminadoPor}</span> el {ticket.fechaEliminacion}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
