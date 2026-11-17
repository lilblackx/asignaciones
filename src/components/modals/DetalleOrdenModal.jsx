import { textoMetrajeConMarcas } from '../../utils/metraje';
import { observacionEsInterna, observacionParaTecnico } from '../../utils/observacion';
import PagoDelCliente from '../PagoDelCliente';
import { pagoClienteDe } from '../../utils/pagoEnOrden';
import { Cable, Camera, ExternalLink, FileText, History, Landmark, MapPin, MessageSquareText, Navigation, Radio, User, Wrench } from 'lucide-react';
import Modal from '../Modal';
import HistorialTimeline from '../HistorialTimeline';
import InsigniaVentaTecnico from '../InsigniaVentaTecnico';
import CobroClienteDetalle from '../CobroClienteDetalle';
import TelefonoAccion from '../TelefonoAccion';
import BotonCopiar from '../BotonCopiar';
import ValoresClienteTarjeta from './ValoresClienteTarjeta';
import { useCopiado } from '../../hooks/useCopiado';
import { formatCedula, getEstadoPastel, getTipoTrabajoEstilo } from '../../utils/ticketDisplay';
import { buildSmartOltUrl } from '../../utils/smartolt';
import { getEnlaceNavegacion, getEnlaceNavegacionNap } from '../../utils/ubicacion';
import { esInstalacion, napConPuerto } from '../../utils/instalacion';
import { textoConectoresInstalacion } from '../../utils/conectoresInstalacion';
import { InsigniasConectoresInstalacion } from '../InsigniaConector';
import { estaExonerado, monedaDe, textoMonto } from '../../utils/cobro';
import { generarMensajeWhatsAppInstalacion, promotoraDeOrden } from '../../utils/whatsapp';
import { valoresGuardados } from '../../utils/valoresCliente';
import CancelacionAviso from '../CancelacionAviso';
import FotosDeOrden from '../FotosDeOrden';
import AprobacionSinDetalles from '../AprobacionSinDetalles';
import { fotosDe } from '../../utils/detallesOrden';
import BotonCerrar from '../BotonCerrar';
import { legible } from '../../utils/nombreTecnico';
import { fallaVisible } from '../../utils/fallaVisible';
import { ICONO_TARJETA, TARJETA_SECCION, TITULO_TARJETA } from '../estilos';

const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');
const fechaProgramada = (iso) => { const [y, m, d] = String(iso || '').split('-'); return y && m && d ? `${d}/${m}/${y}` : ''; };

// Tarjeta de una sección: el mismo fondo suave y título (ver estilos) que las tarjetas de valores del cliente y de formas de pago.
function Seccion({ icono: Icono, titulo, acciones, children }) {
  return (
    <section aria-label={titulo} className={TARJETA_SECCION}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className={TITULO_TARJETA}>
          <Icono className={ICONO_TARJETA} aria-hidden="true" /> {titulo}
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
    <div className="py-2 border-b border-border last:border-b-0 min-w-0">
      <div className="text-[11px] max-lg:text-xs font-bold text-muted-foreground">{etiqueta}</div>
      <div className="text-sm font-bold text-foreground break-words">{children}</div>
    </div>
  );
}

const ENLACE = 'relative inline-flex items-center gap-1 max-lg:after:absolute max-lg:after:-inset-x-1 max-lg:after:-inset-y-3 text-sky-700 dark:text-sky-400 underline decoration-dotted underline-offset-2 hover:decoration-solid';

// Todos los datos de una orden en una sola ventana, solo para mirar (desde el ojito junto al nombre en la lista). Editar,
// aprobar o finalizar siguen en el menú de la fila. `onCopy(texto, mensaje)` copia y avisa con el toast.
// `verCobro` (la oficina): muestra el cobro de la orden al cliente (pendiente o cargado en el portal) en solo lectura.
// `verRevision` (solo ADMIN, que lee la revisión de pagos): avisa si la orden se aprobó en Revisión sin los detalles (fotos), con el motivo.
export default function DetalleOrdenModal({ ticket, onCopy, onClose, verCobro = false, verRevision = false, zIndexClass = 'z-50' }) {
  // La observación marcada como interna solo la ve la oficina (quien ve el cobro); el técnico no.
  const observacionDeOficina = verCobro ? ticket.observacion : observacionParaTecnico(ticket);
  const { copiado, copiar } = useCopiado(onCopy);
  const instalacion = esInstalacion(ticket.tipoTrabajo);
  const datos = ticket.instalacion || {};
  const tipo = getTipoTrabajoEstilo(ticket.tipoTrabajo || 'AVERÍA');
  const enlaceUbicacion = getEnlaceNavegacion(ticket.ubicacion);
  const enlaceNap = getEnlaceNavegacionNap(ticket.napCoordenadas);
  const conectores = textoConectoresInstalacion(datos.conectores);
  const promotora = instalacion ? promotoraDeOrden(ticket) : '';
  const plantilla = instalacion ? generarMensajeWhatsAppInstalacion(ticket) : '';
  const hayDatosTecnico = Boolean(datos.serial || datos.vlan || datos.puerto || datos.metraje || datos.metrajeExistente === true || datos.puertosDisponibles || datos.posteadura?.length || conectores || ticket.vlanVisita || ticket.potenciaDbm != null);
  const cobro = estaExonerado(ticket) ? 'Exonerado' : ticket.cobroBs ? textoMonto(ticket.cobroBs, monedaDe(ticket)) : '';

  return (
    <Modal onClose={onClose} zIndexClass={zIndexClass}>
      <div className="bg-card rounded-card shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-hidden border border-border flex flex-col">
        <div className="encabezado-d bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white flex items-center gap-2"><FileText className="w-4 h-4 text-red-700 dark:text-red-400" aria-hidden="true" /> DETALLE DE LA ORDEN</h2>
            <p className="text-[11px] max-lg:text-xs font-medium text-muted-foreground truncate"><span className="font-black text-foreground">{ticket.codigo || 'S/C'}</span> · {ticket.nombre}</p>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[11px] max-lg:text-xs font-black px-2.5 py-0.5 rounded-full ${getEstadoPastel(ticket.estado)}`}>{ticket.estado}</span>
            <span className={`text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded ${tipo.badge}`}>{ticket.tipoTrabajo || 'AVERÍA'}</span>
            <InsigniaVentaTecnico ticket={ticket} />
            {fallaVisible(ticket) && <span className="text-xs font-bold text-card-foreground">{fallaVisible(ticket)}</span>}
          </div>

          <CancelacionAviso ticket={ticket} />
          {verRevision && <AprobacionSinDetalles orden={ticket} />}

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
                  <TelefonoAccion telefono={ticket.telefono} tipo="llamar" nombre={ticket.nombre} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-boton border border-input bg-card text-foreground text-xs font-bold hover:bg-secondary transition-colors" />
                  <TelefonoAccion telefono={ticket.telefono} tipo="chat" nombre={ticket.nombre} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-boton border border-green-300 dark:border-green-800 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors" />
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
            <Dato etiqueta="Técnico">{legible(ticket.tecnico || '')}</Dato>
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
              <Dato etiqueta="VLAN configurada">{ticket.vlanVisita}</Dato>
              <Dato etiqueta="Metraje del drop">{datos.metrajeExistente === true ? 'Existente' : datos.metraje && textoMetrajeConMarcas(datos.metraje, datos)}</Dato>
              <Dato etiqueta="Posteadura">{datos.posteadura?.length ? datos.posteadura.join(', ') : ''}</Dato>
              <Dato etiqueta="Puertos disponibles">{datos.puertosDisponibles}</Dato>
              <Dato etiqueta="Conectores">{conectores && <InsigniasConectoresInstalacion conectores={datos.conectores} />}</Dato>
              <Dato etiqueta="Potencia">{ticket.potenciaDbm != null && `${ticket.potenciaDbm} dBm`}</Dato>
            </Seccion>
          )}

          {valoresGuardados(ticket) && <ValoresClienteTarjeta valores={ticket.valoresCliente} onCopy={onCopy} />}

          {(observacionDeOficina || ticket.observacionTecnico) && (
            <Seccion icono={MessageSquareText} titulo="Observaciones">
              <Dato etiqueta={observacionEsInterna(ticket) ? 'De la oficina (interna)' : 'De la oficina'}>{observacionDeOficina}</Dato>
              <Dato etiqueta="Del técnico">{ticket.observacionTecnico}</Dato>
            </Seccion>
          )}

          {pagoClienteDe(ticket) && <PagoDelCliente orden={ticket} bloque />}

          {/* Solo la oficina ve las fotos (el técnico las corrige desde su lista) y se piden cuando esta sección entra en pantalla, no al abrir el detalle. */}
          {verCobro && fotosDe(ticket).length > 0 && (
            <Seccion icono={Camera} titulo="Detalles de la orden (fotos)">
              <FotosDeOrden ticket={ticket} />
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
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-campo text-[11px] max-lg:text-xs font-bold"
                  tono="bg-secondary text-foreground hover:bg-accent"
                  iconoClase="w-3 h-3"
                >
                  Copiar
                </BotonCopiar>
              )}
            >
              <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground font-mono max-h-56 overflow-y-auto">{plantilla}</pre>
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
