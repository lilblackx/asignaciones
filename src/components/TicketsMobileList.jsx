import { observacionParaTecnico } from '../utils/observacion';
import { Fragment } from 'react';
import { esProgramadaFutura } from '../utils/programada';
import { esCerrada, fechaCierreTexto } from '../utils/ordenesCerradas';
import { Ban, Banknote, Calendar, Camera, CheckCheck, CheckCircle2, ClipboardCopy, Clock, Edit, ExternalLink, HardHat, MapPin, MapPinOff, MessageSquareText, Navigation, Network, Wrench } from 'lucide-react';
import { getEnlaceLlamada, getEnlaceWhatsApp, parseTelefonos } from '../utils/telefono';
import TelefonoAccion from './TelefonoAccion';
import DevolucionAviso from './DevolucionAviso';
import ConsultaCobroAviso from './ConsultaCobroAviso';
import InfraestructuraAviso from './InfraestructuraAviso';
import CancelacionAviso from './CancelacionAviso';
import AvisoRevision from './AvisoRevision';
import CobroAviso from './CobroAviso';
import PagoDelCliente from './PagoDelCliente';
import { BotonPrioridad, InsigniaPrioridad } from './PrioridadControl';
import InsigniaVentaTecnico from './InsigniaVentaTecnico';
import InsigniaGarantia from './InsigniaGarantia';
import BotonVerDetalle from './BotonVerDetalle';
import CodigoOrden from './CodigoOrden';
import NombreTecnico from './NombreTecnico';
import ViajeControl, { EtiquetaViaje } from './ViajeControl';
import { ESTADO_EN_SITIO, estadoViaje } from '../utils/enCamino';
import { esPrioritaria, puedeCambiarPrioridad } from '../utils/prioridad';
import { enInfraestructura, puedeEscalar } from '../utils/infraestructura';
import { TEXTO_SIN_PLANTILLA, ordenSinPlantilla } from '../utils/whatsapp';
import { PENDIENTE_PAGO, pendienteDelTecnico, puedeCorregirDetalles } from '../utils/detallesOrden';
import FaltaPorCompletar from './FaltaPorCompletar';
import { getEnlaceNavegacion, getEnlaceNavegacionNap, instalacionSinUbicacion } from '../utils/ubicacion';
import { formatCedula, getEstadoPastel, getFechaStyles, getTipoTrabajoEstilo, renderProgramadaBadge } from '../utils/ticketDisplay';
import { buildSmartOltUrl } from '../utils/smartolt';

export default function TicketsMobileList({
  filteredTickets,
  canEditTickets,
  isTecnico = false,
  hasAnyTickets = true,
  getTecnicoColor,
  onEdit,
  onCancelar,
  onCopyWhatsApp,
  onCopiarMensajeCliente,
  onPegarUbicacion,
  onVerDetalle,
  onPreFinalizar,
  conBorrador,
  onRegistrarPago,
  onCorregirFotos,
  onAprobarFinalizar,
  onResponderCobro,
  onEscalar,
  onResolverInfra,
  revisando,
  onFinalizar,
  onTogglePrioridad,
  ahora,
  cerradasEnBusqueda = 0,
  onIniciarViaje,
  onLlegue,
  onCancelarViaje
}) {
  if (filteredTickets.length === 0) {
    return (
      <div className="lg:hidden bg-card rounded-card shadow-card px-4 py-12 text-center text-muted-foreground font-medium transition-colors">
        {isTecnico && !hasAnyTickets ? (
          <div className="flex flex-col items-center gap-2">
            <Wrench className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
            <span>No tienes asignaciones en este momento.</span>
            <span className="text-xs text-muted-foreground">Cuando te asignen una orden, aparecerá aquí.</span>
          </div>
        ) : isTecnico ? (
          'Ninguna de tus asignaciones coincide con los filtros. Quítalos para ver todas.'
        ) : (
          'Ninguna orden activa coincide con los filtros. Quítalos para ver todas, o crea una con Nuevo.'
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:hidden">
      {filteredTickets.map((ticket, index) => {
        const hayTelefono = parseTelefonos(ticket.telefono).some(t => getEnlaceLlamada(t) || getEnlaceWhatsApp(t));
        const enlaceUbicacion = getEnlaceNavegacion(ticket.ubicacion);
        const enlaceNap = getEnlaceNavegacionNap(ticket.napCoordenadas);
        const prioritaria = esPrioritaria(ticket);
        const sinPlantilla = ordenSinPlantilla(ticket);
        const viaje = estadoViaje(ticket, ahora);
        // Si la búsqueda trae órdenes ya cerradas, van al final bajo su propio encabezado.
        const cerrada = cerradasEnBusqueda > 0 && esCerrada(ticket);
        const archivada = Boolean(ticket._archivada);
        const primeraCerrada = cerrada && !(index > 0 && esCerrada(filteredTickets[index - 1]));
        return (
        <Fragment key={ticket._clave || ticket.id}>
        {primeraCerrada && (
          <h2 className="mt-2 px-3 py-2 rounded-campo bg-zinc-700 dark:bg-zinc-800 text-white text-xs font-black">FINALIZADAS Y CANCELADAS ({cerradasEnBusqueda})</h2>
        )}
        <div className={`bg-card rounded-card shadow-card border overflow-hidden flex flex-col transition-colors ${cerrada ? (ticket.estado === 'CANCELADO' ? 'border-red-700/60 dark:border-red-800/60' : 'border-emerald-700/60 dark:border-emerald-800/60') : prioritaria ? 'border-red-500 dark:border-red-500/80 ring-2 ring-red-500/40' : viaje ? (viaje === ESTADO_EN_SITIO ? 'border-teal-500 dark:border-teal-500/70' : 'border-sky-500 dark:border-sky-500/70') : ticket.estado === 'CANCELADO' ? 'border-red-500/40 dark:border-red-900/40' : ticket.estado === 'PRE-FINALIZADO' || ticket.estado === 'PRE-FINALIZADA' ? 'border-amber-400/60 dark:border-amber-600/40' : 'border-transparent'} ${esProgramadaFutura(ticket) ? 'opacity-60 hover:opacity-100' : ''}`}>
          <div className={`p-5 pb-1 flex justify-between items-start sm:items-center ${cerrada ? 'bg-muted' : ''}`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <CodigoOrden ticket={ticket} onCopiar={onCopiarMensajeCliente} vacio="S/C" className="font-black text-lg text-foreground leading-none" />
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
            <div className="self-center flex flex-col items-end gap-0.5">
              <span className={`text-xs font-black px-3 py-1 rounded-full ${getEstadoPastel(ticket.estado)}`}>
                {ticket.estado}
              </span>
              {isTecnico && <FaltaPorCompletar ticket={ticket} />}
              {cerrada && (
                <span className="text-xs font-medium text-muted-foreground leading-tight">
                  {fechaCierreTexto(ticket)}{archivada && ' · Archivada'}
                </span>
              )}
            </div>
          </div>
          <div className="px-5 pb-5 pt-2 flex-1 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg font-black text-foreground leading-tight min-w-0 break-words">{ticket.nombre}</h3>
                {canEditTickets && onVerDetalle && <BotonVerDetalle ticket={ticket} onClick={onVerDetalle} />}
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                C.I: {ticket.cedula && !isTecnico ? (
                  <a
                    href={buildSmartOltUrl(ticket.cedula, ticket.tipoDocumento)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Buscar cliente en SmartOLT"
                    aria-label={`Buscar cédula ${ticket.cedula} en SmartOLT`}
                    className="inline-flex items-center gap-1 min-h-11 min-w-11 text-sky-700 dark:text-sky-400 underline decoration-dotted underline-offset-2 hover:decoration-solid"
                  >
                    {formatCedula(ticket.cedula, ticket.tipoDocumento)}
                    <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </a>
                ) : formatCedula(ticket.cedula, ticket.tipoDocumento)}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="shrink-0 w-9 h-9 rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400 flex items-center justify-center"><MapPin className="w-4 h-4" aria-hidden="true" /></span>
              <span className="text-card-foreground leading-tight">{ticket.direccion}</span>
            </div>
            {instalacionSinUbicacion(ticket) && (
              canEditTickets ? (
                <button type="button" onClick={() => onPegarUbicacion(ticket)} className="self-start inline-flex items-center gap-1.5 min-h-11 text-xs font-bold px-3 py-1.5 rounded-boton bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">
                  <MapPinOff className="w-4 h-4" aria-hidden="true" /> Sin ubicación · pegar
                </button>
              ) : (
                <span className="self-start inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-boton bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                  <MapPinOff className="w-4 h-4" aria-hidden="true" /> Sin ubicación todavía
                </span>
              )
            )}
            {(hayTelefono || enlaceUbicacion || enlaceNap) && (
              // Una sola fila (los que existan se reparten el ancho); texto corto y
              // aria-label completo para no gastar dos filas de alto por tarjeta.
              <div className="flex gap-2">
                {enlaceUbicacion && (
                  <a href={enlaceUbicacion} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a la orden ${ticket.codigo || ticket.id}`} title="Cómo llegar" className="flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 rounded-campo bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 text-xs font-bold hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors">
                    <Navigation className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">Llegar</span>
                  </a>
                )}
                {enlaceNap && (
                  <a href={enlaceNap} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a la NAP de la orden ${ticket.codigo || ticket.id}`} title="Cómo llegar a la NAP" className="flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 rounded-campo bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 text-xs font-bold hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors">
                    <Network className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">NAP</span>
                  </a>
                )}
                <TelefonoAccion telefono={ticket.telefono} tipo="llamar" nombre={ticket.nombre} className="flex-1 min-w-0 flex items-center justify-center gap-1 min-h-11 py-2.5 rounded-campo bg-secondary text-secondary-foreground text-xs font-bold hover:bg-accent transition-colors" />
                <TelefonoAccion telefono={ticket.telefono} tipo="chat" nombre={ticket.nombre} className="flex-1 min-w-0 flex items-center justify-center gap-1 min-h-11 py-2.5 rounded-campo bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors" />
              </div>
            )}
            <div className="flex items-start gap-3 text-sm">
              <span className="shrink-0 w-9 h-9 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><Wrench className="w-4 h-4" aria-hidden="true" /></span>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-1 mb-0.5">
                  <span className={`text-[11px] max-lg:text-xs font-black px-1.5 py-0.5 rounded ${getTipoTrabajoEstilo(ticket.tipoTrabajo || 'AVERÍA').badge}`}>{ticket.tipoTrabajo || 'AVERÍA'}</span>
                  <InsigniaVentaTecnico ticket={ticket} paraTecnico={isTecnico} />
                      {!isTecnico && <InsigniaGarantia ticket={ticket} />}
                </div>
                {/* Sin falla, la orden guarda el tipo de trabajo como falla: no se repite. */}
                {ticket.falla && ticket.falla !== ticket.tipoTrabajo && (
                  <span className="text-card-foreground font-medium leading-tight">{ticket.falla}</span>
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
              <button type="button" onClick={() => onEscalar(ticket)} className="self-start inline-flex items-center gap-1.5 min-h-11 text-xs font-bold px-3 py-1.5 rounded-boton bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors">
                <HardHat className="w-4 h-4" aria-hidden="true" /> Escalar a infraestructura
              </button>
            )}
            {(isTecnico ? observacionParaTecnico(ticket) : ticket.observacion) && (
              <div className="flex items-start gap-2 text-sm">
                <MessageSquareText className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" aria-label="Observación" role="img" />
                <span className="text-card-foreground leading-tight">{isTecnico ? observacionParaTecnico(ticket) : ticket.observacion}</span>
              </div>
            )}
            {ticket.observacionTecnico && (
              <div className="flex items-start gap-2 text-sm">
                <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-label="Observación del técnico" role="img" />
                <span className="text-amber-800 dark:text-amber-300 leading-tight">{ticket.observacionTecnico}</span>
              </div>
            )}
            <PagoDelCliente orden={ticket} tamano="grande" avisarFalta />
          </div>
          {/* El técnico solo ve sus propias órdenes: repetir su nombre (y el creador,
              que no le sirve) en cada tarjeta solo gasta alto de pantalla. */}
          {!isTecnico && (
            <div className="p-3 border-t border-border flex justify-between items-center text-xs">
              <div className="flex flex-col items-start gap-1">
                {ticket.tecnico
                  ? <NombreTecnico nombre={ticket.tecnico} getTecnicoColor={getTecnicoColor} className="text-sm" />
                  : <span className="text-sm font-bold text-muted-foreground">Sin técnico</span>}
                <EtiquetaViaje ticket={ticket} ahora={ahora} />
              </div>
              {ticket.creado && (
                <div className="text-xs font-bold text-muted-foreground">
                  Creó {ticket.creado}
                </div>
              )}
            </div>
          )}

          {/* Arriba de la barra de acciones del técnico, al alcance del pulgar. */}
          {isTecnico && ticket.estado === 'PENDIENTE' && (
            <div className="px-5 pb-4">
              <ViajeControl ticket={ticket} ahora={ahora} onIniciar={onIniciarViaje} onLlegue={onLlegue} onCancelar={onCancelarViaje} />
            </div>
          )}

          {archivada ? (
              <div className="py-3 text-center text-xs text-muted-foreground font-medium bg-muted border-t border-border">Archivada por el cierre del día · solo consulta</div>
            ) : isTecnico ? (
              <div className="flex gap-2 px-5 py-4 border-t border-border">
                <button onClick={() => onCopyWhatsApp(ticket)} disabled={sinPlantilla} aria-label={sinPlantilla ? 'Copiar plantilla de WhatsApp: no disponible, falta la plantilla de la promotora' : 'Copiar plantilla de WhatsApp'} title={sinPlantilla ? TEXTO_SIN_PLANTILLA : 'Copiar plantilla de WhatsApp'} className="flex-1 max-[374px]:flex-auto min-w-0 py-3 px-1 min-h-11 rounded-boton bg-secondary flex items-center justify-center gap-1 text-green-800 dark:text-green-500 font-bold hover:bg-green-50 dark:hover:bg-green-900/20 text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                  <ClipboardCopy className="w-4 h-4" /> {sinPlantilla ? 'Sin plantilla' : 'Plantilla'}
                </button>
                {ticket.estado === 'PENDIENTE' ? (
                  <button onClick={() => onPreFinalizar(ticket)} className="flex-1 max-[374px]:flex-auto min-w-0 py-3 px-1 min-h-11 rounded-boton flex items-center justify-center gap-1.5 text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15 hover:bg-amber-200 dark:hover:bg-amber-500/25 font-bold text-[13px] transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> {conBorrador?.has(String(ticket.id)) ? 'Continuar borrador' : 'Pre-finalizar'}
                  </button>
                ) : onRegistrarPago && pendienteDelTecnico(ticket) ? (
                  <button onClick={() => onRegistrarPago(ticket.id)} className="flex-1 max-[374px]:flex-auto min-w-0 py-3 px-1 min-h-11 rounded-boton flex items-center justify-center gap-1.5 text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/15 hover:bg-emerald-200 dark:hover:bg-emerald-500/25 font-bold text-[13px] transition-colors">
                    {pendienteDelTecnico(ticket) === PENDIENTE_PAGO ? <><Banknote className="w-4 h-4" aria-hidden="true" /> Registrar el pago</> : <><Camera className="w-4 h-4" aria-hidden="true" /> Subir detalles</>}
                  </button>
                ) : ticket.estado === 'PRE-FINALIZADO' || ticket.estado === 'PRE-FINALIZADA' ? (
                  <div className="flex-1 max-[374px]:flex-auto min-w-0 py-3 px-1 min-h-11 rounded-boton bg-secondary flex items-center justify-center gap-1.5 text-amber-800 dark:text-amber-400 font-bold text-sm">
                    <Clock className="w-4 h-4" /> En espera
                  </div>
                ) : onCorregirFotos && puedeCorregirDetalles(ticket) ? (
                  <button onClick={() => onCorregirFotos(ticket)} className="flex-1 max-[374px]:flex-auto min-w-0 py-3 px-1 min-h-11 rounded-boton bg-secondary flex items-center justify-center gap-1.5 text-foreground font-bold text-[13px] hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors">
                    <Camera className="w-4 h-4" aria-hidden="true" /> Corregir fotos
                  </button>
                ) : null}
                {/* Escalar a infraestructura desde el técnico: desactivado por ahora (solo la oficina escala). Para reactivarlo, quitar este
                    comentario, pasar onEscalar también al técnico en App.jsx y volver a permitir la clave 'infraestructura' en las reglas.
                {onEscalar && puedeEscalar(ticket) && (
                  <button onClick={() => onEscalar(ticket)} aria-label={`Escalar la orden ${ticket.codigo || ticket.id} a infraestructura`} className="flex-1 max-[374px]:flex-auto min-w-0 py-3 px-1 min-h-11 rounded-boton bg-secondary flex items-center justify-center gap-1 text-orange-700 dark:text-orange-400 font-bold hover:bg-orange-50 dark:hover:bg-orange-900/20 text-[13px] transition-colors">
                    <HardHat className="w-4 h-4" /> Escalar
                  </button>
                )}
                */}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-border">
                <button onClick={() => onCopyWhatsApp(ticket)} disabled={sinPlantilla} title={sinPlantilla ? TEXTO_SIN_PLANTILLA : undefined} className="flex-1 basis-[calc(50%-0.25rem)] min-w-0 py-3 px-1 min-h-11 rounded-boton bg-secondary flex items-center justify-center gap-1 text-green-800 dark:text-green-500 font-bold hover:bg-green-50 dark:hover:bg-green-900/20 text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"><ClipboardCopy className="w-4 h-4" /> {sinPlantilla ? 'Sin plantilla' : 'Plantilla'}</button>
                {canEditTickets ? (
                  <>
                    {ticket.estado === 'PENDIENTE' && !enInfraestructura(ticket) && (
                      <button onClick={() => onFinalizar(ticket)} className="flex-1 basis-[calc(50%-0.25rem)] min-w-0 py-3 px-1 min-h-11 rounded-boton bg-secondary flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-[13px] transition-colors">
                        <CheckCircle2 className="w-4 h-4" /> Finalizar
                      </button>
                    )}
                    {(ticket.estado === 'PRE-FINALIZADO' || ticket.estado === 'PRE-FINALIZADA') && (
                      <button onClick={() => onAprobarFinalizar(ticket)} className="flex-1 basis-[calc(50%-0.25rem)] min-w-0 py-3 px-1 min-h-11 rounded-boton bg-secondary flex items-center justify-center gap-1 text-blue-700 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[13px] transition-colors">
                        <CheckCheck className="w-4 h-4" /> Aprobar
                      </button>
                    )}
                    <button onClick={() => onEdit(ticket)} className="flex-1 basis-[calc(50%-0.25rem)] min-w-0 py-3 px-1 min-h-11 rounded-boton bg-secondary flex items-center justify-center gap-1 text-card-foreground font-bold hover:bg-accent text-[13px] transition-colors"><Edit className="w-4 h-4" /> Editar</button>
                    {ticket.estado !== 'CANCELADO' && <button onClick={() => onCancelar(ticket)} className="flex-1 basis-[calc(50%-0.25rem)] min-w-0 py-3 px-1 min-h-11 rounded-boton bg-secondary flex items-center justify-center gap-1 text-red-700 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 text-[13px] transition-colors"><Ban className="w-4 h-4" /> Cancelar</button>}
                  </>
                ) : (
                  <div className="flex-1 py-3 text-center text-xs text-muted-foreground font-medium">Solo visualización</div>
                )}
              </div>
            )}
        </div>
        </Fragment>
        );
      })}
    </div>
  );
}
