import { useCallback, useEffect, useMemo, useState } from 'react';
import { escucharAvisos, marcarAvisoResuelto, pagoVigenteDe } from '../lib/avisosOrdenPagada';
import { avisosVigentes } from '../utils/avisoOrdenPagada';

// Finanzas: los avisos de órdenes que ya estaban pagadas y se cancelaron o cambiaron de tipo (ver utils/avisoOrdenPagada). Escucha los sin resolver (pocos) y, de cada orden, lee una vez su revisión para saber
// si de verdad estaba pagada y con qué pago. `resolver(aviso)` lo marca como resuelto a nombre de `usuario`; devuelve true si se guardó.
export function useAvisosOrdenPagada({ firebaseUser, usuario, setToastMsg }) {
  const [avisos, setAvisos] = useState([]);
  const [pagos, setPagos] = useState({});

  useEffect(() => {
    if (!firebaseUser) return undefined;
    return escucharAvisos(setAvisos, (e) => console.error('No se pudieron leer los avisos de órdenes pagadas:', e));
  }, [firebaseUser]);

  // Una lectura por orden con aviso (la primera vez que aparece): su pago vigente o '' si no está pagada.
  const clavesSinLeer = useMemo(() => [...new Set(avisos.map((a) => a.clave))].filter((c) => !(c in pagos)).sort().join('|'), [avisos, pagos]);
  useEffect(() => {
    if (!clavesSinLeer) return undefined;
    let vigente = true;
    Promise.all(clavesSinLeer.split('|').map((c) => pagoVigenteDe(c).then((p) => [c, p]).catch(() => [c, '']))).then((pares) => {
      if (vigente) setPagos((previos) => ({ ...previos, ...Object.fromEntries(pares) }));
    });
    return () => { vigente = false; };
  }, [clavesSinLeer]);

  const vigentes = useMemo(() => avisosVigentes(avisos, pagos), [avisos, pagos]);

  const resolver = useCallback(async (aviso) => {
    try {
      await marcarAvisoResuelto(aviso.id, { por: usuario });
      return true;
    } catch (error) {
      console.error('No se pudo marcar el aviso como resuelto:', error);
      setToastMsg?.({ type: 'error', text: 'No se pudo marcar el aviso como resuelto. Intenta de nuevo.' });
      return false;
    }
  }, [usuario, setToastMsg]);

  return { avisos: vigentes, resolver };
}
