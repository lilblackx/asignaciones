import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ROLES, siguienteColorTecnico } from './constants';
import { getEnvioInfo } from './utils/ticketDisplay';
import { normalizarUbicacion } from './utils/ubicacion';
import { avisoTasaDesactualizada, montoBsDe } from './utils/tasa';
import { avisaCobroAlPreFinalizar } from './utils/tipoVisita';
import { monedaDe, tieneCobroFinal } from './utils/cobro';
import { enInfraestructura } from './utils/infraestructura';
import TasaIndicador from './components/TasaIndicador';
import AvisoNotificaciones from './components/AvisoNotificaciones';
import EnviosInventarioModal, { AvisoInventario } from './components/AlertaInventario';
import { crearConAviso } from './utils/errores';
import { usePushToken } from './hooks/usePushToken';
import { useToast } from './hooks/useToast';
import { useNotifications } from './hooks/useNotifications';
import { useAvisosPagos } from './hooks/useAvisosPagos';
import { useTechnicians } from './hooks/useTechnicians';
import { useLogTecnicos } from './hooks/useLogTecnicos';
import { useTotalesMensuales } from './hooks/useTotalesMensuales';
import { useUsers } from './hooks/useUsers';
import { useTickets } from './hooks/useTickets';
import { useAhora } from './hooks/useAhora';
import { useFilasCambiadas } from './hooks/useFilasCambiadas';
import { useBloqueosOrden } from './hooks/useBloqueosOrden';
import { useReports } from './hooks/useReports';
import { useFilteredTickets } from './hooks/useFilteredTickets';
import { useAvisoCierreAutomatico } from './hooks/useAvisoCierreAutomatico';
import { useEnviosInventario } from './hooks/useEnviosInventario';
import { veEnviosInventario } from './utils/accesoInventario';
import { listarTecnicosInventario } from './lib/inventario';
import { contarPendientes, useInsigniaApp } from './hooks/useInsigniaApp';
import { useArchivedSearch } from './hooks/useArchivedSearch';
import { useTasaBcv } from './hooks/useTasaBcv';
import { useFormasPago } from './hooks/useFormasPago';
import { useTurnoInstalaciones } from './hooks/useTurnoInstalaciones';
import { useCompletarPromotoras } from './hooks/useCompletarPromotoras';
import { esProgramadaFutura } from './utils/programada';
import { esVentaDelTecnico } from './utils/tecnicoVenta';
import { useOperadorEnOrdenes } from './hooks/useOperadorEnOrdenes';
import { TEXTO_SIN_PLANTILLA, generarMensajeDesdePlantilla, generarMensajeWhatsApp, generarMensajeWhatsAppInstalacion, ordenSinPlantilla, tipoUsaPlantillaPromotora } from './utils/whatsapp';
import { stripEmojis } from './utils/sanitizeInput';

import LoadingScreen from './components/LoadingScreen';
import LoginScreen from './components/LoginScreen';
import Toast from './components/Toast';
import Header from './components/Header';
import { useTema } from './hooks/useTema';
import Sidebar from './components/Sidebar';
import PieVersion from './components/PieVersion';
import PaginaMarco from './components/PaginaMarco';
import { BarChart, Cable, ClipboardCheck, ClipboardList, Coins, History, PackageCheck, ShieldCheck, Users } from 'lucide-react';
import { aplanarArchivados } from './utils/reincidencia';
import { construirNapsConocidas } from './utils/napsConocidas';
import FiltersBar from './components/FiltersBar';
import TechnicianWorkload from './components/TechnicianWorkload';
import TicketsMobileList from './components/TicketsMobileList';
import TicketsTable from './components/TicketsTable';
// Modales: ninguno se ve en la primera pintura (todos cuelgan de un estado que
// arranca en false/null), así que van en chunks separados en vez del bundle inicial.
const CreateTicketModal = lazy(() => import('./components/modals/CreateTicketModal'));
const EditTicketModal = lazy(() => import('./components/modals/EditTicketModal'));
const TechniciansModal = lazy(() => import('./components/modals/TechniciansModal'));
const UsersModal = lazy(() => import('./components/modals/UsersModal'));
const ConfirmModal = lazy(() => import('./components/modals/ConfirmModal'));
const ReportsModal = lazy(() => import('./components/modals/ReportsModal'));
const ReportesModal = lazy(() => import('./components/modals/ReportesModal'));
const RevisionPagosModal = lazy(() => import('./components/revision/RevisionPagosModal'));
const OrdersHistoryModal = lazy(() => import('./components/modals/OrdersHistoryModal'));
const WhatsAppMessageModal = lazy(() => import('./components/modals/WhatsAppMessageModal'));
const TasaBcvModal = lazy(() => import('./components/modals/TasaBcvModal'));
const FormasPagoModal = lazy(() => import('./components/modals/FormasPagoModal'));
const MaterialesModal = lazy(() => import('./components/modals/MaterialesModal'));
const PreFinalizarModal = lazy(() => import('./components/modals/PreFinalizarModal'));
const CobroResultanteModal = lazy(() => import('./components/modals/CobroResultanteModal'));
const AprobarFinalizarModal = lazy(() => import('./components/modals/AprobarFinalizarModal'));
const ResponderCobroModal = lazy(() => import('./components/modals/ResponderCobroModal'));
const CancelarOrdenModal = lazy(() => import('./components/modals/CancelarOrdenModal'));
const EscalarInfraestructuraModal = lazy(() => import('./components/modals/EscalarInfraestructuraModal'));
const ResolverInfraestructuraModal = lazy(() => import('./components/modals/ResolverInfraestructuraModal'));
const UbicacionModal = lazy(() => import('./components/modals/UbicacionModal'));
const HistorialOrdenModal = lazy(() => import('./components/modals/HistorialOrdenModal'));
const DetalleOrdenModal = lazy(() => import('./components/modals/DetalleOrdenModal'));

const EMPTY_FORM = () => ({
  fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  fechaProgramada: '',
  codigo: '', nombre: '', cedula: '', tipoDocumento: 'V', direccion: '', telefono: '', nap: '', napCoordenadas: '', ubicacion: '',
  tipoTrabajo: 'AVERÍA', falla: '', tecnico: '', observacion: '', observacionInterna: false, estado: 'PENDIENTE',
  plantillaOriginal: '', ventaTecnico: '', promotora: '', garantiaDe: null
});

// Qué opción del menú lateral se marca según el módulo abierto (sin módulo, la oficina).
const ACTIVO_EN_MENU = { FINANZAS: 'finanzas', PROMOTORA: 'ventas', ALMACEN: 'almacen', INFRAESTRUCTURA: 'infraestructura', REVISION: 'revision', CIERRE: 'cierre', REPORTES: 'reportes', HISTORIAL: 'historial', TASA: 'tasa', TECNICOS: 'tecnicos', USUARIOS: 'usuarios', INVENTARIO: 'inventario' };

// `auth`: la sesión (useAuth) la resuelve Root, que decide qué pantalla corresponde al rol.
// `moduloActivo` / `onAbrirModulo(id)`: el administrador abre cada módulo desde el menú lateral y se ve como página dentro del marco, a la derecha del menú (los demás roles los abren como ventana); Root guarda cuál está abierto
// y `renderModulo(id, { onAbrirMenu })` pinta Finanzas y Ventas. La oficina sigue montada (oculta) para conservar su estado.
export default function App({ auth, moduloActivo = null, onAbrirModulo, renderModulo }) {
  const { firebaseUser, uid, currentUser, currentUserName, role, tecnicoAsociado, isTecnico, canCerrar, authReady, connectionError, loginData, setLoginData, loginError, handleLogin, handleLogout } = auth;
  const push = usePushToken(uid);
  const { toastMsg, setToastMsg } = useToast();
  const conAviso = crearConAviso(setToastMsg);
  // Reloj que se refresca solo cada minuto: "hace 5 min" y los "en camino" que caducan.
  const ahora = useAhora();
  const notifications = useNotifications(currentUser);

  const [isDarkMode, setIsDarkMode] = useTema(currentUser);
  const isAdmin = role === ROLES.ADMIN;
  const canEditTickets = role === ROLES.ADMIN || role === ROLES.USUARIO;

  const { technicians, getTecnicoColor, handleAddTech, handleDeleteTech, toggleTechnicoActivo, vincularTecnicoInventario } = useTechnicians(firebaseUser, setToastMsg, role, tecnicoAsociado, currentUser, notifications.addNotification);
  const { users, createUser, setUserDisabled, updateUserNombre, setUserPuedeCerrar, setUserRole, setUserPuedeCrearVentas, adminResetPassword } = useUsers(firebaseUser, setToastMsg, role);
  const { tickets, ticketsCargados, cobrosPendientes, mostrarCobro, mostrarCobroInmediato, cerrarCobro, createTicket, verificarCodigoManual, updateTicket, cancelarTicket, toggleAsignado, guardarUbicacion, preFinalizarTicket, consultarCobroRecableado, responderConsultaCobro, aprobarFinalizarTicket, guardarValoresCliente, devolverTicket, finalizarTicket, togglePrioridad, escalarAInfraestructura, resolverInfraestructura, iniciarEnCamino, marcarLlegada, cancelarViaje } = useTickets(firebaseUser, currentUser, setToastMsg, role, tecnicoAsociado, notifications.addNotification, currentUserName);
  useOperadorEnOrdenes({ firebaseUser, role, ticketsCargados, tickets, users });
  const filasCambiadas = useFilasCambiadas(tickets, ticketsCargados);
  useAvisoCierreAutomatico(firebaseUser, canCerrar, currentUser, notifications.addNotification);
  // El técnico se entera de un pago o un adelanto que Finanzas le registra, también con la app abierta.
  useAvisosPagos({ firebaseUser, tecnico: isTecnico ? tecnicoAsociado : null, onNotify: notifications.addNotification, setToastMsg });
  // Los envíos al inventario del otro sistema (alertas y módulo) son solo de los usuarios de utils/accesoInventario.
  const verInventario = veEnviosInventario(currentUser);
  const { envios: enviosInventario, pendientes: enviosPendientes, recientes: enviosRecientes, cargandoRecientes, hayMas: hayMasEnvios, cargarRecientes, cargarMas: cargarMasEnvios, actualizarRecientes, reintentar: reintentarEnvio, reenviarAviso: reenviarAvisoEnvio, reintentarTodas: reintentarTodasEnvios, buscar: buscarEnvios, descartar: descartarEnvio } = useEnviosInventario(firebaseUser, verInventario, currentUser, setToastMsg);
  useCompletarPromotoras(firebaseUser, role, tickets);
  const { reports, isProcessing, cerrarDia, hasMoreReports, isLoadingReports, loadMoreReports, refreshReports } = useReports(firebaseUser, canCerrar, currentUser, tickets, setToastMsg);
  const { config: tasaConfig, loading: tasaLoading, actualizarAutomatica, actualizarManual } = useTasaBcv(firebaseUser);
  const { formasPago, guardarFormasPago } = useFormasPago(firebaseUser);
  const { orden: ordenTurno, tecnicoSugerido, guardarOrden, avanzarTurno } = useTurnoInstalaciones(firebaseUser, technicians, setToastMsg);

  const copyToClipboard = async (mensaje, textoExito = 'Plantilla copiada, lista para WhatsApp.', tipoExito = 'success', textoError = 'No se pudo copiar la plantilla.') => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setToastMsg({ type: tipoExito, text: textoExito, ...(tipoExito === 'aviso' ? { duration: 8000 } : {}) });
      return true;
    } catch {
      setToastMsg({ type: 'error', text: textoError });
      return false;
    }
  };

  // El ticket guarda el username del creador (ticket.creado); para la plantilla
  // de WhatsApp se muestra el nombre real de esa persona, no su usuario.
  const resolveOperador = (username) => users.find(u => u.username === username)?.nombre || username;

  const buildWhatsAppMessage = (ticket) => {
    const ticketConOperador = { ...ticket, creado: resolveOperador(ticket.creado) };
    if (ticket.tipoTrabajo?.toUpperCase().includes('INSTAL')) return generarMensajeWhatsAppInstalacion(ticketConOperador);
    // Reconexión creada con la plantilla de la promotora: el mensaje sale de esa
    // misma plantilla (con el correlativo y el técnico). Sin plantilla pegada
    // (carga manual) sale en el formato de la app (el mismo de las averías).
    if (tipoUsaPlantillaPromotora(ticket.tipoTrabajo) && ticket.plantillaOriginal?.trim()) return generarMensajeDesdePlantilla(ticketConOperador);
    return generarMensajeWhatsApp(ticketConOperador, tasaConfig);
  };

  // La plantilla de cualquier orden del historial (instalación, reconexión con plantilla, avería, mudanza...), tal como
  // se copia desde la lista. En las que no salen de la plantilla de la promotora, el monto en Bs es el del cobro ya
  // registrado en la orden, no el de la tasa de hoy. Vacía si la orden no tiene plantilla (ver ordenSinPlantilla).
  const plantillaDeHistorial = (ticket) => {
    if (ordenSinPlantilla(ticket)) return '';
    const saleDePlantilla = ticket.tipoTrabajo?.toUpperCase().includes('INSTAL')
      || (tipoUsaPlantillaPromotora(ticket.tipoTrabajo) && ticket.plantillaOriginal?.trim());
    if (saleDePlantilla) return buildWhatsAppMessage(ticket);
    return generarMensajeWhatsApp({ ...ticket, creado: resolveOperador(ticket.creado) }, tasaConfig, ticket.cobroBs || null, monedaDe(ticket));
  };

  // Copiar la plantilla también marca el ticket como ENVIADO (campo isAsignado
  // en Firestore, se conserva el nombre por compatibilidad con datos viejos). Se marca primero porque asignar puede cambiar el código del
  // ticket (correlativo del técnico) y la plantilla debe salir con el final.
  // Solo marca si el usuario puede editar y ya hay técnico; nunca desmarca.
  // Si la orden ya estaba enviada pero cambió después (técnico, trabajo, etc.),
  // copiar registra un reenvío para limpiar el aviso ámbar.
  // Si la plantilla lleva el monto en Bs (todas menos INSTALACIÓN) y la tasa BCV
  // no es de hoy, la copia igual sale pero el aviso lo dice, para no mandar un
  // cobro con tasa vieja sin darse cuenta.
  const toastCopia = (ticket, textoBase) => {
    // Instalaciones y reconexiones con plantilla de la promotora no llevan el
    // monto calculado con la tasa (el monto, si lo hay, viene escrito en la plantilla).
    const sinMontoAutomatico = ticket.tipoTrabajo?.toUpperCase().includes('INSTAL')
      || (tipoUsaPlantillaPromotora(ticket.tipoTrabajo) && ticket.plantillaOriginal?.trim());
    const aviso = canEditTickets && !sinMontoAutomatico && !tasaLoading ? avisoTasaDesactualizada(tasaConfig) : null;
    return aviso
      ? { texto: `${textoBase} Ojo: ${aviso}`, tipo: 'aviso' }
      : { texto: textoBase, tipo: 'success' };
  };

  const handleCopyWhatsApp = conAviso(async (ticket) => {
    // Una instalación sin la plantilla de la promotora pegada no tiene plantilla que copiar (una reconexión sí: sale en el formato de la app).
    if (ordenSinPlantilla(ticket)) {
      setToastMsg({ type: 'error', text: TEXTO_SIN_PLANTILLA, duration: 8000 });
      return false;
    }
    const reenvio = ticket.isAsignado && getEnvioInfo(ticket).cambioTrasEnvio;
    if (!canEditTickets || !ticket.tecnico || (ticket.isAsignado && !reenvio)) {
      // Sin técnico copia igual pero NO marca como enviada: se dice para que no
      // parezca que el botón falló.
      const sinTecnico = canEditTickets && !ticket.tecnico && !ticket.isAsignado;
      const base = sinTecnico
        ? 'Plantilla copiada. No se marcó como enviada: falta asignar técnico.'
        : 'Plantilla copiada, lista para WhatsApp.';
      const { texto, tipo } = toastCopia(ticket, base);
      return copyToClipboard(buildWhatsAppMessage(ticket), texto, sinTecnico ? 'aviso' : tipo);
    }
    const guardado = await toggleAsignado(ticket, true, { silencioso: true, reenvio });
    const { texto, tipo } = toastCopia(ticket, reenvio ? 'Plantilla copiada y reenvío registrado.' : 'Plantilla copiada y orden marcada como Enviada.');
    return copyToClipboard(buildWhatsAppMessage(guardado || ticket), texto, tipo);
  }, 'No se pudo marcar la orden como enviada.');

  const handleActualizarTasaAutomatica = async () => {
    const ok = await actualizarAutomatica();
    setToastMsg({ type: ok ? 'success' : 'error', text: ok ? 'Tasa actualizada automáticamente.' : 'No se pudo obtener la tasa automática.' });
    return ok;
  };

  const handleActualizarTasaManual = conAviso(async (tasa, montoBaseEUR) => {
    await actualizarManual(tasa, montoBaseEUR, currentUserName || currentUser);
    setToastMsg({ type: 'success', text: 'Tasa actualizada manualmente.' });
  }, 'No se pudo guardar la tasa.');

  const handleGuardarFormasPago = conAviso(async (formas) => {
    await guardarFormasPago(formas, currentUserName || currentUser);
    setToastMsg({ type: 'success', text: 'Formas de pago guardadas.' });
  }, 'No se pudieron guardar las formas de pago.');

  // La tasa se actualiza sola una vez al día por la mañana (cron del Worker de
  // notificaciones); el botón de Tasa permite actualizarla a mano en cualquier momento.

  // Para TECNICO: solo sus propias órdenes. Para otros: todos los tickets.
  // Lo que está esperando a infraestructura sale de su lista: no puede atenderlo hasta que la oficina lo resuelva.
  const ticketsParaVer = isTecnico && tecnicoAsociado
    ? tickets.filter(t => t.tecnico?.toUpperCase() === tecnicoAsociado.toUpperCase() && !enInfraestructura(t))
    : tickets;

  // Para el estado vacío: si el técnico no tiene ninguna orden ACTIVA (aunque
  // sí tenga historial de finalizadas/canceladas), la vista por defecto ("TODOS"
  // solo muestra activas) igual da 0 resultados — eso no es "tus filtros no
  // coinciden", es que no tiene trabajo pendiente ahora mismo.
  const hasActiveAssignments = isTecnico
    ? ticketsParaVer.some(t => (t.estado === 'PENDIENTE' && !esProgramadaFutura(t)) || t.estado === 'PRE-FINALIZADO' || t.estado === 'PRE-FINALIZADA')
    : tickets.length > 0;

  const { searchTerm, setSearchTerm, statusFilter, setStatusFilter, tipoFilter, setTipoFilter, sortBy, setSortBy, filteredTickets, visibleTickets, hasMore, loadMore } = useFilteredTickets(ticketsParaVer, { ocultarProgramadasFuturas: isTecnico, ahora });

  // Contador persistente (no depende de haber visto el toast/sonido): se queda
  // hasta que las aprueben, así nadie se lo pierde por estar lejos de la pantalla.
  const preFinalizadoCount = tickets.filter(t => t.estado === 'PRE-FINALIZADO').length;
  // Misma cuenta que la campana, también sobre el icono de la app instalada.
  useInsigniaApp(currentUser && (canEditTickets || isTecnico) ? contarPendientes(notifications.unreadCount, preFinalizadoCount) : 0);
  const handleOpenPreFinalizados = () => setStatusFilter('PRE-FINALIZADO');
  // Vista por defecto del dashboard: sin búsqueda, órdenes activas, más recientes.
  const handleGoHome = () => {
    setSearchTerm('');
    setStatusFilter('TODOS');
    setTipoFilter('TODOS');
    setSortBy('DEFECTO');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Deja en la lista solo la orden indicada (búsqueda por código) para llegar a ella.
  const mostrarOrden = (ticket) => {
    setSearchTerm(ticket.codigo || ticket.cedula || ticket.nombre || '');
    setTipoFilter('TODOS');
    const activa = ticket.estado === 'PENDIENTE' || ticket.estado === 'PRE-FINALIZADO' || ticket.estado === 'PRE-FINALIZADA';
    setStatusFilter(
      activa ? (isTecnico && esProgramadaFutura(ticket) ? 'PROG_FUTURAS' : 'TODOS')
        : (ticket.estado || 'TODOS').toUpperCase()
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const { reportSearchTerm, setReportSearchTerm, archivedSearchResults } = useArchivedSearch(reports);
  // Coordenadas de NAP ya usadas en órdenes anteriores: evitan esperar a Tomodat.
  const napsConocidas = useMemo(() => construirNapsConocidas(tickets, aplanarArchivados(reports)), [tickets, reports]);

  const [isAddTechModalOpen, setIsAddTechModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isTasaModalOpen, setIsTasaModalOpen] = useState(false);
  const [isFormasPagoOpen, setIsFormasPagoOpen] = useState(false);
  const [isInventarioOpen, setIsInventarioOpen] = useState(false);
  const [newTech, setNewTech] = useState({ name: '', color: null });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  // La orden tal como estaba al abrir Editar: al guardar solo se escribe lo que
  // cambió respecto a ella, sin pisar lo que otro usuario guardó mientras tanto.
  const [edicionBase, setEdicionBase] = useState(null);
  const abrirEdicion = (ticket) => {
    setEdicionBase(ticket);
    setEditingTicket(ticket);
  };
  // La orden que se está cancelando (pide el motivo).
  const [cancelarTarget, setCancelarTarget] = useState(null);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isReportesOpen, setIsReportesOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const logTecnicos = useLogTecnicos(firebaseUser, isReportesOpen || moduloActivo === 'REPORTES');
  const totalesMensuales = useTotalesMensuales(firebaseUser, isReportesOpen || moduloActivo === 'REPORTES');
  const [selectedReportForDetails, setSelectedReportForDetails] = useState(null);

  useEffect(() => {
    if (isReportModalOpen || isHistoryModalOpen || isReportesOpen || ['CIERRE', 'HISTORIAL', 'REPORTES', 'REVISION'].includes(moduloActivo)) refreshReports();
  }, [isReportModalOpen, isHistoryModalOpen, isReportesOpen, moduloActivo, refreshReports]);

  const [isCierreConfirmOpen, setIsCierreConfirmOpen] = useState(false);
  const [cierreDateInput, setCierreDateInput] = useState('');

  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [uncheckWarningTicket, setUncheckWarningTicket] = useState(null);
  const [whatsappMessage, setWhatsappMessage] = useState(null);
  const [preFinalizarTarget, setPreFinalizarTarget] = useState(null);
  const [aprobarTarget, setAprobarTarget] = useState(null);
  const [finalizarTarget, setFinalizarTarget] = useState(null);
  const [ubicacionTarget, setUbicacionTarget] = useState(null);
  const [historialTarget, setHistorialTarget] = useState(null);
  const [detalleTarget, setDetalleTarget] = useState(null);
  const [responderCobroTarget, setResponderCobroTarget] = useState(null);
  const [escalarTarget, setEscalarTarget] = useState(null);
  const [resolverInfraTarget, setResolverInfraTarget] = useState(null);

  // Aviso de "alguien está revisando esta orden": la que esta persona tiene abierta para aprobar, finalizar, resolver, escalar o editar.
  // `revisando`: orden -> nombres de otras personas de la oficina que la tienen abierta ahora (solo aviso; ver hooks/useBloqueosOrden).
  const { revisando } = useBloqueosOrden({
    firebaseUser, rol: role, usuario: currentUser, nombre: currentUserName || currentUser, ahora,
    ordenId: aprobarTarget?.id || finalizarTarget?.id || resolverInfraTarget?.id || escalarTarget?.id || cancelarTarget?.id || editingTicket?.id || null,
  });

  // Click en una notificación: lleva a la orden o a la acción que avisa. Si la orden ya no
  // está (o cambió de estado), cae a la vista de la lista más cercana.
  // Antes de salir se quita este dispositivo del perfil, para que el siguiente usuario del
  // teléfono no reciba los avisos de este. No espera más de 3 s: cerrar sesión no puede trabarse.
  const cerrarSesion = async () => {
    await Promise.race([push.desvincular(), new Promise((resolve) => setTimeout(resolve, 3000))]);
    await handleLogout();
    // Sin esto el aviso de "¿Cerrar sesión?" reaparecía al iniciar sesión de nuevo sin recargar.
    setIsLogoutConfirmOpen(false);
  };

  // El administrador ve cada módulo como página dentro del marco (`moduloActivo`); los demás roles lo ven como ventana (su propio estado).
  const abierta = (id, estado) => (isAdmin ? moduloActivo === id : estado);
  const abrirVentana = (id, poner) => () => (isAdmin ? onAbrirModulo(id) : poner(true));
  const cerrarVentana = (poner) => () => (isAdmin ? onAbrirModulo(null) : poner(false));

  const handleOpenNotification = (n) => {
    onAbrirModulo?.(null);
    const ticket = n.ticketId ? tickets.find(t => t.id === n.ticketId) : null;
    switch (n.type) {
      case 'prefinalizado':
        if (canEditTickets && ticket?.estado === 'PRE-FINALIZADO') setAprobarTarget(ticket);
        else handleOpenPreFinalizados();
        break;
      case 'devuelto':
        if (isTecnico && ticket?.estado === 'PENDIENTE') setPreFinalizarTarget(ticket);
        else if (ticket) mostrarOrden(ticket);
        else handleGoHome();
        break;
      case 'nuevaAsignacion':
      case 'nuevaVenta':
      case 'prioridad':
        if (ticket) mostrarOrden(ticket);
        else handleGoHome();
        break;
      case 'encamino':
      case 'llegada':
        if (ticket) mostrarOrden(ticket);
        else handleGoHome();
        break;
      case 'cancelada':
        // Cancelada: sigue en su lista (con estado CANCELADO); si se quitó o ya se cerró el día, ya no está.
        if (ticket) mostrarOrden(ticket);
        else handleGoHome();
        break;
      case 'desasignada':
      case 'pagoTecnico':
      case 'adelantoTecnico':
      case 'ajusteTecnico':
        // Un pago o un adelanto no es una orden: el técnico vuelve a su lista.
        handleGoHome();
        break;
      case 'aprobado':
        if (ticket && isTecnico && tieneCobroFinal(ticket)) mostrarCobro(ticket);
        else if (ticket) mostrarOrden(ticket);
        else setStatusFilter('FINALIZADO');
        break;
      case 'consultaCobro':
        if (canEditTickets && ticket) setResponderCobroTarget(ticket);
        else if (ticket) mostrarOrden(ticket);
        else handleGoHome();
        break;
      case 'respuestaCobro':
        if (isTecnico && ticket?.estado === 'PENDIENTE') setPreFinalizarTarget(ticket);
        else if (ticket) mostrarOrden(ticket);
        else handleGoHome();
        break;
      case 'infraestructura':
        // La oficina abre la orden para decidir cómo sigue; el técnico la busca en su lista.
        if (canEditTickets && enInfraestructura(ticket)) setResolverInfraTarget(ticket);
        else if (ticket) mostrarOrden(ticket);
        else handleGoHome();
        break;
      case 'tecnicoStatus':
        if (isAdmin) abrirVentana('TECNICOS', setIsAddTechModalOpen)();
        break;
      case 'cierreAutomatico':
        if (canCerrar) abrirVentana('CIERRE', setIsReportModalOpen)();
        break;
      case 'inventario':
        if (verInventario) abrirVentana('INVENTARIO', setIsInventarioOpen)();
        break;
      default:
        break;
    }
  };

  // Tocar un push abre la orden: con la app abierta el Service Worker manda un mensaje; con la
  // app cerrada la abre con ?orden=...&tipo=... en la URL, que se atiende al llegar las órdenes.
  const abrirNotificacionRef = useRef(handleOpenNotification);
  useEffect(() => { abrirNotificacionRef.current = handleOpenNotification; });
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const alRecibir = (e) => {
      if (e.data?.type === 'ABRIR_NOTIFICACION') abrirNotificacionRef.current({ type: e.data.tipo, ticketId: e.data.ticketId });
    };
    navigator.serviceWorker.addEventListener('message', alRecibir);
    return () => navigator.serviceWorker.removeEventListener('message', alRecibir);
  }, []);
  const notificacionDeUrlRef = useRef(null);
  if (notificacionDeUrlRef.current === null) {
    const params = new URLSearchParams(window.location.search);
    notificacionDeUrlRef.current = params.get('orden') ? { type: params.get('tipo') || '', ticketId: params.get('orden') } : false;
  }
  useEffect(() => {
    if (!ticketsCargados || !notificacionDeUrlRef.current) return;
    const n = notificacionDeUrlRef.current;
    notificacionDeUrlRef.current = false;
    window.history.replaceState(null, '', window.location.pathname);
    const id = setTimeout(() => abrirNotificacionRef.current(n), 0);
    return () => clearTimeout(id);
  }, [ticketsCargados]);

  const [formData, setFormData] = useState(EMPTY_FORM());

  const handleCreateChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Un campo con más de un dato (la garantía) llega como objeto: no es texto que limpiar.
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (typeof value === 'string' ? stripEmojis(value) : value) }));
  };

  // Si createTicket falla, conAviso muestra el error y esta función se corta ahí:
  // el modal sigue abierto con lo escrito (no se cierra ni se limpia el formulario).
  const handleCreateSubmit = conAviso(async (e) => {
    e.preventDefault();
    const nuevoTicket = await createTicket(formData);
    if (nuevoTicket === false) return; // validación rechazó: el modal sigue abierto con lo escrito
    setIsCreateModalOpen(false);
    setFormData(EMPTY_FORM());
    if (nuevoTicket) {
      const esInstalacion = formData.tipoTrabajo?.toUpperCase().includes('INSTAL');
      if (esInstalacion) {
        // Consume el turno de quien haya quedado asignado (sugerido o elegido
        // a mano), no solo del sugerido — así igual queda al final de la fila.
        // Una venta del técnico (venía en la plantilla) no consume el turno.
        if (formData.tecnico && !esVentaDelTecnico(formData.ventaTecnico, formData.tecnico)) avanzarTurno(formData.tecnico);
      }
      if (ordenSinPlantilla(nuevoTicket)) {
        setToastMsg({ type: 'aviso', duration: 9000, text: 'Orden creada sin la plantilla de la promotora: no se podrá copiar la plantilla hasta que la pegues desde Editar.' });
      } else {
        setWhatsappMessage(buildWhatsAppMessage(nuevoTicket));
      }
    }
  }, 'No se pudo crear la orden.');

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditingTicket(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (typeof value === 'string' ? stripEmojis(value) : value) }));
  };

  // `datosTecnico`: lo corregido de lo que cargó el técnico (ya validado por el modal); se guarda junto con el resto.
  const handleEditSubmit = conAviso(async (e, datosTecnico = null) => {
    e.preventDefault();
    const originalTicket = tickets.find(t => t.id === editingTicket.id);
    const guardado = await updateTicket(datosTecnico ? { ...editingTicket, ...datosTecnico } : editingTicket, edicionBase);
    if (guardado === false) return; // validación rechazó: el modal sigue abierto con lo escrito
    // Si se le asignó (o cambió) técnico a una instalación desde Editar —no
    // solo al crearla—, también consume el turno, igual que en Nueva Asignación.
    const esInstalacion = editingTicket.tipoTrabajo?.toUpperCase().includes('INSTAL');
    if (esInstalacion && editingTicket.tecnico && originalTicket?.tecnico !== editingTicket.tecnico) {
      avanzarTurno(editingTicket.tecnico);
    }
    setEditingTicket(null);
  }, 'No se pudieron guardar los cambios.');

  const handleConfirmPreFinalizar = conAviso(async (ticket, extra) => {
    // Conector interno: el cobro se informa ya (y queda en el historial de la orden).
    const monto = avisaCobroAlPreFinalizar(extra.tipoVisita) ? montoBsDe(tasaConfig) : null;
    const ok = await preFinalizarTicket(ticket, { ...extra, montoBs: monto });
    setPreFinalizarTarget(null);
    // Conector interno: el técnico ve el cobro ya, para informárselo al cliente en el momento.
    if (ok && isTecnico && avisaCobroAlPreFinalizar(extra.tipoVisita)) {
      if (monto) mostrarCobroInmediato({ ...ticket, ...extra }, monto);
      else setToastMsg({ type: 'error', duration: 9000, text: 'Conector interno: la tasa no está configurada y no se pudo calcular el cobro. Avisa al administrador.' });
    }
  }, 'No se pudo pre-finalizar la orden.');

  // ADMIN/USUARIO: marca o quita la prioridad alta de una orden (al marcarla, el técnico recibe un aviso).
  const handleTogglePrioridad = conAviso(async (ticket) => {
    await togglePrioridad(ticket);
  }, 'No se pudo cambiar la prioridad de la orden.');

  // TECNICO: avisa a la oficina que va en camino, que llegó, o cancela / deshace el aviso.
  const handleIniciarViaje = conAviso(iniciarEnCamino, 'No se pudo avisar que vas en camino.');
  const handleLlegue = conAviso(marcarLlegada, 'No se pudo avisar que llegaste.');
  const handleCancelarViaje = conAviso(cancelarViaje, 'No se pudo cancelar el viaje.');

  const handleConfirmAprobarFinalizar = conAviso(async (ticket, cobro) => {
    const ok = await aprobarFinalizarTicket(ticket, cobro || { montoBs: montoBsDe(tasaConfig) });
    if (ok) setAprobarTarget(null);
  }, 'No se pudo aprobar la orden.');

  // El técnico escala una orden suya y la oficina cualquiera pendiente: queda esperando a infraestructura con un motivo.
  const handleEscalar = conAviso(async (ticket, motivo) => escalarAInfraestructura(ticket, motivo), 'No se pudo escalar la orden.');
  // ADMIN/USUARIO: devuelven la orden al técnico o la cierran como trabajo adicional (TA).
  const handleResolverInfra = conAviso(async (ticket, resolucion) => resolverInfraestructura(ticket, resolucion), 'No se pudo resolver la orden.');

  const handleDevolver = conAviso(async (ticket, motivo) => {
    const ok = await devolverTicket(ticket, motivo);
    if (ok) setAprobarTarget(null);
  }, 'No se pudo devolver la orden.');

  const confirmFinalizar = conAviso(async (ticket, cobro) => {
    const ok = await finalizarTicket(ticket, cobro || { montoBs: montoBsDe(tasaConfig) });
    if (ok) setFinalizarTarget(null);
  }, 'No se pudo finalizar la orden.');

  // Cancelar una orden: pide el motivo y avisa al técnico. Devuelve true si se pudo (el modal se cierra solo).
  const handleCancelar = conAviso(async (ticket, motivo) => cancelarTicket(ticket, motivo), 'No se pudo cancelar la orden.');

  const confirmToggleAsignado = conAviso(async (ticket, newValue) => {
    await toggleAsignado(ticket, newValue);
    setUncheckWarningTicket(null);
  }, 'No se pudo cambiar el estado de envío.');

  const handleToggleAsignado = (ticket) => {
    if (!canEditTickets) return;
    if (ticket.isAsignado) {
      setUncheckWarningTicket(ticket);
    } else if (!ticket.tecnico) {
      setToastMsg({ type: 'error', text: 'Selecciona un técnico antes de marcar como enviada.' });
      abrirEdicion(ticket);
    } else {
      confirmToggleAsignado(ticket, true);
    }
  };

  // Ubicación sin abrir Editar: si la orden aún no tiene, intenta guardar lo que
  // haya en el portapapeles (la operadora copia el enlace de Maps y toca el botón);
  // si no hay un enlace válido —o la orden ya tenía ubicación— abre el modal.
  const handlePegarUbicacion = conAviso(async (ticket) => {
    if (!canEditTickets) return;
    if (!ticket.ubicacion) {
      let texto = '';
      try { texto = await navigator.clipboard.readText(); } catch { /* sin permiso: se cae al modal */ }
      if (normalizarUbicacion(texto).valor) {
        await guardarUbicacion(ticket, texto);
        return;
      }
    }
    setUbicacionTarget(ticket);
  }, 'No se pudo guardar la ubicación.');

  // Guardado desde el modal de ubicación: si falla devuelve false y el modal sigue abierto.
  const handleGuardarUbicacion = conAviso(guardarUbicacion, 'No se pudo guardar la ubicación.');

  const handleAddTechSubmit = conAviso(async (e) => {
    e.preventDefault();
    await handleAddTech({ ...newTech, color: newTech.color || siguienteColorTecnico(technicians) });
    setNewTech({ name: '', color: null });
  }, 'No se pudo agregar el técnico.');

  const handleDeleteTechSeguro = conAviso(handleDeleteTech, 'No se pudo eliminar el técnico.');
  const toggleTechnicoActivoSeguro = conAviso(toggleTechnicoActivo, 'No se pudo cambiar el estado del técnico.');
  const vincularTecnicoInventarioSeguro = conAviso(vincularTecnicoInventario, 'No se pudo guardar el nombre en el inventario.');
  const guardarOrdenSeguro = conAviso((nuevoOrden) => guardarOrden(nuevoOrden, currentUser), 'No se pudo guardar el orden de turno.');

  const handleCreateUser = async (newUser) => {
    await createUser(newUser, currentUser);
  };

  const handleOpenCreateModal = () => {
    // Reset completo: si el usuario cerró el modal sin enviar, no debe
    // encontrar los datos del intento anterior la próxima vez que lo abra.
    setFormData(EMPTY_FORM());
    setIsCreateModalOpen(true);
  };

  const handleRequestCierre = (isoDate) => {
    setCierreDateInput(isoDate);
    setIsCierreConfirmOpen(true);
  };

  const handleConfirmCierre = async () => {
    const newReport = await cerrarDia(cierreDateInput);
    setIsCierreConfirmOpen(false);
    if (newReport) setSelectedReportForDetails(newReport);
  };

  const encabezadoMarco = { nombre: currentUserName || currentUser, rol: role, isDarkMode, setIsDarkMode, handleLogout, onAbrirMenu: () => setIsSidebarOpen(true) };
  const enMarco = (titulo, Icono, hijo, contexto = '') => (isAdmin ? <PaginaMarco titulo={titulo} Icono={Icono} contexto={contexto} encabezado={encabezadoMarco}>{hijo}</PaginaMarco> : hijo);

  if (!authReady) {
    return <LoadingScreen isDarkMode={isDarkMode} connectionError={connectionError} />;
  }

  if (!currentUser) {
    return (
      <LoginScreen
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        loginData={loginData}
        setLoginData={setLoginData}
        loginError={loginError}
        handleLogin={handleLogin}
      />
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-fondo text-zinc-900 dark:text-zinc-100 flex font-sans transition-colors duration-200">

        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />

        {/* El administrador tiene todos los módulos en un menú lateral (fijo en PC, panel con ☰ en el celular); los demás roles no lo ven. */}
        {isAdmin && (
          <Sidebar
            abierto={isSidebarOpen}
            activo={ACTIVO_EN_MENU[moduloActivo] || 'oficina'}
            nombre={currentUserName || currentUser}
            rol={role}
            isDarkMode={isDarkMode}
            onCambiarTema={() => setIsDarkMode(!isDarkMode)}
            onSalir={() => setIsLogoutConfirmOpen(true)}
            onCerrar={() => setIsSidebarOpen(false)}
            veInventario={verInventario}
            alertasInventario={enviosInventario.length}
            acciones={{ inicio: () => { onAbrirModulo(null); handleGoHome(); }, modulo: onAbrirModulo }}
          />
        )}

        {isAdmin && (moduloActivo === 'FINANZAS' || moduloActivo === 'PROMOTORA' || moduloActivo === 'INFRAESTRUCTURA') && (
          <div className="flex-1 min-w-0">{renderModulo(moduloActivo, { onAbrirMenu: () => setIsSidebarOpen(true) })}</div>
        )}

        {abierta('ALMACEN', false) && enMarco('Almacén', Cable, (
          <Suspense fallback={null}>
            <MaterialesModal enPagina tickets={tickets} reports={reports} technicians={technicians} hasMoreReports={hasMoreReports} isLoadingReports={isLoadingReports} onLoadMore={loadMoreReports} />
          </Suspense>
        ))}

        {abierta('REVISION', false) && enMarco('Revisión de órdenes', ClipboardCheck, (
          <Suspense fallback={null}>
            <RevisionPagosModal
              enPagina
              technicians={technicians}
              tickets={tickets}
              reports={reports}
              hasMoreReports={hasMoreReports}
              isLoadingReports={isLoadingReports}
              onLoadMoreReports={loadMoreReports}
              onActualizar={refreshReports}
              usuario={currentUser}
              firebaseUser={firebaseUser}
              setToastMsg={setToastMsg}
            />
          </Suspense>
        ))}

        <div className={`flex-1 min-w-0 flex-col ${isAdmin && moduloActivo ? 'hidden' : 'flex'}`}>
        <Header
          currentUser={currentUser}
          currentUserName={currentUserName}
          role={role}
          canEditTickets={canEditTickets}
          canCerrar={canCerrar}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onOpenReports={() => setIsReportModalOpen(true)}
          onOpenReportes={() => setIsReportesOpen(true)}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          veInventario={verInventario}
          alertasInventario={enviosInventario.length}
          onOpenInventario={() => setIsInventarioOpen(true)}
          onOpenFormasPago={() => setIsFormasPagoOpen(true)}
          onOpenCreate={handleOpenCreateModal}
          handleLogout={() => setIsLogoutConfirmOpen(true)}
          preFinalizadoCount={preFinalizadoCount}
          onOpenPreFinalizados={handleOpenPreFinalizados}
          onOpenNotification={handleOpenNotification}
          onGoHome={handleGoHome}
          notifications={notifications}
        />

        <div className="p-4 max-w-[1400px] mx-auto w-full flex-1">
          {verInventario && <AvisoInventario cantidad={enviosInventario.length} pendientes={enviosPendientes.length} onAbrir={abrirVentana('INVENTARIO', setIsInventarioOpen)} />}
          {(isTecnico || canEditTickets) && <AvisoNotificaciones permiso={push.permiso} registro={push.registro} detalleError={push.detalleError} onActivar={push.activar} avisarFallo={isTecnico} />}
          <FiltersBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            tipoFilter={tipoFilter}
            setTipoFilter={setTipoFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            technicians={technicians}
            isTecnico={isTecnico}
          />

          <TechnicianWorkload tickets={tickets} technicians={technicians} getTecnicoColor={getTecnicoColor} canEditTickets={canEditTickets} isTecnico={isTecnico} onToggleActivo={toggleTechnicoActivoSeguro} onOpenSinTecnico={() => setStatusFilter('PENDIENTE_SIN_TECNICO')} ahora={ahora} onOpenViaje={setStatusFilter} />

          {/* lg:pr-2: en escritorio el texto termina alineado con el contenido de la
              última columna de la tabla (ACC), no en el borde exterior. */}
          {/* En móvil el contador y la tasa se apilan (juntos no caben en una línea);
              desde sm: van en fila, contador a la izquierda y tasa a la derecha. */}
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-3 font-medium flex flex-col items-start gap-1 sm:flex-row sm:justify-between sm:items-center lg:pr-2">
            <span className="whitespace-nowrap">{visibleTickets.length} de {filteredTickets.length} registros</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {canEditTickets && !tasaLoading && <TasaIndicador tasaConfig={tasaConfig} onClick={isAdmin ? abrirVentana('TASA', setIsTasaModalOpen) : undefined} />}
            </div>
          </div>

          {/* Al llegar los datos (ticketsCargados) la lista entra con un fundido en vez de aparecer de golpe. */}
          <div key={String(ticketsCargados)} className="lg:animate-fade-in">
            <TicketsMobileList
              filteredTickets={visibleTickets}
              canEditTickets={canEditTickets}
              isTecnico={isTecnico}
              hasAnyTickets={hasActiveAssignments}
              getTecnicoColor={getTecnicoColor}
              onToggleAsignado={handleToggleAsignado}
              onEdit={abrirEdicion}
              onCancelar={setCancelarTarget}
              onCopyWhatsApp={handleCopyWhatsApp}
              onPegarUbicacion={handlePegarUbicacion}
              onVerDetalle={setDetalleTarget}
              onPreFinalizar={setPreFinalizarTarget}
              onAprobarFinalizar={setAprobarTarget}
              onResponderCobro={canEditTickets ? setResponderCobroTarget : undefined}
              onEscalar={canEditTickets ? setEscalarTarget : undefined}
              onResolverInfra={canEditTickets ? setResolverInfraTarget : undefined}
              revisando={revisando}
              onFinalizar={setFinalizarTarget}
              onTogglePrioridad={handleTogglePrioridad}
              ahora={ahora}
              onIniciarViaje={handleIniciarViaje}
              onLlegue={handleLlegue}
              onCancelarViaje={handleCancelarViaje}
            />

            <TicketsTable
              filteredTickets={visibleTickets}
              filasCambiadas={filasCambiadas}
              canEditTickets={canEditTickets}
              isTecnico={isTecnico}
              hasAnyTickets={hasActiveAssignments}
              sortBy={sortBy}
              setSortBy={setSortBy}
              getTecnicoColor={getTecnicoColor}
              onToggleAsignado={handleToggleAsignado}
              onEdit={abrirEdicion}
              onCancelar={setCancelarTarget}
              onCopyWhatsApp={handleCopyWhatsApp}
              onPegarUbicacion={handlePegarUbicacion}
              onVerDetalle={setDetalleTarget}
              onVerHistorial={setHistorialTarget}
              onPreFinalizar={setPreFinalizarTarget}
              onAprobarFinalizar={setAprobarTarget}
              onResponderCobro={canEditTickets ? setResponderCobroTarget : undefined}
              onEscalar={canEditTickets ? setEscalarTarget : undefined}
              onResolverInfra={canEditTickets ? setResolverInfraTarget : undefined}
              onFinalizar={setFinalizarTarget}
              onTogglePrioridad={handleTogglePrioridad}
              ahora={ahora}
              onIniciarViaje={handleIniciarViaje}
              onLlegue={handleLlegue}
              onCancelarViaje={handleCancelarViaje}
            />
          </div>

          {hasMore && (
            <div className="flex justify-center mt-4">
              <button onClick={loadMore} className="px-6 py-2.5 bg-white dark:bg-zinc-900 border-2 border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-sm text-sm">
                Cargar más ({filteredTickets.length - visibleTickets.length} restantes)
              </button>
            </div>
          )}
        </div>
        <PieVersion />
        </div>

        <Suspense fallback={
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" role="presentation">
            <div className="w-8 h-8 border-4 border-zinc-600 border-t-red-600 rounded-full animate-spin" aria-label="Cargando" />
          </div>
        }>
        {isCreateModalOpen && (
          <CreateTicketModal
            formData={formData}
            handleCreateChange={handleCreateChange}
            handleCreateSubmit={handleCreateSubmit}
            verificarCodigoManual={verificarCodigoManual}
            technicians={technicians}
            tickets={tickets}
            reports={reports}
            napsConocidas={napsConocidas}
            turnoSugerido={tecnicoSugerido}
            onClose={() => setIsCreateModalOpen(false)}
          />
        )}

        {editingTicket && (
          <EditTicketModal
            editingTicket={editingTicket}
            handleEditChange={handleEditChange}
            handleEditSubmit={handleEditSubmit}
            tickets={tickets}
            reports={reports}
            verificarCodigoManual={verificarCodigoManual}
            technicians={technicians}
            isTecnico={isTecnico}
            esAdmin={isAdmin}
            napsConocidas={napsConocidas}
            turnoSugerido={tecnicoSugerido}
            onClose={() => setEditingTicket(null)}
          />
        )}

        {abierta('TECNICOS', isAddTechModalOpen) && enMarco('Técnicos', Users, (
          <TechniciansModal
            technicians={technicians}
            newTech={newTech}
            setNewTech={setNewTech}
            handleAddTech={handleAddTechSubmit}
            handleDeleteTech={handleDeleteTechSeguro}
            onToggleActivo={toggleTechnicoActivoSeguro}
            verInventario={verInventario}
            onCargarTecnicosInventario={listarTecnicosInventario}
            onVincularInventario={vincularTecnicoInventarioSeguro}
            ordenTurno={ordenTurno}
            tecnicoSugerido={tecnicoSugerido}
            onGuardarOrden={guardarOrdenSeguro}
            enPagina={isAdmin}
            onClose={cerrarVentana(setIsAddTechModalOpen)}
          />
        ))}

        {abierta('USUARIOS', isUsersModalOpen) && enMarco('Usuarios', ShieldCheck, (
          <UsersModal
            users={users}
            createUser={handleCreateUser}
            setUserDisabled={setUserDisabled}
            updateUserNombre={updateUserNombre}
            setUserPuedeCerrar={setUserPuedeCerrar}
            setUserRole={setUserRole}
            setUserPuedeCrearVentas={setUserPuedeCrearVentas}
            adminResetPassword={adminResetPassword}
            currentUsername={currentUser}
            technicians={technicians}
            enPagina={isAdmin}
            onClose={cerrarVentana(setIsUsersModalOpen)}
          />
        ))}

        {finalizarTarget && (
          <AprobarFinalizarModal
            ticket={finalizarTarget}
            actual={tickets.find(t => t.id === finalizarTarget.id) || null}
            otrosRevisando={revisando.get(finalizarTarget.id)}
            montoBs={montoBsDe(tasaConfig)}
            onConfirm={confirmFinalizar}
            onGuardarValores={guardarValoresCliente}
            onCopy={copyToClipboard}
            onClose={() => setFinalizarTarget(null)}
          />
        )}

        {cancelarTarget && (
          <CancelarOrdenModal
            ticket={tickets.find(t => t.id === cancelarTarget.id) || cancelarTarget}
            onConfirmar={handleCancelar}
            onClose={() => setCancelarTarget(null)}
          />
        )}

        {abierta('CIERRE', isReportModalOpen) && enMarco('Cierre diario', BarChart, (
          <ReportsModal
            reports={reports}
            hasMoreReports={hasMoreReports}
            isLoadingReports={isLoadingReports}
            onLoadMoreReports={loadMoreReports}
            selectedReportForDetails={selectedReportForDetails}
            setSelectedReportForDetails={setSelectedReportForDetails}
            reportSearchTerm={reportSearchTerm}
            setReportSearchTerm={setReportSearchTerm}
            archivedSearchResults={archivedSearchResults}
            getTecnicoColor={getTecnicoColor}
            onRequestCierre={handleRequestCierre}
            isAdmin={isAdmin}
            usuario={currentUser}
            enPagina={isAdmin}
            onClose={cerrarVentana(setIsReportModalOpen)}
          />
        ), reports[0]?.fechaCierre ? `Último cierre: ${reports[0].fechaCierre}` : 'Todavía no hay cierres')}

        {abierta('REPORTES', isReportesOpen) && enMarco('Reportes', ClipboardList, (
          <ReportesModal
            technicians={technicians}
            tickets={tickets}
            reports={reports}
            hasMoreReports={hasMoreReports}
            isLoadingReports={isLoadingReports}
            onLoadMoreReports={loadMoreReports}
            getTecnicoColor={getTecnicoColor}
            logTecnicos={logTecnicos}
            totalesMensuales={totalesMensuales}
            usuario={currentUser}
            nombreUsuario={currentUserName || currentUser}
            esAdmin={isAdmin}
            firebaseUser={firebaseUser}
            enPagina={isAdmin}
            onClose={cerrarVentana(setIsReportesOpen)}
          />
        ))}

        {abierta('HISTORIAL', isHistoryModalOpen) && enMarco('Historial de órdenes', History, (
          <OrdersHistoryModal
            tickets={tickets}
            reports={reports}
            hasMoreReports={hasMoreReports}
            isLoadingReports={isLoadingReports}
            onLoadMoreReports={loadMoreReports}
            getTecnicoColor={getTecnicoColor}
            puedeVerPlantilla={canCerrar}
            plantillaDe={plantillaDeHistorial}
            onCopy={copyToClipboard}
            enPagina={isAdmin}
            onClose={cerrarVentana(setIsHistoryModalOpen)}
          />
        ))}

        {isCierreConfirmOpen && (
          <ConfirmModal
            color="blue"
            title="¿Confirmar Cierre?"
            description='Se moverán todos los tickets "FINALIZADO" y "CANCELADO" al historial de reportes.'
            dateInput={cierreDateInput}
            setDateInput={setCierreDateInput}
            isProcessing={isProcessing}
            confirmLabel="Sí, Cerrar Día"
            zIndexClass="z-[80]"
            onCancel={() => setIsCierreConfirmOpen(false)}
            onConfirm={handleConfirmCierre}
          />
        )}

        {isLogoutConfirmOpen && (
          <ConfirmModal
            color="red"
            title="¿Cerrar Sesión?"
            description="Deberás volver a ingresar tu usuario y clave para continuar."
            confirmLabel="Sí, Salir"
            zIndexClass="z-[70]"
            onCancel={() => setIsLogoutConfirmOpen(false)}
            onConfirm={cerrarSesion}
          />
        )}

        {uncheckWarningTicket && (
          <ConfirmModal
            color="yellow"
            title="¿Retirar Asignación?"
            description='Está a punto de retirar el check de "Enviado". Esta acción quedará registrada en el log de modificaciones de la orden.'
            confirmLabel="Sí, Retirar"
            processingLabel="Retirando..."
            zIndexClass="z-[90]"
            onCancel={() => setUncheckWarningTicket(null)}
            onConfirm={() => confirmToggleAsignado(uncheckWarningTicket, false)}
          />
        )}

        {whatsappMessage && (
          <WhatsAppMessageModal
            mensaje={whatsappMessage}
            onCopy={() => copyToClipboard(whatsappMessage)}
            onClose={() => setWhatsappMessage(null)}
          />
        )}

        {preFinalizarTarget && (
          <PreFinalizarModal
            ticket={tickets.find(t => t.id === preFinalizarTarget.id) || preFinalizarTarget}
            onConfirm={handleConfirmPreFinalizar}
            onConsultarCobro={consultarCobroRecableado}
            onClose={() => setPreFinalizarTarget(null)}
          />
        )}

        {responderCobroTarget && (
          <ResponderCobroModal
            ticket={tickets.find(t => t.id === responderCobroTarget.id) || responderCobroTarget}
            onResponder={responderConsultaCobro}
            onClose={() => setResponderCobroTarget(null)}
          />
        )}

        {escalarTarget && (
          <EscalarInfraestructuraModal
            ticket={tickets.find(t => t.id === escalarTarget.id) || escalarTarget}
            otrosRevisando={revisando.get(escalarTarget.id)}
            esTecnico={isTecnico}
            onConfirmar={handleEscalar}
            onClose={() => setEscalarTarget(null)}
          />
        )}

        {resolverInfraTarget && (
          <ResolverInfraestructuraModal
            ticket={tickets.find(t => t.id === resolverInfraTarget.id) || resolverInfraTarget}
            otrosRevisando={revisando.get(resolverInfraTarget.id)}
            onResolver={handleResolverInfra}
            onClose={() => setResolverInfraTarget(null)}
          />
        )}

        {detalleTarget && (
          <DetalleOrdenModal
            ticket={tickets.find(t => t.id === detalleTarget.id) || detalleTarget}
            onCopy={(texto, mensaje) => copyToClipboard(texto, mensaje)}
            onClose={() => setDetalleTarget(null)}
          />
        )}

        {historialTarget && (
          <HistorialOrdenModal
            ticket={tickets.find(t => t.id === historialTarget.id) || historialTarget}
            onClose={() => setHistorialTarget(null)}
          />
        )}

        {ubicacionTarget && (
          <UbicacionModal
            ticket={ubicacionTarget}
            onSave={handleGuardarUbicacion}
            onClose={() => setUbicacionTarget(null)}
          />
        )}

        {isTecnico && cobrosPendientes.length > 0 && (
          <CobroResultanteModal ticket={cobrosPendientes[0]} restantes={cobrosPendientes.length - 1} formasPago={formasPago} onCopy={copyToClipboard} onClose={cerrarCobro} />
        )}

        {aprobarTarget && (
          <AprobarFinalizarModal
            ticket={aprobarTarget}
            actual={tickets.find(t => t.id === aprobarTarget.id) || null}
            otrosRevisando={revisando.get(aprobarTarget.id)}
            montoBs={montoBsDe(tasaConfig)}
            onConfirm={handleConfirmAprobarFinalizar}
            onGuardarValores={guardarValoresCliente}
            onDevolver={handleDevolver}
            onCopy={copyToClipboard}
            onClose={() => setAprobarTarget(null)}
          />
        )}

        {abierta('TASA', isTasaModalOpen) && enMarco('Tasa y pagos', Coins, (
          <TasaBcvModal
            tasaConfig={tasaConfig}
            onActualizarAutomatica={handleActualizarTasaAutomatica}
            onActualizarManual={handleActualizarTasaManual}
            formasPago={formasPago}
            onGuardarFormasPago={handleGuardarFormasPago}
            enPagina={isAdmin}
            onClose={cerrarVentana(setIsTasaModalOpen)}
          />
        ))}

        {verInventario && abierta('INVENTARIO', isInventarioOpen) && enMarco('Envíos al inventario', PackageCheck, (
          <EnviosInventarioModal
            envios={enviosInventario}
            pendientes={enviosPendientes}
            recientes={enviosRecientes}
            cargando={cargandoRecientes}
            hayMas={hayMasEnvios}
            onCargar={cargarRecientes}
            onCargarMas={cargarMasEnvios}
            onActualizar={actualizarRecientes}
            onReintentar={reintentarEnvio}
            onReenviarAviso={reenviarAvisoEnvio}
            onReintentarTodas={reintentarTodasEnvios}
            onBuscar={buscarEnvios}
            onDescartar={descartarEnvio}
            enPagina={isAdmin}
            onClose={cerrarVentana(setIsInventarioOpen)}
          />
        ))}


        {isFormasPagoOpen && (
          <FormasPagoModal
            formasPago={formasPago}
            onCopy={copyToClipboard}
            onClose={() => setIsFormasPagoOpen(false)}
          />
        )}
        </Suspense>
      </div>
    </div>
  );
}
