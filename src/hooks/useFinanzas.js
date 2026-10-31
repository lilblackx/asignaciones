import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, orderBy, query, where } from 'firebase/firestore';
import { onSnapshot, getDocs, getDoc, setDoc, updateDoc, writeBatch } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { armarPago, avisoDeAdelanto, avisoDeAnulacion, avisoDeDescuento, avisoDePago, tarifasCompletas } from '../utils/finanzas';
import { armarAdelanto } from '../utils/adelantos';
import { armarPlanDescuentos } from '../utils/descuentos';
import { diaDe } from '../utils/totalesMes';
import { sendPush } from '../lib/notify';
import { esperarConLimite } from '../utils/tiempoLimite';

const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const documento = (nombre, id) => doc(db, 'artifacts', appId, 'public', 'data', nombre, id);
const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// Los pagos más recientes: alcanzan para el reporte de un mes o más y para la lista de pagos registrados.
const MAX_PAGOS_VISIBLES = 300;
const MAX_ADELANTOS_VISIBLES = 300;
const MAX_DESCUENTOS_VISIBLES = 300;
const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

// Lo que lleva Finanzas, en vivo mientras la pantalla está abierta: las órdenes ya pagadas del periodo elegido, las filas del registro de VN y TA del periodo, las tarifas y los últimos pagos. Son pocos documentos (solo lo que Finanzas escribe), no las órdenes: esas se leen aparte (useDatosAlmacen).
export function useFinanzas({ firebaseUser, rango, usuario, setToastMsg }) {
  const [tarifasGuardadas, setTarifasGuardadas] = useState(null);
  const [pagadas, setPagadas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [tiposMudanza, setTiposMudanza] = useState({});
  const [adelantos, setAdelantos] = useState([]);
  const [ajustes, setAjustes] = useState([]);
  const [descuentos, setDescuentos] = useState([]);
  const [revisionesLista, setRevisionesLista] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [error, setError] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    const alFallar = (que) => (e) => { console.error(`No se pudo leer ${que}:`, e); setError(true); };
    const bajas = [
      onSnapshot(datos('tiposMudanza'), (s) => setTiposMudanza(Object.fromEntries(s.docs.map((d) => [d.id, d.data().tipo]))), alFallar('el tipo de las mudanzas')),
      onSnapshot(documento('tarifasPago', 'actual'), (s) => setTarifasGuardadas(s.exists() ? s.data() : {}), alFallar('las tarifas')),
      onSnapshot(query(datos('pagosTecnicos'), orderBy('creadoEn', 'desc'), limit(MAX_PAGOS_VISIBLES)), (s) => setPagos(aLista(s)), alFallar('los pagos')),
      onSnapshot(query(datos('adelantosTecnicos'), orderBy('creadoEn', 'desc'), limit(MAX_ADELANTOS_VISIBLES)), (s) => setAdelantos(aLista(s)), alFallar('los adelantos')),
      // Los descuentos y bonos por órdenes corregidas: se leen todos para ver los que todavía no entraron en ningún pago.
      onSnapshot(datos('ajustesTecnicos'), (s) => setAjustes(aLista(s)), alFallar('los descuentos y bonos')),
      // Los descuentos con motivo que se le ponen a un técnico: los más recientes alcanzan para el periodo y para lo que está por descontar.
      onSnapshot(query(datos('descuentosTecnicos'), orderBy('creadoEn', 'desc'), limit(MAX_DESCUENTOS_VISIBLES)), (s) => setDescuentos(aLista(s)), alFallar('los descuentos')),
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
      onSnapshot(delPeriodo('revisionPagos'), (s) => setRevisionesLista(aLista(s)), alFallar('la revisión de pagos')),
      onSnapshot(query(datos('registroVnTa'), where('fecha', '>=', desde), where('fecha', '<=', hasta)), (s) => setRegistros(aLista(s)), alFallar('el registro de VN y TA')),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [firebaseUser, desde, hasta]);

  const tarifas = useMemo(() => tarifasCompletas(tarifasGuardadas), [tarifasGuardadas]);
  const idsPagadas = useMemo(() => new Set(pagadas.map((p) => p.id)), [pagadas]);
  // La revisión del administrador de lo que se puede pagar: { [clave de la orden]: documento }.
  const revisiones = useMemo(() => Object.fromEntries(revisionesLista.map((r) => [r.id, r])), [revisionesLista]);

  // Cada acción devuelve true si se guardó. Los errores salen como aviso, con el motivo cuando se sabe.
  const ejecutar = async (accion, exito, fallo) => {
    setOcupado(true);
    try {
      // Sin respuesta del servidor el botón no se queda esperando para siempre: se avisa y se libera.
      if (!(await esperarConLimite(accion()))) {
        setToastMsg({ type: 'error', duration: 9000, text: 'No hubo respuesta del servidor: el cambio queda en cola y se aplicará cuando vuelva la conexión. Revisa tu conexión antes de seguir.' });
        return false;
      }
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

  // El tipo de una mudanza anterior al campo TIPO, que ya está en un cierre y no se puede editar: se guarda aquí con el id de la orden.
  const guardarTipoMudanza = (clave, tipo) => ejecutar(
    () => setDoc(documento('tiposMudanza', clave), { tipo, por: usuario, en: Date.now() }),
    `Mudanza ${tipo === 'EXTERNA' ? 'externa' : 'interna'}: queda por pagar con ese precio.`, 'No se pudo guardar el tipo de la mudanza.',
  );

  // Si el aviso no sale (sin conexión, o el técnico no tiene la app con notificaciones), el registro ya quedó guardado: se avisa para que le escriban por WhatsApp.
  const avisarAlTecnico = async (tecnico, { title, body }, tipo) => {
    const { ok, sent } = await sendPush(firebaseUser, { target: { type: 'tecnico', name: tecnico }, title, body, tipo });
    if (ok && sent !== 0) return;
    setToastMsg({
      type: 'error',
      duration: 9000,
      text: ok
        ? `${tecnico} no tiene notificaciones activas en ningún dispositivo: no se enteró por aviso. Avísale por WhatsApp.`
        : `No se pudo enviar la notificación a ${tecnico}. El registro quedó guardado; avísale por WhatsApp.`,
    });
  };

  // Un pago, sus órdenes, las filas de VN y TA que entran y lo que se descuenta de cada adelanto, todo en un solo lote: si alguna orden ya la pagó otra persona
  // mientras tanto, no se guarda nada. `datosPago`: moneda, forma, referencia y fecha y hora del pago (parseDatosPago); `notificar`: avisarle al técnico.
  const pagar = async (fila, rangoPago, { nota = '', tasa = null, datosPago = null, notificar = false } = {}) => {
    const armado = armarPago(fila, rangoPago, tarifas, { por: usuario, ahora: Date.now(), nota, tasa, datos: datosPago, notificar });
    if (armado.error) { setToastMsg({ type: 'error', text: armado.error }); return false; }
    const guardado = await ejecutar(async () => {
      const lote = writeBatch(db);
      lote.set(documento('pagosTecnicos', armado.pagoId), armado.pago);
      for (const { id, datos: d } of armado.ordenes) lote.set(documento('ordenesPagadas', id), d);
      for (const { id, datos: d } of armado.registros) lote.update(documento('registroVnTa', id), d);
      for (const { id, monto } of armado.adelantos) {
        const actual = adelantos.find((a) => a.id === id);
        lote.update(documento('adelantosTecnicos', id), { aplicado: redondear((Number(actual?.aplicado) || 0) + monto), pagoId: armado.pagoId });
      }
      for (const { id, monto } of armado.ajustes) {
        const actual = ajustes.find((a) => a.id === id);
        lote.update(documento('ajustesTecnicos', id), { aplicado: redondear((Number(actual?.aplicado) || 0) + monto), pagoId: armado.pagoId });
      }
      for (const { id, monto } of armado.descuentosLibres) {
        const actual = descuentos.find((d) => d.id === id);
        lote.update(documento('descuentosTecnicos', id), { aplicado: redondear((Number(actual?.aplicado) || 0) + monto), pagoId: armado.pagoId });
      }
      await lote.commit();
    }, `Pago registrado: ${fila.tecnico}.`, 'No se pudo registrar el pago. Alguna orden pudo haberse pagado ya: revisa e intenta de nuevo.');
    if (guardado && notificar) await avisarAlTecnico(fila.tecnico, avisoDePago(armado.pago), 'pagoTecnico');
    return guardado;
  };

  // Un adelanto en dólares a un técnico (`entrada`: lo que devuelve parseAdelanto): queda por descontar en su próximo pago.
  const registrarAdelanto = async (tecnico, entrada, { notificar = false } = {}) => {
    const adelanto = armarAdelanto(tecnico, entrada, { por: usuario, ahora: Date.now(), notificar });
    const guardado = await ejecutar(
      () => setDoc(doc(datos('adelantosTecnicos')), adelanto),
      `Adelanto registrado: ${tecnico}.`, 'No se pudo registrar el adelanto.',
    );
    if (guardado && notificar) await avisarAlTecnico(tecnico, avisoDeAdelanto(adelanto), 'adelantoTecnico');
    return guardado;
  };

  // Solo se anula un adelanto que todavía no se descontó en ningún pago (las reglas también lo exigen).
  const anularAdelanto = (adelanto) => ejecutar(
    () => updateDoc(documento('adelantosTecnicos', adelanto.id), { anulado: true, anuladoPor: usuario, anuladoEn: Date.now() }),
    'Adelanto anulado.', 'No se pudo anular el adelanto.',
  );

  // Un descuento en dólares con su motivo (`entrada`: lo que devuelve parseDescuento): queda por descontar en su próximo pago. Con `programacion` (lo que devuelve parseProgramacion) entra desde esa fecha,
  // en una o varias cuotas (el monto es el total): se guardan todos juntos y solo se avisa al técnico una vez, al programarlo.
  const registrarDescuento = async (tecnico, entrada, { notificar = false, programacion = null } = {}) => {
    const ahora = Date.now();
    const hoy = diaDe(ahora);
    const lista = armarPlanDescuentos(tecnico, entrada, programacion || { desde: hoy, cuotas: 1, frecuencia: '' }, { por: usuario, ahora, notificar, hoy });
    const programado = lista.length > 1 || Boolean(lista[0].desde);
    const guardado = await ejecutar(
      async () => {
        const lote = writeBatch(db);
        for (const d of lista) lote.set(doc(datos('descuentosTecnicos')), d);
        await lote.commit();
      },
      programado ? `Descuento programado: ${tecnico}.` : `Descuento registrado: ${tecnico}.`, 'No se pudo registrar el descuento.',
    );
    if (guardado && notificar) await avisarAlTecnico(tecnico, avisoDeDescuento(lista[0]), 'descuentoTecnico');
    return guardado;
  };

  // Solo se anula un descuento que todavía no se descontó en ningún pago (las reglas también lo exigen).
  const anularDescuento = (descuento) => ejecutar(
    () => updateDoc(documento('descuentosTecnicos', descuento.id), { anulado: true, anuladoPor: usuario, anuladoEn: Date.now() }),
    'Descuento anulado.', 'No se pudo anular el descuento.',
  );

  const anular = async (pago) => {
    const anulado = await anularPago(pago);
    if (anulado && pago.notificado) await avisarAlTecnico(pago.tecnico, avisoDeAnulacion(pago), 'pagoTecnico');
    return anulado;
  };
  const anularPago = (pago) => ejecutar(async () => {
    const lote = writeBatch(db);
    lote.update(documento('pagosTecnicos', pago.id), { anulado: true, anuladoPor: usuario, anuladoEn: Date.now() });
    const ordenes = await getDocs(query(datos('ordenesPagadas'), where('pagoId', '==', pago.id)));
    ordenes.docs.forEach((d) => lote.delete(d.ref));
    const marcadas = await getDocs(query(datos('registroVnTa'), where('pagoId', '==', pago.id)));
    marcadas.docs.forEach((d) => lote.update(d.ref, { pagoId: '', pagadoEn: 0 }));
    // Lo que ese pago descontó vuelve al saldo de cada adelanto (se lee lo que tiene ahora: otro pago pudo descontar más después).
    for (const { id, monto } of pago.adelantos || []) {
      const actual = await getDoc(documento('adelantosTecnicos', id));
      if (actual.exists()) lote.update(actual.ref, { aplicado: Math.max(0, redondear((Number(actual.data().aplicado) || 0) - monto)), pagoId: pago.id });
    }
    // Lo mismo con los descuentos y bonos por órdenes corregidas que entraron en ese pago.
    for (const { id, monto } of pago.ajustes || []) {
      const actual = await getDoc(documento('ajustesTecnicos', id));
      if (actual.exists()) lote.update(actual.ref, { aplicado: Math.max(0, redondear((Number(actual.data().aplicado) || 0) - monto)), pagoId: pago.id });
    }
    // Y con los descuentos con motivo de ese pago.
    for (const { id, monto } of pago.descuentosManuales || []) {
      const actual = await getDoc(documento('descuentosTecnicos', id));
      if (actual.exists()) lote.update(actual.ref, { aplicado: Math.max(0, redondear((Number(actual.data().aplicado) || 0) - monto)), pagoId: pago.id });
    }
    await lote.commit();
  }, 'Pago anulado: las órdenes vuelven a estar por pagar y los adelantos y descuentos, por descontar.', 'No se pudo anular el pago.');

  return { tarifas, tarifasCargadas: tarifasGuardadas !== null, pagadas, registros, tiposMudanza, adelantos, ajustes, descuentos, revisiones, idsPagadas, pagos, error, ocupado, guardarTarifas, pagar, anular, guardarTipoMudanza, registrarAdelanto, anularAdelanto, registrarDescuento, anularDescuento };
}
