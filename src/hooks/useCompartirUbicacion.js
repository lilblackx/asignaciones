import { useCallback, useEffect, useState } from 'react';
import { doc } from 'firebase/firestore';
import { deleteDoc, onSnapshot, setDoc } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { ENVIOS_RAPIDOS, PROBLEMAS, armarPosicion, armarProblema, armarPunto, idDeTecnico, intervaloDeEnvio, solicitudVigente } from '../utils/ubicacionTecnico';

// El teléfono del técnico comparte su ubicación con la oficina (ver utils/ubicacionTecnico.js). SIN avisos: no hay mensaje ni push en su pantalla; el navegador muestra su propio indicador de ubicación.
//  - A demanda: mientras la oficina tenga una solicitud vigente (30 minutos), cada vez que el técnico abre la app (o vuelve a ella) envía su posición al instante, luego cada 30 segundos durante los
//    primeros 2 minutos y después cada 2 minutos. Para que la pantalla no se apague a medias solo se pide que siga encendida durante esos primeros 2 minutos. Al terminar borra su posición.
//  - Un punto por acción: `registrarPunto` guarda una lectura al marcar "En camino" y "Llegué" y al pre-finalizar (la última ubicación conocida).
// Solo escucha (una lectura al abrir y otra por cada solicitud) cuando `activo`: el técnico con la función encendida en Configuración. Apagada, no lee ni escribe nada.
const ref = (coleccion, id) => doc(db, 'artifacts', appId, 'public', 'data', coleccion, id);
const ESPERA_GPS_MS = 20000;

// `ahora`: la hora que ya refresca la app cada minuto; el fin exacto de la solicitud lo marca el temporizador de abajo.
export function useCompartirUbicacion({ firebaseUser, tecnico, activo, ahora }) {
  const id = idDeTecnico(tecnico);
  const [recibida, setSolicitud] = useState(null);
  // Cambia al vencer la solicitud para que el envío se detenga aunque no llegue ningún cambio del servidor.
  const [vencimiento, setVencimiento] = useState(0);

  useEffect(() => {
    if (!firebaseUser || !activo || !id) return undefined;
    return onSnapshot(ref('solicitudesUbicacion', id),
      (snap) => setSolicitud(snap.exists() ? snap.data() : null),
      (error) => { console.warn('No se pudo leer la solicitud de ubicación:', error); setSolicitud(null); });
  }, [firebaseUser, activo, id]);

  const solicitud = activo && id ? recibida : null;
  const pedidaEn = solicitud?.pedidaEn;
  const venceEn = solicitud?.venceEn;
  const detenidaEn = solicitud?.detenidaEn;
  const vigente = Boolean(activo) && solicitudVigente(solicitud, ahora) && vencimiento !== pedidaEn;

  useEffect(() => {
    if (!vigente || !id || typeof navigator === 'undefined') return undefined;
    let vivo = true;
    let candado = null;
    let temporizador = null;
    let enviados = 0; // los envíos de esta ráfaga: se reinicia al volver a la app
    const destino = ref('ubicaciones', id);

    const escribir = async (datos) => {
      try { await setDoc(destino, datos); } catch (error) { console.warn('No se pudo enviar la ubicación:', error); }
    };
    const pedirCandado = async () => {
      try { if (!candado || candado.released) candado = (await navigator.wakeLock?.request('screen')) ?? null; } catch { candado = null; }
    };
    const soltarCandado = () => { candado?.release?.().catch(() => {}); candado = null; };
    const leerYEnviar = () => {
      if (!navigator.geolocation) { escribir(armarProblema(PROBLEMAS.SIN_GPS, pedidaEn)); return; }
      navigator.geolocation.getCurrentPosition(
        (r) => { if (!vivo) return; const datos = armarPosicion(r.coords, pedidaEn); if (datos) escribir(datos); },
        (error) => { if (vivo) escribir(armarProblema(error?.code === 1 ? PROBLEMAS.DENEGADO : PROBLEMAS.SIN_GPS, pedidaEn)); },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: ESPERA_GPS_MS },
      );
    };
    // Envía ahora y programa el siguiente según el ritmo de la ráfaga (30 s al principio, 2 min después).
    const enviar = () => {
      leerYEnviar();
      if (enviados >= ENVIOS_RAPIDOS) soltarCandado();
      temporizador = setTimeout(enviar, intervaloDeEnvio(enviados));
      enviados += 1;
    };
    const empezarRafaga = () => { clearTimeout(temporizador); enviados = 0; pedirCandado(); enviar(); };
    const alVolver = () => { if (document.visibilityState === 'visible') empezarRafaga(); };

    empezarRafaga();
    const fin = setTimeout(() => setVencimiento(pedidaEn), Math.max(0, venceEn - Date.now()) + 300);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearTimeout(temporizador);
      clearTimeout(fin);
      document.removeEventListener('visibilitychange', alVolver);
      soltarCandado();
      // Al terminar no queda la última posición de la solicitud guardada.
      deleteDoc(destino).catch(() => {});
    };
  }, [vigente, id, pedidaEn, venceEn, detenidaEn]);

  // Un punto por acción del técnico (En camino, Llegué, pre-finalizar): una lectura, sin avisos y sin esperar al resultado. Nunca interrumpe lo que se está haciendo.
  const registrarPunto = useCallback((motivo, codigo = '') => {
    if (!activo || !firebaseUser || !id || typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (r) => {
        const datos = armarPunto(r.coords, motivo, codigo);
        if (datos) setDoc(ref('ultimaUbicacion', id), datos).catch((error) => console.warn('No se pudo guardar el punto de ubicación:', error));
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000, timeout: ESPERA_GPS_MS },
    );
  }, [activo, firebaseUser, id]);

  return { compartiendo: vigente, registrarPunto };
}
