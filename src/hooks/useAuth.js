import { useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { onSnapshot } from '../lib/medidorFirestore.js';
import { auth, db, appId, borrarCacheLocal } from '../lib/firebase';
import { usernameToAuthEmail } from '../utils/authEmail';
import { MENSAJE_SESION_VENCIDA, msParaVencer, sesionVencida } from '../utils/sesion';

const GENERIC_LOGIN_ERROR = 'Usuario o clave incorrectos.';
// Al vencer la sesión la página se recarga: esta marca (en la pestaña, no en el disco) le dice a la pantalla de inicio por qué se cerró.
const CLAVE_SESION_VENCIDA = 'asignaciones:sesion-vencida';
const motivoDelCierre = () => {
  try { return sessionStorage.getItem(CLAVE_SESION_VENCIDA) ? MENSAJE_SESION_VENCIDA : ''; } catch { return ''; }
};

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [loginData, setLoginData] = useState({ usuario: '', clave: '' });
  const [loginError, setLoginError] = useState(motivoDelCierre);

  useEffect(() => {
    const timeoutId = setTimeout(() => setConnectionError(true), 10000);

    let unsubProfile = null;
    const stopProfile = () => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      clearTimeout(timeoutId);
      stopProfile();
      if (!u) {
        setFirebaseUser(null);
        setProfile(null);
        setAuthReady(true);
        return;
      }

      // Escucha el perfil propio en vivo: cambios de rol/técnico se reflejan al
      // instante y una cuenta deshabilitada o eliminada cierra la sesión.
      let first = true;
      const reject = (disabled) => {
        stopProfile();
        signOut(auth).catch(() => {});
        setFirebaseUser(null);
        setProfile(null);
        setLoginError(disabled ? 'Esta cuenta fue deshabilitada.' : GENERIC_LOGIN_ERROR);
        setAuthReady(true);
      };

      unsubProfile = onSnapshot(
        doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid),
        (snap) => {
          const profileData = snap.exists() ? snap.data() : null;
          if (!profileData || profileData.disabled) {
            reject(!!profileData?.disabled);
            return;
          }
          if (first) {
            first = false;
            setFirebaseUser(u);
            setAuthReady(true);
          }
          setProfile(profileData);
        },
        () => reject(false)
      );
    });
    return () => {
      clearTimeout(timeoutId);
      stopProfile();
      unsubscribe();
    };
  }, []);

  // La marca solo sirve para el mensaje de la pantalla de inicio: se borra al mostrarlo.
  useEffect(() => {
    try { sessionStorage.removeItem(CLAVE_SESION_VENCIDA); } catch { /* sin almacenamiento: no hay marca que borrar */ }
  }, []);

  // La sesión dura 24 horas desde que la persona escribió su clave, y 7 días si es técnico (ver utils/sesion.js). Al vencer se cierra igual que al salir: se borra la
  // caché del dispositivo y se vuelve al inicio con un aviso. Se vigila con un temporizador y también al volver a la app (un teléfono con la
  // pantalla apagada pausa los temporizadores, y a las reglas de Firestore ya no les vale esa sesión).
  const rol = profile?.role || null;
  useEffect(() => {
    if (!firebaseUser || !rol) return undefined;
    let cancelado = false;
    let cerrando = false;
    let temporizador = null;
    let inicioDeSesion = null;
    const cerrarPorVencimiento = async () => {
      if (cerrando) return;
      cerrando = true;
      try { sessionStorage.setItem(CLAVE_SESION_VENCIDA, '1'); } catch { /* sin almacenamiento: se cierra igual, sin el aviso */ }
      try { await signOut(auth); } catch { /* sin conexión: la caché se borra y se recarga igual */ }
      await borrarCacheLocal();
      window.location.reload();
    };
    const revisar = () => { if (inicioDeSesion !== null && sesionVencida(inicioDeSesion, rol)) cerrarPorVencimiento(); };
    const alVolver = () => { if (document.visibilityState === 'visible') revisar(); };
    const programar = (inicio) => {
      if (cancelado) return;
      inicioDeSesion = inicio;
      const falta = msParaVencer(inicio, rol);
      if (falta === null) return;
      if (falta === 0) { cerrarPorVencimiento(); return; }
      temporizador = setTimeout(cerrarPorVencimiento, falta);
    };
    // La hora del inicio de sesión viene en el token (refrescarlo no la cambia). Sin conexión puede no poder leerse: se usa la que guarda la cuenta.
    firebaseUser.getIdTokenResult()
      .then((r) => programar(r.authTime))
      .catch(() => programar(firebaseUser.metadata?.lastSignInTime));
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', revisar);
    window.addEventListener('online', revisar);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', revisar);
      window.removeEventListener('online', revisar);
    };
  }, [firebaseUser, rol]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loginData.usuario.trim() === '') {
      setLoginError('Debes ingresar un usuario.');
      return;
    }
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, usernameToAuthEmail(loginData.usuario), loginData.clave);
    } catch {
      setLoginError(GENERIC_LOGIN_ERROR);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setLoginData({ usuario: '', clave: '' });
    await borrarCacheLocal();
    window.location.reload();
  };

  return {
    firebaseUser,
    uid: firebaseUser?.uid || null,
    currentUser: profile?.username || null,
    currentUserName: profile?.nombre || profile?.username || null,
    role: profile?.role || null,
    tecnicoAsociado: profile?.tecnicoAsociado || null,
    // PROMOTORA: con qué nombres aparece en las plantillas (claves normalizadas, ver utils/promotora).
    promotoraNombres: profile?.promotoraNombres || [],
    promotoraClaves: profile?.promotoraClaves || [],
    // PROMOTORA de ventas: ve las instalaciones de todas las promotoras (lo marca el ADMIN en Usuarios).
    verTodasInstalaciones: profile?.role === 'PROMOTORA' && profile?.verTodasInstalaciones === true,
    // PROMOTORA con permiso de crear ventas (instalaciones nuevas, nada más): lo marca el ADMIN en Usuarios.
    puedeCrearVentas: profile?.role === 'PROMOTORA' && profile?.puedeCrearVentas === true,
    isTecnico: profile?.role === 'TECNICO',
    canCerrar: profile?.role === 'ADMIN' || profile?.puedeCerrar === true,
    authReady,
    connectionError,
    loginData,
    setLoginData,
    loginError,
    handleLogin,
    handleLogout
  };
}
