import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { query, where } from 'firebase/firestore';
import { getDocs, onSnapshot } from '../lib/medidorFirestore.js';
import { coleccionCobros } from '../lib/cobrosClientes';
import { ESTADO_COBRO, avisoDeCobro } from '../utils/cobrosClientes';
import { playAprobadoSound } from '../utils/notificationSound';
import { useVentanaLectura } from './useVentanaLectura';

const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const inicioDelDia = (iso) => Date.parse(`${iso}T00:00:00-04:00`);
const finDelDia = (iso) => Date.parse(`${iso}T23:59:59.999-04:00`);

// El módulo de Administración: los cobros del rango de fechas (por el día en que se emitieron) y, siempre, todos los pendientes y los que tienen un cambio de monto por corregir
// (cuentan aunque sean de antes del rango). Pide los dos índices de un solo campo que Firestore crea solo (estado y creadoEn) y `montoCambio != null`.
export function useCobrosAdministracion(firebaseUser, rango) {
  const [delRango, setDelRango] = useState({ lista: [], cargado: false });
  const [pendientes, setPendientes] = useState({ lista: [], cargado: false });
  const [conCambio, setConCambio] = useState({ lista: [], cargado: false });
  const [error, setError] = useState(false);
  const desde = inicioDelDia(rango.desde);
  const hasta = finDelDia(rango.hasta);

  useEffect(() => {
    if (!firebaseUser || !Number.isFinite(desde) || !Number.isFinite(hasta)) return undefined;
    const alFallar = (que) => (e) => { console.error(`No se pudieron leer ${que}:`, e); setError(true); };
    const bajas = [
      onSnapshot(query(coleccionCobros(), where('creadoEn', '>=', desde), where('creadoEn', '<=', hasta)), (snap) => setDelRango({ lista: aLista(snap), cargado: true }), alFallar('los cobros')),
      onSnapshot(query(coleccionCobros(), where('estado', '==', ESTADO_COBRO.PENDIENTE)), (snap) => setPendientes({ lista: aLista(snap), cargado: true }), alFallar('los cobros pendientes')),
      onSnapshot(query(coleccionCobros(), where('montoCambio', '!=', null)), (snap) => setConCambio({ lista: aLista(snap), cargado: true }), alFallar('los cobros con cambio de monto')),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [firebaseUser, desde, hasta]);

  // Lo del rango más los pendientes y los con cambio de fuera del rango, sin repetir; los más nuevos primero.
  const cobros = useMemo(() => {
    const porId = new Map(delRango.lista.map((c) => [c.id, c]));
    for (const c of [...pendientes.lista, ...conCambio.lista]) if (!porId.has(c.id)) porId.set(c.id, c);
    return [...porId.values()].sort((a, b) => (Number(b.creadoEn) || 0) - (Number(a.creadoEn) || 0));
  }, [delRango.lista, pendientes.lista, conCambio.lista]);
  return { cobros, cargado: delRango.cargado && pendientes.cargado && conCambio.cargado, error };
}

// Los avisos de Administración con la app abierta: cada cobro nuevo sale en pantalla, en la campana y con sonido (con la app cerrada llega la push). Solo avisa de lo que se emite después de abrir
// la app; lo que ya existía es la base. Solo para ADMINISTRACION (el ADMIN no recibe estos avisos).
export function useAvisosCobros({ firebaseUser, activo, onNotify, setToastMsg }) {
  const avisarRef = useRef(null);
  useEffect(() => {
    avisarRef.current = (cobro) => {
      const { title, body } = avisoDeCobro(cobro);
      const texto = `${title}: ${body}`;
      setToastMsg?.({ type: 'pagoCliente', text: texto, duration: 9000 });
      onNotify?.({ type: 'pagoCliente', text: texto });
      playAprobadoSound();
    };
  });
  useEffect(() => {
    if (!firebaseUser || !activo) return undefined;
    // Solo lo reciente: el aviso es de lo que se emite ahora (índice automático de un solo campo).
    const desde = Date.now() - 24 * 60 * 60 * 1000;
    let base = true;
    return onSnapshot(query(coleccionCobros(), where('creadoEn', '>=', desde)), (snap) => {
      if (!base) snap.docChanges().filter((c) => c.type === 'added').forEach((c) => avisarRef.current?.({ id: c.doc.id, ...c.doc.data() }));
      base = false;
    }, (error) => console.error('No se pudieron leer los avisos de cobros:', error));
  }, [firebaseUser, activo]);
}

// Finanzas: los cobros emitidos en el rango (días de Caracas "AAAA-MM-DD"), leídos al abrir, al ampliar el rango y con "recargar" (sin listener, como el resto de sus datos).
export function useCobrosFinanzas(firebaseUser, rango) {
  const [estado, setEstado] = useState({ clave: '', cobros: [], error: false });
  const [version, setVersion] = useState(0);
  // Se lee de una ventana que solo crece mientras la sección está abierta (ver useVentanaLectura): pasar a un periodo más corto o volver a uno ya visto no lee nada; abajo se filtra el periodo elegido.
  const ventana = useVentanaLectura(rango, Boolean(rango.desde && rango.hasta));
  const desde = ventana ? inicioDelDia(ventana.desde) : NaN;
  const hasta = ventana ? finDelDia(ventana.hasta) : NaN;
  const clave = `${desde}|${hasta}|${version}`;
  const inicioPeriodo = inicioDelDia(rango.desde);
  const finPeriodo = finDelDia(rango.hasta);
  const cobros = useMemo(() => estado.cobros.filter((c) => Number(c.creadoEn) >= inicioPeriodo && Number(c.creadoEn) <= finPeriodo), [estado.cobros, inicioPeriodo, finPeriodo]);

  useEffect(() => {
    if (!firebaseUser || !Number.isFinite(desde) || !Number.isFinite(hasta)) return undefined;
    let vigente = true;
    getDocs(query(coleccionCobros(), where('creadoEn', '>=', desde), where('creadoEn', '<=', hasta)))
      .then((snap) => { if (vigente) setEstado({ clave, cobros: aLista(snap), error: false }); })
      .catch((error) => {
        console.error('No se pudieron leer los cobros de clientes:', error);
        if (vigente) setEstado({ clave, cobros: [], error: true });
      });
    return () => { vigente = false; };
  }, [firebaseUser, desde, hasta, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { cobros, cargado: estado.clave === clave, error: estado.error, recargar };
}
