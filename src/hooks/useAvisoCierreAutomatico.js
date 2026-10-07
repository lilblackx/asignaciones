import { useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';

const STORAGE_PREFIX = 'asignaciones:cierreAutomatico:';

// Cuando el Worker termina un cierre automático escribe su resultado en
// config/cierreAutomatico. Aquí se convierte en una notificación del icono de la
// campana (igual que el resto de avisos de la app) la próxima vez que haya una
// sesión abierta. El push del sistema lo cubre cuando la app está cerrada.
export function useAvisoCierreAutomatico(firebaseUser, canCerrar, currentUser, addNotification) {
  const addRef = useRef(addNotification);
  useEffect(() => { addRef.current = addNotification; });

  useEffect(() => {
    if (!firebaseUser || !canCerrar || !currentUser) return;
    const clave = STORAGE_PREFIX + currentUser;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'cierreAutomatico'), (snap) => {
      const datos = snap.data();
      const ejecutadoEn = Number(datos?.ultimaEjecucionEn) || 0;
      let visto = null;
      try { visto = localStorage.getItem(clave); } catch { /* storage bloqueado: se trata como primera vez */ }
      // Primera vez en este navegador: se toma como punto de partida, sin avisar de cierres viejos.
      if (visto === null || ejecutadoEn <= Number(visto)) {
        if (visto === null) { try { localStorage.setItem(clave, String(ejecutadoEn)); } catch { /* sin storage */ } }
        return;
      }
      try { localStorage.setItem(clave, String(ejecutadoEn)); } catch { /* sin storage */ }
      addRef.current({ type: 'cierreAutomatico', text: `Cierre automático: ${datos.ultimoResultado || 'ejecutado.'}`, timestamp: ejecutadoEn });
    }, (err) => console.error('No se pudo escuchar el cierre automático:', err));
    return () => unsub();
  }, [firebaseUser, canCerrar, currentUser]);
}
