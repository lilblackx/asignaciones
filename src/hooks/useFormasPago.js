import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { normalizarFormasPago } from '../utils/formasPago';

const CONFIG_REF = () => doc(db, 'artifacts', appId, 'public', 'data', 'config', 'formasPago');

export function useFormasPago(firebaseUser) {
  // Documento tal como está en Firestore ({ formas, actualizadoEn, actualizadoPor })
  // o null si el ADMIN todavía no ha guardado nada.
  const [formasPago, setFormasPago] = useState(null);

  useEffect(() => {
    // Espera a que haya sesión: antes de eso las reglas rechazan la lectura.
    if (!firebaseUser) return;
    // onSnapshot: si el ADMIN cambia un dato, el técnico lo ve al instante.
    const unsub = onSnapshot(CONFIG_REF(), (snap) => {
      setFormasPago(snap.exists() ? snap.data() : null);
    }, (err) => {
      console.error('No se pudieron cargar las formas de pago:', err);
    });
    return () => unsub();
  }, [firebaseUser]);

  const guardarFormasPago = useCallback(async (formas, usuario) => {
    // Sin merge: el documento se reemplaza completo, así lo que el ADMIN quitó
    // desaparece también para los técnicos.
    await setDoc(CONFIG_REF(), {
      formas: normalizarFormasPago({ formas }),
      actualizadoEn: Date.now(),
      actualizadoPor: usuario,
    });
  }, []);

  return { formasPago, guardarFormasPago };
}
