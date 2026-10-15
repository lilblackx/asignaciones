import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { FALLA_LOS, TIPO_AVERIA, TIPO_INSTALACION } from '../utils/estadoInstalacion';

// Instalaciones de una PROMOTORA en tiempo real: solo las que tienen alguno de sus nombres (claves normalizadas) como
// promotora. Las reglas solo dejan leer así, y de paso se leen solo las suyas: una consulta por cada nombre.
// Con `claves` vacío no se consulta nada (la pantalla avisa que falta asignarle su nombre).
// Con `verTodas` (perfil de ventas) son dos consultas: todas las instalaciones (sin filtrar por promotora) y las averías LOS.
export function useInstalacionesPromotora(firebaseUser, claves, verTodas = false) {
  const [estado, setEstado] = useState({ tickets: [], cargado: false, error: false });
  const llave = verTodas ? '*' : claves.join('|');

  useEffect(() => {
    if (!firebaseUser || !llave) return;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'tickets');
    if (verTodas) {
      // Ventas: todas las instalaciones y las averías LOS (dos consultas; las reglas exigen estos filtros exactos).
      const consultas = [
        query(ref, where('tipoTrabajo', '==', TIPO_INSTALACION)),
        query(ref, where('tipoTrabajo', '==', TIPO_AVERIA), where('falla', '==', FALLA_LOS)),
      ];
      const porConsulta = new Map();
      const unsubsVentas = consultas.map((q, i) => onSnapshot(
        q,
        (snap) => {
          porConsulta.set(i, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          if (porConsulta.size === consultas.length) setEstado({ tickets: [...porConsulta.values()].flat(), cargado: true, error: false });
        },
        (err) => {
          console.error('No se pudieron cargar las órdenes:', err);
          setEstado((e) => ({ ...e, cargado: true, error: true }));
        },
      ));
      return () => unsubsVentas.forEach((u) => u());
    }
    const lista = llave.split('|');
    const porClave = new Map();
    const unsubs = lista.map((clave) => onSnapshot(
      query(ref, where('tipoTrabajo', '==', TIPO_INSTALACION), where('promotoraClave', '==', clave)),
      (snap) => {
        porClave.set(clave, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        if (porClave.size === lista.length) setEstado({ tickets: [...porClave.values()].flat(), cargado: true, error: false });
      },
      (err) => {
        console.error('No se pudieron cargar las instalaciones:', err);
        setEstado((e) => ({ ...e, cargado: true, error: true }));
      },
    ));
    return () => unsubs.forEach((u) => u());
  }, [firebaseUser, llave, verTodas]);

  return estado;
}
