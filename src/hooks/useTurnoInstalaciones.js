import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
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

  // No resetea el puntero a 0: si el técnico que tenía el turno sigue en la
  // lista nueva, el puntero se mueve con él (evita que reordenar regale el
  // turno de vuelta al primero de la lista). Solo cae a 0 si ese técnico
  // ya no está (lo quitaron del orden).
  const guardarOrden = useCallback(async (nuevoOrden, usuario) => {
    const tecnicoActual = orden[turnoActualIndex];
    const nuevoIndex = tecnicoActual
      ? Math.max(0, nuevoOrden.findIndex(n => n.toUpperCase() === tecnicoActual.toUpperCase()))
      : 0;
    await setDoc(TURNO_REF(), {
      orden: nuevoOrden,
      turnoActualIndex: nuevoIndex,
      actualizadoPor: usuario || null,
      actualizadoEn: Date.now()
    });
    setToastMsg({ type: 'success', text: 'Orden de turno guardado.' });
  }, [setToastMsg, orden, turnoActualIndex]);

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
