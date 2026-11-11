import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc } from 'firebase/firestore';
import { onSnapshot, setDoc } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { useAhora } from './useAhora';
import { delMomento, desdeHistorico, diaCaracas, fusionarDias, opcionesDeTasa } from '../utils/tasasDolar';

// Las tasas BCV del dólar de los últimos 7 días (ver utils/tasasDolar.js), para elegir con cuál se paga. Se juntan tres fuentes: lo guardado en config/tasasDolar, el historial de DolarAPI
// (así el lunes está aunque nadie abriera Finanzas ese día) y la tasa del momento (`enVivo`, de useTasaDolar). Lo que falte por guardar lo guarda quien tenga abierta la pantalla (una escritura
// como mucho por cambio: normalmente una al día); si esa escritura falla (permiso, sin conexión) el selector sigue funcionando con lo que trajo la API. Costo: una lectura al abrir.
const REF = () => doc(db, 'artifacts', appId, 'public', 'data', 'config', 'tasasDolar');
const API_HISTORICO = 'https://ve.dolarapi.com/v1/historicos/dolares/oficial';

export function useTasasDolar(firebaseUser, usuario, enVivo) {
  const [guardadas, setGuardadas] = useState({ dias: null, error: false });
  const [historico, setHistorico] = useState({ lista: null, cargado: false, error: false });
  const [pedido, setPedido] = useState(0);
  const guardado = useRef('');

  useEffect(() => {
    if (!firebaseUser) return undefined;
    return onSnapshot(REF(),
      (snap) => setGuardadas({ dias: snap.exists() && snap.data().dias && typeof snap.data().dias === 'object' ? snap.data().dias : {}, error: false }),
      (error) => { console.warn('No se pudieron leer las tasas guardadas (config/tasasDolar):', error); setGuardadas({ dias: {}, error: true }); });
  }, [firebaseUser]);

  useEffect(() => {
    let vigente = true;
    fetch(API_HISTORICO)
      .then((r) => { if (!r.ok) throw new Error(`La API respondió ${r.status}`); return r.json(); })
      .then((lista) => { if (vigente) setHistorico({ lista, cargado: true, error: false }); })
      .catch((error) => { console.warn('No se pudo traer el historial de la tasa BCV:', error); if (vigente) setHistorico((h) => ({ ...h, cargado: true, error: true })); });
    return () => { vigente = false; };
  }, [pedido]);

  // El día de hoy (de Caracas) se renueva solo: con la pantalla abierta de un día a otro, la ventana de 7 días avanza.
  const hoy = diaCaracas(useAhora());
  const { dias, hayCambios } = useMemo(() => {
    const nuevos = { ...desdeHistorico(historico.lista, hoy), ...delMomento(enVivo?.tasa, enVivo?.fecha, hoy) };
    return fusionarDias(guardadas.dias, nuevos, hoy);
  }, [guardadas.dias, historico.lista, enVivo?.tasa, enVivo?.fecha, hoy]);

  const listo = guardadas.dias !== null && historico.cargado && !enVivo?.cargando;
  useEffect(() => {
    if (!firebaseUser || !listo || !hayCambios || Object.keys(dias).length === 0) return;
    const firma = JSON.stringify(dias);
    if (guardado.current === firma) return;
    guardado.current = firma;
    setDoc(REF(), { dias, actualizadoEn: Date.now(), actualizadoPor: String(usuario || '').slice(0, 80) })
      .catch((error) => console.warn('No se pudieron guardar las tasas de los últimos días:', error));
  }, [firebaseUser, listo, hayCambios, dias, usuario]);

  const actualizar = useCallback(() => setPedido((n) => n + 1), []);
  const opciones = useMemo(() => opcionesDeTasa(dias, hoy), [dias, hoy]);
  return { opciones, hoy, cargado: guardadas.dias !== null && historico.cargado, errorHistorial: historico.error, actualizar };
}
