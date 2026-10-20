import { ArrowDownAZ, Ban, CheckCheck, ClipboardCheck, Clock, Edit, ExternalLink, Flag, HardHat, History, MapPin, MapPinOff, MessageCircle, MessageSquareText, Navigation, Wrench } from 'lucide-react';
// Para reactivar la columna ENVIADO: volver a importar Send, TriangleAlert y getEnvioInfo, y a recibir onToggleAsignado.
import { getEnlaceNavegacion, instalacionSinUbicacion } from '../utils/ubicacion';
import { formatCedula, getEstadoColor, getEtiquetaDia, getTipoTrabajoEstilo, renderCedulaConSaltos, renderProgramadaBadge } from '../utils/ticketDisplay';
import { buildSmartOltUrl } from '../utils/smartolt';
import { esProgramadaFutura } from '../utils/programada';
import RowMenu from './RowMenu';
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
import { estadoViaje } from '../utils/enCamino';
import { esPrioritaria, puedeCambiarPrioridad } from '../utils/prioridad';
import { TEXTO_SIN_PLANTILLA, ordenSinPlantilla } from '../utils/whatsapp';
import { enInfraestructura, puedeEscalar } from '../utils/infraestructura';

const COLUMNAS = 8;
// Al bajar por la lista quedan a la vista el título de las columnas y el separador del grupo en que vas (PRIORIDAD ALTA, HOY...).
// Se pegan debajo del encabezado de la página (62px, sticky) y el separador debajo del título de columnas (su alto). Si cambia el
// alto de alguno de los dos, hay que ajustar estas dos cifras.
const ALTO_ENCABEZADO_PAGINA = 62;
const ALTO_TITULOS = 37;

export default function TicketsTable({
  filteredTickets,
  canEditTickets,
  isTecnico = false,
  hasAnyTickets = true,
  sortBy,
  setSortBy,
  getTecnicoColor,
  // onToggleAsignado,
  onEdit,
  onCancelar,
  onCopyWhatsApp,
  onPegarUbicacion,
  onVerHistorial,
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
  filasCambiadas,
  onIniciarViaje,
  onLlegue,
  onCancelarViaje
}) {
  // Con orden "más recientes" o por fecha las órdenes de un mismo día quedan
  // juntas: se agrupan bajo un encabezado. Con otros órdenes la fecha va en la fila.
  const agrupado = sortBy === 'DEFECTO' || sortBy === 'FECHA';

  return (
    <div className="hidden lg:block bg-white dark:bg-zinc-900 rounded-xl shadow-md dark:shadow-sm border border-zinc-300 dark:border-zinc-800 overflow-clip transition-colors w-full">
      <table className="w-full text-xs text-left table-fixed">
        <thead className="sticky z-[5] text-[10px] text-white uppercase bg-black" style={{ top: ALTO_ENCABEZADO_PAGINA }}>
          {/* La raya roja va como sombra interior de cada título: un borde de la tabla no se queda pegado al bajar. */}
          <tr className="[&>th]:shadow-[inset_0_-2px_0_0_#dc2626]">
            <th className="px-3 py-3 border-r border-zinc-800 w-[9%] min-[1440px]:w-[7%] align-middle text-center">CÓDIGO</th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[18%] align-middle text-center">NOMBRE</th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[11%] min-[1440px]:w-[9%] align-middle text-center">CÉDULA</th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[16%] min-[1440px]:w-[22%] align-middle text-center">DIRECCIÓN</th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[17%] min-[1440px]:w-[16%] align-middle text-center group cursor-pointer hover:bg-zinc-800 transition-colors" onClick={() => setSortBy(sortBy === 'TIPO_TRABAJO' ? 'DEFECTO' : 'TIPO_TRABAJO')} title="Ordenar por Tipo de Trabajo">
              {/* El título va centrado como los demás; el ícono de orden cuelga a su derecha sin correrlo. */}
              <span className="relative block w-fit mx-auto">
                FALLA / TRABAJO
                <ArrowDownAZ className={`absolute left-full top-1/2 -translate-y-1/2 ml-1 w-3 h-3 ${sortBy === 'TIPO_TRABAJO' ? 'text-red-500' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              </span>
            </th>
            <th className="px-3 py-3 border-r border-zinc-800 w-[11%] align-middle text-center">TÉCNICO</th>
            {/* Columna ENVIADO desactivada por ahora (el estado de envío sigue en isAsignado y en el Excel); ver también su celda más abajo.
            <th className="px-2 py-3 border-r border-zinc-800 w-[6%] align-middle text-center">ENVIADO</th>
            */}
            <th className="px-3 py-3 border-r border-zinc-800 w-[8%] min-[1440px]:w-[7%] align-middle text-center">ESTADO</th>
            <th className="px-2 py-3 align-middle text-center w-[10%]">ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {filteredTickets.map((ticket, index) => {
            const tipoEstilo = getTipoTrabajoEstilo(ticket.tipoTrabajo);
            // const envio = getEnvioInfo(ticket); // solo la usa la celda ENVIADO, desactivada
            const enlaceNavegacion = getEnlaceNavegacion(ticket.ubicacion);
            const prioritaria = esPrioritaria(ticket);
            const sinPlantilla = ordenSinPlantilla(ticket);
            const enViaje = Boolean(estadoViaje(ticket, ahora));
            // Las órdenes con prioridad alta forman su propio grupo arriba; el resto, un grupo por día.
            const grupoDe = (t) => (esPrioritaria(t) ? 'PRIORIDAD' : t.fecha);
            const nuevoDia = agrupado && (index === 0 || grupoDe(filteredTickets[index - 1]) !== grupoDe(ticket));
            const dia = nuevoDia ? (prioritaria ? { texto: 'PRIORIDAD ALTA', prioridad: true } : getEtiquetaDia(ticket.fecha, ticket.estado)) : null;
            return [
              nuevoDia && (
                <tr key={`dia-${ticket.id}`} className="border-b border-zinc-300 dark:border-zinc-800">
                  <td colSpan={COLUMNAS} style={{ top: ALTO_ENCABEZADO_PAGINA + ALTO_TITULOS }} className={`sticky z-[4] px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${dia.prioridad ? 'bg-red-600' : 'bg-zinc-200 dark:bg-zinc-950'} ${dia.prioridad ? 'text-white' : dia.atrasado ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    {dia.prioridad && <Flag className="inline w-3 h-3 mr-1 -mt-0.5 fill-current" aria-hidden="true" />}{dia.texto}
                  </td>
                </tr>
              ),
              <tr key={ticket.id} className={`border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors ${prioritaria ? 'bg-red-50 dark:bg-red-950/25' : enViaje ? 'bg-sky-50 dark:bg-sky-950/25' : index % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-100/70 dark:bg-zinc-900/50'} ${esProgramadaFutura(ticket) ? 'opacity-60 hover:opacity-100' : ''}${filasCambiadas?.has(ticket.id) ? ' animate-destello-fila' : ''}`}>
                <td className={`px-3 py-3 border-r border-zinc-200 dark:border-zinc-800 border-l-4 font-bold text-zinc-800 dark:text-zinc-100 whitespace-normal break-words align-middle`} title={ticket.creado ? `Creada por ${ticket.creado}` : undefined}>
                  <div className="min-h-[2rem] flex flex-col justify-center gap-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span>{ticket.codigo}</span>
                      {canEditTickets && puedeCambiarPrioridad(ticket) && (
                        <BotonPrioridad activa={Boolean(ticket.prioridadAlta)} codigo={ticket.codigo} onClick={() => onTogglePrioridad(ticket)} />
                      )}
                    </div>
                    {/* El aviso "PRIORIDAD ALTA" es para el técnico; la oficina ya la ve con la bandera y el separador de grupo. */}
                    {prioritaria && isTecnico && <InsigniaPrioridad />}
                  </div>
                </td>
                <td className="px-3 py-3 border-r border-zinc-200 dark:border-zinc-800 whitespace-normal leading-tight align-middle">
                  <div className="flex flex-col justify-center h-full min-h-[2rem] gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{ticket.nombre}</span>
                      {canEditTickets && onVerDetalle && <BotonVerDetalle ticket={ticket} onClick={onVerDetalle} />}
                    </div>
                    {!agrupado && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{ticket.fecha}</span>}
                    {ticket.estado === 'PENDIENTE' && renderProgramadaBadge(ticket.fechaProgramada, ticket.tecnico)}
                    <AvisoRevision nombres={revisando?.get(ticket.id)} compact />
                    <DevolucionAviso ticket={ticket} compact />
                    <CancelacionAviso ticket={ticket} compact />
                    <CobroAviso ticket={ticket} compact />
                    <ConsultaCobroAviso ticket={ticket} compact onResponder={onResponderCobro} />
                    <InfraestructuraAviso ticket={ticket} compact onResolver={canEditTickets ? onResolverInfra : undefined} />
                    {isTecnico && ticket.estado === 'PENDIENTE' && (
                      <ViajeControl ticket={ticket} ahora={ahora} onIniciar={onIniciarViaje} onLlegue={onLlegue} onCancelar={onCancelarViaje} compact />
                    )}
                    {ticket.observacion && (
                      <span className="flex items-start gap-1 text-[10px] text-zinc-500 dark:text-zinc-400" title={ticket.observacion}>
                        <MessageSquareText className="w-3 h-3 shrink-0 mt-px" aria-label="Observación" role="img" />
                        <span className="line-clamp-2">{ticket.observacion}</span>
                      </span>
                    )}
                    {ticket.observacionTecnico && (
                      <span className="flex items-start gap-1 text-[10px] text-amber-700 dark:text-amber-400" title={`Técnico: ${ticket.observacionTecnico}`}>
                        <Wrench className="w-3 h-3 shrink-0 mt-px" aria-label="Observación del técnico" role="img" />
                        <span className="line-clamp-2">{ticket.observacionTecnico}</span>
                      </span>
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
                        className="group inline-flex items-center gap-1 underline-offset-2 hover:underline focus-visible:underline hover:text-sky-700 dark:hover:text-sky-400 focus-visible:text-sky-700 dark:focus-visible:text-sky-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>{renderCedulaConSaltos(formatCedula(ticket.cedula, ticket.tipoDocumento))}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden="true" />
                      </a>
                    ) : renderCedulaConSaltos(formatCedula(ticket.cedula, ticket.tipoDocumento))}
                  </div>
                </td>
                <td className="px-3 py-3 border-r border-zinc-200 dark:border-zinc-800 whitespace-normal leading-tight align-middle">
                  <div className="flex items-center h-full min-h-[2rem]"><span className="line-clamp-2" title={ticket.direccion}>{ticket.direccion}</span></div>
                </td>
                <td className="px-3 py-3 border-r border-zinc-200 dark:border-zinc-800 whitespace-normal leading-tight font-medium align-middle">
                  <div className="flex flex-col items-start justify-center h-full min-h-[2rem] gap-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded ${tipoEstilo.badge}`}>{ticket.tipoTrabajo}</span>
                      <InsigniaVentaTecnico ticket={ticket} paraTecnico={isTecnico} />
                    </div>
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
                  <div className="flex flex-col items-center justify-center h-full min-h-[2rem] gap-1">
                    {ticket.tecnico && (
                      <span className={`inline-flex items-center justify-center px-2 py-1.5 text-[11px] font-bold rounded leading-none ${getTecnicoColor(ticket.tecnico)}`}>{ticket.tecnico}</span>
                    )}
                    {!isTecnico && <EtiquetaViaje ticket={ticket} ahora={ahora} />}
                  </div>
                </td>
                {/* Celda ENVIADO desactivada (ver el encabezado).
                <td className="px-2 py-3 border-r border-zinc-200 dark:border-zinc-800 text-center align-middle bg-zinc-50/50 dark:bg-zinc-900/20">
                  <div className="flex items-center justify-center h-full min-h-[2rem]">
                    <button
                      type="button"
                      onClick={() => onToggleAsignado(ticket)}
                      disabled={!canEditTickets || isTecnico}
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
                */}
                <td className="px-2 py-3 border-r border-zinc-200 dark:border-zinc-800 text-center align-middle">
                  <div className="flex items-center justify-center h-full min-h-[2rem]">
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded leading-tight text-center ${getEstadoColor(ticket.estado)}`}>{ticket.estado}</span>
                  </div>
                </td>
                <td className="px-1.5 py-2 text-center align-middle">
                  <div className="flex flex-wrap items-center justify-center h-full min-h-[2rem] gap-1">
                    {isTecnico ? (
                      <>
                        <button onClick={() => onCopyWhatsApp(ticket)} disabled={sinPlantilla} aria-label={sinPlantilla ? `Copiar plantilla de la orden ${ticket.codigo || ticket.id}: no disponible, falta la plantilla de la promotora` : `Copiar plantilla WhatsApp de orden ${ticket.codigo || ticket.id}`} className="p-1 text-green-700 dark:text-green-500 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-100 dark:disabled:hover:bg-green-900/30" title={sinPlantilla ? TEXTO_SIN_PLANTILLA : 'Copiar plantilla WhatsApp'}><MessageCircle className="w-3.5 h-3.5" /></button>
                        {enlaceNavegacion && (
                          <a href={enlaceNavegacion} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a la orden ${ticket.codigo || ticket.id}`} title="Cómo llegar" className="p-1 text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-900/50 rounded transition-colors"><Navigation className="w-3.5 h-3.5" /></a>
                        )}
                        {ticket.estado === 'PENDIENTE' ? (
                          <button onClick={() => onPreFinalizar(ticket)} aria-label={`Pre-finalizar orden ${ticket.codigo || ticket.id}`} className="p-1 text-black bg-amber-500 hover:bg-amber-400 rounded font-bold transition-colors" title="Pre-finalizar orden"><ClipboardCheck className="w-3.5 h-3.5" /></button>
                        ) : ticket.estado === 'PRE-FINALIZADO' ? (
                          <span className="p-1 text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 rounded" title="Pre-finalizada: esperando aprobación de administración"><Clock className="w-3.5 h-3.5" /></span>
                        ) : null}
                        {/* Escalar a infraestructura desde el técnico: desactivado por ahora (solo la oficina escala). Para reactivarlo, quitar este
                            comentario, pasar onEscalar también al técnico en App.jsx y volver a permitir la clave 'infraestructura' en las reglas.
                        {onEscalar && puedeEscalar(ticket) && (
                          <button onClick={() => onEscalar(ticket)} aria-label={`Escalar la orden ${ticket.codigo || ticket.id} a infraestructura`} className="p-1 text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 rounded transition-colors" title="Escalar a infraestructura"><HardHat className="w-3.5 h-3.5" /></button>
                        )}
                        */}
                      </>
                    ) : (
                      <>
                        <button onClick={() => onCopyWhatsApp(ticket)} disabled={sinPlantilla} aria-label={sinPlantilla ? `Copiar plantilla de la orden ${ticket.codigo || ticket.id}: no disponible, falta la plantilla de la promotora` : `Copiar plantilla WhatsApp de orden ${ticket.codigo || ticket.id}`} className="p-1 text-green-700 dark:text-green-500 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-100 dark:disabled:hover:bg-green-900/30" title={sinPlantilla ? TEXTO_SIN_PLANTILLA : 'Copiar plantilla WhatsApp (marca como enviada)'}><MessageCircle className="w-3.5 h-3.5" /></button>
                        {canEditTickets ? (
                          <>
                            {ticket.estado === 'PENDIENTE' && !enInfraestructura(ticket) && (
                              <button onClick={() => onFinalizar(ticket)} aria-label={`Finalizar orden ${ticket.codigo || ticket.id}`} className="p-1 text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors" title="Finalizar orden"><ClipboardCheck className="w-3.5 h-3.5" /></button>
                            )}
                            {ticket.estado === 'PRE-FINALIZADO' && (
                              <button onClick={() => onAprobarFinalizar(ticket)} aria-label={`Aprobar y finalizar orden ${ticket.codigo || ticket.id}`} className="p-1 text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors" title="Aprobar y Finalizar orden"><CheckCheck className="w-3.5 h-3.5" /></button>
                            )}
                            <button onClick={() => onPegarUbicacion(ticket)} aria-label={`${ticket.ubicacion ? 'Cambiar' : 'Pegar'} ubicación de orden ${ticket.codigo || ticket.id}`} title={ticket.ubicacion ? 'Cambiar ubicación' : 'Pegar ubicación desde el portapapeles'} className={`p-1 rounded transition-colors ${ticket.ubicacion ? 'text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-900/50' : 'text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}><MapPin className="w-3.5 h-3.5" /></button>
                            <RowMenu
                              label={`Más acciones de orden ${ticket.codigo || ticket.id}`}
                              items={[
                                ...(onEscalar && puedeEscalar(ticket) ? [{ label: 'Escalar a infraestructura', icon: HardHat, onClick: () => onEscalar(ticket) }] : []),
                                { label: 'Editar', icon: Edit, onClick: () => onEdit(ticket) },
                                { label: 'Historial', icon: History, onClick: () => onVerHistorial(ticket) },
                                ...(ticket.estado !== 'CANCELADO' ? [{ label: 'Cancelar orden', icon: Ban, danger: true, onClick: () => onCancelar(ticket) }] : []),
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
