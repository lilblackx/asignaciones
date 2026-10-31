import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { setAutomaticasPausadas } from '../lib/escrituraAutomatica';
import { aplicarActualizacion, hayActualizacion } from '../lib/updateAvailable';
import { debeRecargar } from '../utils/recargaForzada';

// Control de emergencia desde el servidor, para todas las sesiones abiertas (todos los roles), sin pedirle a nadie que recargue.
// Lo escribe el ADMIN en config/app (consola de Firebase o scripts/control-remoto.mjs):
//   pausarAutomaticas: true    ninguna sesión hace escrituras automáticas (ver lib/escrituraAutomatica.js); false o sin el campo: normal.
//   recargarAntesDe: <ms>      toda página abierta antes de ese momento se recarga una vez (con la versión publicada si hay una nueva).
// Es un solo documento: una lectura al abrir y otra cada vez que se cambia.

// Cuándo se abrió esta página. `recargarAntesDe` solo recarga las abiertas antes.
const ABIERTA_EN = Date.now();
const CLAVE_RECARGA = 'asignaciones:recargaForzada';

const leerMarca = () => { try { return localStorage.getItem(CLAVE_RECARGA); } catch { return undefined; } };
const guardarMarca = (valor) => { try { localStorage.setItem(CLAVE_RECARGA, String(valor)); return true; } catch { return false; } };

export function useControlRemoto(firebaseUser) {
  useEffect(() => {
    if (!firebaseUser) return undefined;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'app'), (snap) => {
      const datos = snap.exists() ? snap.data() : {};
      setAutomaticasPausadas(datos.pausarAutomaticas === true);
      if (debeRecargar(datos.recargarAntesDe, ABIERTA_EN, leerMarca()) && guardarMarca(datos.recargarAntesDe)) {
        if (hayActualizacion()) aplicarActualizacion(); else window.location.reload();
      }
    }, (error) => console.warn('No se pudo leer el control remoto (config/app):', error));
  }, [firebaseUser]);
}
