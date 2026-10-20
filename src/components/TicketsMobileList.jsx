import { esProgramadaFutura } from '../utils/programada';
import { Ban, Calendar, CheckCheck, CheckCircle2, ClipboardCopy, Clock, Edit, ExternalLink, HardHat, MapPin, MapPinOff, MessageSquareText, Navigation, Network, Send, TriangleAlert, Wrench } from 'lucide-react';
import { getEnlaceLlamada, getEnlaceWhatsApp, parseTelefonos } from '../utils/telefono';
import TelefonoAccion from './TelefonoAccion';
import DevolucionAviso from './DevolucionAviso';
import ConsultaCobroAviso from './ConsultaCobroAviso';
import InfraestructuraAviso from './InfraestructuraAviso';
import CancelacionAviso from './CancelacionAviso';
import AvisoRevision from './AvisoRevision';
import CobroAviso from './CobroAviso';
import { BotonPrioridad, InsigniaPrioridad } from './PrioridadControl';
import InsigniaVentaTecnico from './InsigniaVentaTecnico';
import BotonVerDetalle from './BotonVerDetalle';
import ViajeControl, { EtiquetaViaje } from './ViajeControl';
import { ESTADO_EN_SITIO, estadoViaje } from '../utils/enCamino';
import { esPrioritaria, puedeCambiarPrioridad } from '../utils/prioridad';
import { enInfraestructura, puedeEscalar } from '../utils/infraestructura';
import { TEXTO_SIN_PLANTILLA, ordenSinPlantilla } from '../utils/whatsapp';
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
  onCancelar,
  onCopyWhatsApp,
  onPegarUbicacion,
  onVerDetalle,
  onPreFinalizar,
  onAprobarFinalizar,
  onResponderCobro,
  onEscalar,
  onResolverInfra,
  revisando,
  onFinalizar,
  onTogglePrioridad,
  ahora,
  onIniciarViaje,
  onLlegue,
  onCancelarViaje
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
        const prioritaria = esPrioritaria(ticket);
        const sinPlantilla = ordenSinPlantilla(ticket);
        const viaje = estadoViaje(ticket, ahora);
        return (
        <div key={ticket.id} className={`bg-white dark:bg-zinc-900 rounded-xl shadow-md dark:shadow-sm border overflow-hidden flex flex-col transition-colors ${prioritaria ? 'border-red-500 dark:border-red-500/80 ring-2 ring-red-500/40' : viaje ? (viaje === ESTADO_EN_SITIO ? 'border-teal-500 dark:border-teal-500/70' : 'border-sky-500 dark:border-sky-500/70') : ticket.estado === 'CANCELADO' ? 'border-red-500/40 dark:border-red-900/40' : ticket.estado === 'PRE-FINALIZADO' || ticket.estado === 'PRE-FINALIZADA' ? 'border-amber-400/60 dark:border-amber-600/40' : 'border-zinc-300 dark:border-zinc-800'} ${esProgramadaFutura(ticket) ? 'opacity-60 hover:opacity-100' : ''}`}>
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-start sm:items-center bg-zinc-50 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-zinc-900 dark:text-white leading-none">{ticket.codigo || 'S/C'}</span>
                {canEditTickets && puedeCambiarPrioridad(ticket) && (
                  <BotonPrioridad activa={Boolean(ticket.prioridadAlta)} codigo={ticket.codigo} onClick={() => onTogglePrioridad(ticket)} />
                )}
                {/* El aviso "PRIORIDAD ALTA" es para el técnico; la oficina ya la ve con la bandera y el separador de grupo. */}
                {prioritaria && isTecnico && <InsigniaPrioridad />}
              </div>
              <div className="flex flex-col">
                <span className={`text-xs font-bold flex items-center gap-1 ${getFechaStyles(ticket.fecha, ticket.estado)}`}><Calendar className="w-3.5 h-3.5" /> {ticket.fecha}</span>
                {ticket.estado === 'PENDIENTE' && renderProgramadaBadge(ticket.fechaProgramada, ticket.tecnico)}
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getEstadoColor(ticket.estado)}`}>
              {ticket.estado}
            </span>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-zinc-900 dark:text-white leading-tight min-w-0 break-words">{ticket.nombre}</h3>
                {canEditTickets && onVerDetalle && <BotonVerDetalle ticket={ticket} onClick={onVerDetalle} />}
              </div>
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
            {(hayTelefono || enlaceUbicacion || enlaceNap) && (
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
                <div className="flex flex-wrap items-center gap-1 mb-0.5">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${getTipoTrabajoEstilo(ticket.tipoTrabajo || 'AVERÍA').badge}`}>{ticket.tipoTrabajo || 'AVERÍA'}</span>
                  <InsigniaVentaTecnico ticket={ticket} paraTecnico={isTecnico} />
                </div>
                {/* Sin falla, la orden guarda el tipo de trabajo como falla: no se repite. */}
                {ticket.falla && ticket.falla !== ticket.tipoTrabajo && (
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium leading-tight">{ticket.falla}</span>
                )}
              </div>
            </div>
            <AvisoRevision nombres={revisando?.get(ticket.id)} compact />
            <DevolucionAviso ticket={ticket} />
            <CancelacionAviso ticket={ticket} />
            <CobroAviso ticket={ticket} />
            <ConsultaCobroAviso ticket={ticket} onResponder={onResponderCobro} />
            <InfraestructuraAviso ticket={ticket} onResolver={canEditTickets ? onResolverInfra : undefined} />
            {canEditTickets && onEscalar && puedeEscalar(ticket) && (
              <button type="button" onClick={() => onEscalar(ticket)} className="self-start inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors">
                <HardHat className="w-4 h-4" aria-hidden="true" /> Escalar a infraestructura
              </button>
            )}
            {ticket.observacion && (
              <div className="flex items-start gap-2 text-sm">
                <MessageSquareText className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" aria-label="Observación" role="img" />
                <span className="text-zinc-700 dark:text-zinc-300 leading-tight">{ticket.observacion}</span>
              </div>
            )}
            {ticket.observacionTecnico && (
              <div className="flex items-start gap-2 text-sm">
                <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-label="Observación del técnico" role="img" />
                <span className="text-amber-800 dark:text-amber-300 leading-tight">{ticket.observacionTecnico}</span>
              </div>
            )}
            {!isTecnico && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => onToggleAsignado(ticket)}
                  disabled={!canEditTickets}
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
              <div className="flex flex-col items-start gap-1">
                <div className={`px-2.5 py-1.5 rounded font-bold ${getTecnicoColor(ticket.tecnico)}`}>
                  {ticket.tecnico || 'SIN TÉCNICO'}
                </div>
                <EtiquetaViaje ticket={ticket} ahora={ahora} />
              </div>
              {ticket.creado && (
                <div className={`px-2 py-1 rounded text-[10px] font-bold ${getCreadoColor(ticket.creado)}`}>
                  {ticket.creado}
                </div>
              )}
            </div>
          )}

          {/* Arriba de la barra de acciones del técnico, al alcance del pulgar. */}
          {isTecnico && ticket.estado === 'PENDIENTE' && (
            <div className="px-4 pb-3">
              <ViajeControl ticket={ticket} ahora={ahora} onIniciar={onIniciarViaje} onLlegue={onLlegue} onCancelar={onCancelarViaje} />
            </div>
          )}

            isTecnico ? (
              <div className="bg-zinc-100 dark:bg-zinc-800 flex divide-x divide-zinc-200 dark:divide-zinc-700 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => onCopyWhatsApp(ticket)} disabled={sinPlantilla} aria-label={sinPlantilla ? 'Copiar plantilla de WhatsApp: no disponible, falta la plantilla de la promotora' : 'Copiar plantilla de WhatsApp'} title={sinPlantilla ? TEXTO_SIN_PLANTILLA : 'Copiar plantilla de WhatsApp'} className="flex-1 max-[374px]:flex-auto min-w-0 py-3 px-1 flex items-center justify-center gap-1 text-green-700 dark:text-green-500 font-bold hover:bg-green-50 dark:hover:bg-green-900/20 text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                  <ClipboardCopy className="w-4 h-4" /> {sinPlantilla ? 'Sin plantilla' : 'Plantilla'}
                </button>
                {ticket.estado === 'PENDIENTE' ? (
                  <button onClick={() => onPreFinalizar(ticket)} className="flex-1 max-[374px]:flex-auto min-w-0 py-3 px-1 flex items-center justify-center gap-1.5 text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15 hover:bg-amber-200 dark:hover:bg-amber-500/25 font-bold text-[13px] transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Pre-finalizar
                  </button>
                ) : ticket.estado === 'PRE-FINALIZADO' || ticket.estado === 'PRE-FINALIZADA' ? (
                  <div className="flex-1 max-[374px]:flex-auto min-w-0 py-3 px-1 flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-sm">
                    <Clock className="w-4 h-4" /> En espera
                  </div>
                ) : null}
                {/* Escalar a infraestructura desde el técnico: desactivado por ahora (solo la oficina escala). Para reactivarlo, quitar este
                    comentario, pasar onEscalar también al técnico en App.jsx y volver a permitir la clave 'infraestructura' en las reglas.
                {onEscalar && puedeEscalar(ticket) && (
                  <button onClick={() => onEscalar(ticket)} aria-label={`Escalar la orden ${ticket.codigo || ticket.id} a infraestructura`} className="flex-1 max-[374px]:flex-auto min-w-0 py-3 px-1 flex items-center justify-center gap-1 text-orange-700 dark:text-orange-400 font-bold hover:bg-orange-50 dark:hover:bg-orange-900/20 text-[13px] transition-colors">
                    <HardHat className="w-4 h-4" /> Escalar
                  </button>
                )}
                */}
              </div>
            ) : (
              <div className="bg-zinc-100 dark:bg-zinc-800 flex divide-x divide-zinc-200 dark:divide-zinc-700 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => onCopyWhatsApp(ticket)} disabled={sinPlantilla} title={sinPlantilla ? TEXTO_SIN_PLANTILLA : undefined} className="flex-1 min-w-0 py-3 px-1 flex items-center justify-center gap-1 text-green-700 dark:text-green-500 font-bold hover:bg-green-50 dark:hover:bg-green-900/20 text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"><ClipboardCopy className="w-4 h-4" /> {sinPlantilla ? 'Sin plantilla' : 'Plantilla'}</button>
                {canEditTickets ? (
                  <>
                    {ticket.estado === 'PENDIENTE' && !enInfraestructura(ticket) && (
                      <button onClick={() => onFinalizar(ticket)} className="flex-1 min-w-0 py-3 px-1 flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-[13px] transition-colors">
                        <CheckCircle2 className="w-4 h-4" /> Finalizar
                      </button>
                    )}
                    {(ticket.estado === 'PRE-FINALIZADO' || ticket.estado === 'PRE-FINALIZADA') && (
                      <button onClick={() => onAprobarFinalizar(ticket)} className="flex-1 min-w-0 py-3 px-1 flex items-center justify-center gap-1 text-blue-700 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[13px] transition-colors">
                        <CheckCheck className="w-4 h-4" /> Aprobar
                      </button>
                    )}
                    <button onClick={() => onEdit(ticket)} className="flex-1 min-w-0 py-3 px-1 flex items-center justify-center gap-1 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[13px] transition-colors"><Edit className="w-4 h-4" /> Editar</button>
                    {ticket.estado !== 'CANCELADO' && <button onClick={() => onCancelar(ticket)} className="flex-1 min-w-0 py-3 px-1 flex items-center justify-center gap-1 text-red-600 dark:text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 text-[13px] transition-colors"><Ban className="w-4 h-4" /> Cancelar</button>}
                  </>
                ) : (
                  <div className="flex-1 py-3 text-center text-xs text-zinc-500 font-medium">Solo visualización</div>
                )}
              </div>
            )
        </div>
        );
      })}
    </div>
  );
}
