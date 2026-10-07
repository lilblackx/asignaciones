import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ROLES, siguienteColorTecnico } from './constants';
import { getEnvioInfo } from './utils/ticketDisplay';
import { normalizarUbicacion } from './utils/ubicacion';
import { avisoTasaDesactualizada } from './utils/tasa';
import TasaIndicador from './components/TasaIndicador';
import { crearConAviso } from './utils/errores';
import { useAuth } from './hooks/useAuth';
import { usePushToken } from './hooks/usePushToken';
import { useToast } from './hooks/useToast';
import { useNotifications } from './hooks/useNotifications';
import { useTechnicians } from './hooks/useTechnicians';
import { useUsers } from './hooks/useUsers';
import { useTickets } from './hooks/useTickets';
import { useReports } from './hooks/useReports';
import { useFilteredTickets } from './hooks/useFilteredTickets';
import { useArchivedSearch } from './hooks/useArchivedSearch';
import { useTasaBcv } from './hooks/useTasaBcv';
import { useTurnoInstalaciones } from './hooks/useTurnoInstalaciones';
import { esProgramadaFutura } from './utils/programada';
import { esVentaDelTecnico } from './utils/tecnicoVenta';
import { generarMensajeDesdePlantilla, generarMensajeWhatsApp, generarMensajeWhatsAppInstalacion, tipoUsaPlantillaPromotora } from './utils/whatsapp';
import { stripEmojis } from './utils/sanitizeInput';

import LoadingScreen from './components/LoadingScreen';
import LoginScreen from './components/LoginScreen';
import Toast from './components/Toast';
import Header from './components/Header';
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
const OrdersHistoryModal = lazy(() => import('./components/modals/OrdersHistoryModal'));
const WhatsAppMessageModal = lazy(() => import('./components/modals/WhatsAppMessageModal'));
const TasaBcvModal = lazy(() => import('./components/modals/TasaBcvModal'));
const PreFinalizarModal = lazy(() => import('./components/modals/PreFinalizarModal'));
const AprobarFinalizarModal = lazy(() => import('./components/modals/AprobarFinalizarModal'));
const UbicacionModal = lazy(() => import('./components/modals/UbicacionModal'));
const HistorialOrdenModal = lazy(() => import('./components/modals/HistorialOrdenModal'));

const EMPTY_FORM = () => ({
  fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  fechaProgramada: '',
  codigo: '', nombre: '', cedula: '', tipoDocumento: 'V', direccion: '', telefono: '', nap: '', napCoordenadas: '', ubicacion: '',
  tipoTrabajo: 'AVERÍA', falla: '', tecnico: '', observacion: '', observacionInterna: false, estado: 'PENDIENTE',
  plantillaOriginal: '', ventaTecnico: ''
});

export default function App() {
  const { firebaseUser, uid, currentUser, currentUserName, role, tecnicoAsociado, isTecnico, canCerrar, authReady, connectionError, loginData, setLoginData, loginError, handleLogin, handleLogout } = useAuth();
  usePushToken(uid);
  const { toastMsg, setToastMsg } = useToast();
  const conAviso = crearConAviso(setToastMsg);
  const notifications = useNotifications(currentUser);

  const [isDarkMode, setIsDarkMode] = useState(true);
  const isAdmin = role === ROLES.ADMIN;
  const canEditTickets = role === ROLES.ADMIN || role === ROLES.USUARIO;

  const { technicians, getTecnicoColor, handleAddTech, handleDeleteTech, toggleTechnicoActivo } = useTechnicians(firebaseUser, setToastMsg, role, tecnicoAsociado, currentUser, notifications.addNotification);
  const { users, createUser, setUserDisabled, updateUserNombre, setUserPuedeCerrar, setUserRole, adminResetPassword } = useUsers(firebaseUser, setToastMsg);
  const { tickets, createTicket, verificarCodigoManual, updateTicket, softDeleteTicket, toggleAsignado, guardarUbicacion, preFinalizarTicket, aprobarFinalizarTicket, finalizarTicket, deleteTicketsByIds } = useTickets(firebaseUser, currentUser, setToastMsg, role, tecnicoAsociado, notifications.addNotification);
  const { reports, isProcessing, cerrarDia, hasMoreReports, isLoadingReports, loadMoreReports } = useReports(firebaseUser, canCerrar, currentUser, tickets, deleteTicketsByIds, setToastMsg);
  const { config: tasaConfig, loading: tasaLoading, actualizarAutomatica, actualizarManual } = useTasaBcv(firebaseUser);
  const { orden: ordenTurno, tecnicoSugerido, guardarOrden, avanzarTurno } = useTurnoInstalaciones(firebaseUser, technicians, setToastMsg);

  const copyToClipboard = async (mensaje, textoExito = 'Plantilla copiada, lista para WhatsApp.', tipoExito = 'success') => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setToastMsg({ type: tipoExito, text: textoExito, ...(tipoExito === 'aviso' ? { duration: 8000 } : {}) });
      return true;
    } catch {
      setToastMsg({ type: 'error', text: 'No se pudo copiar la plantilla.' });
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
    // (carga manual) se mantiene el mensaje de siempre.
    if (tipoUsaPlantillaPromotora(ticket.tipoTrabajo) && ticket.plantillaOriginal?.trim()) return generarMensajeDesdePlantilla(ticketConOperador);
    return generarMensajeWhatsApp(ticketConOperador, tasaConfig);
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

  // Un solo intento por sesión: si el ADMIN abre la app y la tasa no es de hoy,
  // se refresca sola. No sustituye un cron real (no hay backend en plan Spark),
  // pero cubre el caso más común de "se me olvidó actualizarla".
  const tasaAutoCheckDone = useRef(false);
  useEffect(() => {
    if (!isAdmin || tasaLoading || tasaAutoCheckDone.current) return;
    tasaAutoCheckDone.current = true;

    const esDeHoy = tasaConfig?.actualizadoEn && new Date(tasaConfig.actualizadoEn).toDateString() === new Date().toDateString();
    if (esDeHoy) return;

    (async () => {
      const ok = await actualizarAutomatica();
      setToastMsg({
        type: ok ? 'success' : 'error',
        text: ok
          ? 'Tasa BCV desactualizada: se refrescó automáticamente al abrir la app.'
          : 'La tasa BCV está desactualizada y no se pudo refrescar sola. Revísala en Tasa.'
      });
    })();
    // Deliberadamente solo [isAdmin, tasaLoading]: el intento único por sesión ya
    // lo controla el ref de arriba; sumar el resto de dependencias no cambia el
    // comportamiento (el ref corta antes) pero sí dispara el effect de más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tasaLoading]);

  // Para TECNICO: solo sus propias órdenes. Para otros: todos los tickets.
  const ticketsParaVer = isTecnico && tecnicoAsociado
    ? tickets.filter(t => t.tecnico?.toUpperCase() === tecnicoAsociado.toUpperCase())
    : tickets;

  // Para el estado vacío: si el técnico no tiene ninguna orden ACTIVA (aunque
  // sí tenga historial de finalizadas/canceladas), la vista por defecto ("TODOS"
  // solo muestra activas) igual da 0 resultados — eso no es "tus filtros no
  // coinciden", es que no tiene trabajo pendiente ahora mismo.
  const hasActiveAssignments = isTecnico
    ? ticketsParaVer.some(t => (t.estado === 'PENDIENTE' && !esProgramadaFutura(t)) || t.estado === 'PRE-FINALIZADO' || t.estado === 'PRE-FINALIZADA')
    : tickets.length > 0;

  const { searchTerm, setSearchTerm, statusFilter, setStatusFilter, tipoFilter, setTipoFilter, sortBy, setSortBy, filteredTickets, visibleTickets, hasMore, loadMore } = useFilteredTickets(ticketsParaVer, { ocultarProgramadasFuturas: isTecnico });

  // Contador persistente (no depende de haber visto el toast/sonido): se queda
  // hasta que las aprueben, así nadie se lo pierde por estar lejos de la pantalla.
  const preFinalizadoCount = tickets.filter(t => t.estado === 'PRE-FINALIZADO').length;  const handleOpenPreFinalizados = () => setStatusFilter('PRE-FINALIZADO');
  // Vista por defecto del dashboard: sin búsqueda, órdenes activas, más recientes.
  const handleGoHome = () => {
    setSearchTerm('');
    setStatusFilter('TODOS');
    setTipoFilter('TODOS');
    setSortBy('DEFECTO');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const { reportSearchTerm, setReportSearchTerm, archivedSearchResults } = useArchivedSearch(reports);

  const [isAddTechModalOpen, setIsAddTechModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isTasaModalOpen, setIsTasaModalOpen] = useState(false);
  const [newTech, setNewTech] = useState({ name: '', color: null });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [deletingTicketId, setDeletingTicketId] = useState(null);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedReportForDetails, setSelectedReportForDetails] = useState(null);

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

  const [formData, setFormData] = useState(EMPTY_FORM());

  const handleCreateChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : stripEmojis(value) }));
  };

  // Si createTicket falla, conAviso muestra el error y esta función se corta ahí:
  // el modal sigue abierto con lo escrito (no se cierra ni se limpia el formulario).
  const handleCreateSubmit = conAviso(async (e) => {
    e.preventDefault();
    const nuevoTicket = await createTicket(formData);
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
      setWhatsappMessage(buildWhatsAppMessage(nuevoTicket));
    }
  }, 'No se pudo crear la orden.');

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditingTicket(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : stripEmojis(value) }));
  };

  const handleEditSubmit = conAviso(async (e) => {
    e.preventDefault();
    const originalTicket = tickets.find(t => t.id === editingTicket.id);
    const guardado = await updateTicket(editingTicket);
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
    await preFinalizarTicket(ticket, extra);
    setPreFinalizarTarget(null);
  }, 'No se pudo pre-finalizar la orden.');

  const handleConfirmAprobarFinalizar = conAviso(async (ticket) => {
    await aprobarFinalizarTicket(ticket);
    setAprobarTarget(null);
  }, 'No se pudo aprobar la orden.');

  const confirmFinalizar = conAviso(async () => {
    await finalizarTicket(finalizarTarget);
    setFinalizarTarget(null);
  }, 'No se pudo finalizar la orden.');

  const confirmDelete = conAviso(async () => {
    await softDeleteTicket(deletingTicketId);
    setDeletingTicketId(null);
  }, 'No se pudo eliminar la orden.');

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
      setEditingTicket(ticket);
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
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">

        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />

        <Header
          currentUser={currentUser}
          currentUserName={currentUserName}
          role={role}
          canEditTickets={canEditTickets}
          canCerrar={canCerrar}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onOpenReports={() => setIsReportModalOpen(true)}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onOpenTechnicians={() => setIsAddTechModalOpen(true)}
          onOpenUsers={() => setIsUsersModalOpen(true)}
          onOpenTasa={() => setIsTasaModalOpen(true)}
          onOpenCreate={handleOpenCreateModal}
          handleLogout={() => setIsLogoutConfirmOpen(true)}
          preFinalizadoCount={preFinalizadoCount}
          onOpenPreFinalizados={handleOpenPreFinalizados}
          onGoHome={handleGoHome}          notifications={notifications}
        />

        <div className="p-4 max-w-[1400px] mx-auto w-full flex-1">
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

          <TechnicianWorkload tickets={tickets} technicians={technicians} getTecnicoColor={getTecnicoColor} canEditTickets={canEditTickets} isTecnico={isTecnico} onToggleActivo={toggleTechnicoActivoSeguro} onOpenSinTecnico={() => setStatusFilter('PENDIENTE_SIN_TECNICO')} />

          {/* lg:pr-2: en escritorio el texto termina alineado con el contenido de la
              última columna de la tabla (ACC), no en el borde exterior. */}
          {/* En móvil el contador y la tasa se apilan (juntos no caben en una línea);
              desde sm: van en fila, contador a la izquierda y tasa a la derecha. */}
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-3 font-medium flex flex-col items-start gap-1 sm:flex-row sm:justify-between sm:items-center lg:pr-2">
            <span className="whitespace-nowrap">{visibleTickets.length} de {filteredTickets.length} registros</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {statusFilter === 'ELIMINADOS' && <span className="text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">Viendo papelera</span>}
              {canEditTickets && !tasaLoading && <TasaIndicador tasaConfig={tasaConfig} onClick={isAdmin ? () => setIsTasaModalOpen(true) : undefined} />}
            </div>
          </div>

          <TicketsMobileList
            filteredTickets={visibleTickets}
            canEditTickets={canEditTickets}
            isTecnico={isTecnico}
            hasAnyTickets={hasActiveAssignments}
            getTecnicoColor={getTecnicoColor}
            onToggleAsignado={handleToggleAsignado}
            onEdit={setEditingTicket}
            onDelete={setDeletingTicketId}
            onCopyWhatsApp={handleCopyWhatsApp}
            onPegarUbicacion={handlePegarUbicacion}
            onPreFinalizar={setPreFinalizarTarget}
            onAprobarFinalizar={setAprobarTarget}
            onFinalizar={setFinalizarTarget}
          />

          <TicketsTable
            filteredTickets={visibleTickets}
            canEditTickets={canEditTickets}
            isTecnico={isTecnico}
            hasAnyTickets={hasActiveAssignments}
            sortBy={sortBy}
            setSortBy={setSortBy}
            getTecnicoColor={getTecnicoColor}
            onToggleAsignado={handleToggleAsignado}
            onEdit={setEditingTicket}
            onDelete={setDeletingTicketId}
            onCopyWhatsApp={handleCopyWhatsApp}
            onPegarUbicacion={handlePegarUbicacion}
            onVerHistorial={setHistorialTarget}
            onPreFinalizar={setPreFinalizarTarget}
            onAprobarFinalizar={setAprobarTarget}
            onFinalizar={setFinalizarTarget}
          />

          {hasMore && (
            <div className="flex justify-center mt-4">
              <button onClick={loadMore} className="px-6 py-2.5 bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-sm text-sm">
                Cargar más ({filteredTickets.length - visibleTickets.length} restantes)
              </button>
            </div>
          )}
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
            turnoSugerido={tecnicoSugerido}
            onClose={() => setIsCreateModalOpen(false)}
          />
        )}

        {editingTicket && (
          <EditTicketModal
            editingTicket={editingTicket}
            handleEditChange={handleEditChange}
            handleEditSubmit={handleEditSubmit}
            verificarCodigoManual={verificarCodigoManual}
            technicians={technicians}
            isTecnico={isTecnico}
            turnoSugerido={tecnicoSugerido}
            onClose={() => setEditingTicket(null)}
          />
        )}

        {isAddTechModalOpen && (
          <TechniciansModal
            technicians={technicians}
            newTech={newTech}
            setNewTech={setNewTech}
            handleAddTech={handleAddTechSubmit}
            handleDeleteTech={handleDeleteTechSeguro}
            onToggleActivo={toggleTechnicoActivoSeguro}
            ordenTurno={ordenTurno}
            tecnicoSugerido={tecnicoSugerido}
            onGuardarOrden={guardarOrdenSeguro}
            onClose={() => setIsAddTechModalOpen(false)}
          />
        )}

        {isUsersModalOpen && (
          <UsersModal
            users={users}
            createUser={handleCreateUser}
            setUserDisabled={setUserDisabled}
            updateUserNombre={updateUserNombre}
            setUserPuedeCerrar={setUserPuedeCerrar}
            setUserRole={setUserRole}
            adminResetPassword={adminResetPassword}
            currentUsername={currentUser}
            technicians={technicians}
            onClose={() => setIsUsersModalOpen(false)}
          />
        )}

        {finalizarTarget && (
          <ConfirmModal
            color="blue"
            title="¿Finalizar Orden?"
            description={`La orden ${finalizarTarget.codigo || ''} (${finalizarTarget.nombre || 'sin nombre'}) pasará a FINALIZADO y quedará registrado en el historial.`}
            confirmLabel="Sí, Finalizar"
            processingLabel="Finalizando..."
            zIndexClass="z-[70]"
            onCancel={() => setFinalizarTarget(null)}
            onConfirm={confirmFinalizar}
          />
        )}

        {deletingTicketId !== null && (
          <ConfirmModal
            color="red"
            title="¿Eliminar Orden?"
            description='La orden pasará a la papelera y quedará registrado que usted la eliminó.'
            confirmLabel="Sí, Eliminar"
            processingLabel="Eliminando..."
            zIndexClass="z-[70]"
            onCancel={() => setDeletingTicketId(null)}
            onConfirm={confirmDelete}
          />
        )}

        {isReportModalOpen && (
          <ReportsModal
            tickets={tickets}
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
            onClose={() => setIsReportModalOpen(false)}
          />
        )}

        {isHistoryModalOpen && (
          <OrdersHistoryModal
            tickets={tickets}
            reports={reports}
            hasMoreReports={hasMoreReports}
            isLoadingReports={isLoadingReports}
            onLoadMoreReports={loadMoreReports}
            getTecnicoColor={getTecnicoColor}
            onClose={() => setIsHistoryModalOpen(false)}
          />
        )}

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
            onConfirm={handleLogout}
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
            ticket={preFinalizarTarget}
            onConfirm={handleConfirmPreFinalizar}
            onClose={() => setPreFinalizarTarget(null)}
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

        {aprobarTarget && (
          <AprobarFinalizarModal
            ticket={aprobarTarget}
            onConfirm={handleConfirmAprobarFinalizar}
            onClose={() => setAprobarTarget(null)}
          />
        )}

        {isTasaModalOpen && (
          <TasaBcvModal
            tasaConfig={tasaConfig}
            onActualizarAutomatica={handleActualizarTasaAutomatica}
            onActualizarManual={handleActualizarTasaManual}
            onClose={() => setIsTasaModalOpen(false)}
          />
        )}
        </Suspense>
      </div>
    </div>
  );
}
