import { useCallback, useEffect, useState } from 'react';
import { collection, doc } from 'firebase/firestore';
import { deleteDoc, onSnapshot, setDoc, updateDoc } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { detencion, idDeTecnico, nuevaSolicitud } from '../utils/ubicacionTecnico';

// Lo que ve la oficina de la ubicación de los técnicos (ver utils/ubicacionTecnico.js). Solo escucha mientras `activo` (el módulo abierto): las solicitudes, las posiciones y las últimas ubicaciones de
// todos los técnicos, que son unos pocos documentos; cada envío de un técnico es una lectura aquí, así que con el módulo cerrado no gasta nada. Devuelve las listas por id de técnico (su nombre en
// mayúsculas) y las acciones `pedir`, `detener` y `descartar` (true si se hizo).
const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const documento = (nombre, id) => doc(db, 'artifacts', appId, 'public', 'data', nombre, id);

const aMapa = (snap) => Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));

export function useUbicacionTecnicos(firebaseUser, activo, usuario) {
  const [estado, setEstado] = useState({ solicitudes: {}, ubicaciones: {}, ultimas: {}, cargado: false, error: false });

  useEffect(() => {
    if (!firebaseUser || !activo) return undefined;
    const fallo = (que) => (error) => { console.warn(`No se pudo leer ${que}:`, error); setEstado((e) => ({ ...e, cargado: true, error: true })); };
    const alLlegar = (campo) => (snap) => setEstado((e) => ({ ...e, [campo]: aMapa(snap), cargado: true, error: false }));
    const cortar = [
      onSnapshot(datos('solicitudesUbicacion'), alLlegar('solicitudes'), fallo('las solicitudes de ubicación')),
      onSnapshot(datos('ubicaciones'), alLlegar('ubicaciones'), fallo('las ubicaciones')),
      onSnapshot(datos('ultimaUbicacion'), alLlegar('ultimas'), fallo('las últimas ubicaciones')),
    ];
    return () => cortar.forEach((c) => c());
  }, [firebaseUser, activo]);

  const pedir = useCallback(async (nombreTecnico) => {
    const id = idDeTecnico(nombreTecnico);
    if (!id) return false;
    try {
      await setDoc(documento('solicitudesUbicacion', id), nuevaSolicitud(usuario));
      return true;
    } catch (error) {
      console.error('No se pudo pedir la ubicación:', error);
      return false;
    }
  }, [usuario]);

  const detener = useCallback(async (nombreTecnico) => {
    const id = idDeTecnico(nombreTecnico);
    if (!id) return false;
    try {
      await updateDoc(documento('solicitudesUbicacion', id), detencion('OFICINA'));
      return true;
    } catch (error) {
      console.error('No se pudo detener la ubicación:', error);
      return false;
    }
  }, []);

  // Borra una posición que quedó sin solicitud (posicionesHuerfanas) o una última ubicación de más de 24 horas (ultimasViejas). Solo el ADMIN; si falla, se intenta la próxima vez que abra el módulo.
  const descartar = useCallback(async (id, coleccion = 'ubicaciones') => {
    try { await deleteDoc(documento(coleccion, id)); return true; } catch (error) { console.warn('No se pudo borrar una posición vieja:', error); return false; }
  }, []);

  return { ...estado, pedir, detener, descartar };
}
