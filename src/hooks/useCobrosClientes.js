import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { coleccionCobros } from '../lib/cobrosClientes';
import { ESTADO_COBRO, avisoDeCobro, cantidadPorCargar } from '../utils/cobrosClientes';
import { playAprobadoSound } from '../utils/notificationSound';

const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const inicioDelDia = (iso) => Date.parse(`${iso}T00:00:00-04:00`);
const finDelDia = (iso) => Date.parse(`${iso}T23:59:59.999-04:00`);

// El contador de cobros por cargar (el menú del ADMIN): cuántos esperan que Administración los suba al portal.
export function useCobrosPorCargar(firebaseUser, activo) {
  const [pendientes, setPendientes] = useState([]);
  useEffect(() => {
    if (!firebaseUser || !activo) return undefined;
    return onSnapshot(
      query(coleccionCobros(), where('estado', '==', ESTADO_COBRO.PENDIENTE)),
      (snap) => setPendientes(aLista(snap)),
      (error) => console.error('No se pudieron leer los cobros por cargar:', error),
    );
  }, [firebaseUser, activo]);
  return cantidadPorCargar(pendientes);
}

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

// Finanzas: los cobros emitidos en el rango (días de Caracas "AAAA-MM-DD"), leídos al abrir, al cambiar el rango y con "recargar" (sin listener, como el resto de sus datos).
export function useCobrosFinanzas(firebaseUser, rango) {
  const [estado, setEstado] = useState({ clave: '', cobros: [], error: false });
  const [version, setVersion] = useState(0);
  const desde = inicioDelDia(rango.desde);
  const hasta = finDelDia(rango.hasta);
  const clave = `${desde}|${hasta}|${version}`;

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
  return { cobros: estado.cobros, cargado: estado.clave === clave, error: estado.error, recargar };
}
