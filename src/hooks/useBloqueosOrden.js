import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';

// "Alguien está revisando esta orden": cuando una persona de la oficina abre una orden para aprobarla, finalizarla, resolverla o editarla, deja un
// aviso con vencimiento (un documento por orden y persona en bloqueosOrden, ver firestore.rules). Los demás lo ven en la lista y dentro de su
// propio modal ("Ana también tiene abierta esta orden"). Es solo un aviso: no impide nada. Lo que impide que dos personas finalicen la misma orden
// es la transacción al guardar (useTickets) y las reglas. Si alguien cierra la pestaña sin cerrar el modal, el aviso vence solo.
export const DURACION_AVISO_MS = 150000;
const RENOVAR_CADA_MS = 50000;
const BORRAR_VENCIDOS_DESPUES_DE_MS = 10 * 60000;

const refDe = (ordenId, usuario) => doc(db, 'artifacts', appId, 'public', 'data', 'bloqueosOrden', `${ordenId}__${usuario}`);

// `ordenId`: la orden que esta persona tiene abierta ahora (o null). `ahora`: reloj de la app (se refresca cada minuto).
// Devuelve { revisando }: id de orden -> nombres de OTRAS personas que la tienen abierta y cuyo aviso sigue vigente.
export function useBloqueosOrden({ firebaseUser, rol, usuario, nombre, ordenId, ahora }) {
  const activo = Boolean(firebaseUser && usuario && (rol === 'ADMIN' || rol === 'USUARIO'));
  const [avisos, setAvisos] = useState([]);
  const nombreRef = useRef(nombre);
  useEffect(() => { nombreRef.current = nombre; });

  // Los avisos de todos (son pocos y de vida corta). De paso, se borran los que quedaron vencidos hace rato (limpieza).
  useEffect(() => {
    if (!activo) return undefined;
    const col = collection(db, 'artifacts', appId, 'public', 'data', 'bloqueosOrden');
    return onSnapshot(col, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAvisos(lista);
      const limite = Date.now() - BORRAR_VENCIDOS_DESPUES_DE_MS;
      lista.filter((a) => Number(a.venceEn) < limite).slice(0, 10).forEach((a) => deleteDoc(doc(col, a.id)).catch(() => {}));
    }, () => {});
  }, [activo]);

  // El aviso propio: se deja al abrir la orden, se renueva mientras siga abierta y se borra al cerrarla.
  useEffect(() => {
    if (!activo || !ordenId) return undefined;
    const dejar = () => setDoc(refDe(ordenId, usuario), { ticketId: String(ordenId), por: usuario, nombre: String(nombreRef.current || usuario).slice(0, 100), desde: Date.now(), venceEn: Date.now() + DURACION_AVISO_MS }).catch(() => {});
    dejar();
    const id = setInterval(dejar, RENOVAR_CADA_MS);
    return () => {
      clearInterval(id);
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
