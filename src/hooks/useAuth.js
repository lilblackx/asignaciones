import { useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, appId } from '../lib/firebase';
import { usernameToAuthEmail } from '../utils/authEmail';

const GENERIC_LOGIN_ERROR = 'Usuario o clave incorrectos.';

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [loginData, setLoginData] = useState({ usuario: '', clave: '' });
  const [loginError, setLoginError] = useState('');

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
  };

  return {
    firebaseUser,
    uid: firebaseUser?.uid || null,
    currentUser: profile?.username || null,
    currentUserName: profile?.nombre || profile?.username || null,
    role: profile?.role || null,
    tecnicoAsociado: profile?.tecnicoAsociado || null,
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
