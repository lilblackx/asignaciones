import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { getDocs } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { leerReportesIncremental } from '../lib/reportesLocales';

const TAMANO_PAGINA = 30;
// Si la pestaña estuvo oculta más de esto, al volver se actualiza sola.
export const REFRESCO_AUTOMATICO_MS = 10 * 60 * 1000;

const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// El historial de órdenes para INFRAESTRUCTURA con permiso (las reglas solo se lo dejan leer a ese rol con ese permiso): las mismas órdenes y
// cierres que ve el administrador, pero sin listeners en vivo (cada cambio de cualquier orden costaría una lectura). Se lee la primera vez que
// se abre (`activo`), con el botón "Actualizar" y al volver a la pestaña tras un rato; los cierres anteriores, a pedido.
// Devuelve { tickets, reports, cargado, error, actualizadoEn, actualizando, actualizar, hayMasReportes, cargandoReportes, cargarReportesAnteriores }.
export function useHistorialOrdenes(firebaseUser, activo) {
  const [estado, setEstado] = useState({ tickets: [], reports: [], cargado: false, error: false, actualizadoEn: 0 });
  const [actualizando, setActualizando] = useState(false);
  const [hayMasReportes, setHayMasReportes] = useState(false);
  const [cargandoReportes, setCargandoReportes] = useState(false);
  const ultimoReporte = useRef(null); // el más antiguo cargado, para pedir los anteriores
  const reportesRef = useRef([]);
  const ocupado = useRef(false);
  const pedido = useRef(false); // ya se pidió la primera carga

  const primeraPagina = useCallback((uid) => leerReportesIncremental({
    uid,
    nombre: 'infra-historial',
    limite: TAMANO_PAGINA,
    referencia: (id) => doc(datos('reports'), id),
    consulta: (condiciones) => query(datos('reports'), ...condiciones, orderBy('createdAt', 'desc'), limit(TAMANO_PAGINA)),
  }), []);

  const aplicar = useCallback((ordenes, reportes) => {
    reportesRef.current = reportes;
    setEstado({ tickets: aLista(ordenes), reports: reportes, cargado: true, error: false, actualizadoEn: Date.now() });
  }, []);

  // Primera carga: la primera vez que se abre el historial.
  useEffect(() => {
    if (!firebaseUser || !activo || pedido.current) return undefined;
    pedido.current = true;
    let cancelado = false;
    let terminado = false;
    (async () => {
      try {
        const [ordenes, docsReportes] = await Promise.all([getDocs(datos('tickets')), primeraPagina(firebaseUser.uid)]);
        if (cancelado) return;
        terminado = true;
        ultimoReporte.current = docsReportes[docsReportes.length - 1] || null;
        setHayMasReportes(docsReportes.length === TAMANO_PAGINA);
        aplicar(ordenes, docsReportes.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('No se pudo cargar el historial de órdenes:', error);
        terminado = true;
        pedido.current = false;
        if (!cancelado) setEstado((e) => ({ ...e, cargado: true, error: true }));
      }
    })();
    // Si se desmonta o cambia antes de terminar, la próxima vez vuelve a pedir (también el montaje doble de StrictMode en desarrollo).
    return () => { cancelado = true; if (!terminado) pedido.current = false; };
  }, [firebaseUser, activo, aplicar, primeraPagina]);

  const actualizar = useCallback(async () => {
    if (!firebaseUser || ocupado.current) return;
    ocupado.current = true;
    setActualizando(true);
    try {
      const mayor = reportesRef.current.reduce((m, r) => Math.max(m, r.createdAt || 0), 0);
      const [ordenes, nuevos] = await Promise.all([
        getDocs(datos('tickets')),
        getDocs(query(datos('reports'), where('createdAt', '>', mayor), orderBy('createdAt', 'desc'))),
      ]);
      aplicar(ordenes, [...aLista(nuevos), ...reportesRef.current]);
    } catch (error) {
      console.error('No se pudo actualizar el historial de órdenes:', error);
      setEstado((e) => ({ ...e, error: true }));
    } finally {
      ocupado.current = false;
      setActualizando(false);
    }
  }, [firebaseUser, aplicar]);

  const cargarReportesAnteriores = useCallback(async () => {
    if (!ultimoReporte.current || cargandoReportes) return;
    setCargandoReportes(true);
    try {
      const snap = await getDocs(query(datos('reports'), orderBy('createdAt', 'desc'), startAfter(ultimoReporte.current), limit(TAMANO_PAGINA)));
      reportesRef.current = [...reportesRef.current, ...aLista(snap)];
      ultimoReporte.current = snap.docs[snap.docs.length - 1] || ultimoReporte.current;
      setHayMasReportes(snap.docs.length === TAMANO_PAGINA);
      setEstado((e) => ({ ...e, reports: reportesRef.current }));
    } catch (error) {
      console.error('No se pudieron cargar los cierres anteriores:', error);
    } finally {
      setCargandoReportes(false);
    }
  }, [cargandoReportes]);

  // Al volver a la pestaña después de un rato, se actualiza sola (solo si el historial ya se abrió).
  const ultima = useRef(0);
  useEffect(() => { ultima.current = estado.actualizadoEn; }, [estado.actualizadoEn]);
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible' && ultima.current && Date.now() - ultima.current > REFRESCO_AUTOMATICO_MS) actualizar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [actualizar]);

  return { ...estado, actualizando, actualizar, hayMasReportes, cargandoReportes, cargarReportesAnteriores };
}
