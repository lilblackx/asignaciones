import { Cable, ExternalLink, FileText, History, Landmark, MapPin, MessageSquareText, Navigation, Radio, User, Wrench, X } from 'lucide-react';
import Modal from '../Modal';
import HistorialTimeline from '../HistorialTimeline';
import InsigniaVentaTecnico from '../InsigniaVentaTecnico';
import CobroClienteDetalle from '../CobroClienteDetalle';
import TelefonoAccion from '../TelefonoAccion';
import BotonCopiar from '../BotonCopiar';
import ValoresClienteTarjeta from './ValoresClienteTarjeta';
import { useCopiado } from '../../hooks/useCopiado';
import { formatCedula, getEstadoColor, getTipoTrabajoEstilo } from '../../utils/ticketDisplay';
import { buildSmartOltUrl } from '../../utils/smartolt';
import { getEnlaceNavegacion, getEnlaceNavegacionNap } from '../../utils/ubicacion';
import { esInstalacion, napConPuerto } from '../../utils/instalacion';
import { textoConectoresInstalacion } from '../../utils/conectoresInstalacion';
import { estaExonerado, monedaDe, textoMonto } from '../../utils/cobro';
import { generarMensajeWhatsAppInstalacion, promotoraDeOrden } from '../../utils/whatsapp';
import { valoresGuardados } from '../../utils/valoresCliente';
import CancelacionAviso from '../CancelacionAviso';

const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');
const fechaProgramada = (iso) => { const [y, m, d] = String(iso || '').split('-'); return y && m && d ? `${d}/${m}/${y}` : ''; };

// Tarjeta de una sección: el mismo recuadro y título que las tarjetas de valores del cliente y de formas de pago.
function Seccion({ icono: Icono, titulo, acciones, children }) {
  return (
    <section aria-label={titulo} className="bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="flex items-center gap-1.5 text-xs font-black text-red-600 dark:text-red-400">
          <Icono className="w-4 h-4 shrink-0" aria-hidden="true" /> {titulo}
        </h3>
        {acciones}
      </div>
      {children}
    </section>
  );
}

// Un dato: etiqueta chica arriba y el valor debajo. Sin valor no se muestra.
function Dato({ etiqueta, children }) {
  if (children === undefined || children === null || children === '' || children === false) return null;
  return (
    <div className="py-2 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 min-w-0">
      <div className="text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400">{etiqueta}</div>
      <div className="text-sm font-bold text-zinc-900 dark:text-white break-words">{children}</div>
    </div>
  );
}

const ENLACE = 'inline-flex items-center gap-1 max-lg:min-h-11 text-sky-700 dark:text-sky-400 underline decoration-dotted underline-offset-2 hover:decoration-solid';

// Todos los datos de una orden en una sola ventana, solo para mirar (desde el ojito junto al nombre en la lista). Editar,
// aprobar o finalizar siguen en el menú de la fila. `onCopy(texto, mensaje)` copia y avisa con el toast.
// `verCobro` (la oficina): muestra el cobro de la orden al cliente (pendiente o cargado en el portal) en solo lectura.
export default function DetalleOrdenModal({ ticket, onCopy, onClose, verCobro = false }) {
  const { copiado, copiar } = useCopiado(onCopy);
  const instalacion = esInstalacion(ticket.tipoTrabajo);
  const datos = ticket.instalacion || {};
  const tipo = getTipoTrabajoEstilo(ticket.tipoTrabajo || 'AVERÍA');
  const enlaceUbicacion = getEnlaceNavegacion(ticket.ubicacion);
  const enlaceNap = getEnlaceNavegacionNap(ticket.napCoordenadas);
  const conectores = textoConectoresInstalacion(datos.conectores);
  const promotora = instalacion ? promotoraDeOrden(ticket) : '';
  const plantilla = instalacion ? generarMensajeWhatsAppInstalacion(ticket) : '';
  const hayDatosTecnico = Boolean(datos.serial || datos.vlan || datos.puerto || datos.metraje || datos.puertosDisponibles || datos.posteadura?.length || conectores || ticket.potenciaDbm != null);
  const cobro = estaExonerado(ticket) ? 'Exonerado' : ticket.cobroBs ? textoMonto(ticket.cobroBs, monedaDe(ticket)) : '';

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-zinc-300 dark:border-zinc-800 flex flex-col">
        <div className="bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white flex items-center gap-2"><FileText className="w-4 h-4 text-red-500" aria-hidden="true" /> DETALLE DE LA ORDEN</h2>
            <p className="text-[11px] max-lg:text-xs font-medium text-red-400 truncate">{ticket.codigo || 'S/C'} - {ticket.nombre}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[11px] max-lg:text-xs font-bold px-2 py-0.5 rounded ${getEstadoColor(ticket.estado)}`}>{ticket.estado}</span>
            <span className={`text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded ${tipo.badge}`}>{ticket.tipoTrabajo || 'AVERÍA'}</span>
            <InsigniaVentaTecnico ticket={ticket} />
            {ticket.falla && ticket.falla !== ticket.tipoTrabajo && <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{ticket.falla}</span>}
          </div>

          <CancelacionAviso ticket={ticket} />

          {verCobro && (
            <Seccion icono={Landmark} titulo="Cobro al cliente">
              <CobroClienteDetalle ticketId={ticket.id} />
            </Seccion>
          )}

          <Seccion icono={User} titulo="Cliente">
            <Dato etiqueta="Nombre">{ticket.nombre}</Dato>
            <Dato etiqueta="Cédula / RIF">
              {ticket.cedula && (
                <a href={buildSmartOltUrl(ticket.cedula, ticket.tipoDocumento)} target="_blank" rel="noopener noreferrer" title="Buscar cliente en SmartOLT" className={ENLACE}>
                  {formatCedula(ticket.cedula, ticket.tipoDocumento)} <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                </a>
              )}
            </Dato>
            <Dato etiqueta="Teléfono">
              {ticket.telefono && (
                <div className="flex flex-wrap items-center gap-2">
                  <span>{ticket.telefono}</span>
                  <TelefonoAccion telefono={ticket.telefono} tipo="llamar" nombre={ticket.nombre} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" />
                  <TelefonoAccion telefono={ticket.telefono} tipo="chat" nombre={ticket.nombre} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors" />
                </div>
              )}
            </Dato>
            <Dato etiqueta="Dirección">{ticket.direccion}</Dato>
            <Dato etiqueta="Ubicación">
              {(enlaceUbicacion || enlaceNap) && (
                <div className="flex flex-wrap gap-3">
                  {enlaceUbicacion && <a href={enlaceUbicacion} target="_blank" rel="noopener noreferrer" className={ENLACE}><Navigation className="w-3.5 h-3.5" aria-hidden="true" /> Cómo llegar</a>}
                  {enlaceNap && <a href={enlaceNap} target="_blank" rel="noopener noreferrer" className={ENLACE}><MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Cómo llegar a la NAP</a>}
                </div>
              )}
            </Dato>
          </Seccion>

          <Seccion icono={Wrench} titulo="Orden">
            <Dato etiqueta="Técnico">{ticket.tecnico}</Dato>
            <Dato etiqueta="Promotor">{promotora}</Dato>
            <Dato etiqueta="Creada">{[fechaHora(ticket.createdAt) || ticket.fecha, (ticket.creadoNombre || ticket.creado) && `por ${ticket.creadoNombre || ticket.creado}`].filter(Boolean).join(' · ')}</Dato>
            <Dato etiqueta="Programada para">{fechaProgramada(ticket.fechaProgramada)}</Dato>
            <Dato etiqueta="Finalizada">{fechaHora(ticket.finalizadoEn)}</Dato>
            <Dato etiqueta="Prioridad">{ticket.prioridadAlta && 'Alta'}</Dato>
            <Dato etiqueta="Cobro resultante">{cobro}</Dato>
            {/* Sin datos del técnico todavía, la NAP que dice la plantilla se ve aquí. */}
            {!hayDatosTecnico && <Dato etiqueta="NAP">{ticket.nap}</Dato>}
          </Seccion>

          {hayDatosTecnico && (
            <Seccion icono={Cable} titulo="Lo que cargó el técnico">
              <Dato etiqueta="NAP y puerto">{napConPuerto(ticket.nap, datos.puerto)}</Dato>
              <Dato etiqueta="Serial">{datos.serial}</Dato>
              <Dato etiqueta="VLAN">{datos.vlan}</Dato>
              <Dato etiqueta="Metraje del drop">{datos.metraje && `${datos.metraje} m`}</Dato>
              <Dato etiqueta="Posteadura">{datos.posteadura?.length ? datos.posteadura.join(', ') : ''}</Dato>
              <Dato etiqueta="Puertos disponibles">{datos.puertosDisponibles}</Dato>
              <Dato etiqueta="Conectores">{conectores}</Dato>
              <Dato etiqueta="Potencia">{ticket.potenciaDbm != null && `${ticket.potenciaDbm} dBm`}</Dato>
            </Seccion>
          )}

          {valoresGuardados(ticket) && <ValoresClienteTarjeta valores={ticket.valoresCliente} onCopy={onCopy} />}

          {(ticket.observacion || ticket.observacionTecnico) && (
            <Seccion icono={MessageSquareText} titulo="Observaciones">
              <Dato etiqueta={ticket.observacionInterna ? 'De la oficina (interna)' : 'De la oficina'}>{ticket.observacion}</Dato>
              <Dato etiqueta="Del técnico">{ticket.observacionTecnico}</Dato>
            </Seccion>
          )}

          {plantilla && (
            <Seccion
              icono={Radio}
              titulo="Plantilla"
              acciones={(
                <BotonCopiar
                  copiado={copiado === 'plantilla'}
                  onClick={() => copiar('plantilla', plantilla, 'Plantilla copiada, lista para WhatsApp.')}
                  etiqueta="Copiar la plantilla"
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] max-lg:text-xs font-bold"
                  tono="bg-zinc-800 text-white hover:bg-zinc-700"
                  iconoClase="w-3 h-3"
                >
                  Copiar
                </BotonCopiar>
              )}
            >
              <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-zinc-800 dark:text-zinc-200 font-mono max-h-56 overflow-y-auto">{plantilla}</pre>
            </Seccion>
          )}

          <Seccion icono={History} titulo="Historial">
            <div className="mt-2"><HistorialTimeline ticket={ticket} /></div>
          </Seccion>
        </div>
      </div>
    </Modal>
  );
}
