import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { updateDoc } from '../lib/medidorFirestore.js';
import { app, db, appId, FCM_VAPID_KEY } from '../lib/firebase';
import { swRegistrationReady } from '../lib/swRegistration';
import { esBrave } from '../utils/fallosPush';

const permisoActual = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
const perfilRef = (uid) => doc(db, 'artifacts', appId, 'public', 'data', 'users', uid);

// Intentos de registro antes de darlo por fallido (esperas entre intentos). Un registro
// justo al instalar o actualizar la app puede fallar un momento y salir bien al reintentar.
const ESPERAS_REINTENTO_MS = [3000, 8000];
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Marca (por usuario, en este navegador) de que ya se registró un token con éxito: si un
// registro posterior falla, no se alarma a nadie, porque el token guardado sigue sirviendo.
const MARCA_PREFIX = 'asignaciones:pushRegistrado:';
const hayMarca = (uid) => { try { return localStorage.getItem(MARCA_PREFIX + uid) !== null; } catch { return false; } };
const guardarMarca = (uid, token) => { try { localStorage.setItem(MARCA_PREFIX + uid, token); } catch { /* sin almacenamiento */ } };
const borrarMarca = (uid) => { try { localStorage.removeItem(MARCA_PREFIX + uid); } catch { /* sin almacenamiento */ } };

// getToken falla con "no active Service Worker" si el SW recién registrado todavía no está
// activo (primera visita o instalación nueva). Se espera a que lo esté.
async function swRegistrationActivo() {
  const registration = await swRegistrationReady;
  return registration.active ? registration : navigator.serviceWorker.ready;
}

// Registra el dispositivo para recibir pushes: guarda su token FCM en el perfil del
// usuario (fcmTokens: array — un usuario puede tener varios dispositivos).
//
// - Si el permiso ya está concedido, se registra solo al abrir la app (cada vez: es
//   idempotente y recupera el token si el anterior se perdió o rotó).
// - Pedir el permiso NO se hace solo: los navegadores (sobre todo iPhone) ignoran o
//   penalizan los avisos pedidos sin que la persona toque algo. Lo pide `activar()`, que
//   debe llamarse desde un botón (ver AvisoNotificaciones).
// - `desvincular()` quita este dispositivo del perfil; se llama al cerrar sesión para que
//   el siguiente usuario del mismo teléfono no reciba los avisos del anterior.
//
// Devuelve { permiso, registro, detalleError, activar, desvincular }:
//   permiso: 'granted' | 'default' | 'denied' | 'unsupported'
//   registro: null (sin intentar) | 'ok' | 'error'
//   detalleError: nombre del error cuando registro es 'error' (ayuda a diagnosticar)
export function usePushToken(uid) {
  const [permiso, setPermiso] = useState(permisoActual);
  const [registro, setRegistro] = useState(null);
  const [detalleError, setDetalleError] = useState('');
  // Brave trae apagado el servicio de push de Google: el registro falla aunque el permiso esté en "Permitir" (ver utils/fallosPush).
  const [brave, setBrave] = useState(false);
  useEffect(() => { esBrave().then(setBrave); }, []);
  const tokenRef = useRef(null);

  // Devuelve { estado: 'ok' | 'error' | null, detalle } (null: nada que registrar, p. ej. sin
  // permiso todavía). Reintenta antes de rendirse; si falla pero este navegador ya se había
  // registrado antes, no cuenta como error: el token guardado sigue valiendo.
  const registrar = useCallback(async () => {
    if (!uid || FCM_VAPID_KEY === 'PENDIENTE_GENERAR_EN_CONSOLA') return { estado: null };
    let ultimoError = null;
    for (let intento = 0; intento <= ESPERAS_REINTENTO_MS.length; intento++) {
      try {
        if (!(await isSupported()) || permisoActual() !== 'granted') return { estado: null };
        const registration = await swRegistrationActivo();
        const token = await getToken(getMessaging(app), { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: registration });
        if (!token) throw new Error('FCM no entregó un token');
        tokenRef.current = token;
        await updateDoc(perfilRef(uid), { fcmTokens: arrayUnion(token) });
        guardarMarca(uid, token);
        return { estado: 'ok' };
      } catch (err) {
        ultimoError = err;
        console.error(`No se pudo registrar el token de notificaciones push (intento ${intento + 1}):`, err);
        if (intento < ESPERAS_REINTENTO_MS.length) await esperar(ESPERAS_REINTENTO_MS[intento]);
      }
    }
    return hayMarca(uid) ? { estado: null } : { estado: 'error', detalle: typeof ultimoError?.code === 'string' ? ultimoError.code : (ultimoError?.name || 'Error') };
  }, [uid]);

  const aplicarRegistro = useCallback((r) => {
    if (!r.estado) return;
    setRegistro(r.estado);
    setDetalleError(r.estado === 'error' ? r.detalle : '');
  }, []);

  useEffect(() => {
    let cancelado = false;
    registrar().then((r) => { if (!cancelado) aplicarRegistro(r); });
    return () => { cancelado = true; };
  }, [registrar, aplicarRegistro]);

  // El permiso se puede cambiar desde los ajustes del navegador con la app abierta.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let status;
    let cancelado = false;
    const alCambiar = () => {
      setPermiso(permisoActual());
      registrar().then(aplicarRegistro);
    };
    navigator.permissions.query({ name: 'notifications' }).then((s) => {
      if (cancelado) return;
      status = s;
      s.addEventListener('change', alCambiar);
    }).catch(() => {});
    return () => {
      cancelado = true;
      status?.removeEventListener('change', alCambiar);
    };
  }, [registrar, aplicarRegistro]);

  // Debe llamarse dentro de un toque/click del usuario.
  const activar = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    try {
      await Notification.requestPermission();
    } catch (err) {
      console.error('No se pudo pedir el permiso de notificaciones:', err);
    }
    setPermiso(permisoActual());
    aplicarRegistro(await registrar());
  }, [registrar, aplicarRegistro]);

  const desvincular = useCallback(async () => {
    if (!uid) return;
    try {
      if (!(await isSupported()) || permisoActual() !== 'granted') return;
      const messaging = getMessaging(app);
      let token = tokenRef.current;
      if (!token) {
        const registration = await swRegistrationActivo();
        token = await getToken(messaging, { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: registration });
      }
      if (token) await updateDoc(perfilRef(uid), { fcmTokens: arrayRemove(token) });
      borrarMarca(uid);
      // Token nuevo para quien entre después en este dispositivo.
      await deleteToken(messaging);
      tokenRef.current = null;
    } catch (err) {
      // Nunca debe impedir cerrar sesión.
      console.error('No se pudo desvincular el dispositivo de las notificaciones:', err);
    }
  }, [uid]);

  return { permiso, registro, detalleError, brave, activar, desvincular };
}
