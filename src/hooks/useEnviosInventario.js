import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { llamarInventario } from '../lib/inventario';
import { ESTADOS_CON_ALERTA, ESTADO_DESCARTADO } from '../utils/envioInventario';

const TAMANO_RECIENTES = 30;
const coleccionEnvios = () => collection(db, 'artifacts', appId, 'public', 'data', 'telecomEnvios');

// Envíos al inventario del otro sistema: lo que pasó con cada orden aprobada. Solo para los usuarios del módulo (ver
// utils/accesoInventario; las reglas de Firestore lo exigen también). `puedeVer` es false para cualquier otro y no se lee nada.
//  - envios: las órdenes que necesitan que alguien las mire (serial que no existe en su inventario, equipo ya instalado a otro
//    cliente, orden sin serial, o agotó los reintentos). Es un listener sobre pocos documentos: sin alertas no gasta nada más
//    que la lectura inicial. Lo PENDIENTE no aparece aquí: se reintenta solo.
//  - recientes: la actividad de los últimos envíos, de cualquier estado; se lee solo al abrir el módulo o al actualizar.
export function useEnviosInventario(firebaseUser, puedeVer, usuario, setToastMsg) {
  const [envios, setEnvios] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [cargandoRecientes, setCargandoRecientes] = useState(false);

  useEffect(() => {
    if (!firebaseUser || !puedeVer) return undefined;
    const cancelar = onSnapshot(
      query(coleccionEnvios(), where('estado', 'in', ESTADOS_CON_ALERTA)),
      (snap) => setEnvios(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.actualizadoEn || 0) - (a.actualizadoEn || 0))),
      (error) => console.error('No se pudo escuchar los envíos al inventario:', error),
    );
    return () => { cancelar(); setEnvios([]); };
  }, [firebaseUser, puedeVer]);

  // Las marcas que acaba de dejar la app (aún sin procesar) no traen fecha de actualización y no salen aquí.
  const cargarRecientes = useCallback(async () => {
    if (!firebaseUser || !puedeVer) return;
    try {
      const snap = await getDocs(query(coleccionEnvios(), orderBy('actualizadoEn', 'desc'), limit(TAMANO_RECIENTES)));
      setRecientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('No se pudo cargar la actividad de envíos al inventario:', error);
    }
  }, [firebaseUser, puedeVer]);

  const actualizarRecientes = useCallback(async () => {
    setCargandoRecientes(true);
    await cargarRecientes();
    setCargandoRecientes(false);
  }, [cargarRecientes]);

  // Vuelve a intentar el envío (por ejemplo, después de que el almacén ingresó el serial). Devuelve true si quedó enviado.
  const reintentar = useCallback(async (envio) => {
    const r = await llamarInventario('/inventario/reintentar', envio.id);
    await cargarRecientes();
    if (r.ok && r.estado === 'ENVIADO') {
      setToastMsg?.({ type: 'success', text: `La orden ${envio.codigo || 'S/C'} se envió al inventario.` });
      return true;
    }
    setToastMsg?.({ type: 'error', text: r.ok ? (r.mensaje || 'Sigue sin poder enviarse. Revisa el detalle de la alerta.') : (r.mensaje || 'No se pudo reintentar el envío.') });
    return false;
  }, [cargarRecientes, setToastMsg]);

  // Da la alerta por resuelta sin enviar nada (la orden se arregló por otro lado). Queda guardada como DESCARTADO, no se borra.
  const descartar = useCallback(async (envio) => {
    try {
      await updateDoc(doc(coleccionEnvios(), envio.id), { estado: ESTADO_DESCARTADO, actualizadoEn: Date.now(), descartadoPor: usuario || '' });
      await cargarRecientes();
      return true;
    } catch (error) {
      console.error('No se pudo descartar la alerta:', error);
      setToastMsg?.({ type: 'error', text: 'No se pudo descartar la alerta.' });
      return false;
    }
  }, [cargarRecientes, setToastMsg, usuario]);

  return { envios, recientes, cargandoRecientes, cargarRecientes, actualizarRecientes, reintentar, descartar };
}
