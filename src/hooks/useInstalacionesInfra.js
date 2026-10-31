import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, deleteField, doc, orderBy, query, where } from 'firebase/firestore';
import { getDocs, getDoc, setDoc } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { leerReportesIncremental } from '../lib/reportesLocales';
import { DIAS_INFRAESTRUCTURA, instalacionesRealizadas, mesDeMarcas, mesesDeMarcas } from '../utils/instalacionesInfra';

// Si la pestaña estuvo oculta más de esto, al volver se actualiza sola.
export const REFRESCO_AUTOMATICO_MS = 10 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// Solo lo que Infraestructura necesita: las instalaciones finalizadas que aún están en la lista de órdenes y los reportes de cierre de los últimos DIAS_INFRAESTRUCTURA días
// (donde quedan las que el cierre del día archivó). Las reglas solo le dejan leer esas dos cosas, y la consulta debe llevar los mismos filtros.
// Los reportes se piden con leerReportesIncremental: de los que ya están en el dispositivo solo se baja lo que salió después.
const leer = (uid) => {
  // Al día completo, para que la ventana no se mueva con cada lectura y la caché sirva.
  const hoy = new Date().setHours(0, 0, 0, 0);
  const desde = hoy - DIAS_INFRAESTRUCTURA * DIA_MS;
  return Promise.all([
    getDocs(query(datos('tickets'), where('tipoTrabajo', '==', 'INSTALACIÓN'), where('estado', '==', 'FINALIZADO'))),
    leerReportesIncremental({
      uid,
      nombre: 'infraestructura',
      desde,
      referencia: (id) => doc(datos('reports'), id),
      consulta: (condiciones) => query(datos('reports'), where('tipoReporte', '==', 'CIERRE'), ...condiciones, orderBy('createdAt', 'desc')),
    }),
    // Las marcas de "ya la anoté": un documento por mes, dos lecturas como mucho.
    Promise.all(mesesDeMarcas().map((mes) => getDoc(doc(datos('infraAnotadas'), mes)))),
  ]);
};

// Las instalaciones realizadas para el módulo de INFRAESTRUCTURA. Sin listeners en vivo (cada cambio de cualquier orden costaría una lectura): se lee al abrir, con el botón
// "Actualizar" y al volver a la pestaña tras un rato.
// Devuelve { instalaciones, marcas, marcar, cargado, error, actualizadoEn, actualizando, actualizar }.
export function useInstalacionesInfra(firebaseUser) {
  const [estado, setEstado] = useState({ instalaciones: [], marcas: {}, cargado: false, error: false, actualizadoEn: 0 });
  const [actualizando, setActualizando] = useState(false);
  const ocupado = useRef(false);

  const aplicar = useCallback(([ordenes, reportes, meses]) => {
    const marcas = Object.assign({}, ...meses.map((m) => (m.exists() ? m.data().marcas : null)));
    setEstado({ instalaciones: instalacionesRealizadas(aLista(ordenes), reportes.map((d) => ({ id: d.id, ...d.data() }))), marcas, cargado: true, error: false, actualizadoEn: Date.now() });
  }, []);

  // Primera carga, al abrir.
  useEffect(() => {
    if (!firebaseUser) return undefined;
    let cancelado = false;
    leer(firebaseUser.uid)
      .then((r) => { if (!cancelado) aplicar(r); })
      .catch((error) => {
        console.error('No se pudieron cargar las instalaciones:', error);
        if (!cancelado) setEstado((e) => ({ ...e, cargado: true, error: true }));
      });
    return () => { cancelado = true; };
  }, [firebaseUser, aplicar]);

  const actualizar = useCallback(async () => {
    if (!firebaseUser || ocupado.current) return;
    ocupado.current = true;
    setActualizando(true);
    try {
      aplicar(await leer(firebaseUser.uid));
    } catch (error) {
      console.error('No se pudieron actualizar las instalaciones:', error);
      setEstado((e) => ({ ...e, error: true }));
    } finally {
      ocupado.current = false;
      setActualizando(false);
    }
  }, [firebaseUser, aplicar]);

  // Marca o desmarca una instalación como anotada. Se ve al instante y, si no se pudo guardar, vuelve a como estaba (y avisa quien llama).
  // `por`: quién la marcó. Es solo la marca: no toca la orden.
  const marcar = useCallback(async (fila, anotada, por) => {
    if (!firebaseUser) return false;
    const antes = estado.marcas[fila.id];
    const nueva = anotada ? { por: por || '', en: Date.now() } : null;
    const poner = (valor) => setEstado((e) => {
      const marcas = { ...e.marcas };
      if (valor) marcas[fila.id] = valor; else delete marcas[fila.id];
      return { ...e, marcas };
    });
    poner(nueva);
    try {
      await setDoc(doc(datos('infraAnotadas'), mesDeMarcas(fila.fecha)), { marcas: { [fila.id]: nueva ?? deleteField() } }, { merge: true });
      return true;
    } catch (error) {
      console.error('No se pudo guardar la marca:', error);
      poner(antes || null);
      return false;
    }
  }, [firebaseUser, estado.marcas]);

  const ultima = useRef(0);
  useEffect(() => { ultima.current = estado.actualizadoEn; }, [estado.actualizadoEn]);
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible' && ultima.current && Date.now() - ultima.current > REFRESCO_AUTOMATICO_MS) actualizar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [actualizar]);

  return { ...estado, actualizando, actualizar, marcar };
}
