import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { ESTADO_PAGO, FECHA_INICIO_PAGO_CLIENTE, avisoDePagoCliente } from '../utils/pagoCliente';
import { playAprobadoSound } from '../utils/notificationSound';

const coleccion = () => collection(db, 'artifacts', appId, 'public', 'data', 'pagosOrdenes');
const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
// Desde cuándo se leen los pagos del técnico: el inicio del día en que empezó a pedirse el pago (lo anterior no pide nada).
const INICIO_MS = Date.parse(`${FECHA_INICIO_PAGO_CLIENTE}T00:00:00-04:00`);

// Los pagos del técnico (de sus órdenes), por id de orden. `cargado` es false hasta el primer snapshot: sin saber qué ya registró, no se le pide nada.
// Pide el índice (tecnico + creadoEn) de pagosOrdenes en firestore.indexes.json.
export function usePagosTecnico(firebaseUser, tecnico) {
  const [estado, setEstado] = useState({ pagos: [], cargado: false });
  useEffect(() => {
    if (!firebaseUser || !tecnico) return undefined;
    return onSnapshot(
      query(coleccion(), where('tecnico', '==', tecnico), where('creadoEn', '>=', INICIO_MS)),
      (snap) => setEstado({ pagos: aLista(snap), cargado: true }),
      (error) => console.error('No se pudieron leer los pagos del técnico:', error),
    );
  }, [firebaseUser, tecnico]);
  const ids = useMemo(() => new Set(estado.pagos.map((p) => p.ticketId || p.id)), [estado.pagos]);
  return { pagos: estado.pagos, ids, cargado: estado.cargado };
}

// Las órdenes con pago pendiente de cobro (la etiqueta "Pago pendiente" de la lista). Para la oficina y el ADMIN escucha todas; el técnico usa las suyas (usePagosTecnico).
export function usePagosPendientes(firebaseUser, activo) {
  const [pendientes, setPendientes] = useState([]);
  useEffect(() => {
    if (!firebaseUser || !activo) return undefined;
    return onSnapshot(
      query(coleccion(), where('estado', '==', ESTADO_PAGO.PENDIENTE)),
      (snap) => setPendientes(aLista(snap)),
      (error) => console.error('No se pudieron leer los pagos pendientes:', error),
    );
  }, [firebaseUser, activo]);
  return useMemo(() => new Set(pendientes.map((p) => p.ticketId || p.id)), [pendientes]);
}

// El módulo de Administración: los pagos del rango de fechas (por la fecha en que se registraron) y, siempre, todos los pendientes de cobro (cuentan aunque sean de antes del rango).
export function usePagosAdministracion(firebaseUser, rango) {
  const [delRango, setDelRango] = useState({ lista: [], cargado: false });
  const [pendientes, setPendientes] = useState({ lista: [], cargado: false });
  const [error, setError] = useState(false);
  const desde = Date.parse(`${rango.desde}T00:00:00-04:00`);
  const hasta = Date.parse(`${rango.hasta}T23:59:59.999-04:00`);

  useEffect(() => {
    if (!firebaseUser || !Number.isFinite(desde) || !Number.isFinite(hasta)) return undefined;
    const bajas = [
      onSnapshot(query(coleccion(), where('creadoEn', '>=', desde), where('creadoEn', '<=', hasta)),
        (snap) => setDelRango({ lista: aLista(snap), cargado: true }),
        (e) => { console.error('No se pudieron leer los pagos:', e); setError(true); }),
      onSnapshot(query(coleccion(), where('estado', '==', ESTADO_PAGO.PENDIENTE)),
        (snap) => setPendientes({ lista: aLista(snap), cargado: true }),
        (e) => { console.error('No se pudieron leer los pagos pendientes:', e); setError(true); }),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [firebaseUser, desde, hasta]);

  // Lo del rango más los pendientes de fuera del rango, sin repetir; los más nuevos primero.
  const pagos = useMemo(() => {
    const porId = new Map(delRango.lista.map((p) => [p.id, p]));
    for (const p of pendientes.lista) if (!porId.has(p.id)) porId.set(p.id, p);
    return [...porId.values()].sort((a, b) => (Number(b.creadoEn) || 0) - (Number(a.creadoEn) || 0));
  }, [delRango.lista, pendientes.lista]);
  return { pagos, porCobrar: pendientes.lista.length, cargado: delRango.cargado && pendientes.cargado, error };
}

// Finanzas: los pagos de instalaciones y de cambios de equipo creados en el rango (días de Caracas "AAAA-MM-DD"), leídos al abrir, al cambiar el rango y con "recargar" (sin listener, como el resto de
// sus datos). Son tres consultas porque las reglas solo dejan leer lo que se pide con esos valores exactos (tipoTrabajo de instalación o de cambio de equipo, o el tipo de visita CAMBIO_EQUIPO);
// piden los índices (tipoTrabajo + creadoEn) y (tipoVisita + creadoEn) de pagosOrdenes.
export function usePagosFinanzas(firebaseUser, rango) {
  const [estado, setEstado] = useState({ clave: '', pagos: [], error: false });
  const [version, setVersion] = useState(0);
  const desde = Date.parse(`${rango.desde}T00:00:00-04:00`);
  const hasta = Date.parse(`${rango.hasta}T23:59:59.999-04:00`);
  const clave = `${desde}|${hasta}|${version}`;

  useEffect(() => {
    if (!firebaseUser || !Number.isFinite(desde) || !Number.isFinite(hasta)) return undefined;
    let vigente = true;
    const fechas = [where('creadoEn', '>=', desde), where('creadoEn', '<=', hasta)];
    Promise.all([
      getDocs(query(coleccion(), where('tipoTrabajo', '==', 'INSTALACIÓN'), ...fechas)),
      getDocs(query(coleccion(), where('tipoTrabajo', '==', 'CAMBIO DE EQUIPO'), ...fechas)),
      getDocs(query(coleccion(), where('tipoVisita', '==', 'CAMBIO_EQUIPO'), ...fechas)),
    ]).then((resultados) => {
      if (!vigente) return;
      const porId = new Map();
      for (const snap of resultados) for (const d of snap.docs) porId.set(d.id, { id: d.id, ...d.data() });
      setEstado({ clave, pagos: [...porId.values()], error: false });
    }).catch((error) => {
      console.error('No se pudieron leer los pagos de clientes:', error);
      if (vigente) setEstado({ clave, pagos: [], error: true });
    });
    return () => { vigente = false; };
  }, [firebaseUser, desde, hasta, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { pagos: estado.pagos, cargado: estado.clave === clave, error: estado.error, recargar };
}

// El contador de "por cobrar" (menú y módulo) y los avisos de Administración: con la app abierta, cada pago nuevo que registra un técnico sale en pantalla, en la campana y con
// sonido (con la app cerrada llega la push). Solo avisa de lo que se crea después de abrir la app; lo que ya existía es la base. Solo para ADMINISTRACION (el ADMIN no recibe estos avisos).
export function useAvisosAdministracion({ firebaseUser, activo, onNotify, setToastMsg }) {
  const avisarRef = useRef(null);
  useEffect(() => {
    avisarRef.current = (doc) => {
      const { title, body } = avisoDePagoCliente(doc);
      const texto = `${title}: ${body}`;
      setToastMsg?.({ type: 'pagoCliente', text: texto, duration: 9000 });
      onNotify?.({ type: 'pagoCliente', text: texto });
      playAprobadoSound();
    };
  });
  useEffect(() => {
    if (!firebaseUser || !activo) return undefined;
    // Solo lo reciente: el aviso es de lo que se registra ahora (índice automático de un solo campo).
    const desde = Date.now() - 24 * 60 * 60 * 1000;
    let base = true;
    return onSnapshot(query(coleccion(), where('creadoEn', '>=', desde)), (snap) => {
      if (!base) snap.docChanges().filter((c) => c.type === 'added').forEach((c) => avisarRef.current?.({ id: c.doc.id, ...c.doc.data() }));
      base = false;
    }, (error) => console.error('No se pudieron leer los avisos de pagos:', error));
  }, [firebaseUser, activo]);
}
