import { useEffect, useRef } from 'react';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { app, db, appId, FCM_VAPID_KEY } from '../lib/firebase';
import { swRegistrationReady } from '../lib/swRegistration';

// Pide permiso de notificaciones y registra el token FCM del dispositivo en el
// perfil del usuario (fcmTokens: array — un usuario puede tener varios
// dispositivos). Se dispara una vez por sesión, apenas hay usuario logueado.
export function usePushToken(uid) {
  const attemptedFor = useRef(null);

  useEffect(() => {
    if (!uid || attemptedFor.current === uid) return;
    attemptedFor.current = uid;

    (async () => {
      if (FCM_VAPID_KEY === 'PENDIENTE_GENERAR_EN_CONSOLA') return;
      if (!(await isSupported())) return;
      if (typeof Notification === 'undefined') return;

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') return;

      try {
        const registration = await swRegistrationReady;
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: FCM_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });
        if (!token) return;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), {
          fcmTokens: arrayUnion(token),
        });
      } catch (err) {
        console.error('No se pudo registrar el token de notificaciones push:', err);
      }
    })();
  }, [uid]);
}
