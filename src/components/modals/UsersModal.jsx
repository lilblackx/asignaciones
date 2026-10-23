import { useState } from 'react';
import { Ban, Check, CheckCircle2, KeyRound, Pencil, Search, ShieldCheck, UserPlus, X } from 'lucide-react';
import { ROLES, etiquetaRol } from '../../constants';
import { errorNombresPromotora } from '../../utils/promotora';
import { getPasswordPolicyError, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy';
import { stripEmojis } from '../../utils/sanitizeInput';
import Modal, { CENTRADO_AMPLIO, PANEL_COMPLETO, PANEL_PAGINA } from '../Modal';
import EncabezadoModulo from '../EncabezadoModulo';
import BotonLimpiarBusqueda from '../BotonLimpiarBusqueda';
import SelectMenu from '../SelectMenu';
import Colapsable from '../Colapsable';
import Spinner from '../Spinner';
import BotonFiltros from '../BotonFiltros';
import MenuPermisos from '../MenuPermisos';
import { BUSCADOR, CAMPO, CAMPO_FORMULARIO, ETIQUETA as ETIQUETA_TABLA, TARJETA, TITULO_SECCION } from '../estilos';
import Boton from '../Boton';
import Chip from '../Chip';

// En el celular la fila es: nombre y botones arriba, y debajo el rol y los permisos lado a lado; en PC son cuatro columnas.
const COLUMNAS = 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.1fr)_9.5rem_minmax(0,1.3fr)_5.5rem]';
const ROL_ITEMS = [ROLES.USUARIO, ROLES.TECNICO, ROLES.ALMACEN, ROLES.PROMOTORA, ROLES.FINANZAS, ROLES.INFRAESTRUCTURA, ROLES.ADMIN].map(r => ({ value: r, label: etiquetaRol(r) }));
const ROL_NUEVO_ITEMS = [
  { value: ROLES.USUARIO, label: 'USUARIO (sin Técnicos/Usuarios/Tasa y pagos)' },
  { value: ROLES.TECNICO, label: 'TÉCNICO (asignaciones propias y pre-finalizar)' },
  { value: ROLES.ALMACEN, label: 'ALMACÉN (solo ve Materiales)' },
  { value: ROLES.PROMOTORA, label: 'VENTAS (ve sus instalaciones, o todas con "Ver todas")' },
  { value: ROLES.FINANZAS, label: 'FINANZAS (cobros, pago a técnicos y reportes; no toca las órdenes)' },
  { value: ROLES.INFRAESTRUCTURA, label: 'INFRAESTRUCTURA (ve las instalaciones con su NAP y puerto)' },
  { value: ROLES.ADMIN, label: 'ADMIN (acceso total)' }
];
const SELECT_FORM_CLASS = 'w-full bg-white dark:bg-zinc-950 border-2 border-zinc-400 dark:border-zinc-700 text-zinc-900 dark:text-white pl-4 pr-9 py-3 rounded-xl focus:ring-0 focus:border-red-600 outline-none font-bold transition-colors shadow-sm';

const ORDEN_ROLES = [ROLES.ADMIN, ROLES.USUARIO, ROLES.TECNICO, ROLES.ALMACEN, ROLES.PROMOTORA, ROLES.FINANZAS, ROLES.INFRAESTRUCTURA];
const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const claseRol = (rol) => (rol === ROLES.ADMIN
  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  : rol === ROLES.TECNICO
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    : [ROLES.ALMACEN, ROLES.PROMOTORA, ROLES.FINANZAS, ROLES.INFRAESTRUCTURA].includes(rol)
      ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300');

const EMPTY_NEW_USER = { usuario: '', nombre: '', clave: '', role: ROLES.USUARIO, puedeCerrar: false, tecnicoAsociado: '', promotoraNombres: '', verTodasInstalaciones: false, puedeCrearVentas: false };

export default function UsersModal({ users, createUser, setUserDisabled, updateUserNombre, setUserPuedeCerrar, setUserRole, setUserPuedeCrearVentas, adminResetPassword, currentUsername, onClose, technicians = [], enPagina = false }) {
  const [roleEditId, setRoleEditId] = useState(null);
  const [roleDraft, setRoleDraft] = useState('');
  const [techDraft, setTechDraft] = useState('');
  const [promDraft, setPromDraft] = useState('');
  const [verTodasDraft, setVerTodasDraft] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('TODOS');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [promError, setPromError] = useState('');

  const cancelRoleEdit = () => {
    setRoleEditId(null);
    setRoleDraft('');
    setTechDraft('');
    setPromDraft('');
    setVerTodasDraft(false);
    setPromError('');
  };

  // VENTAS (PROMOTORA): con qué nombre(s) aparece en las plantillas (con eso ve sus instalaciones). Sirve al cambiar el rol y para corregirlos.
  const startPromEdit = (u) => {
    setRoleEditId(u.id);
    setRoleDraft(ROLES.PROMOTORA);
    setPromDraft((u.promotoraNombres || []).join(', '));
    setVerTodasDraft(u.verTodasInstalaciones === true);
    setPromError('');
  };

  const savePromRole = async (userId) => {
    // Un perfil de ventas (ve todas) puede quedarse sin nombres: no los necesita.
    const error = verTodasDraft && !promDraft.trim() ? '' : errorNombresPromotora(promDraft);
    if (error) { setPromError(error); return; }
    setTogglingId(userId);
    await setUserRole(userId, ROLES.PROMOTORA, null, promDraft, verTodasDraft);
    setTogglingId(null);
    cancelRoleEdit();
  };

  const techItemsInline = [{ value: '', label: 'Técnico...' }, ...technicians.map(t => ({ value: t.name, label: t.name }))];
  const techItemsNuevo = [{ value: '', label: 'Selecciona el técnico...' }, ...technicians.map(t => ({ value: t.name, label: t.name }))];

  const onChangeRole = async (u, role) => {
    if (role === u.role) {
      cancelRoleEdit();
      return;
    }
    if (role === ROLES.TECNICO) {
      setRoleEditId(u.id);
      setRoleDraft(role);
      setTechDraft(u.tecnicoAsociado || '');
      return;
    }
    if (role === ROLES.PROMOTORA) {
      startPromEdit(u);
      return;
    }
    cancelRoleEdit();
    setTogglingId(u.id);
    await setUserRole(u.id, role, null);
    setTogglingId(null);
  };

  const saveTechRole = async (userId) => {
    if (!techDraft) return;
    setTogglingId(userId);
    await setUserRole(userId, ROLES.TECNICO, techDraft);
    setTogglingId(null);
    cancelRoleEdit();
  };
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);
  const [passwordError, setPasswordError] = useState('');
  const [userError, setUserError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [editingNombreId, setEditingNombreId] = useState(null);
  const [nombreDraft, setNombreDraft] = useState('');
  const [resettingId, setResettingId] = useState(null);
  const [resetDraft, setResetDraft] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const startResetPassword = (u) => {
    setResettingId(u.id);
    setResetDraft('');
    setResetError('');
  };

  const saveResetPassword = async (userId) => {
    const policyError = getPasswordPolicyError(resetDraft);
    if (policyError) {
      setResetError(policyError);
      return;
    }
    setIsResetting(true);
    await adminResetPassword(userId, resetDraft);
    setIsResetting(false);
    setResettingId(null);
    setResetDraft('');
  };

  const startEditNombre = (u) => {
    setEditingNombreId(u.id);
    setNombreDraft(u.nombre || '');
  };

  const saveNombre = async (userId) => {
    await updateUserNombre(userId, nombreDraft);
    setEditingNombreId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newUser.role === ROLES.TECNICO && !newUser.tecnicoAsociado) {
      setUserError('Debes seleccionar el técnico asociado.');
      document.getElementById('user-tecnico')?.focus();
      return;
    }
    if (newUser.role === ROLES.PROMOTORA && !newUser.verTodasInstalaciones) {
      const error = errorNombresPromotora(newUser.promotoraNombres);
      if (error) {
        setUserError(error);
        document.getElementById('user-promotora')?.focus();
        return;
      }
    }
    const policyError = getPasswordPolicyError(newUser.clave);
    if (policyError) {
      setPasswordError(policyError);
      document.getElementById('user-clave')?.focus();
      return;
    }
    setPasswordError('');
    setUserError('');
    setIsSubmitting(true);
    await createUser(newUser);
    setIsSubmitting(false);
    setNewUser(EMPTY_NEW_USER);
  };

  const onToggleDisabled = async (id, disabled) => {
    setTogglingId(id);
    await setUserDisabled(id, disabled);
    setTogglingId(null);
  };

  const onTogglePuedeCrearVentas = async (id, puedeCrearVentas) => {
    setTogglingId(id);
    await setUserPuedeCrearVentas(id, puedeCrearVentas);
    setTogglingId(null);
  };

  const onTogglePuedeCerrar = async (id, puedeCerrar) => {
    setTogglingId(id);
    await setUserPuedeCerrar(id, puedeCerrar);
    setTogglingId(null);
  };

  // Los permisos que se pueden dar a cada rol (el desplegable de la columna Permisos): las casillas son lo que se activa o no, y las acciones abren la edición
  // de lo que no es un sí o no (los nombres de la plantilla de ventas y el técnico de una cuenta de técnico). Los demás roles no tienen permisos que elegir.
  const cambiarVerTodas = async (u, valor) => {
    const nombres = u.promotoraNombres || [];
    // Quitar "ver todas" a quien no tiene nombres lo dejaría sin ver nada: se pide el nombre primero.
    if (!valor && nombres.length === 0) { startPromEdit(u); setVerTodasDraft(false); return; }
    setTogglingId(u.id);
    await setUserRole(u.id, ROLES.PROMOTORA, null, nombres.join(', '), valor);
    setTogglingId(null);
  };

  const permisosDe = (u) => {
    const ocupado = togglingId === u.id;
    if (u.role === ROLES.USUARIO) {
      return {
        resumen: u.puedeCerrar ? 'Puede cerrar' : 'Sin permisos',
        opciones: [{ clave: 'cierre', etiqueta: 'Realizar cierres', ayuda: 'Puede ejecutar el cierre del día.', marcado: u.puedeCerrar === true, deshabilitado: ocupado, onCambiar: (v) => onTogglePuedeCerrar(u.id, v) }],
        acciones: [],
      };
    }
    if (u.role === ROLES.PROMOTORA) {
      const nombres = u.promotoraNombres || [];
      const verTodas = u.verTodasInstalaciones === true;
      const creaVentas = u.puedeCrearVentas === true;
      const activos = [verTodas && 'Ve todas', creaVentas && 'Crea ventas'].filter(Boolean);
      return {
        resumen: activos.length ? activos.join(' · ') : 'Sin permisos',
        opciones: [
          { clave: 'todas', etiqueta: 'Ver todas las instalaciones', ayuda: 'Ve las de todas las promotoras, no solo las de su nombre.', marcado: verTodas, deshabilitado: ocupado, onCambiar: (v) => cambiarVerTodas(u, v) },
          { clave: 'ventas', etiqueta: 'Crear ventas', ayuda: 'Puede crear instalaciones nuevas desde su pantalla.', marcado: creaVentas, deshabilitado: ocupado, onCambiar: (v) => onTogglePuedeCrearVentas(u.id, v) },
        ],
        acciones: [{ clave: 'nombres', etiqueta: 'Nombres en las plantillas', detalle: nombres.length ? nombres.join(' · ') : verTodas ? 'Sin nombre' : 'Sin nombre: no ve nada', onClick: () => startPromEdit(u) }],
      };
    }
    if (u.role === ROLES.TECNICO) {
      return {
        resumen: u.tecnicoAsociado ? `Técnico: ${u.tecnicoAsociado}` : 'Sin técnico',
        opciones: [],
        acciones: [{ clave: 'tecnico', etiqueta: 'Técnico asociado', detalle: u.tecnicoAsociado || 'Sin elegir', onClick: () => { setRoleEditId(u.id); setRoleDraft(ROLES.TECNICO); setTechDraft(u.tecnicoAsociado || ''); } }],
      };
    }
    return { resumen: 'Sin permisos', opciones: [], acciones: [] };
  };

  const ETIQUETA = 'text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1';

  const filtros = [{ value: 'TODOS', label: 'Todos', n: users.length }, ...ORDEN_ROLES.map((r) => ({ value: r, label: etiquetaRol(r), n: users.filter((u) => u.role === r).length })).filter((f) => f.n > 0)];
  const q = sinTildes(busqueda).trim();
  const visibles = users
    .filter((u) => (filtroRol === 'TODOS' || u.role === filtroRol) && (!q || sinTildes(`${u.nombre} ${u.username}`).includes(q)))
    .sort((a, b) => ORDEN_ROLES.indexOf(a.role) - ORDEN_ROLES.indexOf(b.role) || String(a.nombre || a.username).localeCompare(String(b.nombre || b.username), 'es'));

  return (
    <Modal enPagina={enPagina} onClose={onClose} zIndexClass="z-[60]" completa>
      <div className={enPagina ? PANEL_PAGINA : `bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-zinc-300 dark:border-zinc-800 ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={ShieldCheck} titulo="Usuarios" onClose={onClose} enPagina={enPagina} />

        <div className={`flex-1 overflow-y-auto bg-fondo p-4 sm:p-6 ${CENTRADO_AMPLIO}`}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          {/* Cuentas */}
          <section aria-label="Cuentas" className={`${TARJETA} overflow-hidden`}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-300 dark:border-zinc-800">
              <h3 className={TITULO_SECCION}>Cuentas <span className="font-bold text-zinc-600 dark:text-zinc-400">({users.length})</span></h3>
              {/* En pantallas angostas el formulario queda debajo de la lista: este botón baja hasta él. */}
              <Boton variante="principal" tamano="compacto" className="lg:hidden" type="button" onClick={() => { const campo = document.getElementById('user-nombre'); campo?.scrollIntoView({ behavior: 'smooth', block: 'center' }); campo?.focus({ preventScroll: true }); }}>
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" /> Nuevo usuario
              </Boton>
            </div>
            <div className="p-3 space-y-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Buscar usuario"
                  placeholder="Buscar por nombre o usuario"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={BUSCADOR}
                />
                <BotonLimpiarBusqueda valor={busqueda} onLimpiar={() => setBusqueda('')} />
              </div>
              <BotonFiltros abierto={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} cuenta={(filtroRol !== 'TODOS' ? 1 : 0)} />
            </div>
            <Colapsable>{filtersOpen && (
              <div className="rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
              <div role="group" aria-label="Filtrar por rol" className="flex flex-wrap gap-2">
                {filtros.map((f) => (
                  <Chip activo={filtroRol === f.value} tamano="compacto" key={f.value} type="button" onClick={() => setFiltroRol(f.value)}>
                    {f.label} <span className="opacity-80">({f.n})</span>
                  </Chip>
                ))}
              </div>
              </div>
            )}</Colapsable>

            </div>
            {users.length > 0 && (
              <div className={`hidden md:grid ${COLUMNAS} gap-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 ${ETIQUETA_TABLA}`}>
                <span>Usuario</span>
                <span>Rol</span>
                <span>Permisos</span>
                <span className="text-right">Acciones</span>
              </div>
            )}
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {visibles.map(u => (
                <li key={u.id} className={`grid ${COLUMNAS} gap-x-3 gap-y-2 px-4 py-3 items-center ${u.disabled ? 'bg-zinc-100 dark:bg-zinc-950/60 opacity-60' : ''}`}>
                  <div className="min-w-0 md:col-start-1 md:row-start-1">
                      {editingNombreId === u.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="text"
                            value={nombreDraft}
                            onChange={(e) => setNombreDraft(stripEmojis(e.target.value))}
                            onKeyDown={(e) => e.key === 'Enter' && saveNombre(u.id)}
                            className={CAMPO}
                          />
                          <button type="button" onClick={() => saveNombre(u.id)} aria-label="Guardar nombre" className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"><Check className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <p className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5 break-words">
                          {u.nombre || u.username}
                          <button type="button" onClick={() => startEditNombre(u)} aria-label={`Editar nombre de ${u.username}`} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><Pencil className="w-3.5 h-3.5" /></button>
                        </p>
                      )}
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">@{u.username}{u.disabled && ' · deshabilitado'}</p>
                    </div>

                  <div className="flex items-center gap-1.5 md:justify-end md:col-start-4 md:row-start-1">
                    {resettingId !== u.id && (
                      <Boton tamano="compacto" icono={KeyRound} onClick={() => startResetPassword(u)} aria-label={`Cambiar la clave de ${u.username}`} title="Cambiar clave">
                        
                      </Boton>
                    )}
                    {u.username !== currentUsername && (
                      <Boton
                        variante={u.disabled ? 'secundario' : 'peligro'}
                        tamano="compacto"
                        icono={u.disabled ? CheckCircle2 : Ban}
                        onClick={() => onToggleDisabled(u.id, !u.disabled)}
                        disabled={togglingId === u.id}
                        aria-label={u.disabled ? `Habilitar ${u.username}` : `Deshabilitar ${u.username}`}
                        title={u.disabled ? 'Habilitar' : 'Deshabilitar'}
                        className={u.disabled ? '!border-emerald-600 !text-emerald-700 dark:!text-emerald-300' : ''}
                      >
                        
                      </Boton>
                    )}
                  </div>

                  <div className="col-span-full grid grid-cols-2 gap-2 md:contents">
                  <div className="min-w-0 md:col-start-2 md:row-start-1">
                    {u.username === currentUsername ? (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${claseRol(u.role)}`} title="No puedes cambiar tu propio rol">
                        {etiquetaRol(u.role)}
                      </span>
                    ) : (
                      <SelectMenu
                        value={roleEditId === u.id ? roleDraft : u.role}
                        onChange={(v) => onChangeRole(u, v)}
                        disabled={togglingId === u.id}
                        ariaLabel={`Rol de ${u.username}`}
                        items={ROL_ITEMS}
                        chevronClassName="w-3 h-3 right-1.5"
                        className={`text-xs font-bold pl-2.5 pr-6 py-1 rounded-lg border-0 cursor-pointer disabled:opacity-50 ${claseRol(roleEditId === u.id ? roleDraft : u.role)}`}
                      />
                    )}
                  </div>
                  <div className="min-w-0 md:col-start-3 md:row-start-1">
                    <MenuPermisos ariaLabel={`Permisos de ${u.username}`} {...permisosDe(u)} deshabilitado={permisosDe(u).opciones.length === 0 && permisosDe(u).acciones.length === 0} />
                  </div>
                  </div>

                  {(roleEditId === u.id && (roleDraft === ROLES.PROMOTORA || roleDraft === ROLES.TECNICO)) || resettingId === u.id ? (
                    <div className="col-span-full space-y-3">
                      {roleEditId === u.id && roleDraft === ROLES.PROMOTORA && (
                    <div className="rounded-lg border border-sky-200 dark:border-sky-900/50 bg-sky-50/60 dark:bg-sky-950/20 p-3 space-y-2.5">
                      <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                        <input type="checkbox" checked={verTodasDraft} onChange={(e) => { setVerTodasDraft(e.target.checked); setPromError(''); }} className="w-4 h-4 text-red-600 rounded border-zinc-400 focus:ring-red-500 cursor-pointer" />
                        Ver todas las instalaciones
                      </label>
                      <input
                        type="text"
                        value={promDraft}
                        onChange={(e) => { setPromDraft(e.target.value); setPromError(''); }}
                        aria-label={`Nombres del promotor ${u.username} en las plantillas`}
                        placeholder={verTodasDraft ? 'Nombre en la plantilla (opcional)' : 'Nombre en la plantilla (separa varios con coma)'}
                        maxLength="200"
                        className={CAMPO}
                      />
                      {promError && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400">{promError}</p>}
                      <div className="flex gap-2">
                        <Boton variante="principal" tamano="compacto" type="button" onClick={() => savePromRole(u.id)} disabled={togglingId === u.id} aria-label={`Guardar nombres de ${u.username}`}><Check className="w-3.5 h-3.5" /> Guardar</Boton>
                        <Boton variante="secundario" tamano="compacto" type="button" onClick={cancelRoleEdit} aria-label="Cancelar"><X className="w-3.5 h-3.5" /> Cancelar</Boton>
                      </div>
                    </div>
                  )}

                  {roleEditId === u.id && roleDraft === ROLES.TECNICO && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2.5">
                      <SelectMenu
                        value={techDraft}
                        onChange={setTechDraft}
                        ariaLabel={`Técnico asociado de ${u.username}`}
                        items={techItemsInline}
                        chevronClassName="w-3 h-3 right-2"
                        className="w-full text-sm font-bold pl-3 pr-7 py-2 rounded-lg bg-white dark:bg-zinc-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-900/60"
                      />
                      <div className="flex gap-2">
                        <Boton variante="principal" tamano="compacto" type="button" onClick={() => saveTechRole(u.id)} disabled={!techDraft || togglingId === u.id} aria-label={`Confirmar rol de ${u.username}`}><Check className="w-3.5 h-3.5" /> Guardar</Boton>
                        <Boton variante="secundario" tamano="compacto" type="button" onClick={cancelRoleEdit} aria-label="Cancelar"><X className="w-3.5 h-3.5" /> Cancelar</Boton>
                      </div>
                    </div>
                  )}
                      {resettingId === u.id && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="password"
                            minLength={8}
                            value={resetDraft}
                            onChange={(e) => { setResetDraft(stripEmojis(e.target.value)); setResetError(''); }}
                            aria-invalid={!!resetError}
                            onKeyDown={(e) => e.key === 'Enter' && saveResetPassword(u.id)}
                            placeholder="nueva clave"
                            className={CAMPO}
                          />
                          <button type="button" onClick={() => saveResetPassword(u.id)} disabled={isResetting} aria-label={`Guardar clave de ${u.username}`} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg disabled:opacity-50"><Check className="w-4 h-4" /></button>
                          <button type="button" onClick={() => setResettingId(null)} aria-label="Cancelar" className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                        {resetError && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold">{resetError}</p>}
                      </div>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {users.length === 0 && <p className="text-sm text-center text-zinc-600 dark:text-zinc-500 py-6">No hay usuarios.</p>}
            {users.length > 0 && visibles.length === 0 && <p className="text-sm text-center text-zinc-600 dark:text-zinc-500 py-6">Ningún usuario coincide con la búsqueda.</p>}
          </section>

          {/* Nuevo usuario */}
          <section aria-label="Nuevo usuario" className={`${TARJETA} p-4`}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className={TITULO_SECCION}>Nuevo usuario</h3>
              <div className="grid gap-4 grid-cols-[minmax(0,1fr)] sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)]">
                <div className="space-y-2 min-w-0">
                  <label htmlFor="user-nombre" className={ETIQUETA}>NOMBRE COMPLETO</label>
                  <input id="user-nombre" required type="text" maxLength="80" value={newUser.nombre} onChange={(e) => setNewUser({ ...newUser, nombre: stripEmojis(e.target.value) })} className={CAMPO_FORMULARIO} placeholder="Ej. Luis Fernández" />
                </div>
                <div className="space-y-2 min-w-0">
                  <label htmlFor="user-usuario" className={ETIQUETA}>USUARIO</label>
                  <input id="user-usuario" required type="text" maxLength="40" value={newUser.usuario} onChange={(e) => setNewUser({ ...newUser, usuario: stripEmojis(e.target.value) })} className={CAMPO_FORMULARIO} placeholder="Ej: lfernandez" />
                </div>
                <div className="space-y-2 min-w-0">
                  <label htmlFor="user-clave" className={ETIQUETA}>CLAVE</label>
                  <input id="user-clave" required type="password" minLength={8} value={newUser.clave} onChange={(e) => { setNewUser({ ...newUser, clave: stripEmojis(e.target.value) }); setPasswordError(''); }} className={CAMPO_FORMULARIO} placeholder="mínimo 8 caracteres" />
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-500 ml-1">{PASSWORD_POLICY_HINT}</p>
                  {passwordError && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold ml-1">{passwordError}</p>}
                </div>
                <div className="space-y-2 min-w-0">
                  <label htmlFor="user-role" className={ETIQUETA}>ROL</label>
                  <SelectMenu
                    id="user-role"
                    ariaLabel="Rol"
                    value={newUser.role}
                    onChange={(v) => { setNewUser({ ...newUser, role: v }); setUserError(''); }}
                    items={ROL_NUEVO_ITEMS}
                    className={SELECT_FORM_CLASS}
                    chevronClassName="w-4 h-4 right-3"
                  />
                </div>
              </div>

              {newUser.role === ROLES.TECNICO && (
                <div className="space-y-2 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-4">
                  <label htmlFor="user-tecnico" className={ETIQUETA}>VINCULAR CON TÉCNICO REGISTRADO</label>
                  <SelectMenu
                    id="user-tecnico"
                    ariaLabel="Vincular con técnico registrado"
                    value={newUser.tecnicoAsociado}
                    onChange={(selTech) => {
                      setNewUser({
                        ...newUser,
                        tecnicoAsociado: selTech,
                        nombre: newUser.nombre || selTech
                      });
                      setUserError('');
                    }}
                    items={techItemsNuevo}
                    className={SELECT_FORM_CLASS}
                    chevronClassName="w-4 h-4 right-3"
                  />
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-500 ml-1">Este usuario solo verá las órdenes asignadas a este técnico.</p>
                </div>
              )}

              {newUser.role === ROLES.PROMOTORA && (
                <div className="space-y-3 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/60 dark:bg-sky-950/20 p-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={newUser.verTodasInstalaciones} onChange={(e) => { setNewUser({ ...newUser, verTodasInstalaciones: e.target.checked }); setUserError(''); }} className="w-4 h-4 text-red-600 rounded border-zinc-400 focus:ring-red-500 cursor-pointer" />
                    Ver todas las instalaciones
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={newUser.puedeCrearVentas} onChange={(e) => setNewUser({ ...newUser, puedeCrearVentas: e.target.checked })} className="w-4 h-4 text-red-600 rounded border-zinc-400 focus:ring-red-500 cursor-pointer" />
                    Puede crear ventas
                  </label>
                  <div className="space-y-2">
                    <label htmlFor="user-promotora" className={ETIQUETA}>NOMBRE EN LAS PLANTILLAS{newUser.verTodasInstalaciones && <span className="font-normal text-zinc-400"> (opcional)</span>}</label>
                    <input
                      id="user-promotora"
                      type="text"
                      maxLength="200"
                      value={newUser.promotoraNombres}
                      onChange={(e) => { setNewUser({ ...newUser, promotoraNombres: e.target.value }); setUserError(''); }}
                      placeholder="Ej. Sariana"
                      className={SELECT_FORM_CLASS}
                    />
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-500 ml-1">Como aparece en la línea "Promotor:" (o "Promotora:") de las plantillas. Si lo escriben de varias formas, sepáralas con coma (Ej. Sariana, Sariana Pérez). Sin "Ver todas las instalaciones", este usuario solo verá las instalaciones cuyo promotor coincida.</p>
                  </div>
                </div>
              )}

              {newUser.role === ROLES.USUARIO && (
                <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1 cursor-pointer">
                  <input type="checkbox" checked={newUser.puedeCerrar} onChange={(e) => setNewUser({ ...newUser, puedeCerrar: e.target.checked })} className="w-4 h-4 text-red-600 rounded border-zinc-400 focus:ring-red-500 cursor-pointer" />
                  Permitir realizar cierres
                </label>
              )}

              {userError && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold ml-1">{userError}</p>}

              {/* En PC, con el formulario largo (rol Ventas o Técnico), el botón se queda a la vista al desplazar. */}
              <div className="lg:sticky lg:bottom-0 lg:-mx-4 lg:-mb-4 lg:px-4 lg:py-3 lg:rounded-b-xl lg:bg-white lg:dark:bg-zinc-900 lg:border-t lg:border-zinc-200 lg:dark:border-zinc-800">
                <Boton variante="principal" tamano="grande" className="w-full" type="submit" disabled={isSubmitting}>{isSubmitting && <Spinner />}{isSubmitting ? 'Creando...' : 'Crear Usuario'}</Boton>
              </div>
            </form>
          </section>
          </div>
        </div>
      </div>
    </Modal>
  );
}
