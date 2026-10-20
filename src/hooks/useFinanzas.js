import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { armarPago, tarifasCompletas } from '../utils/finanzas';

const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const documento = (nombre, id) => doc(db, 'artifacts', appId, 'public', 'data', nombre, id);
const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// Los pagos más recientes: alcanzan para el reporte de un mes o más y para la lista de pagos registrados.
const MAX_PAGOS_VISIBLES = 300;

// Lo que lleva Finanzas, en vivo mientras la pantalla está abierta: las órdenes ya pagadas del periodo elegido, las tarifas y los últimos pagos. Son pocos documentos (solo lo que Finanzas escribe), no las órdenes: esas se leen aparte (useDatosAlmacen).
export function useFinanzas({ firebaseUser, rango, usuario, setToastMsg }) {
  const [tarifasGuardadas, setTarifasGuardadas] = useState(null);
  const [pagadas, setPagadas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [error, setError] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    const alFallar = (que) => (e) => { console.error(`No se pudo leer ${que}:`, e); setError(true); };
    const bajas = [
      onSnapshot(documento('tarifasPago', 'actual'), (s) => setTarifasGuardadas(s.exists() ? s.data() : {}), alFallar('las tarifas')),
      onSnapshot(query(datos('pagosTecnicos'), orderBy('creadoEn', 'desc'), limit(MAX_PAGOS_VISIBLES)), (s) => setPagos(aLista(s)), alFallar('los pagos')),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [firebaseUser]);

  const { desde, hasta } = rango;
  useEffect(() => {
    if (!firebaseUser) return;
    const alFallar = (que) => (e) => { console.error(`No se pudo leer ${que}:`, e); setError(true); };
    const delPeriodo = (nombre) => query(datos(nombre), where('dia', '>=', desde), where('dia', '<=', hasta));
    const bajas = [
      onSnapshot(delPeriodo('ordenesPagadas'), (s) => setPagadas(aLista(s)), alFallar('las órdenes pagadas')),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [firebaseUser, desde, hasta]);

  const tarifas = useMemo(() => tarifasCompletas(tarifasGuardadas), [tarifasGuardadas]);
  const idsPagadas = useMemo(() => new Set(pagadas.map((p) => p.id)), [pagadas]);

  // Cada acción devuelve true si se guardó. Los errores salen como aviso, con el motivo cuando se sabe.
  const ejecutar = async (accion, exito, fallo) => {
    setOcupado(true);
    try {
      await accion();
      if (exito) setToastMsg({ type: 'success', text: exito });
      return true;
    } catch (e) {
      console.error(fallo, e);
      setToastMsg({ type: 'error', text: fallo });
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const guardarTarifas = (valores) => ejecutar(
    () => setDoc(documento('tarifasPago', 'actual'), { ...valores, por: usuario, en: Date.now() }),
    'Tarifas guardadas.', 'No se pudieron guardar las tarifas.',
  );

  // Un pago y sus órdenes en un solo lote: si alguna orden ya la pagó otra persona mientras tanto, no se guarda nada.
  const pagar = async (fila, rangoPago, nota, tasa = null) => {
    const armado = armarPago(fila, rangoPago, tarifas, { por: usuario, ahora: Date.now(), nota, tasa });
    if (armado.error) { setToastMsg({ type: 'error', text: armado.error }); return false; }
    return ejecutar(async () => {
      const lote = writeBatch(db);
      lote.set(documento('pagosTecnicos', armado.pagoId), armado.pago);
      for (const { id, datos: d } of armado.ordenes) lote.set(documento('ordenesPagadas', id), d);
      await lote.commit();
    },`Pago registrado: ${fila.tecnico}.`, 'No se pudo registrar el pago. Alguna orden pudo haberse pagado ya: revisa e intenta de nuevo.');
  };

  const anular = (pago) => ejecutar(async () => {
    const lote = writeBatch(db);
    lote.update(documento('pagosTecnicos', pago.id), { anulado: true, anuladoPor: usuario, anuladoEn: Date.now() });
    const ordenes = await getDocs(query(datos('ordenesPagadas'), where('pagoId', '==', pago.id)));
    ordenes.docs.forEach((d) => lote.delete(d.ref));
    await lote.commit();
  }, 'Pago anulado: las órdenes vuelven a estar por pagar.', 'No se pudo anular el pago.');

  return { tarifas, tarifasCargadas: tarifasGuardadas !== null, pagadas, idsPagadas, pagos, error, ocupado, guardarTarifas, pagar, anular };
}
