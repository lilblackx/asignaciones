import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';

const CONFIG_REF = () => doc(db, 'artifacts', appId, 'public', 'data', 'config', 'cierreAutomatico');

// Configuración del cierre automático (config/cierreAutomatico): { activo, hora
// "HH:MM", dias [0-6, 0 = domingo], ... }. La ejecuta un cron del Worker de
// notificaciones (cf-worker), que además escribe aquí ultimaEjecucion,
// ultimaEjecucionEn y ultimoResultado. Solo se escuchan al abrir Reportes.
export function useCierreAutomatico() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(CONFIG_REF(), (snap) => {
      setConfig(snap.exists() ? snap.data() : null);
      setLoading(false);
    }, (err) => {
      console.error('No se pudo cargar la configuración del cierre automático:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // merge: no pisa los campos que escribe el Worker (ultimaEjecucion, etc.).
  // actualizadoEn evita que activarlo después de la hora de hoy dispare un cierre inmediato.
  const guardar = useCallback(async ({ activo, hora, dias }, usuario) => {
    await setDoc(CONFIG_REF(), { activo, hora, dias, actualizadoEn: Date.now(), actualizadoPor: usuario }, { merge: true });
  }, []);

  return { config, loading, guardar };
}
