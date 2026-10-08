import { useEffect, useState } from 'react';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, appId, firebaseConfig, NOTIFY_WORKER_URL } from '../lib/firebase';
import { usernameToAuthEmail, normalizeUsername } from '../utils/authEmail';

const SECONDARY_APP_NAME = 'user-admin-secondary';
const USA_EMULADORES = import.meta.env.VITE_USE_EMULATORS === 'true';

// Solo emulador. createUserWithEmailAndPassword firma automáticamente con la cuenta
// recién creada en la instancia de auth que se le pase. Usamos una app secundaria
// desechable para no reemplazar la sesión del admin que está creando el usuario.
async function createAuthAccount(email, password) {
  const existing = getApps().find(a => a.name === SECONDARY_APP_NAME);
  const secondaryApp = existing || initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  const secondaryAuth = getAuth(secondaryApp);
  if (!existing) connectAuthEmulator(secondaryAuth, `http://${window.location.hostname}:9099`, { disableWarnings: true });
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return credential.user.uid;
  } finally {
    await signOutSecondary(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}

export function useUsers(firebaseUser, setToastMsg) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!firebaseUser) return;
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsub = onSnapshot(usersRef, (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [firebaseUser]);

  const createUser = async ({ usuario, clave, role, nombre, puedeCerrar, tecnicoAsociado }, createdBy) => {
    const username = normalizeUsername(usuario);
    const nombreCompleto = (nombre || '').trim();
    if (!username || !clave || !nombreCompleto) return;

    if (users.some(u => u.username === username)) {
      setToastMsg({ type: 'error', text: 'Ese usuario ya existe.' });
      return;
    }

    const perfil = {
      username,
      nombre: nombreCompleto,
      role,
      tecnicoAsociado: role === 'TECNICO' ? (tecnicoAsociado || '').trim() : null,
      puedeCerrar: !!puedeCerrar,
    };

    // Producción: el alta la hace el Worker (cuenta + perfil), porque el registro
    // público de Firebase Auth está cerrado. En el emulador no hay Worker.
    if (!USA_EMULADORES) {
      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch(`${NOTIFY_WORKER_URL}/admin/create-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ ...perfil, email: usernameToAuthEmail(username), password: clave, createdBy })
        });
        if (!res.ok) {
          setToastMsg({ type: 'error', text: (await res.text()) || 'No se pudo crear el usuario.' });
          return;
        }
        setToastMsg({ type: 'success', text: 'Usuario creado exitosamente.' });
      } catch {
        setToastMsg({ type: 'error', text: 'No se pudo crear el usuario.' });
      }
      return;
    }

    try {
      const uid = await createAuthAccount(usernameToAuthEmail(username), clave);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), {
        ...perfil,
        disabled: false,
        createdAt: Date.now(),
        createdBy
      });
      setToastMsg({ type: 'success', text: 'Usuario creado exitosamente.' });
    } catch (error) {
      const message = error.code === 'auth/email-already-in-use'
        ? 'Ese usuario ya existe.'
        : error.code === 'auth/weak-password'
          ? 'La clave debe tener al menos 6 caracteres.'
          : 'No se pudo crear el usuario.';
      setToastMsg({ type: 'error', text: message });
    }
  };

  const setUserDisabled = async (userId, disabled) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), { disabled });
    setToastMsg({ type: 'success', text: disabled ? 'Usuario deshabilitado.' : 'Usuario habilitado.' });
  };

  const updateUserNombre = async (userId, nombre) => {
    const nombreCompleto = (nombre || '').trim();
    if (!nombreCompleto) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), { nombre: nombreCompleto });
    setToastMsg({ type: 'success', text: 'Nombre actualizado.' });
  };

  const setUserPuedeCerrar = async (userId, puedeCerrar) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), { puedeCerrar });
    setToastMsg({ type: 'success', text: puedeCerrar ? 'Permiso de cierres otorgado.' : 'Permiso de cierres retirado.' });
  };

  const setUserRole = async (userId, role, tecnicoAsociado) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), {
        role,
        tecnicoAsociado: role === 'TECNICO' ? (tecnicoAsociado || '').trim() : null
      });
      setToastMsg({ type: 'success', text: 'Rol actualizado.' });
    } catch {
      setToastMsg({ type: 'error', text: 'No se pudo cambiar el rol.' });
    }
  };

  const setUserTecnicoAsociado = async (userId, tecnicoAsociado) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), { tecnicoAsociado: (tecnicoAsociado || '').trim() });
    setToastMsg({ type: 'success', text: 'Técnico asociado actualizado.' });
  };

  const adminResetPassword = async (userId, newPassword) => {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(`${NOTIFY_WORKER_URL}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ targetUserId: userId, newPassword })
      });
      if (!res.ok) {
        setToastMsg({ type: 'error', text: await res.text() || 'No se pudo cambiar la clave.' });
        return;
      }
      setToastMsg({ type: 'success', text: 'Clave actualizada.' });
    } catch {
      setToastMsg({ type: 'error', text: 'No se pudo cambiar la clave.' });
    }
  };

  return { users, createUser, setUserDisabled, updateUserNombre, setUserPuedeCerrar, setUserRole, setUserTecnicoAsociado, adminResetPassword };
}
