import { useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, orderBy, query, startAfter, writeBatch } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';

const REPORTS_PAGE_SIZE = 30;
const MAX_ESCRITURAS_LOTE = 450; // Firestore admite 500 por lote

function buildDesglose(items) {
  return items.reduce((acc, t) => {
    const tipo = t.tipoTrabajo || 'OTRO';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});
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

  useEffect(() => {
    if (!firebaseUser || !canCerrar) return;
    let cancelled = false;

    (async () => {
      setIsLoadingReports(true);
      try {
        const snap = await getDocs(query(reportsRef(), orderBy('createdAt', 'desc'), limit(REPORTS_PAGE_SIZE)));
        if (cancelled) return;
        setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLastDoc(snap.docs[snap.docs.length - 1] || null);
        setHasMoreReports(snap.docs.length === REPORTS_PAGE_SIZE);
      } catch (error) {
        console.error('Error al cargar el historial de reportes:', error);
      } finally {
        if (!cancelled) setIsLoadingReports(false);
      }
    })();

    return () => { cancelled = true; };
  }, [firebaseUser, canCerrar]);

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
    const primerLote = writeBatch(db);
    primerLote.set(doc(db, 'artifacts', appId, 'public', 'data', 'reports', reportId), newReport);
    ids.slice(0, MAX_ESCRITURAS_LOTE - 1).forEach(id => primerLote.delete(ticketRef(id)));
    await primerLote.commit();
    for (let i = MAX_ESCRITURAS_LOTE - 1; i < ids.length; i += MAX_ESCRITURAS_LOTE) {
      const lote = writeBatch(db);
      ids.slice(i, i + MAX_ESCRITURAS_LOTE).forEach(id => lote.delete(ticketRef(id)));
      await lote.commit();
    }
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

  return { reports, isProcessing, cerrarDia, hasMoreReports, isLoadingReports, loadMoreReports };
}
