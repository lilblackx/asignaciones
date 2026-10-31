import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, query, where } from 'firebase/firestore';
import { onSnapshot, writeBatch } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { avisoDeAjuste, tarifasCompletas } from '../utils/finanzas';
import { MAX_REVISIONES_POR_LOTE, borrarAlDeshacer } from '../utils/revisionPagos';
import { sendPush } from '../lib/notify';
import { esperarConLimite } from '../utils/tiempoLimite';

const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const documento = (nombre, id) => doc(db, 'artifacts', appId, 'public', 'data', nombre, id);
const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// Lo que necesita el módulo Revisión de órdenes mientras está abierto (`activo`): las tarifas y los tipos de mudanza elegidos, y, del periodo, las órdenes ya pagadas, las filas de VN y TA y
// las revisiones ya hechas. Y lo que escribe: guardar revisiones (una o varias en un lote) y deshacer una borrándola.
//   guardar(documentos: [{ id, datos, ajustes?, borrarAjustes? }], exito) -> true si se guardó (con los descuentos y bonos que crea o borra al aprobar o deshacer, y el aviso a los técnicos); deshacer(item) -> true si se borró
export function useRevisionPagos({ firebaseUser, activo, rango, setToastMsg }) {
  const [tarifasGuardadas, setTarifasGuardadas] = useState(null);
  const [tiposMudanza, setTiposMudanza] = useState({});
  const [pagadas, setPagadas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [revisionesLista, setRevisionesLista] = useState([]);
  const [error, setError] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const { desde, hasta } = rango;

  useEffect(() => {
    if (!firebaseUser || !activo) return undefined;
    const alFallar = (que) => (e) => { console.error(`No se pudo leer ${que}:`, e); setError(true); };
    const bajas = [
      onSnapshot(documento('tarifasPago', 'actual'), (s) => setTarifasGuardadas(s.exists() ? s.data() : {}), alFallar('las tarifas')),
      onSnapshot(datos('tiposMudanza'), (s) => setTiposMudanza(Object.fromEntries(s.docs.map((d) => [d.id, d.data().tipo]))), alFallar('el tipo de las mudanzas')),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [firebaseUser, activo]);

  useEffect(() => {
    if (!firebaseUser || !activo) return undefined;
    const alFallar = (que) => (e) => { console.error(`No se pudo leer ${que}:`, e); setError(true); };
    const porDia = (nombre) => query(datos(nombre), where('dia', '>=', desde), where('dia', '<=', hasta));
    const bajas = [
      onSnapshot(porDia('ordenesPagadas'), (s) => setPagadas(aLista(s)), alFallar('las órdenes pagadas')),
      onSnapshot(porDia('revisionPagos'), (s) => setRevisionesLista(aLista(s)), alFallar('las revisiones')),
      onSnapshot(query(datos('registroVnTa'), where('fecha', '>=', desde), where('fecha', '<=', hasta)), (s) => setRegistros(aLista(s)), alFallar('el registro de VN y TA')),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [firebaseUser, activo, desde, hasta]);

  const tarifas = useMemo(() => tarifasCompletas(tarifasGuardadas), [tarifasGuardadas]);
  const idsPagadas = useMemo(() => new Set(pagadas.map((p) => p.id)), [pagadas]);
  const revisiones = useMemo(() => Object.fromEntries(revisionesLista.map((r) => [r.id, r])), [revisionesLista]);

  const ejecutar = async (accion, exito, fallo) => {
    setOcupado(true);
    try {
      // Sin respuesta del servidor el botón no se queda esperando para siempre: se avisa y se libera.
      if (!(await esperarConLimite(accion()))) {
        setToastMsg?.({ type: 'error', duration: 9000, text: 'No hubo respuesta del servidor: el cambio queda en cola y se aplicará cuando vuelva la conexión. Revisa tu conexión antes de seguir.' });
        return false;
      }
      if (exito) setToastMsg?.({ type: 'success', text: exito });
      return true;
    } catch (e) {
      console.error(fallo, e);
      setToastMsg?.({ type: 'error', text: fallo });
      return false;
    } finally {
      setOcupado(false);
    }
  };

  // Si el aviso no sale (sin conexión, o el técnico no tiene la app con notificaciones), el ajuste ya quedó guardado: se avisa para que le escriban por WhatsApp.
  const avisarAjuste = async (ajuste) => {
    const { ok, sent } = await sendPush(firebaseUser, { target: { type: 'tecnico', name: ajuste.tecnico }, ...avisoDeAjuste(ajuste), tipo: 'ajusteTecnico' });
    if (ok && sent !== 0) return;
    setToastMsg?.({
      type: 'error',
      duration: 9000,
      text: ok
        ? `${ajuste.tecnico} no tiene notificaciones activas en ningún dispositivo: no se enteró por aviso. Avísale por WhatsApp.`
        : `No se pudo enviar la notificación a ${ajuste.tecnico}. El ajuste quedó guardado; avísale por WhatsApp.`,
    });
  };

  // Guarda varias revisiones en lotes (un documento por orden; un lote admite 500 escrituras). Al aprobar una orden con descuento crea sus dos ajustes (y avisa a los dos técnicos); al
  // dejar de estar aprobada borra los que tenía. Si alguno ya entró en un pago, las reglas lo impiden y no se guarda nada de ese lote.
  const guardar = useCallback(async (documentos, exito) => {
    const nuevos = [];
    const guardado = await ejecutar(async () => {
      const grupos = [];
      let actual = [];
      let escrituras = 0;
      for (const d of documentos) {
        const costo = 1 + (d.ajustes?.length || 0) + (d.borrarAjustes?.length || 0);
        if (actual.length > 0 && escrituras + costo > MAX_REVISIONES_POR_LOTE) { grupos.push(actual); actual = []; escrituras = 0; }
        actual.push(d);
        escrituras += costo;
      }
      if (actual.length > 0) grupos.push(actual);
      for (const grupo of grupos) {
        const lote = writeBatch(db);
        for (const { id, datos: d, ajustes = [], borrarAjustes = [] } of grupo) {
          lote.set(documento('revisionPagos', id), d);
          for (const idAjuste of borrarAjustes) lote.delete(documento('ajustesTecnicos', idAjuste));
          for (const a of ajustes) lote.set(documento('ajustesTecnicos', a.id), a.datos);
        }
        await lote.commit();
        for (const { ajustes = [] } of grupo) nuevos.push(...ajustes.map((a) => a.datos));
      }
    }, exito, 'No se pudo guardar la revisión. Si la orden tiene un descuento que ya entró en un pago, anula ese pago primero. Revisa tu conexión e intenta de nuevo.');
    if (guardado) for (const a of nuevos) await avisarAjuste(a);
    return guardado;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Deshacer una revisión: se borra el documento y, si la orden estaba aprobada con descuento, sus dos ajustes.
  const deshacer = useCallback((item) => ejecutar(async () => {
    const { id, borrarAjustes } = borrarAlDeshacer(item);
    const lote = writeBatch(db);
    lote.delete(documento('revisionPagos', id));
    for (const idAjuste of borrarAjustes) lote.delete(documento('ajustesTecnicos', idAjuste));
    await lote.commit();
  }, 'Revisión deshecha: la orden vuelve a estar pendiente.', 'No se pudo deshacer la revisión. Si la orden tiene un descuento que ya entró en un pago, anula ese pago primero.'), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { tarifas, tarifasCargadas: tarifasGuardadas !== null, tiposMudanza, idsPagadas, registros, revisiones, error, ocupado, guardar, deshacer };
}
