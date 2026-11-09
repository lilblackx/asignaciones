import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { collection, doc } from 'firebase/firestore';
import { onSnapshot, writeBatch } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { avisoDeAjuste, tarifasCompletas } from '../utils/finanzas';
import { MAX_REVISIONES_POR_LOTE, borrarAlDeshacer } from '../utils/revisionPagos';
import { sendPush } from '../lib/notify';
import { esperarConLimite } from '../utils/tiempoLimite';
import { diaDe } from '../utils/totalesMes';
import { leerRevisiones, pagadasEnServidor, revisionesEnVivo, suscribirseARevisiones, validarPagadas } from '../lib/revisionesEnVivo';
import { mensajeDePagadas } from '../utils/pagadasRevision';

const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const documento = (nombre, id) => doc(db, 'artifacts', appId, 'public', 'data', nombre, id);

// Pregunta al servidor si alguna de esas órdenes ya está pagada; si sí, no se cambia nada y se avisa cuáles eran (la lista ya queda actualizada). `ordenes`: [{ id, codigo }].
async function confirmarSinPagar(ordenes) {
  const pagadas = await pagadasEnServidor(ordenes.map((o) => o.id));
  if (pagadas.length === 0) return;
  const codigos = pagadas.map((id) => ordenes.find((o) => o.id === id)?.codigo || 's/c');
  throw Object.assign(new Error('Orden ya pagada'), { paraElUsuario: mensajeDePagadas(codigos) });
}

// Lo que necesita el módulo Revisión de órdenes mientras está abierto (`activo`): las tarifas y los tipos de mudanza elegidos, y, de la ventana `rango` (la que arma rangoDeLectura: los últimos 35 días o más,
// para que cambiar de periodo no vuelva a leer todo), las filas de VN y TA y las revisiones ya hechas; el filtro por periodo lo hace la pantalla. Lo ya
// pagado se sabe por la propia revisión (su `pagoId`), así que no se leen las órdenes pagadas. Y lo que escribe: guardar revisiones (una o varias en un lote) y deshacer una borrándola.
//   guardar(documentos: [{ id, datos, ajustes?, borrarAjustes? }], exito) -> true si se guardó (con los descuentos y bonos que crea o borra al aprobar o deshacer, y el aviso a los técnicos); deshacer(item) -> true si se borró
export function useRevisionPagos({ firebaseUser, activo, rango, setToastMsg }) {
  const [tarifasGuardadas, setTarifasGuardadas] = useState(null);
  const [tiposMudanza, setTiposMudanza] = useState({});
  const [errorLocal, setError] = useState(false);
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

  // Las revisiones y las filas de VN y TA no se leen aquí: viven en un almacén de la sesión (ver lib/revisionesEnVivo) para no volver a pagar todos sus documentos cada vez que se entra a Revisión.
  const { sinPagar, pagadas, registros, error: errorEnVivo } = useSyncExternalStore(suscribirseARevisiones, revisionesEnVivo);
  const uid = firebaseUser?.uid || '';
  useEffect(() => {
    if (!uid || !activo) return;
    leerRevisiones({ uid, hoy: diaDe(Date.now()), rango: { desde, hasta } });
    validarPagadas();
  }, [uid, activo, desde, hasta]);
  const error = errorLocal || errorEnVivo;

  const tarifas = useMemo(() => tarifasCompletas(tarifasGuardadas), [tarifasGuardadas]);
  // Las revisiones que se trabajan (sin pagar). Las pagadas no hacen falta: solo se necesita saber cuáles son para sacarlas de la revisión.
  const revisiones = useMemo(() => Object.fromEntries(sinPagar.map((r) => [r.id, r])), [sinPagar]);
  const idsPagadas = useMemo(() => new Set(pagadas), [pagadas]);

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
      if (!e?.paraElUsuario) console.error(fallo, e);
      setToastMsg?.({ type: 'error', duration: e?.paraElUsuario ? 9000 : undefined, text: e?.paraElUsuario || fallo });
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
      // Antes de escribir, el servidor confirma que ninguna de esas órdenes ya se pagó: no se depende de lo que recuerde esta PC.
      await confirmarSinPagar(documentos.map((d) => ({ id: d.id, codigo: d.datos?.codigo })));
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
    await confirmarSinPagar([{ id, codigo: item.orden?.codigo }]);
    const lote = writeBatch(db);
    lote.delete(documento('revisionPagos', id));
    for (const idAjuste of borrarAjustes) lote.delete(documento('ajustesTecnicos', idAjuste));
    await lote.commit();
  }, 'Revisión deshecha: la orden vuelve a estar pendiente.', 'No se pudo deshacer la revisión. Si la orden tiene un descuento que ya entró en un pago, anula ese pago primero.'), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { tarifas, tarifasCargadas: tarifasGuardadas !== null, tiposMudanza, idsPagadas, registros, revisiones, error, ocupado, guardar, deshacer };
}
