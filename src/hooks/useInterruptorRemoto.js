import { useCallback, useEffect, useState } from 'react';
import { doc } from 'firebase/firestore';
import { onSnapshot, setDoc } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { cambioDePausa, leerInterruptor } from '../utils/interruptorRemoto';

// El interruptor remoto de Configuración (config/app, ver utils/interruptorRemoto.js). Solo escucha mientras el módulo está abierto (`activo`): es un documento,
// una lectura al abrir y otra cada vez que alguien lo cambia (la app ya escucha este mismo documento en useControlRemoto, así que el servidor no manda nada extra).
// `pausarAutomaticas` es null hasta que llega la primera lectura (o si falla), para no afirmar que está apagado sin saberlo.
const ref = () => doc(db, 'artifacts', appId, 'public', 'data', 'config', 'app');

export function useInterruptorRemoto(firebaseUser, activo, usuario) {
  const [estado, setEstado] = useState({ pausarAutomaticas: null, actualizadoPor: '', actualizadoEn: 0, cargado: false, error: false });

  useEffect(() => {
    if (!firebaseUser || !activo) return undefined;
    return onSnapshot(ref(),
      (snap) => setEstado({ ...leerInterruptor(snap.exists() ? snap.data() : null), cargado: true, error: false }),
      (error) => { console.warn('No se pudo leer config/app:', error); setEstado((e) => ({ ...e, cargado: true, error: true })); });
  }, [firebaseUser, activo]);

  // Solo el ADMIN: las reglas lo rechazan para los demás. Devuelve true si se guardó.
  const cambiarPausa = useCallback(async (valor) => {
    try {
      await setDoc(ref(), cambioDePausa(valor, usuario), { merge: true });
      return true;
    } catch (error) {
      console.error('No se pudo guardar el interruptor remoto:', error);
      return false;
    }
  }, [usuario]);

  return { ...estado, cambiarPausa };
}
