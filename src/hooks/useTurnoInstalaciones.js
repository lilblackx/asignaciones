import { useCallback, useEffect, useState } from 'react';
import { doc } from 'firebase/firestore';
import { onSnapshot, setDoc, updateDoc } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';

const TURNO_REF = () => doc(db, 'artifacts', appId, 'public', 'data', 'config', 'turnoInstalaciones');

// El orden lo arma el ADMIN a mano (semanal, ver TechniciansModal). Este hook
// solo sabe: cuál es la lista, quién sigue, y cómo avanzar/saltar inactivos.
export function useTurnoInstalaciones(firebaseUser, technicians, setToastMsg) {
  const [orden, setOrden] = useState([]);
  const [turnoActualIndex, setTurnoActualIndex] = useState(0);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onSnapshot(TURNO_REF(), (snap) => {
      const data = snap.data();
      setOrden(data?.orden || []);
      setTurnoActualIndex(data?.turnoActualIndex || 0);
    }, (err) => {
      console.error('No se pudo cargar el turno de instalaciones:', err);
    });
    return () => unsub();
  }, [firebaseUser]);

  // Un orden nuevo es el de la semana: el turno vuelve al primero de la lista (tecnicoSugerido salta
  // a los inactivos). Antes el puntero se quedaba con quien tenía el turno y, al reordenar, la
  // primera instalación de la semana se le asignaba a alguien del final de la lista.
  const guardarOrden = useCallback(async (nuevoOrden, usuario) => {
    await setDoc(TURNO_REF(), {
      orden: nuevoOrden,
      turnoActualIndex: 0,
      actualizadoPor: usuario || null,
      actualizadoEn: Date.now()
    });
    setToastMsg({ type: 'success', text: 'Orden de turno guardado.' });
  }, [setToastMsg]);

  // Se llama al crear una INSTALACIÓN con técnico asignado (haya sido el
  // sugerido o no): el puntero pasa a la posición siguiente a ESE técnico,
  // así quien acaba de recibir el trabajo queda al final de la fila.
  const avanzarTurno = useCallback(async (tecnicoAsignado) => {
    if (!tecnicoAsignado || orden.length === 0) return;
    const idx = orden.findIndex(n => n.toUpperCase() === tecnicoAsignado.toUpperCase());
    if (idx === -1) return;
    try {
      await updateDoc(TURNO_REF(), { turnoActualIndex: (idx + 1) % orden.length });
    } catch (err) {
      console.error('No se pudo avanzar el turno de instalaciones:', err);
    }
  }, [orden]);

  // Recorre `orden` desde turnoActualIndex, saltando a cualquiera marcado
  // inactivo, hasta encontrar el primero disponible. null si nadie califica.
  const tecnicoSugerido = (() => {
    if (orden.length === 0) return null;
    for (let i = 0; i < orden.length; i++) {
      const nombre = orden[(turnoActualIndex + i) % orden.length];
      const tech = technicians.find(t => t.name.toUpperCase() === nombre.toUpperCase());
      if (tech && tech.activo !== false) return tech.name;
    }
    return null;
  })();

  return { orden, turnoActualIndex, tecnicoSugerido, guardarOrden, avanzarTurno };
}
