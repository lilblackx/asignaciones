import { useCallback, useEffect, useState } from 'react';
import { doc } from 'firebase/firestore';
import { onSnapshot, setDoc } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { cambioDeFuncion, leerFunciones } from '../utils/funciones';

// Las funciones que el ADMIN enciende en Configuración (config/funciones, ver utils/funciones.js). Solo escucha cuando `activo`: los técnicos
// (para saber si ven la ruta) y el módulo Configuración abierto; los demás roles no gastan ni una lectura. Es un documento: una lectura al
// abrir y otra cada vez que el ADMIN cambia algo. Mientras no llega (o si falla), todo está apagado.
const ref = () => doc(db, 'artifacts', appId, 'public', 'data', 'config', 'funciones');

export function useFunciones(firebaseUser, activo, usuario) {
  const [estado, setEstado] = useState({ funciones: leerFunciones(null), cargado: false, error: false });

  useEffect(() => {
    if (!firebaseUser || !activo) return undefined;
    return onSnapshot(ref(),
      (snap) => setEstado({ funciones: leerFunciones(snap.exists() ? snap.data() : null), cargado: true, error: false }),
      (error) => { console.warn('No se pudo leer config/funciones:', error); setEstado((e) => ({ ...e, cargado: true, error: true })); });
  }, [firebaseUser, activo]);

  // Solo el ADMIN: las reglas lo rechazan para los demás. Devuelve true si se guardó.
  const cambiar = useCallback(async (clave, valor) => {
    try {
      await setDoc(ref(), cambioDeFuncion(clave, valor, usuario), { merge: true });
      return true;
    } catch (error) {
      console.error('No se pudo guardar la función:', error);
      return false;
    }
  }, [usuario]);

  return { ...estado, cambiar };
}
