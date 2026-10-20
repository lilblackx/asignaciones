import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, startAfter, updateDoc, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { llamarInventario } from '../lib/inventario';
import { ESTADOS_CON_ALERTA, ESTADO_DESCARTADO, ESTADO_ENVIADO, ESTADO_PENDIENTE } from '../utils/envioInventario';

const TAMANO_PAGINA = 10;
const coleccionEnvios = () => collection(db, 'artifacts', appId, 'public', 'data', 'telecomEnvios');

// Envíos al inventario del otro sistema: lo que pasó con cada orden aprobada. Solo para los usuarios del módulo (ver
// utils/accesoInventario; las reglas de Firestore lo exigen también). `puedeVer` es false para cualquier otro y no se lee nada.
//  - envios: las órdenes que necesitan que alguien las mire (serial que no existe en su inventario, equipo ya instalado a otro
//    cliente, orden sin serial, o agotó los reintentos). Es un listener sobre pocos documentos: sin alertas no gasta nada más
//    que la lectura inicial.
//  - pendientes: lo que ya falló al menos una vez por no poder llegar al otro sistema (red, clave...) y se reintenta solo cada
//    15 minutos. Va en el mismo listener (una orden que se envía a la primera pasa por PENDIENTE sin intentos y no se cuenta).
//  - recientes: la actividad de los últimos envíos, de cualquier estado; se leen solo los últimos 10 al abrir el módulo o al
//    actualizar, y de 10 en 10 más con "Cargar más" (cada página cuesta sus lecturas, así que no se trae nada que no se pida).
export function useEnviosInventario(firebaseUser, puedeVer, usuario, setToastMsg) {
  const [envios, setEnvios] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [cargandoRecientes, setCargandoRecientes] = useState(false);
  const [hayMas, setHayMas] = useState(false);
  const ultimoDoc = useRef(null);

  useEffect(() => {
    if (!firebaseUser || !puedeVer) return undefined;
    const cancelar = onSnapshot(
      query(coleccionEnvios(), where('estado', 'in', [...ESTADOS_CON_ALERTA, ESTADO_PENDIENTE])),
      (snap) => {
        const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.actualizadoEn || 0) - (a.actualizadoEn || 0));
        setEnvios(todos.filter((e) => e.estado !== ESTADO_PENDIENTE));
        setPendientes(todos.filter((e) => e.estado === ESTADO_PENDIENTE && e.intentos > 0));
      },
      (error) => console.error('No se pudo escuchar los envíos al inventario:', error),
    );
    return () => { cancelar(); setEnvios([]); setPendientes([]); };
  }, [firebaseUser, puedeVer]);

  // Las marcas que acaba de dejar la app (aún sin procesar) no traen fecha de actualización y no salen aquí.
  const cargarRecientes = useCallback(async () => {
    if (!firebaseUser || !puedeVer) return;
    try {
      const snap = await getDocs(query(coleccionEnvios(), orderBy('actualizadoEn', 'desc'), limit(TAMANO_PAGINA)));
      setRecientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      ultimoDoc.current = snap.docs[snap.docs.length - 1] || null;
      setHayMas(snap.docs.length === TAMANO_PAGINA);
    } catch (error) {
      console.error('No se pudo cargar la actividad de envíos al inventario:', error);
    }
  }, [firebaseUser, puedeVer]);

  // La página siguiente, a continuación de la última que se leyó.
  const cargarMas = useCallback(async () => {
    if (!firebaseUser || !puedeVer || !ultimoDoc.current) return;
    setCargandoRecientes(true);
    try {
      const snap = await getDocs(query(coleccionEnvios(), orderBy('actualizadoEn', 'desc'), startAfter(ultimoDoc.current), limit(TAMANO_PAGINA)));
      setRecientes((previos) => [...previos, ...snap.docs.map((d) => ({ id: d.id, ...d.data() }))]);
      ultimoDoc.current = snap.docs[snap.docs.length - 1] || ultimoDoc.current;
      setHayMas(snap.docs.length === TAMANO_PAGINA);
    } catch (error) {
      console.error('No se pudo cargar más actividad de envíos al inventario:', error);
    }
    setCargandoRecientes(false);
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

  // Vuelve a avisar al otro sistema (su módulo de notificaciones) de una orden con alerta. Devuelve true si el aviso quedó escrito.
  const reenviarAviso = useCallback(async (envio) => {
    const r = await llamarInventario('/inventario/notificar', envio.id);
    if (r.ok && r.estado === 'NOTIFICADA') {
      setToastMsg?.({ type: 'success', text: `Se reenvió el aviso de la orden ${envio.codigo || 'S/C'} a la app del almacén.` });
      return true;
    }
    const motivo = r.ok ? (r.estado === 'SIN_ALERTA' ? 'La orden ya no tiene alerta.' : r.estado === 'DESHABILITADO' ? 'El envío al inventario está apagado.' : r.mensaje) : r.mensaje;
    setToastMsg?.({ type: 'error', text: `No se pudo reenviar el aviso.${motivo ? ` ${motivo}` : ''}` });
    return false;
  }, [setToastMsg]);

  // Reintenta una lista de órdenes una tras otra (el Worker las procesa de a una). Un solo aviso al final y una sola lectura de
  // la actividad, no una por orden.
  const reintentarTodas = useCallback(async (lista) => {
    let enviadas = 0;
    for (const envio of lista) {
      const r = await llamarInventario('/inventario/reintentar', envio.id);
      if (r.ok && r.estado === ESTADO_ENVIADO) enviadas++;
    }
    await cargarRecientes();
    setToastMsg?.(enviadas === lista.length
      ? { type: 'success', text: `Se enviaron las ${enviadas} órdenes al inventario.` }
      : { type: 'error', text: `Se enviaron ${enviadas} de ${lista.length} órdenes. Las demás siguen en revisión.` });
    return enviadas;
  }, [cargarRecientes, setToastMsg]);

  // Busca en todo el historial por código de orden o serial (coincidencia exacta; hasta 5 de cada uno): para lo que no está en las
  // últimas cargadas, sin leer todo.
  const buscar = useCallback(async (texto) => {
    const valor = String(texto || '').trim().toUpperCase();
    if (!firebaseUser || !puedeVer || !valor) return [];
    try {
      const grupos = await Promise.all(['codigo', 'serial'].map((campo) => getDocs(query(coleccionEnvios(), where(campo, '==', valor), limit(5)))));
      const porId = new Map();
      for (const snap of grupos) for (const d of snap.docs) porId.set(d.id, { id: d.id, ...d.data() });
      return [...porId.values()];
    } catch (error) {
      console.error('No se pudo buscar en los envíos al inventario:', error);
      return [];
    }
  }, [firebaseUser, puedeVer]);

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

  return { envios, pendientes, recientes, cargandoRecientes, hayMas, cargarRecientes, cargarMas, actualizarRecientes, reintentar, reenviarAviso, reintentarTodas, buscar, descartar };
}
