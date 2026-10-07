import { useState } from 'react';
import { Ban, Check, CheckCircle2, KeyRound, Pencil, ShieldCheck, User, X } from 'lucide-react';
import { ROLES } from '../../constants';
import { getPasswordPolicyError, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy';
import { stripEmojis } from '../../utils/sanitizeInput';
import Modal from '../Modal';
import SelectMenu from '../SelectMenu';

const ROL_ITEMS = [ROLES.USUARIO, ROLES.TECNICO, ROLES.ADMIN].map(r => ({ value: r, label: r }));
const ROL_NUEVO_ITEMS = [
  { value: ROLES.USUARIO, label: 'USUARIO (sin Técnicos/Usuarios/Tasa)' },
  { value: ROLES.TECNICO, label: 'TÉCNICO (asignaciones propias y pre-finalizar)' },
  { value: ROLES.ADMIN, label: 'ADMIN (acceso total)' }
];
const SELECT_FORM_CLASS = 'w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white pl-4 pr-9 py-3 rounded-xl focus:ring-0 focus:border-red-600 outline-none font-bold transition-colors shadow-sm';

const EMPTY_NEW_USER = { usuario: '', nombre: '', clave: '', role: ROLES.USUARIO, puedeCerrar: false, tecnicoAsociado: '' };

export default function UsersModal({ users, createUser, setUserDisabled, updateUserNombre, setUserPuedeCerrar, setUserRole, adminResetPassword, currentUsername, onClose, technicians = [] }) {
  const [roleEditId, setRoleEditId] = useState(null);
  const [roleDraft, setRoleDraft] = useState('');
  const [techDraft, setTechDraft] = useState('');

  const cancelRoleEdit = () => {
    setRoleEditId(null);
    setRoleDraft('');
    setTechDraft('');
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
      return;
    }
    const policyError = getPasswordPolicyError(newUser.clave);
    if (policyError) {
      setPasswordError(policyError);
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

  return (
    <Modal onClose={onClose} zIndexClass="z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-6 py-4 border-b-2 border-red-600 flex justify-between items-center">
          <h2 className="text-lg font-black text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-red-500" /> USUARIOS</h2>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 block ml-1">CUENTAS ACTIVAS</label>
            <div className="max-h-48 overflow-y-auto border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-2 space-y-2 bg-zinc-50 dark:bg-zinc-950">
              {users.map(u => (
                <div key={u.id} className={`flex justify-between items-center p-2 rounded-lg border shadow-sm ${u.disabled ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'}`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <User className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      {editingNombreId === u.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={nombreDraft}
                            onChange={(e) => setNombreDraft(stripEmojis(e.target.value))}
                            onKeyDown={(e) => e.key === 'Enter' && saveNombre(u.id)}
                            className="text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5 w-32"
                          />
                          <button type="button" onClick={() => saveNombre(u.id)} aria-label="Guardar nombre" className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded"><Check className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                          {u.nombre || u.username}
                          <button type="button" onClick={() => startEditNombre(u)} aria-label={`Editar nombre de ${u.username}`} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><Pencil className="w-3 h-3" /></button>
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">@{u.username}</span>
                      {resettingId === u.id ? (
                        <div className="mt-1 space-y-1">
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              type="password"
                              minLength={8}
                              value={resetDraft}
                              onChange={(e) => { setResetDraft(stripEmojis(e.target.value)); setResetError(''); }}
                              onKeyDown={(e) => e.key === 'Enter' && saveResetPassword(u.id)}
                              placeholder="nueva clave"
                              className="text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5 w-32"
                            />
                            <button type="button" onClick={() => saveResetPassword(u.id)} disabled={isResetting} aria-label={`Guardar clave de ${u.username}`} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => setResettingId(null)} aria-label="Cancelar" className="p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"><X className="w-3.5 h-3.5" /></button>
                          </div>
                          {resetError && <p role="alert" className="text-[9px] text-red-600 dark:text-red-400 font-bold">{resetError}</p>}
                        </div>
                      ) : (
                        <button type="button" onClick={() => startResetPassword(u)} className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                          <KeyRound className="w-2.5 h-2.5" aria-hidden="true" /> Cambiar clave
                        </button>
                      )}
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        {u.username === currentUsername ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" title="No puedes cambiar tu propio rol">
                            {u.role}
                          </span>
                        ) : (
                          <SelectMenu
                            value={roleEditId === u.id ? roleDraft : u.role}
                            onChange={(v) => onChangeRole(u, v)}
                            disabled={togglingId === u.id}
                            ariaLabel={`Rol de ${u.username}`}
                            items={ROL_ITEMS}
                            chevronClassName="w-2.5 h-2.5 right-0.5"
                            className={`text-[9px] font-bold pl-1.5 pr-4 py-0.5 rounded border-0 cursor-pointer disabled:opacity-50 ${
                              (roleEditId === u.id ? roleDraft : u.role) === ROLES.ADMIN
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : (roleEditId === u.id ? roleDraft : u.role) === ROLES.TECNICO
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          />
                        )}
                        {roleEditId === u.id && (
                          <span className="inline-flex items-center gap-1">
                            <SelectMenu
                              value={techDraft}
                              onChange={setTechDraft}
                              ariaLabel={`Técnico asociado de ${u.username}`}
                              items={techItemsInline}
                              chevronClassName="w-2.5 h-2.5 right-0.5"
                              className="text-[9px] font-bold pl-1.5 pr-4 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0"
                            />
                            <button type="button" onClick={() => saveTechRole(u.id)} disabled={!techDraft || togglingId === u.id} aria-label={`Confirmar rol de ${u.username}`} className="p-0.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded disabled:opacity-40"><Check className="w-3 h-3" /></button>
                            <button type="button" onClick={cancelRoleEdit} aria-label="Cancelar" className="p-0.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"><X className="w-3 h-3" /></button>
                          </span>
                        )}
                        {u.role === ROLES.TECNICO && u.tecnicoAsociado && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" title="Técnico asignado a esta cuenta">
                            <User className="w-2.5 h-2.5" aria-hidden="true" /> {u.tecnicoAsociado}
                          </span>
                        )}
                        {u.role === ROLES.USUARIO && (
                          <button
                            type="button"
                            onClick={() => onTogglePuedeCerrar(u.id, !u.puedeCerrar)}
                            disabled={togglingId === u.id}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 ${u.puedeCerrar ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'}`}
                            title="Permitir realizar cierres"
                          >
                            {u.puedeCerrar ? 'Puede cerrar' : 'Sin cierres'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {u.username !== currentUsername && (
                    <button
                      type="button"
                      onClick={() => onToggleDisabled(u.id, !u.disabled)}
                      disabled={togglingId === u.id}
                      aria-label={u.disabled ? `Habilitar ${u.username}` : `Deshabilitar ${u.username}`}
                      className={`p-1.5 rounded-md transition-all disabled:opacity-50 shrink-0 ${u.disabled ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'}`}
                      title={u.disabled ? 'Habilitar' : 'Deshabilitar'}
                    >
                      {u.disabled ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              ))}
              {users.length === 0 && <p className="text-xs text-center text-zinc-500 py-3">No hay usuarios.</p>}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor="user-nombre" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">NOMBRE COMPLETO</label>
              <input id="user-nombre" required type="text" maxLength="80" value={newUser.nombre} onChange={(e) => setNewUser({ ...newUser, nombre: stripEmojis(e.target.value) })} className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white px-4 py-3 rounded-xl focus:ring-0 focus:border-red-600 outline-none transition-colors shadow-sm" placeholder="Ej. Luis Fernández" />
            </div>
            <div className="space-y-2">
              <label htmlFor="user-usuario" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">USUARIO</label>
              <input id="user-usuario" required type="text" maxLength="40" value={newUser.usuario} onChange={(e) => setNewUser({ ...newUser, usuario: stripEmojis(e.target.value) })} className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white px-4 py-3 rounded-xl focus:ring-0 focus:border-red-600 outline-none transition-colors shadow-sm" placeholder="Ej: lfernandez" />
            </div>
            <div className="space-y-2">
              <label htmlFor="user-clave" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">CLAVE</label>
              <input id="user-clave" required type="password" minLength={8} value={newUser.clave} onChange={(e) => { setNewUser({ ...newUser, clave: stripEmojis(e.target.value) }); setPasswordError(''); }} className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white px-4 py-3 rounded-xl focus:ring-0 focus:border-red-600 outline-none transition-colors shadow-sm" placeholder="mínimo 8 caracteres" />
              <p className="text-[10px] text-zinc-500 ml-1">{PASSWORD_POLICY_HINT}</p>
              {passwordError && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{passwordError}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="user-role" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">ROL</label>
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

            {newUser.role === ROLES.TECNICO && (
              <div className="space-y-2">
                <label htmlFor="user-tecnico" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">VINCULAR CON TÉCNICO REGISTRADO</label>
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
                <p className="text-[10px] text-zinc-500 ml-1">Este usuario solo verá las órdenes asignadas a este técnico.</p>
              </div>
            )}

            {userError && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{userError}</p>}

            {newUser.role === ROLES.USUARIO && (
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1 cursor-pointer">
                <input type="checkbox" checked={newUser.puedeCerrar} onChange={(e) => setNewUser({ ...newUser, puedeCerrar: e.target.checked })} className="w-4 h-4 text-red-600 rounded border-zinc-400 focus:ring-red-500 cursor-pointer" />
                Permitir realizar cierres
              </label>
            )}
            <button type="submit" disabled={isSubmitting} className={`px-6 py-3 w-full text-white font-bold rounded-xl transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{isSubmitting ? 'Creando...' : 'Crear Usuario'}</button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
