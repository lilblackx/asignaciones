import { useState } from 'react';
import { Ban, Check, CheckCircle2, KeyRound, Pencil, ShieldCheck, User, UserPlus, X } from 'lucide-react';
import { ROLES, etiquetaRol } from '../../constants';
import { errorNombresPromotora } from '../../utils/promotora';
import { getPasswordPolicyError, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy';
import { stripEmojis } from '../../utils/sanitizeInput';
import Modal from '../Modal';
import BotonLimpiarBusqueda from '../BotonLimpiarBusqueda';
import SelectMenu from '../SelectMenu';

const ROL_ITEMS = [ROLES.USUARIO, ROLES.TECNICO, ROLES.ALMACEN, ROLES.PROMOTORA, ROLES.ADMIN].map(r => ({ value: r, label: etiquetaRol(r) }));
const ROL_NUEVO_ITEMS = [
  { value: ROLES.USUARIO, label: 'USUARIO (sin Técnicos/Usuarios/Tasa y pagos)' },
  { value: ROLES.TECNICO, label: 'TÉCNICO (asignaciones propias y pre-finalizar)' },
  { value: ROLES.ALMACEN, label: 'ALMACÉN (solo ve Materiales)' },
  { value: ROLES.PROMOTORA, label: 'VENTAS (ve sus instalaciones, o todas con "Ver todas")' },
  { value: ROLES.ADMIN, label: 'ADMIN (acceso total)' }
];
const SELECT_FORM_CLASS = 'w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white pl-4 pr-9 py-3 rounded-xl focus:ring-0 focus:border-red-600 outline-none font-bold transition-colors shadow-sm';

const ORDEN_ROLES = [ROLES.ADMIN, ROLES.USUARIO, ROLES.TECNICO, ROLES.ALMACEN, ROLES.PROMOTORA];
const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const claseRol = (rol) => (rol === ROLES.ADMIN
  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  : rol === ROLES.TECNICO
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    : [ROLES.ALMACEN, ROLES.PROMOTORA].includes(rol)
      ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300');

const EMPTY_NEW_USER = { usuario: '', nombre: '', clave: '', role: ROLES.USUARIO, puedeCerrar: false, tecnicoAsociado: '', promotoraNombres: '', verTodasInstalaciones: false };

export default function UsersModal({ users, createUser, setUserDisabled, updateUserNombre, setUserPuedeCerrar, setUserRole, adminResetPassword, currentUsername, onClose, technicians = [] }) {
  const [roleEditId, setRoleEditId] = useState(null);
  const [roleDraft, setRoleDraft] = useState('');
  const [techDraft, setTechDraft] = useState('');
  const [promDraft, setPromDraft] = useState('');
  const [verTodasDraft, setVerTodasDraft] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('TODOS');
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

  const onTogglePuedeCerrar = async (id, puedeCerrar) => {
    setTogglingId(id);
    await setUserPuedeCerrar(id, puedeCerrar);
    setTogglingId(null);
  };

  const CAMPO = 'w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white px-4 py-3 rounded-xl focus:ring-0 focus:border-red-600 outline-none transition-colors shadow-sm';
  const ETIQUETA = 'text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1';
  const EDICION = 'w-full text-sm font-bold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-red-600';

  const filtros = [{ value: 'TODOS', label: 'Todos', n: users.length }, ...ORDEN_ROLES.map((r) => ({ value: r, label: etiquetaRol(r), n: users.filter((u) => u.role === r).length })).filter((f) => f.n > 0)];
  const q = sinTildes(busqueda).trim();
  const visibles = users
    .filter((u) => (filtroRol === 'TODOS' || u.role === filtroRol) && (!q || sinTildes(`${u.nombre} ${u.username}`).includes(q)))
    .sort((a, b) => ORDEN_ROLES.indexOf(a.role) - ORDEN_ROLES.indexOf(b.role) || String(a.nombre || a.username).localeCompare(String(b.nombre || b.username), 'es'));

  return (
    <Modal onClose={onClose} zIndexClass="z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-5 sm:px-6 py-4 border-b-2 border-red-600 flex justify-between items-center shrink-0">
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-red-500" /> USUARIOS</h2>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* Cuentas */}
          <section aria-label="Cuentas" className="p-4 sm:p-6 space-y-4 lg:overflow-y-auto lg:border-r lg:border-zinc-200 lg:dark:border-zinc-800">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-black tracking-wide text-zinc-700 dark:text-zinc-300">CUENTAS <span className="text-zinc-400 font-bold">({users.length})</span></h3>
              {/* En pantallas angostas el formulario queda debajo de la lista: este botón baja hasta él. */}
              <button
                type="button"
                onClick={() => { const campo = document.getElementById('user-nombre'); campo?.scrollIntoView({ behavior: 'smooth', block: 'center' }); campo?.focus({ preventScroll: true }); }}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" /> Nuevo usuario
              </button>
            </div>
            <div className="relative">
              <input
                type="search"
                aria-label="Buscar usuario"
                placeholder="Buscar por nombre o usuario"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 pl-4 pr-10 py-2.5 rounded-xl text-sm outline-none focus:border-red-600"
              />
              <BotonLimpiarBusqueda valor={busqueda} onLimpiar={() => setBusqueda('')} />
            </div>
            <div role="group" aria-label="Filtrar por rol" className="flex flex-wrap gap-2">
              {filtros.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filtroRol === f.value}
                  onClick={() => setFiltroRol(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-colors ${filtroRol === f.value ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}`}
                >
                  {f.label} <span className="opacity-80">({f.n})</span>
                </button>
              ))}
            </div>

            <ul className="space-y-3">
              {visibles.map(u => (
                <li key={u.id} className={`rounded-xl border p-3.5 space-y-3 shadow-sm ${u.disabled ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0"><User className="w-5 h-5 text-zinc-400" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      {editingNombreId === u.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="text"
                            value={nombreDraft}
                            onChange={(e) => setNombreDraft(stripEmojis(e.target.value))}
                            onKeyDown={(e) => e.key === 'Enter' && saveNombre(u.id)}
                            className={EDICION}
                          />
                          <button type="button" onClick={() => saveNombre(u.id)} aria-label="Guardar nombre" className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"><Check className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <p className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5 break-words">
                          {u.nombre || u.username}
                          <button type="button" onClick={() => startEditNombre(u)} aria-label={`Editar nombre de ${u.username}`} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><Pencil className="w-3.5 h-3.5" /></button>
                        </p>
                      )}
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">@{u.username}{u.disabled && ' · deshabilitado'}</p>
                    </div>
                    {u.username !== currentUsername && (
                      <button
                        type="button"
                        onClick={() => onToggleDisabled(u.id, !u.disabled)}
                        disabled={togglingId === u.id}
                        aria-label={u.disabled ? `Habilitar ${u.username}` : `Deshabilitar ${u.username}`}
                        className={`p-2 rounded-lg transition-all disabled:opacity-50 shrink-0 ${u.disabled ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'}`}
                        title={u.disabled ? 'Habilitar' : 'Deshabilitar'}
                      >
                        {u.disabled ? <CheckCircle2 className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
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
                    {u.role === ROLES.TECNICO && u.tecnicoAsociado && roleEditId !== u.id && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" title="Técnico asignado a esta cuenta">
                        <User className="w-3 h-3" aria-hidden="true" /> {u.tecnicoAsociado}
                      </span>
                    )}
                    {u.role === ROLES.USUARIO && (
                      <button
                        type="button"
                        onClick={() => onTogglePuedeCerrar(u.id, !u.puedeCerrar)}
                        disabled={togglingId === u.id}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 ${u.puedeCerrar ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}
                        title="Permitir realizar cierres"
                      >
                        {u.puedeCerrar ? 'Puede cerrar' : 'Sin cierres'}
                      </button>
                    )}
                    {u.role === ROLES.PROMOTORA && !(roleEditId === u.id && roleDraft === ROLES.PROMOTORA) && (
                      <>
                        <button
                          type="button"
                          onClick={() => startPromEdit(u)}
                          title="Cambiar los nombres con que aparece en las plantillas y si ve todas las instalaciones"
                          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${(u.promotoraNombres || []).length ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' : u.verTodasInstalaciones ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
                        >
                          <Pencil className="w-3 h-3" aria-hidden="true" /> {(u.promotoraNombres || []).length ? (u.promotoraNombres || []).join(' · ') : u.verTodasInstalaciones ? 'Sin nombre' : 'Sin nombre: no ve nada'}
                        </button>
                        {u.verTodasInstalaciones && (
                          <span title="Ve las instalaciones de todas las promotoras (solo lectura). Se cambia con el lápiz." className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Ve todas</span>
                        )}
                      </>
                    )}
                  </div>

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
                        className={EDICION}
                      />
                      {promError && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400">{promError}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => savePromRole(u.id)} disabled={togglingId === u.id} aria-label={`Guardar nombres de ${u.username}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-40"><Check className="w-3.5 h-3.5" /> Guardar</button>
                        <button type="button" onClick={cancelRoleEdit} aria-label="Cancelar" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold"><X className="w-3.5 h-3.5" /> Cancelar</button>
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
                        <button type="button" onClick={() => saveTechRole(u.id)} disabled={!techDraft || togglingId === u.id} aria-label={`Confirmar rol de ${u.username}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-40"><Check className="w-3.5 h-3.5" /> Guardar</button>
                        <button type="button" onClick={cancelRoleEdit} aria-label="Cancelar" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold"><X className="w-3.5 h-3.5" /> Cancelar</button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
                    {resettingId === u.id ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="password"
                            minLength={8}
                            value={resetDraft}
                            onChange={(e) => { setResetDraft(stripEmojis(e.target.value)); setResetError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && saveResetPassword(u.id)}
                            placeholder="nueva clave"
                            className={EDICION}
                          />
                          <button type="button" onClick={() => saveResetPassword(u.id)} disabled={isResetting} aria-label={`Guardar clave de ${u.username}`} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg disabled:opacity-50"><Check className="w-4 h-4" /></button>
                          <button type="button" onClick={() => setResettingId(null)} aria-label="Cancelar" className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                        {resetError && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold">{resetError}</p>}
                      </div>
                    ) : (
                      <button type="button" onClick={() => startResetPassword(u)} className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                        <KeyRound className="w-3.5 h-3.5" aria-hidden="true" /> Cambiar clave
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {users.length === 0 && <p className="text-sm text-center text-zinc-500 py-6">No hay usuarios.</p>}
            {users.length > 0 && visibles.length === 0 && <p className="text-sm text-center text-zinc-500 py-6">Ningún usuario coincide con la búsqueda.</p>}
          </section>

          {/* Nuevo usuario */}
          <section aria-label="Nuevo usuario" className="p-4 sm:p-6 border-t-2 border-zinc-200 dark:border-zinc-800 lg:border-t-0 lg:overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-sm font-black tracking-wide text-zinc-700 dark:text-zinc-300">NUEVO USUARIO</h3>
              <div className="grid gap-4 grid-cols-[minmax(0,1fr)] sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)]">
                <div className="space-y-2 min-w-0">
                  <label htmlFor="user-nombre" className={ETIQUETA}>NOMBRE COMPLETO</label>
                  <input id="user-nombre" required type="text" maxLength="80" value={newUser.nombre} onChange={(e) => setNewUser({ ...newUser, nombre: stripEmojis(e.target.value) })} className={CAMPO} placeholder="Ej. Luis Fernández" />
                </div>
                <div className="space-y-2 min-w-0">
                  <label htmlFor="user-usuario" className={ETIQUETA}>USUARIO</label>
                  <input id="user-usuario" required type="text" maxLength="40" value={newUser.usuario} onChange={(e) => setNewUser({ ...newUser, usuario: stripEmojis(e.target.value) })} className={CAMPO} placeholder="Ej: lfernandez" />
                </div>
                <div className="space-y-2 min-w-0">
                  <label htmlFor="user-clave" className={ETIQUETA}>CLAVE</label>
                  <input id="user-clave" required type="password" minLength={8} value={newUser.clave} onChange={(e) => { setNewUser({ ...newUser, clave: stripEmojis(e.target.value) }); setPasswordError(''); }} className={CAMPO} placeholder="mínimo 8 caracteres" />
                  <p className="text-[11px] text-zinc-500 ml-1">{PASSWORD_POLICY_HINT}</p>
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
                  <p className="text-[11px] text-zinc-500 ml-1">Este usuario solo verá las órdenes asignadas a este técnico.</p>
                </div>
              )}

              {newUser.role === ROLES.PROMOTORA && (
                <div className="space-y-3 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/60 dark:bg-sky-950/20 p-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={newUser.verTodasInstalaciones} onChange={(e) => { setNewUser({ ...newUser, verTodasInstalaciones: e.target.checked }); setUserError(''); }} className="w-4 h-4 text-red-600 rounded border-zinc-400 focus:ring-red-500 cursor-pointer" />
                    Ver todas las instalaciones
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
                    <p className="text-[11px] text-zinc-500 ml-1">Como aparece en la línea "Promotor:" (o "Promotora:") de las plantillas. Si lo escriben de varias formas, sepáralas con coma (Ej. Sariana, Sariana Pérez). Sin "Ver todas las instalaciones", este usuario solo verá las instalaciones cuyo promotor coincida.</p>
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
              <div className="lg:sticky lg:-bottom-6 lg:-mx-6 lg:-mb-6 lg:px-6 lg:py-4 lg:bg-zinc-50 lg:dark:bg-zinc-950">
                <button type="submit" disabled={isSubmitting} className={`px-6 py-3.5 w-full text-white font-bold rounded-xl transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{isSubmitting ? 'Creando...' : 'Crear Usuario'}</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </Modal>
  );
}
