import { useEffect } from 'react';
import { doc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { medidor, setDoc } from '../lib/medidorFirestore.js';
import { automaticasPausadas, contadoresAutomaticas, cortacircuitosAbierto, cortarContadoresAutomaticas } from '../lib/escrituraAutomatica';
import { INTERVALO_REPORTE_MS, MIN_ENTRE_REPORTES_MS, anomaliaDe, armarReporte, describirEquipo } from '../utils/estaciones';

// Cada navegador con la app abierta (todos los roles) reporta en estaciones/{estacionId} quién lo usa, desde qué equipo y todo lo que puede
// afectar a producción desde ahí (ver utils/estaciones.js): lecturas y escrituras, rechazos del servidor, escuchadores, errores de la app y la
// hora del servidor (para notar un reloj desfasado). Reporta al abrir, cada 10 minutos y en cuanto nota una anomalía, pero nunca dos veces en
// menos de 2 minutos; si un reporte falla, espera al siguiente (sin reintentos). Con `pausarEstaciones` en config/app no reporta.
// Costo: ~6 escrituras por hora por pestaña abierta (con 15 abiertas 12 horas, ~1.100 al día: dentro de lo gratis).

const CLAVE_ESTACION = 'asignaciones:estacion';
const ABIERTA_EN = Date.now();
const REVISAR_CADA_MS = 30 * 1000;
let pausadas = false;

// Lo cambia useControlRemoto con `pausarEstaciones` de config/app.
export function setEstacionesPausadas(valor) {
  pausadas = Boolean(valor);
}

const nuevoId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);

// El mismo id mientras no se borren los datos del navegador; sin almacenamiento, uno por pestaña.
let idDeEstaPestana = null;
function estacionId() {
  try {
    const guardado = localStorage.getItem(CLAVE_ESTACION);
    if (guardado && /^[a-z0-9]{12,40}$/.test(guardado)) return guardado;
    const id = nuevoId();
    localStorage.setItem(CLAVE_ESTACION, id);
    return id;
  } catch {
    idDeEstaPestana ??= nuevoId();
    return idDeEstaPestana;
  }
}

const instalada = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };

// Los errores de la app (no capturados) se cuentan desde que se carga la página, aunque todavía no haya sesión.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => medidor.errorApp(e?.message || e?.error?.message, Date.now()));
  window.addEventListener('unhandledrejection', (e) => medidor.errorApp(e?.reason?.message || String(e?.reason ?? ''), Date.now()));
}

export function useEstacion({ uid, currentUser, currentUserName, role }) {
  useEffect(() => {
    if (!uid || !currentUser || !role) return undefined;
    const id = estacionId();
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'estaciones', id);
    const equipo = describirEquipo(navigator.userAgent, { ancho: window.screen?.width, alto: window.screen?.height, instalada: instalada() });
    let ultimoReporte = 0;
    let ventanaDesde = Date.now();
    let anomaliaAvisada = '';

    const anomaliaActual = () => anomaliaDe({
      ultimos5: medidor.ultimos5(Date.now()), errores: medidor.erroresVentana(), escuchadoresActivos: medidor.activos(),
      fallidasVentana: contadoresAutomaticas().ventanaFallidas, cortacircuitos: cortacircuitosAbierto(),
    });

    // true si se envió (o se intentó enviar) el reporte.
    const reportar = (anomalia) => {
      const ahora = Date.now();
      if (pausadas || ahora - ultimoReporte < MIN_ENTRE_REPORTES_MS) return false;
      ultimoReporte = ahora;
      const datos = armarReporte({
        estacionId: id, uid, usuario: currentUser, nombre: currentUserName, rol: role, equipo, build: __APP_BUILD__, abiertaEn: ABIERTA_EN, ahora,
        visible: document.visibilityState === 'visible', conectada: navigator.onLine !== false, ventana: medidor.cortar(), desde: ventanaDesde,
        totales: medidor.totales(), escuchadoresActivos: medidor.activos(), ultimoError: medidor.ultimoError(),
        automaticas: cortarContadoresAutomaticas(), cortacircuitos: cortacircuitosAbierto(), pausadas: automaticasPausadas(), anomalia,
      });
      ventanaDesde = ahora;
      // `reloj`: la hora del servidor; comparada con `ultimaSenal` (la del equipo) dice si el reloj del equipo está desfasado.
      setDoc(ref, { ...datos, reloj: serverTimestamp() }).catch((error) => console.warn('No se pudo reportar la estación:', error));
      return true;
    };

    const revisar = () => {
      const anomalia = anomaliaActual();
      // Una anomalía nueva se reporta en cuanto se puede; si no se pudo (reporte muy reciente), se vuelve a intentar en la próxima revisión.
      if (anomalia && anomalia !== anomaliaAvisada) {
        if (reportar(anomalia)) anomaliaAvisada = anomalia;
        return;
      }
      if (!anomalia) anomaliaAvisada = '';
      if (Date.now() - ultimoReporte >= INTERVALO_REPORTE_MS) reportar(anomalia);
    };

    reportar(anomaliaActual());
    const intervalo = setInterval(revisar, REVISAR_CADA_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') revisar(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
    };
  }, [uid, currentUser, currentUserName, role]);
}
