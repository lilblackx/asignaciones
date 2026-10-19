import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDocs, increment, limit, orderBy, query, setDoc, startAfter, where, writeBatch } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { RETENCION_MS_HISTORIAL_VENTAS, esDeVentas, resumenInstalacion } from '../utils/estadoInstalacion';
import { diaDe, incrementosMensuales } from '../utils/totalesMes';

const REPORTS_PAGE_SIZE = 30;
const MAX_ESCRITURAS_LOTE = 450; // Firestore admite 500 por lote

function buildDesglose(items) {
  return items.reduce((acc, t) => {
    const tipo = t.tipoTrabajo || 'OTRO';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});
}

// Las instalaciones que el cierre saca de la lista dejan un resumen liviano en historialInstalaciones, para que las
// promotoras vean cómo terminaron durante unos días. Si falla, el cierre ya está hecho: solo se avisa en consola.
async function guardarHistorialInstalaciones(ordenes, ahoraMs) {
  const instalaciones = ordenes.filter(esDeVentas);
  try {
    for (let i = 0; i < instalaciones.length; i += MAX_ESCRITURAS_LOTE) {
      const lote = writeBatch(db);
      instalaciones.slice(i, i + MAX_ESCRITURAS_LOTE).forEach((t) => {
        lote.set(doc(db, 'artifacts', appId, 'public', 'data', 'historialInstalaciones', String(t.id)), resumenInstalacion(t, ahoraMs));
      });
      await lote.commit();
    }
  } catch (error) {
    console.error('No se pudo guardar el historial de instalaciones:', error);
  }
}

async function limpiarHistorialInstalaciones(ahoraMs) {
  try {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'historialInstalaciones');
    const vencidas = await getDocs(query(ref, where('archivadoEn', '<', ahoraMs - RETENCION_MS_HISTORIAL_VENTAS)));
    for (let i = 0; i < vencidas.docs.length; i += MAX_ESCRITURAS_LOTE) {
      const lote = writeBatch(db);
      vencidas.docs.slice(i, i + MAX_ESCRITURAS_LOTE).forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }
  } catch (error) {
    console.error('No se pudo limpiar el historial de instalaciones:', error);
  }
}

function formatFecha(dateInput) {
  let formattedDate = new Date().toLocaleDateString('es-VE');
  if (dateInput) {
    const [year, month, day] = dateInput.split('-');
    if (year && month && day) {
      formattedDate = `${day}/${month}/${year}`;
    }
  }
  return formattedDate;
}

// Se pide por páginas (en vez de un onSnapshot de toda la colección) porque
// "reports" solo crece con el tiempo y nunca se borra: sin límite, cada sesión
// de un usuario con permiso de cierre descargaría el historial completo entero,
// cada vez más pesado con los meses.
export function useReports(firebaseUser, canCerrar, currentUser, tickets, setToastMsg) {
  const [reports, setReports] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMoreReports, setHasMoreReports] = useState(true);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const reportsRef = () => collection(db, 'artifacts', appId, 'public', 'data', 'reports');

  // Recarga la primera página. También se llama al abrir Reportes/Historial: el
  // cierre automático crea reportes desde el Worker y esta lista no tiene listener,
  // así que una sesión abierta desde ayer no los vería.
  const refreshReports = useCallback(async () => {
    if (!firebaseUser || !canCerrar) return;
    setIsLoadingReports(true);
    try {
      const snap = await getDocs(query(reportsRef(), orderBy('createdAt', 'desc'), limit(REPORTS_PAGE_SIZE)));
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMoreReports(snap.docs.length === REPORTS_PAGE_SIZE);
    } catch (error) {
      console.error('Error al cargar el historial de reportes:', error);
    } finally {
      setIsLoadingReports(false);
    }
  }, [firebaseUser, canCerrar]);

  // Primera carga. Va en un setTimeout para que refreshReports (que marca "cargando" al empezar) no cambie el
  // estado dentro del propio efecto; al salir se cancela, así que un cambio de usuario no deja una carga colgada.
  useEffect(() => {
    const id = setTimeout(refreshReports, 0);
    return () => clearTimeout(id);
  }, [refreshReports]);

  const loadMoreReports = async () => {
    if (!lastDoc || isLoadingReports) return;
    setIsLoadingReports(true);
    try {
      const snap = await getDocs(query(reportsRef(), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(REPORTS_PAGE_SIZE)));
      setReports(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
      setLastDoc(snap.docs[snap.docs.length - 1] || lastDoc);
      setHasMoreReports(snap.docs.length === REPORTS_PAGE_SIZE);
    } catch (error) {
      console.error('Error al cargar más reportes:', error);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const archiveByEstado = async (estado, tipoReporte, dateInput) => {
    const seleccionados = tickets.filter(t => t.estado === estado);
    if (seleccionados.length === 0) return null;

    const reportId = `${Date.now()}-${tipoReporte}`;
    const newReport = {
      id: reportId,
      fechaCierre: formatFecha(dateInput),
      horaCierre: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      operador: currentUser,
      total: seleccionados.length,
      desglose: buildDesglose(seleccionados),
      ticketsDetalle: seleccionados,
      tipoReporte,
      createdAt: Date.now()
    };

    // El reporte y los borrados van en el mismo lote (atómico): si falla, no queda
    // un reporte con órdenes que siguen en la tabla y se archivarían dos veces.
    // Con más de MAX_ESCRITURAS_LOTE órdenes, el resto se borra en lotes siguientes;
    // como el reporte ya existe, un fallo ahí solo deja órdenes por borrar.
    const ticketRef = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'tickets', id.toString());
    const ids = seleccionados.map(t => t.id);
    // Los totales del mes de ventas se suman en el mismo lote: o se archivó y se contó, o ninguna de las dos (ver totalesMes).
    const totales = Object.entries(incrementosMensuales(seleccionados, estado, newReport.createdAt));
    const enElPrimero = MAX_ESCRITURAS_LOTE - 1 - totales.length;
    const primerLote = writeBatch(db);
    primerLote.set(doc(db, 'artifacts', appId, 'public', 'data', 'reports', reportId), newReport);
    totales.forEach(([mes, campos]) => primerLote.set(
      doc(db, 'artifacts', appId, 'public', 'data', 'estadisticasMensuales', mes),
      Object.fromEntries(Object.entries(campos).map(([campo, n]) => [campo, increment(n)])),
      { merge: true },
    ));
    ids.slice(0, enElPrimero).forEach(id => primerLote.delete(ticketRef(id)));
    await primerLote.commit();
    for (let i = enElPrimero; i < ids.length; i += MAX_ESCRITURAS_LOTE) {
      const lote = writeBatch(db);
      ids.slice(i, i + MAX_ESCRITURAS_LOTE).forEach(id => lote.delete(ticketRef(id)));
      await lote.commit();
    }
    await guardarHistorialInstalaciones(seleccionados, newReport.createdAt);
    return newReport;
  };

  const cerrarDia = async (dateInput) => {
    if (isProcessing) return null;

    setIsProcessing(true);
    try {
      const reporteCierre = await archiveByEstado('FINALIZADO', 'CIERRE', dateInput);
      const reporteCancelados = await archiveByEstado('CANCELADO', 'CANCELADOS', dateInput);

      if (!reporteCierre && !reporteCancelados) {
        setToastMsg({ type: 'error', text: 'No hay órdenes FINALIZADO o CANCELADO para cerrar.' });
        return null;
      }

      await limpiarHistorialInstalaciones(Date.now());

      // El cierre de hoy ya está hecho a mano: el automático de hoy no debe correr (el Worker lo lee en config/cierreAutomatico).
      // Si no se puede dejar la marca, el cierre ya está hecho; solo se avisa en consola.
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'cierreAutomatico'), { cierreManualFecha: diaDe(Date.now()) }, { merge: true })
        .catch((error) => console.warn('No se pudo marcar el cierre manual de hoy:', error));

      // El nuevo reporte se agrega directo al estado local (en vez de re-consultar
      // Firestore) porque ya no hay listener en tiempo real que lo traiga solo.
      setReports(prev => [...[reporteCierre, reporteCancelados].filter(Boolean), ...prev]);

      setToastMsg({ type: 'success', text: 'Cierre de día procesado correctamente.' });
      return reporteCierre || reporteCancelados;
    } catch (error) {
      console.error("Error al procesar el cierre:", error);
      setToastMsg({ type: 'error', text: 'Hubo un error procesando la operación.' });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return { reports, isProcessing, cerrarDia, hasMoreReports, isLoadingReports, loadMoreReports, refreshReports };
}
