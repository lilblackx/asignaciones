import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc } from 'firebase/firestore';
import { onSnapshot, setDoc, deleteDoc } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { ejecutarAutomatica } from '../lib/escrituraAutomatica';
import { crearRenovador } from '../lib/renovadorAviso';
import { DURACION_AVISO_MS, OCULTA_SIN_ESCUCHAR_DESPUES_DE_MS } from '../utils/avisoDeOrden';

export { DURACION_AVISO_MS };

// "Alguien está revisando esta orden": cuando una persona de la oficina abre una orden para aprobarla, finalizarla, resolverla o editarla, deja un
// aviso con vencimiento (un documento por orden y persona en bloqueosOrden, ver firestore.rules). Los demás lo ven en la lista y dentro de su
// propio modal ("Ana también tiene abierta esta orden"). Es solo un aviso: no impide nada. Lo que impide que dos personas finalicen la misma orden
// es la transacción al guardar (useTickets) y las reglas. Si alguien cierra la pestaña sin cerrar el modal, el aviso vence solo.
// Para gastar poco (cada renovación es una escritura, una lectura del perfil en las reglas y una lectura en cada pestaña que escucha), el aviso propio se renueva solo mientras la pestaña se ve y la
// persona hace algo (ver utils/avisoDeOrden y lib/renovadorAviso), y una pestaña que lleva rato oculta deja de escuchar los avisos de los demás hasta que se vuelva a ver.
const BORRAR_VENCIDOS_DESPUES_DE_MS = 10 * 60000;
const EVENTOS_DE_ACTIVIDAD = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];

const refDe = (ordenId, usuario) => doc(db, 'artifacts', appId, 'public', 'data', 'bloqueosOrden', `${ordenId}__${usuario}`);

// ¿Hay que escuchar los avisos de los demás? Mientras la pestaña se ve y hasta un rato después de ocultarse (así cambiar de pestaña un momento no vuelve a leer nada).
function useEscuchando(activo) {
  const [escuchando, setEscuchando] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    if (!activo) return undefined;
    let espera = null;
    const alCambiar = () => {
      clearTimeout(espera);
      if (document.visibilityState === 'visible') setEscuchando(true);
      else espera = setTimeout(() => setEscuchando(false), OCULTA_SIN_ESCUCHAR_DESPUES_DE_MS);
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => { clearTimeout(espera); document.removeEventListener('visibilitychange', alCambiar); };
  }, [activo]);
  return escuchando;
}

// `ordenId`: la orden que esta persona tiene abierta ahora (o null). `ahora`: reloj de la app (se refresca cada minuto).
// Devuelve { revisando }: id de orden -> nombres de OTRAS personas que la tienen abierta y cuyo aviso sigue vigente.
export function useBloqueosOrden({ firebaseUser, rol, usuario, nombre, ordenId, ahora }) {
  const activo = Boolean(firebaseUser && usuario && (rol === 'ADMIN' || rol === 'USUARIO'));
  const escuchando = useEscuchando(activo);
  const [avisos, setAvisos] = useState([]);
  const nombreRef = useRef(nombre);
  useEffect(() => { nombreRef.current = nombre; });

  // Los avisos de todos (son pocos y de vida corta). De paso, se borran los que quedaron vencidos hace rato (limpieza). La limpieza pasa
  // por ejecutarAutomatica: cada aviso se intenta borrar pocas veces y con espera, aunque la lista lo siga mostrando (ver escrituraAutomatica.js).
  useEffect(() => {
    if (!activo || !escuchando) return undefined;
    const col = collection(db, 'artifacts', appId, 'public', 'data', 'bloqueosOrden');
    return onSnapshot(col, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAvisos(lista);
      const limite = Date.now() - BORRAR_VENCIDOS_DESPUES_DE_MS;
      lista.filter((a) => Number(a.venceEn) < limite).slice(0, 10)
        .forEach((a) => ejecutarAutomatica(`bloqueo:${a.id}:${a.venceEn}`, () => deleteDoc(doc(col, a.id))));
    }, () => {});
  }, [activo, escuchando]);

  // El aviso propio: se deja al abrir la orden, se renueva mientras siga abierta (y la pestaña se vea y haya actividad) y se borra al cerrarla.
  useEffect(() => {
    if (!activo || !ordenId) return undefined;
    const dejar = () => setDoc(refDe(ordenId, usuario), { ticketId: String(ordenId), por: usuario, nombre: String(nombreRef.current || usuario).slice(0, 100), desde: Date.now(), venceEn: Date.now() + DURACION_AVISO_MS }).catch(() => {});
    const renovador = crearRenovador({
      ahora: Date.now,
      visible: () => document.visibilityState === 'visible',
      cada: (fn, ms) => { const id = setInterval(fn, ms); return () => clearInterval(id); },
      dejar,
    });
    const alHaberActividad = () => renovador.actividad();
    EVENTOS_DE_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, alHaberActividad, { passive: true }));
    document.addEventListener('visibilitychange', alHaberActividad);
    return () => {
      renovador.detener();
      EVENTOS_DE_ACTIVIDAD.forEach((evento) => window.removeEventListener(evento, alHaberActividad));
      document.removeEventListener('visibilitychange', alHaberActividad);
      deleteDoc(refDe(ordenId, usuario)).catch(() => {});
    };
  }, [activo, ordenId, usuario]);

  const revisando = useMemo(() => {
    const mapa = new Map();
    for (const a of avisos) {
      if (a.por === usuario || !(Number(a.venceEn) > ahora)) continue;
      if (!mapa.has(a.ticketId)) mapa.set(a.ticketId, []);
      mapa.get(a.ticketId).push(a.nombre || a.por);
    }
    return mapa;
  }, [avisos, usuario, ahora]);

  return { revisando };
}
