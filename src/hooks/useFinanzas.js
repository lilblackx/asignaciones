import { useEffect, useMemo, useState } from 'react';
import { collection, doc, documentId, limit, orderBy, query, where } from 'firebase/firestore';
import { onSnapshot, getDocs, getDoc, setDoc, updateDoc, writeBatch } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { armarPago, avisoDeAdelanto, avisoDeAdicional, avisoDeAnulacion, avisoDeDescuento, avisoDePago, tarifasCompletas } from '../utils/finanzas';
import { armarAdicional, itemsAdicionales } from '../utils/adicionales';
import { armarAdelanto } from '../utils/adelantos';
import { armarPlanDescuentos } from '../utils/descuentos';
import { diaDe } from '../utils/totalesMes';
import { sendPush } from '../lib/notify';
import { esperarConLimite } from '../utils/tiempoLimite';
import { useVentanaLectura } from './useVentanaLectura';

const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const documento = (nombre, id) => doc(db, 'artifacts', appId, 'public', 'data', nombre, id);
const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// Los pagos más recientes: alcanzan para el reporte de un mes o más y para la lista de pagos registrados.
const MAX_PAGOS_VISIBLES = 300;
const MAX_ADELANTOS_VISIBLES = 300;
const MAX_DESCUENTOS_VISIBLES = 300;
const MAX_ADICIONALES_VISIBLES = 300;
const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

// Lo que lleva Finanzas, en vivo mientras la pantalla está abierta: las órdenes ya pagadas del periodo elegido, las filas del registro de VN y TA del periodo, las tarifas y los últimos pagos. Son pocos documentos (solo lo que Finanzas escribe), no las órdenes: esas se leen aparte (useDatosAlmacen).
// Lo del periodo se lee de una ventana que solo crece mientras se está en un periodo (ver useVentanaLectura): pasar a uno más corto o volver a uno ya visto no vuelve a leer nada; aquí se filtra lo del periodo elegido.
// `soloPendientes` ("Por pagar"): en vez de leer por periodo, lee solo las revisiones marcadas `pendientePago` (lo aprobado y sin pagar, de cualquier fecha) y, de ellas, las filas de VN y TA que le tocan.
// No lee las órdenes pagadas (esas revisiones no están marcadas): `pagadas` e `idsPagadas` quedan vacíos. `desdePendientes` es el día más antiguo entre esas revisiones ('' si no hay ninguna).
export function useFinanzas({ firebaseUser, rango, usuario, setToastMsg, soloPendientes = false }) {
  const [tarifasGuardadas, setTarifasGuardadas] = useState(null);
  const [pagadas, setPagadas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [tiposMudanza, setTiposMudanza] = useState({});
  const [adelantos, setAdelantos] = useState([]);
  const [ajustes, setAjustes] = useState([]);
  const [descuentos, setDescuentos] = useState([]);
  const [adicionales, setAdicionales] = useState([]);
  const [catalogoAdicionales, setCatalogoAdicionales] = useState(null);
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
      // Los pagos adicionales que se le suman a un técnico y el catálogo de ítems del tabulador.
      onSnapshot(query(datos('pagosAdicionales'), orderBy('creadoEn', 'desc'), limit(MAX_ADICIONALES_VISIBLES)), (s) => setAdicionales(aLista(s)), alFallar('los pagos adicionales')),
      onSnapshot(documento('tarifasPago', 'adicionales'), (s) => setCatalogoAdicionales(s.exists() ? s.data() : {}), alFallar('los ítems de pagos adicionales')),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [firebaseUser]);

  const { desde, hasta } = rango;
  // Lo que se lee de Firestore: el periodo elegido o uno más ancho si antes se eligió uno mayor (no se encoge hasta que se vuelve a "Por pagar" o se sale de Finanzas).
  const ventana = useVentanaLectura(rango, !soloPendientes);
  const lecturaDesde = ventana?.desde ?? '';
  const lecturaHasta = ventana?.hasta ?? '';
  useEffect(() => {
    if (!firebaseUser || soloPendientes || !lecturaDesde) return;
    const alFallar = (que) => (e) => { console.error(`No se pudo leer ${que}:`, e); setError(true); };
    const delPeriodo = (nombre) => query(datos(nombre), where('dia', '>=', lecturaDesde), where('dia', '<=', lecturaHasta));
    const bajas = [
      onSnapshot(delPeriodo('ordenesPagadas'), (s) => setPagadas(aLista(s)), alFallar('las órdenes pagadas')),
      onSnapshot(delPeriodo('revisionPagos'), (s) => setRevisionesLista(aLista(s)), alFallar('la revisión de pagos')),
      onSnapshot(query(datos('registroVnTa'), where('fecha', '>=', lecturaDesde), where('fecha', '<=', lecturaHasta)), (s) => setRegistros(aLista(s)), alFallar('el registro de VN y TA')),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [firebaseUser, lecturaDesde, lecturaHasta, soloPendientes]);
  // Lo leído puede abarcar más días que el periodo elegido: solo cuenta lo de ese periodo (lo mismo que leía antes).
  const pagadasDelPeriodo = useMemo(() => pagadas.filter((d) => d.dia >= desde && d.dia <= hasta), [pagadas, desde, hasta]);
  const revisionesDelPeriodo = useMemo(() => revisionesLista.filter((d) => d.dia >= desde && d.dia <= hasta), [revisionesLista, desde, hasta]);
  const registrosDelPeriodo = useMemo(() => registros.filter((d) => d.fecha >= desde && d.fecha <= hasta), [registros, desde, hasta]);

  // "Por pagar": solo las aprobadas sin pagar (pendientePago), de cualquier fecha. Se guardan aparte de lo del periodo para no mezclar un modo con otro al cambiar.
  const [revisionesPendientes, setRevisionesPendientes] = useState([]);
  const [registrosPendientes, setRegistrosPendientes] = useState([]);
  useEffect(() => {
    if (!firebaseUser || !soloPendientes) return;
    const alFallar = (que) => (e) => { console.error(`No se pudo leer ${que}:`, e); setError(true); };
    return onSnapshot(query(datos('revisionPagos'), where('pendientePago', '==', true)), (s) => setRevisionesPendientes(aLista(s)), alFallar('lo aprobado por pagar'));
  }, [firebaseUser, soloPendientes]);
  // Las filas de VN y TA de esas aprobadas (su revisión se llama `vnta_<id de la fila>`): se piden por id, de 30 en 30, cuando cambia cuáles son. Las demás filas no hacen falta.
  const idsFilasVnTa = useMemo(() => revisionesPendientes.filter((r) => r.id.startsWith('vnta_')).map((r) => r.id.slice(5)).sort().join(','), [revisionesPendientes]);
  useEffect(() => {
    if (!firebaseUser || !soloPendientes) return undefined;
    const ids = idsFilasVnTa ? idsFilasVnTa.split(',') : [];
    let vigente = true;
    const grupos = [];
    for (let i = 0; i < ids.length; i += 30) grupos.push(ids.slice(i, i + 30));
    Promise.all(grupos.map((g) => getDocs(query(datos('registroVnTa'), where(documentId(), 'in', g)))))
      .then((snaps) => { if (vigente) setRegistrosPendientes(snaps.flatMap(aLista)); })
      .catch((e) => { console.error('No se pudo leer el registro de VN y TA:', e); if (vigente) setError(true); });
    return () => { vigente = false; };
  }, [firebaseUser, soloPendientes, idsFilasVnTa]);
  const desdePendientes = useMemo(() => (soloPendientes ? revisionesPendientes.map((r) => r.dia).filter(Boolean).sort()[0] || '' : ''), [soloPendientes, revisionesPendientes]);
  const pagadasVisibles = useMemo(() => (soloPendientes ? [] : pagadasDelPeriodo), [soloPendientes, pagadasDelPeriodo]);
  const registrosVisibles = soloPendientes ? registrosPendientes : registrosDelPeriodo;

  const tarifas = useMemo(() => tarifasCompletas(tarifasGuardadas), [tarifasGuardadas]);
  const itemsPagoAdicional = useMemo(() => itemsAdicionales(catalogoAdicionales), [catalogoAdicionales]);
  const idsPagadas = useMemo(() => new Set(pagadasVisibles.map((p) => p.id)), [pagadasVisibles]);
  // La revisión del administrador de lo que se puede pagar: { [clave de la orden]: documento }.
  const revisiones = useMemo(() => Object.fromEntries((soloPendientes ? revisionesPendientes : revisionesDelPeriodo).map((r) => [r.id, r])), [soloPendientes, revisionesPendientes, revisionesDelPeriodo]);

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

  // Los ítems de pagos adicionales del tabulador (`items`: [{ id, nombre, precio }]): se guardan todos juntos. Lo ya registrado a los técnicos conserva el nombre y el precio de ese momento.
  const guardarItemsAdicionales = (items) => ejecutar(
    () => setDoc(documento('tarifasPago', 'adicionales'), { items, por: usuario, en: Date.now() }),
    'Pagos adicionales guardados.', 'No se pudieron guardar los pagos adicionales.',
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
      // La revisión de cada orden deja de estar pendiente de pago y guarda este pago (las reglas solo lo permiten en este mismo lote).
      for (const { id, datos: d } of armado.revisiones) lote.update(documento('revisionPagos', id), d);
      for (const { id, datos: d } of armado.registros) lote.update(documento('registroVnTa', id), d);
      for (const { id, monto } of armado.adelantos) {
        const actual = adelantos.find((a) => a.id === id);
        lote.update(documento('adelantosTecnicos', id), { aplicado: redondear((Number(actual?.aplicado) || 0) + monto), pagoId: armado.pagoId });
      }
      for (const { id, monto } of armado.ajustes) {
        const actual = ajustes.find((a) => a.id === id);
        lote.update(documento('ajustesTecnicos', id), { aplicado: redondear((Number(actual?.aplicado) || 0) + monto), pagoId: armado.pagoId });
      }
      for (const { id, monto } of armado.adicionales) {
        const actual = adicionales.find((a) => a.id === id);
        lote.update(documento('pagosAdicionales', id), { aplicado: redondear((Number(actual?.aplicado) || 0) + monto), pagoId: armado.pagoId });
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

  // Un pago adicional a un técnico (`entrada`: lo que devuelve parseAdicional): se suma entero a su próximo pago.
  const registrarAdicional = async (tecnico, entrada, { notificar = false } = {}) => {
    const adicional = armarAdicional(tecnico, entrada, { por: usuario, ahora: Date.now(), notificar });
    const guardado = await ejecutar(
      () => setDoc(doc(datos('pagosAdicionales')), adicional),
      `Pago adicional registrado: ${tecnico}.`, 'No se pudo registrar el pago adicional.',
    );
    if (guardado && notificar) await avisarAlTecnico(tecnico, avisoDeAdicional(adicional), 'pagoTecnico');
    return guardado;
  };

  // Solo se anula un pago adicional que todavía no entró en ningún pago (las reglas también lo exigen).
  const anularAdicional = (adicional) => ejecutar(
    () => updateDoc(documento('pagosAdicionales', adicional.id), { anulado: true, anuladoPor: usuario, anuladoEn: Date.now() }),
    'Pago adicional anulado.', 'No se pudo anular el pago adicional.',
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
    // Y la revisión de esas órdenes vuelve a estar pendiente de pago, sin el pago anulado (las reglas lo piden en este mismo lote).
    const revisadas = await getDocs(query(datos('revisionPagos'), where('pagoId', '==', pago.id)));
    revisadas.docs.forEach((d) => lote.update(d.ref, { pendientePago: true, pagoId: '' }));
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
    // Y con los pagos adicionales de ese pago.
    for (const { id, monto } of pago.adicionales || []) {
      const actual = await getDoc(documento('pagosAdicionales', id));
      if (actual.exists()) lote.update(actual.ref, { aplicado: Math.max(0, redondear((Number(actual.data().aplicado) || 0) - monto)), pagoId: pago.id });
    }
    // Y con los descuentos con motivo de ese pago.
    for (const { id, monto } of pago.descuentosManuales || []) {
      const actual = await getDoc(documento('descuentosTecnicos', id));
      if (actual.exists()) lote.update(actual.ref, { aplicado: Math.max(0, redondear((Number(actual.data().aplicado) || 0) - monto)), pagoId: pago.id });
    }
    await lote.commit();
  }, 'Pago anulado: las órdenes vuelven a estar por pagar, los adelantos y descuentos por descontar y los pagos adicionales por pagar.', 'No se pudo anular el pago.');

  return { tarifas, tarifasCargadas: tarifasGuardadas !== null, pagadas: pagadasVisibles, desdePendientes, registros: registrosVisibles, tiposMudanza, adelantos, ajustes, descuentos, adicionales, itemsPagoAdicional, catalogoCargado: catalogoAdicionales !== null, revisiones, idsPagadas, pagos, error, ocupado, guardarTarifas, pagar, anular, guardarTipoMudanza, registrarAdelanto, anularAdelanto, registrarDescuento, anularDescuento, guardarItemsAdicionales, registrarAdicional, anularAdicional };
}
