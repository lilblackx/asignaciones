import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';

const TAMANO_PAGINA = 30;
// Si la pestaña estuvo oculta más de esto, al volver se actualiza sola.
export const REFRESCO_AUTOMATICO_MS = 10 * 60 * 1000;
// Materiales solo cuenta las órdenes aprobadas y avisa de las que esperan aprobación: no hace falta leer ninguna otra.
export const ESTADOS_DE_MATERIALES = ['FINALIZADO', 'PRE-FINALIZADO'];

const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

const leerOrdenesYTecnicos = () => Promise.all([
  getDocs(query(datos('tickets'), where('estado', 'in', ESTADOS_DE_MATERIALES))),
  getDocs(datos('technicians')),
]);

// Reportes de cierre (los únicos con órdenes finalizadas), del más nuevo al más viejo. `condiciones` agrega
// filtros ('createdAt' mayor que...) o la página siguiente. Pide el índice (tipoReporte + createdAt); si todavía no
// existe en el proyecto cae a la consulta sin filtro de tipo y descarta los CANCELADOS aquí, para no quedar sin datos.
async function leerReportes(condiciones = [], paginacion = []) {
  try {
    return await getDocs(query(datos('reports'), where('tipoReporte', '==', 'CIERRE'), ...condiciones, orderBy('createdAt', 'desc'), ...paginacion));
  } catch (error) {
    if (error?.code !== 'failed-precondition') throw error;
    const snap = await getDocs(query(datos('reports'), ...condiciones, orderBy('createdAt', 'desc'), ...paginacion));
    return { docs: snap.docs.filter((d) => d.data().tipoReporte === 'CIERRE') };
  }
}

// Datos del módulo de Materiales para el ALMACÉN, pensados para gastar pocas lecturas de Firestore:
//  - sin listeners en vivo (cada cambio de cualquier orden costaría una lectura): se lee al abrir, con el botón
//    "Actualizar" y al volver a la pestaña tras un rato;
//  - de las órdenes solo las que Materiales usa (FINALIZADO y PRE-FINALIZADO), no todas;
//  - de los reportes de cierre, una página al abrir; al actualizar solo se piden los nuevos, y los anteriores a pedido.
export function useDatosAlmacen(firebaseUser) {
  const [datosAlmacen, setDatos] = useState({ tickets: [], technicians: [], reports: [], cargado: false, error: false, actualizadoEn: 0 });
  const [actualizando, setActualizando] = useState(false);
  const [hayMasReportes, setHayMasReportes] = useState(false);
  const [cargandoReportes, setCargandoReportes] = useState(false);
  const ultimoReporte = useRef(null); // el más antiguo cargado, para pedir los anteriores
  const reportesRef = useRef([]);
  const ocupado = useRef(false);

  // Primera carga: órdenes, técnicos y la primera página de reportes.
  useEffect(() => {
    if (!firebaseUser) return;
    let cancelado = false;
    (async () => {
      try {
        const [[ordenes, tecnicos], reportes] = await Promise.all([
          leerOrdenesYTecnicos(),
          leerReportes([], [limit(TAMANO_PAGINA)]),
        ]);
        if (cancelado) return;
        reportesRef.current = aLista(reportes);
        ultimoReporte.current = reportes.docs[reportes.docs.length - 1] || null;
        setHayMasReportes(reportes.docs.length === TAMANO_PAGINA);
        setDatos({ tickets: aLista(ordenes), technicians: aLista(tecnicos), reports: reportesRef.current, cargado: true, error: false, actualizadoEn: Date.now() });
      } catch (error) {
        console.error('No se pudieron cargar los datos del almacén:', error);
        if (!cancelado) setDatos((d) => ({ ...d, cargado: true, error: true }));
      }
    })();
    return () => { cancelado = true; };
  }, [firebaseUser]);

  const actualizar = useCallback(async () => {
    if (!firebaseUser || ocupado.current) return;
    ocupado.current = true;
    setActualizando(true);
    try {
      const mayor = reportesRef.current.reduce((m, r) => Math.max(m, r.createdAt || 0), 0);
      const [[ordenes, tecnicos], nuevos] = await Promise.all([
        leerOrdenesYTecnicos(),
        leerReportes([where('createdAt', '>', mayor)]),
      ]);
      const delaLista = aLista(nuevos);
      if (delaLista.length) reportesRef.current = [...delaLista, ...reportesRef.current];
      setDatos({ tickets: aLista(ordenes), technicians: aLista(tecnicos), reports: reportesRef.current, cargado: true, error: false, actualizadoEn: Date.now() });
    } catch (error) {
      console.error('No se pudieron actualizar los datos del almacén:', error);
      setDatos((d) => ({ ...d, error: true }));
    } finally {
      ocupado.current = false;
      setActualizando(false);
    }
  }, [firebaseUser]);

  const cargarReportesAnteriores = useCallback(async () => {
    if (!ultimoReporte.current || cargandoReportes) return;
    setCargandoReportes(true);
    try {
      const snap = await leerReportes([], [startAfter(ultimoReporte.current), limit(TAMANO_PAGINA)]);
      reportesRef.current = [...reportesRef.current, ...aLista(snap)];
      ultimoReporte.current = snap.docs[snap.docs.length - 1] || ultimoReporte.current;
      setHayMasReportes(snap.docs.length === TAMANO_PAGINA);
      setDatos((d) => ({ ...d, reports: reportesRef.current }));
    } catch (error) {
      console.error('No se pudieron cargar los reportes anteriores:', error);
    } finally {
      setCargandoReportes(false);
    }
  }, [cargandoReportes]);

  // Al volver a la pestaña después de un rato, se actualiza sola.
  const ultimaActualizacion = useRef(0);
  useEffect(() => { ultimaActualizacion.current = datosAlmacen.actualizadoEn; }, [datosAlmacen.actualizadoEn]);
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible' && ultimaActualizacion.current && Date.now() - ultimaActualizacion.current > REFRESCO_AUTOMATICO_MS) actualizar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [actualizar]);

  return { ...datosAlmacen, actualizando, actualizar, hayMasReportes, cargandoReportes, cargarReportesAnteriores };
}
