import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { mesDe } from '../utils/totalesMes';

// Los totales ya cerrados de un mes (un documento, lo suma el cierre del día en el Worker): una lectura por mes consultado. Se guarda una
// copia en el equipo: el del mes en curso cambia una vez al día (al cerrar), así que una hora basta; uno ya pasado no cambia (un día).
// El número cambia cuando se corrigen los totales guardados (v2: recálculo del 22/10/2026), para que ningún equipo siga mostrando una copia vieja.
const CLAVE_COPIA = 'asignaciones:estadisticasMes:v2:';
const VIGENCIA_ACTUAL_MS = 60 * 60 * 1000;
const VIGENCIA_PASADO_MS = 24 * 60 * 60 * 1000;

function copiaGuardada(mes) {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_COPIA + mes));
    const vigencia = mes === mesDe(Date.now()) ? VIGENCIA_ACTUAL_MS : VIGENCIA_PASADO_MS;
    return c && Date.now() - c.t < vigencia && c.datos && typeof c.datos === 'object' ? c.datos : null;
  } catch {
    return null;
  }
}

// { contador, cargado, error } del mes pedido. `contador` es {} si ese mes todavía no tiene nada cerrado. `activo` false = no lee nada.
export function useEstadisticasMes(firebaseUser, activo, mes) {
  const [estado, setEstado] = useState({ mes: null, datos: null, error: false });

  useEffect(() => {
    if (!firebaseUser || !activo || !mes) return undefined;
    let cancelado = false;
    const cargar = async () => {
      const guardada = copiaGuardada(mes);
      if (guardada) { setEstado({ mes, datos: guardada, error: false }); return; }
      try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'estadisticasMensuales', mes));
        const datos = snap.exists() ? snap.data() : {};
        try { localStorage.setItem(CLAVE_COPIA + mes, JSON.stringify({ t: Date.now(), datos })); } catch { /* sin almacenamiento: solo se pierde el ahorro */ }
        if (!cancelado) setEstado({ mes, datos, error: false });
      } catch (err) {
        console.error('No se pudieron cargar los totales del mes:', err);
        if (!cancelado) setEstado({ mes, datos: null, error: true });
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [firebaseUser, activo, mes]);

  const alDia = estado.mes === mes;
  return { contador: alDia ? estado.datos : null, cargado: alDia, error: alDia && estado.error };
}
