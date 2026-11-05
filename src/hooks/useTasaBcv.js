import { useState, useEffect, useCallback } from 'react';
import { doc } from 'firebase/firestore';
import { onSnapshot, setDoc } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { tasaEuroPlausible } from '../utils/tasa.js';

const CONFIG_REF = () => doc(db, 'artifacts', appId, 'public', 'data', 'config', 'tasaBcv');
// DolarApi.com — tasa oficial BCV del euro. https://dolarapi.com/docs/venezuela/
const API_TASAS_BCV = 'https://ve.dolarapi.com/v1/cotizaciones';

const redondear2 = (n) => Math.round(Number(n) * 100) / 100;

// Tasas oficiales del momento según la API: { euro, dolar } (NaN si no vienen). Lanza si la API no responde.
async function leerTasasOficiales() {
  const res = await fetch(API_TASAS_BCV);
  if (!res.ok) throw new Error('Respuesta no OK de la API de tasa');
  const lista = await res.json();
  // Respuesta real confirmada: [{ moneda: "EUR", fuente: "oficial", promedio: <número>, ... }, { moneda: "USD", ... }]
  const oficial = (moneda) => Number((Array.isArray(lista) ? lista : []).find((c) => c?.moneda === moneda && c?.fuente === 'oficial')?.promedio);
  return { euro: oficial('EUR'), dolar: oficial('USD') };
}

export function useTasaBcv(firebaseUser) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Devuelve true si la guardó, 'invalida' si la API trajo una tasa imposible (se deja la anterior)
  // y false si no se pudo consultar.
  const actualizarAutomatica = useCallback(async () => {
    try {
      const { euro: tasa, dolar } = await leerTasasOficiales();
      if (!tasa) throw new Error('No se pudo leer la tasa de la respuesta de la API');
      if (!tasaEuroPlausible(tasa, dolar)) {
        console.error('Tasa del euro rechazada por imposible:', tasa, 'dólar', dolar);
        return 'invalida';
      }

      const nuevaConfig = {
        montoBaseEUR: config?.montoBaseEUR ?? 1, // AJUSTAR: pon aquí el monto base real
        tasa: redondear2(tasa),
        fuente: 'automatica',
        actualizadoEn: Date.now(),
      };
      // No hace falta setConfig acá: el listener de abajo trae este mismo
      // valor apenas Firestore confirma la escritura, para esta sesión y
      // para cualquier otra que esté abierta en ese momento.
      await setDoc(CONFIG_REF(), nuevaConfig, { merge: true });
      return true;
    } catch (err) {
      console.error('No se pudo actualizar la tasa automáticamente:', err);
      return false;
    }
  }, [config]);

  // Devuelve 'invalida' (sin guardar) si la tasa escrita es menor que el dólar oficial; si la API no responde no hay con qué
  // comparar y se guarda tal cual.
  const actualizarManual = useCallback(async (tasa, montoBaseEUR, usuario) => {
    const { dolar } = await leerTasasOficiales().catch(() => ({ dolar: NaN }));
    if (Number.isFinite(dolar) && dolar > 0 && !tasaEuroPlausible(Number(tasa), dolar)) return 'invalida';
    const nuevaConfig = {
      montoBaseEUR: redondear2(montoBaseEUR),
      tasa: redondear2(tasa),
      fuente: 'manual',
      actualizadoEn: Date.now(),
      actualizadoPor: usuario,
    };
    await setDoc(CONFIG_REF(), nuevaConfig, { merge: true });
    return true;
  }, []);

  useEffect(() => {
    // Antes se disparaba al montar la app, antes de que la sesión de Firebase Auth
    // terminara de resolver — esa primera lectura chocaba con las reglas (sin sesión
    // aún) y, al no reintentar, la tasa quedaba en null toda la sesión. Ahora espera
    // a que haya un usuario autenticado.
    if (!firebaseUser) return;
    // onSnapshot (no getDoc de una sola vez): así, si OTRO admin actualiza la
    // tasa mientras esta sesión sigue abierta, se entera al instante en vez
    // de quedarse con una copia vieja hasta que alguien recargue la página.
    const unsub = onSnapshot(CONFIG_REF(), (snap) => {
      setConfig(snap.exists() ? snap.data() : null);
      setLoading(false);
    }, (err) => {
      console.error('No se pudo cargar la configuración de tasa:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [firebaseUser]);

  return { config, loading, actualizarAutomatica, actualizarManual };
}
