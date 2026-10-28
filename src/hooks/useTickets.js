import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, doc, runTransaction, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { generarCodigoBase, generarCorrelativoConCatchUp as generarCorrelativoConCatchUpBase, guardarConNumeracion as guardarConNumeracionBase, sincronizarCorrelativoManual, detectarSaltoManual } from '../utils/correlativo';
import { playAprobadoSound, playDevueltaSound, playNuevaAsignacionSound, playPreFinalizadoSound, playPrioridadSound, playTecnicoStatusSound } from '../utils/notificationSound';
import { esPrioritaria, mapaPrioridad, prioridadNueva, textoAvisoPrioridad } from '../utils/prioridad';
import { sendPush } from '../lib/notify';
import { ESTADO_EN_SITIO, deshacerLlegada, estaEnCamino, estadoViaje, iniciarViaje, mapaViaje, puedeIniciarViaje, registrarLlegada, textoAvisoEnCamino, textoAvisoLlegada, viajeEnCursoDe, viajesNuevos } from '../utils/enCamino';
import { parsePotencia } from '../utils/potencia';
import { MENSAJE_TELEFONO_OBLIGATORIO, tieneTelefono } from '../utils/telefono';
import { MENSAJE_PROMOTOR_OBLIGATORIO, claveNombre, nombrePromotora } from '../utils/promotora';
import { direccionCliente, nombrePersona } from '../utils/datosCliente';
import { generarMensajeWhatsAppInstalacion, promotoraDeOrden } from '../utils/whatsapp';
import { esVentaPorNumerar, TEXTO_AVISO_NUEVA_VENTA } from '../utils/ventaPromotora';
import { normalizarCoordenadasNap, normalizarUbicacion } from '../utils/ubicacion';
import { errorGarantia } from '../utils/garantia';
import { cambiosDeTicket } from '../utils/cambiosTicket';
import { ConflictoOrdenError, verificarEstado } from '../utils/concurrencia';
import { camposTiempos, conTiempos } from '../utils/tiemposOrden';
import { cambiosDatosTecnico } from '../utils/edicionDatosTecnico';
import { errorSerialCaja } from '../utils/serialOlt';
import { devolucionPendiente } from '../utils/devolucion';
import { ESTADO_CANCELADO, camposCancelacion, cancelaAhora, comoCancelada, lineaMotivoCancelacion, motivoCancelacion, parseMotivoCancelacion } from '../utils/cancelacion';
import { ORIGEN_OFICINA, ORIGEN_TECNICO, RESULTADO_CERRADA, RESULTADO_DEVUELTA, cambiosInfraestructura, construirEscalada, construirResolucion, enInfraestructura, infraestructuraDe, mapaInfraestructura, parseMotivo, puedeEscalar, textoEscaladaOficina, textoEscaladaTecnico, textoResueltaTecnico } from '../utils/infraestructura';
import { construirConsulta, construirRespuesta, consultasNuevas, mapaConsultas, textoAvisoConsulta, textoAvisoRespuesta, textoRespuesta } from '../utils/consultaCobro';
import { COBRO_EXONERADO, COBRO_VISITA, camposCobro, detalleCobro, estaExonerado, llevaCobro, monedaDe, textoMonto, tieneCobroFinal, valorCobro } from '../utils/cobro';
import { detalleValoresCliente, exigeValoresCliente, ofreceValoresCliente, parseValoresCliente, valoresGuardados } from '../utils/valoresCliente';
import { detalleInstalacion, esInstalacion, instalacionCompleta, validarInstalacion } from '../utils/instalacion';
import { errorConectoresInstalacion, normalizarConectoresInstalacion } from '../utils/conectoresInstalacion';
import { payloadEnvioInventario } from '../utils/envioInventario';
import { llamarInventario, marcarEnvioInventario } from '../lib/inventario';
import { ETIQUETA_TIPO_VISITA, TIPO_RECABLEADO, avisaCobroAlPreFinalizar, datosConectores, datosSerialEquipo, errorCantidadesConector, errorNapPuertoVisita, errorTipoEquipoNuevo, errorTipoVisita, esCambioEquipo, llevaConectores, parseSerialEquipo, partesRecableado, textoConectorVisita, tieneDatosRecableado } from '../utils/tipoVisita';
import { lineaTecnico } from '../utils/historial';
import { buscarClienteSmartOlt } from '../lib/smartolt';
import { MIN_DIGITOS_CEDULA, soloDigitos } from '../utils/clienteSmartolt';
import { oltUnica } from '../utils/olt';

// Texto del cobro que se le muestra al técnico cuando finalizan una orden (cualquiera). El cobro lo elige quien
// finaliza (el monto de la visita con la tasa de ese momento, otro monto o exonerar) y queda guardado en la
// orden como `cobroBs` / `cobroTipo`. Antes de finalizar no se muestra ningún cobro.
const avisoCobro = (t) => {
  if (!llevaCobro(t)) return '';
  if (estaExonerado(t)) return ' Visita exonerada: no se cobra al cliente.';
  return t.cobroBs ? ` Cobro resultante al cliente: ${textoMonto(t.cobroBs, monedaDe(t))}.` : '';
};

// Órdenes que el técnico todavía tiene por atender: solo de esas le avisa que se las quitaron o cancelaron.
const esActiva = (t) => t?.estado === 'PENDIENTE' || t?.estado === 'PRE-FINALIZADO';
const etiquetaOrden = (t) => `${t.codigo || 'S/C'}${t.nombre ? ` - ${t.nombre}` : ''}`;

// Al finalizar una instalación se guarda su plantilla ya llena por el técnico (vacía si nunca tuvo plantilla).
const plantillaFinalDe = (t) => {
  if (!esInstalacion(t.tipoTrabajo)) return {};
  const texto = generarMensajeWhatsAppInstalacion({ ...t, estado: 'FINALIZADO' });
  return texto ? { plantillaFinal: texto } : {};
};

const esCobroFinalizado = (t) => t.estado === 'FINALIZADO' && tieneCobroFinal(t);

// Un cobro cuenta como visto si el técnico confirmó ese monto exacto ("id|monto") o, como lo
// guardaban versiones anteriores, el id suelto. Así, si el monto final cambia respecto al que
// ya vio al pre-finalizar, se le muestra de nuevo.
const claveCobro = (t) => `${t.id}|${valorCobro(t)}`;
const cobroVisto = (vistos, t) => vistos.has(t.id) || vistos.has(claveCobro(t));

// Lo último que vio este dispositivo de las órdenes (id -> estado, id -> si tenía ubicación).
// Sirve de punto de partida al abrir la app: lo que cambió mientras estuvo cerrada
// (órdenes nuevas, devueltas, aprobadas) se avisa en la app igual que si hubiera estado abierta,
// aunque el push del sistema no haya llegado. Pasados 3 días se descarta: ya no es "reciente".
const BASELINE_PREFIX = 'asignaciones:baseline:';
const BASELINE_VIGENCIA_MS = 3 * 24 * 60 * 60 * 1000;
function cargarBaseline(usuario) {
  if (!usuario) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(BASELINE_PREFIX + usuario));
    if (!raw || Date.now() - raw.t > BASELINE_VIGENCIA_MS) return null;
    // `p` (prioridades) no existía en los guardados viejos: sin él no se sabe qué cambió y no se avisa.
    return { estados: new Map(raw.e), ubicaciones: new Map(raw.u), prioridades: raw.p ? new Map(raw.p) : null };
  } catch {
    return null;
  }
}
function guardarBaseline(usuario, estados, ubicaciones, prioridades) {
  if (!usuario) return;
  try {
    localStorage.setItem(BASELINE_PREFIX + usuario, JSON.stringify({ t: Date.now(), e: [...estados], u: [...ubicaciones], p: [...prioridades] }));
  } catch {
    // Sin almacenamiento: solo se pierde el aviso de lo ocurrido con la app cerrada.
  }
}

const COBROS_VISTOS_PREFIX = 'asignaciones:cobrosVistos:';
// null = este dispositivo nunca los guardó (primera vez).
function cargarCobrosVistos(usuario) {
  try {
    const raw = localStorage.getItem(COBROS_VISTOS_PREFIX + usuario);
    return raw === null ? null : new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}
function guardarCobrosVistos(usuario, ids) {
  try {
    localStorage.setItem(COBROS_VISTOS_PREFIX + usuario, JSON.stringify([...ids].slice(-300)));
  } catch {
    // Sin almacenamiento: el aviso puede repetirse al recargar, pero nunca se pierde.
  }
}

// Envoltorios con la base de datos de la app; la lógica vive en utils/correlativo.js.
const generarCorrelativoConCatchUp = (...args) => generarCorrelativoConCatchUpBase(db, appId, ...args);
const guardarConNumeracion = (...args) => guardarConNumeracionBase(db, appId, ...args);

// Guarda solo lo que cambió entre `original` (como la vio el usuario) y `actualizada`:
// si otro usuario editó la orden mientras tanto, sus cambios no se pierden.
async function actualizarTicket(original, actualizada) {
  const cambios = cambiosDeTicket(original, conTiempos(original, actualizada));
  if (Object.keys(cambios).length === 0) return;
  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', original.id.toString()), cambios);
}

// Como actualizarTicket, pero dentro de una transacción que vuelve a leer la orden: si otra persona ya la cambió (por ejemplo, la finalizó
// mientras esta la tenía abierta), `verificar` da el texto del problema y no se escribe nada (ConflictoOrdenError). Así, de dos personas que
// finalizan la misma orden a la vez, solo una guarda. Ver utils/concurrencia.
async function actualizarTicketConGuardia(original, actualizada, verificar) {
  const ref = doc(db, 'artifacts', appId, 'public', 'data', 'tickets', original.id.toString());
  const cambios = cambiosDeTicket(original, conTiempos(original, actualizada));
  await runTransaction(db, async (transaction) => {
    const actual = await transaction.get(ref);
    const problema = verificar(actual.exists() ? { id: actual.id, ...actual.data() } : null);
    if (problema) throw new ConflictoOrdenError(problema);
    if (Object.keys(cambios).length > 0) transaction.update(ref, cambios);
  });
}

export function useTickets(firebaseUser, currentUser, setToastMsg, role, tecnicoAsociado, onNotify, currentUserName = null) {
  const [tickets, setTickets] = useState([]);
  // false hasta que llega el primer snapshot de órdenes (antes, `tickets` está vacío).
  const [ticketsCargados, setTicketsCargados] = useState(false);
  // Cobros que el técnico ya confirmó ("Entendido"), guardados en el dispositivo (la fuente
  // es localStorage; el estado solo lo refleja). Una orden finalizada con cobro que no esté
  // ahí se le muestra a pantalla completa, también si se finalizó con la app cerrada o si
  // recargó antes de confirmar (ver CobroResultanteModal).
  const [cobrosVistos, setCobrosVistos] = useState(null);
  // Aviso de cobro que sale apenas el técnico pre-finaliza con conector interno: la orden
  // (con el monto calculado en ese momento) hasta que confirma con "Entendido".
  const [cobroInmediato, setCobroInmediato] = useState(null);
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; });

  const cobrosPendientes = useMemo(() => {
    if (role !== 'TECNICO' || !cobrosVistos) return [];
    const finalizados = tickets.filter(t => esCobroFinalizado(t) && !cobroVisto(cobrosVistos, t) && t.id !== cobroInmediato?.id);
    return cobroInmediato ? [cobroInmediato, ...finalizados] : finalizados;
  }, [role, tickets, cobrosVistos, cobroInmediato]);
  const actualizarCobrosVistos = (fn) => {
    const siguiente = fn(new Set(cobrosVistos || []));
    guardarCobrosVistos(currentUser, siguiente);
    setCobrosVistos(siguiente);
  };
  // "Entendido": el cobro mostrado deja de estar pendiente.
  const cerrarCobro = () => {
    const actual = cobrosPendientes[0];
    if (!actual) return;
    actualizarCobrosVistos(set => set.add(claveCobro(actual)));
    if (actual === cobroInmediato) setCobroInmediato(null);
  };
  // Desde la campana: vuelve a mostrar un cobro ya confirmado.
  const mostrarCobro = (ticket) => actualizarCobrosVistos(set => { set.delete(ticket.id); set.delete(claveCobro(ticket)); return set; });
  // Pre-finalizar con conector interno: el cobro se informa en ese momento, sin esperar la aprobación.
  const mostrarCobroInmediato = (ticket, montoBs) => setCobroInmediato({ ...ticket, estado: 'PRE-FINALIZADO', cobroBs: montoBs, cobroTipo: null });

  // Guarda con la guardia de actualizarTicketConGuardia. Devuelve true si se guardó; false si otra persona ya había cambiado la orden (se avisa
  // con el texto del conflicto y no se escribe nada). Cualquier otro error sigue su camino (lo muestra quien llama).
  const guardarConGuardia = async (original, actualizada, verificar) => {
    try {
      await actualizarTicketConGuardia(original, actualizada, verificar);
      return true;
    } catch (error) {
      if (error instanceof ConflictoOrdenError) {
        setToastMsg({ type: 'error', duration: 12000, text: error.message });
        return false;
      }
      throw error;
    }
  };

  // Al aprobar o finalizar una orden que gasta material o instala un equipo (instalación, cambio de equipo, recableado,
  // visita de conector), se envía al inventario del otro sistema. La marca "pendiente" se deja antes de avisar al Worker:
  // si el aviso no llega, el Worker lo envía solo en unos minutos. Nunca frena ni ensucia la aprobación: un problema se
  // ve en la alerta de quien cierra (ver useEnviosInventario).
  const enviarAlInventario = (ticket) => {
    if (!firebaseUser || !payloadEnvioInventario(ticket)) return;
    marcarEnvioInventario(ticket.id)
      .then(() => llamarInventario('/inventario/enviar', ticket.id))
      .catch((error) => console.warn('No se pudo iniciar el envío al inventario:', error));
  };

  // La OLT del cliente se guarda en la orden al crearla (con la cédula buscada en SmartOLT). Las que no la tienen (una instalación con la
  // plantilla de la promotora: el cliente aún no estaba en la OLT) la toman al aprobarse o finalizarse, cuando el cliente ya existe. Va en segundo
  // plano y solo escribe si la orden sigue sin OLT y con la misma cédula: nunca frena ni ensucia el cierre.
  const completarOlt = (ticket) => {
    const digitos = soloDigitos(ticket?.cedula);
    if (!firebaseUser || !ticket?.id || ticket.olt || digitos.length < MIN_DIGITOS_CEDULA) return;
    buscarClienteSmartOlt(digitos)
      .then(async (onus) => {
        const olt = oltUnica(onus);
        if (!olt) return;
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticket.id);
        await runTransaction(db, async (tx) => {
          const actual = await tx.get(ref);
          if (!actual.exists() || actual.data().olt || soloDigitos(actual.data().cedula) !== digitos) return;
          tx.update(ref, { olt });
        });
      })
      .catch((error) => console.warn('No se pudo guardar la OLT del cliente:', error));
  };

  // Mismo criterio que el listener de abajo (nueva asignación / pre-finalizado /
  // aprobado), pero disparado por quien escribe el cambio, no por quien lo lee —
  // así el push llega aunque el destinatario tenga la app cerrada.
  const avisosFalloRef = useRef(new Map()); // nombre -> última vez que se avisó el fallo
  // Envía el push y, si el técnico no se va a enterar (sin dispositivos con notificaciones
  // o envío fallido), se lo dice a quien hizo el cambio para que le avise por otro medio.
  // Un mismo técnico se avisa como máximo una vez por minuto, para no apilar mensajes al
  // asignar varias órdenes seguidas.
  const avisarPush = async (params) => {
    const { ok, sent } = await sendPush(firebaseUser, params);
    const nombre = params.target.type === 'tecnico' ? params.target.name : null;
    const sinDispositivos = ok && sent === 0;
    if (!nombre || (ok && !sinDispositivos)) return;
    const ahora = Date.now();
    if (ahora - (avisosFalloRef.current.get(nombre) || 0) < 60000) return;
    avisosFalloRef.current.set(nombre, ahora);
    setToastMsg({
      type: 'error',
      duration: 9000,
      text: sinDispositivos
        ? `${nombre} no tiene notificaciones activas en ningún dispositivo: no se enteró por aviso. Avísale por WhatsApp.`
        : `No se pudo enviar la notificación a ${nombre}. La orden quedó guardada; avísale por WhatsApp.`,
    });
  };

  // Mismo criterio que el listener de abajo (nueva asignación / pre-finalizado /
  // aprobado), pero disparado por quien escribe el cambio, no por quien lee —
  // así el push llega aunque el destinatario tenga la app cerrada. `tipo` y `ticketId`
  // viajan con el push para que al tocarlo la app abra esa orden.
  const notifyTicketChange = (original, updated) => {
    const ticketId = updated.id;
    // Al técnico que tenía la orden se le avisa si se la quitan (reasignada o sin técnico) o la cancelan. Si ya estaba
    // cerrada (finalizada, cancelada) no hay nada que avisar.
    if (original?.tecnico && esActiva(original)) {
      const cerrada = updated.estado === 'CANCELADO';
      if (cerrada) {
        avisarPush({
          target: { type: 'tecnico', name: original.tecnico },
          title: 'Orden cancelada',
          body: `La orden ${etiquetaOrden(updated)} fue cancelada.${motivoCancelacion(updated) ? ` Motivo: ${motivoCancelacion(updated)}.` : ''} Ya no tienes que atenderla.`,
          tipo: 'cancelada',
          ticketId,
        });
      } else if (updated.tecnico !== original.tecnico) {
        avisarPush({
          target: { type: 'tecnico', name: original.tecnico },
          title: 'Orden desasignada',
          body: `Te quitaron la orden ${etiquetaOrden(updated)}. Ya no tienes que atenderla.`,
          tipo: 'desasignada',
          ticketId,
        });
      }
    }
    if (updated.tecnico && (!original || original.tecnico !== updated.tecnico)) {
      const conPrioridad = esPrioritaria(updated);
      avisarPush({
        target: { type: 'tecnico', name: updated.tecnico },
        title: conPrioridad ? 'Nueva asignación - PRIORIDAD ALTA' : 'Nueva asignación',
        body: `Te asignaron la orden ${updated.codigo || 'S/C'}${updated.nombre ? ` - ${updated.nombre}` : ''}.${conPrioridad ? ' Es PRIORIDAD ALTA: atiéndela primero.' : ''}`,
        tipo: conPrioridad ? 'prioridad' : 'nuevaAsignacion',
        ticketId,
      });
    }
    // Prioridad alta marcada después (por ADMIN/USUARIO) en una orden que el técnico ya tenía.
    if (updated.tecnico && original && original.tecnico === updated.tecnico && esPrioritaria(updated) && !esPrioritaria(original)) {
      avisarPush({
        target: { type: 'tecnico', name: updated.tecnico },
        title: 'Prioridad alta',
        body: textoAvisoPrioridad(updated),
        tipo: 'prioridad',
        ticketId,
      });
    }
    // Ubicación que llega después de asignar (las promotoras la mandan aparte de
    // la plantilla). Si el técnico es nuevo en la orden, "Nueva asignación" ya cubre el aviso.
    if (updated.tecnico && updated.ubicacion && original && original.tecnico === updated.tecnico && (original.ubicacion || '') !== updated.ubicacion) {
      avisarPush({
        target: { type: 'tecnico', name: updated.tecnico },
        title: 'Ubicación disponible',
        body: `La orden ${updated.codigo || 'S/C'}${updated.nombre ? ` - ${updated.nombre}` : ''} ya tiene ubicación.`,
        tipo: 'nuevaAsignacion',
        ticketId,
      });
    }
    if (updated.estado === 'PRE-FINALIZADO' && (!original || original.estado !== 'PRE-FINALIZADO')) {
      avisarPush({
        target: { type: 'aprobadores' },
        title: 'Orden pre-finalizada',
        body: `${updated.codigo || 'Orden'} (${updated.tecnico || 'técnico'}) fue marcada PRE-FINALIZADA - revisar.`,
        tipo: 'prefinalizado',
        ticketId,
      });
    }
    if (updated.estado === 'PENDIENTE' && original?.estado === 'PRE-FINALIZADO') {
      const { motivo } = devolucionPendiente(updated) || {};
      avisarPush({
        target: { type: 'tecnico', name: updated.tecnico },
        title: 'Orden devuelta',
        body: `${updated.codigo || 'Orden'} fue devuelta${motivo ? `: ${motivo}` : '. Revisa los detalles.'}`,
        tipo: 'devuelto',
        ticketId,
      });
    }
    // Cierre directo de una orden con tipo de visita (vino de una devolución): solo
    // avisa si hay cobro; el aviso normal de cierre es el de aprobación de abajo.
    if (updated.tecnico && updated.estado === 'FINALIZADO' && original?.estado === 'PENDIENTE' && avisoCobro(updated)) {
      avisarPush({
        target: { type: 'tecnico', name: updated.tecnico },
        title: 'Orden finalizada',
        body: `${updated.codigo || 'Orden'} fue finalizada.${avisoCobro(updated)}`,
        tipo: 'aprobado',
        ticketId,
      });
    }
    if (updated.estado === 'FINALIZADO' && original?.estado === 'PRE-FINALIZADO') {
      avisarPush({
        target: { type: 'tecnico', name: updated.tecnico },
        title: 'Orden aprobada',
        body: `${updated.codigo || 'Orden'} fue aprobada y finalizada.${avisoCobro(updated) || ' Ya puedes continuar.'}`,
        tipo: 'aprobado',
        ticketId,
      });
    }
  };
  // null = todavía no llegó el primer snapshot (evita notificar de golpe todo
  // lo que ya estaba PRE-FINALIZADO desde antes de abrir la app).
  const estadoAnteriorRef = useRef(null);
  // id -> ubicación del snapshot anterior, para avisar al técnico cuando una
  // orden que ya tenía pasa a tener ubicación.
  const ubicacionAnteriorRef = useRef(null);
  // id -> si la orden tenía prioridad alta en el snapshot anterior, para avisar al técnico cuando se la marcan.
  const prioridadAnteriorRef = useRef(null);
  // Órdenes activas vistas en esta sesión (id -> orden). Una que desaparece del snapshot del técnico
  // es que se la quitaron; solo cuenta lo visto en vivo, no lo guardado de una sesión anterior
  // (esas pudieron finalizarse y archivarse con la app cerrada).
  const activasVistasRef = useRef(new Map());
  // id -> viaje ("en camino" / "en sitio") del snapshot anterior, para avisar a la oficina cuando un técnico
  // sale o llega. Solo de esta sesión: no se avisa de lo que ya estaba en curso al abrir la app.
  const viajeAnteriorRef = useRef(null);
  // id -> consulta y respuesta de cobro del snapshot anterior, para avisar a la oficina de una consulta nueva y al técnico de su respuesta.
  const consultaAnteriorRef = useRef(null);
  // id -> cuándo se escaló a infraestructura (0 si no espera), para avisar a la oficina de una escalada del técnico y al técnico de lo que hizo la oficina.
  const infraestructuraAnteriorRef = useRef(null);
  // Técnicos cuyo "en camino" se está guardando ahora mismo (ver iniciarEnCamino).
  const iniciandoViajeRef = useRef(new Set());

  useEffect(() => {
    if (!firebaseUser) return;
    const ticketsRef = collection(db, 'artifacts', appId, 'public', 'data', 'tickets');
    // TECNICO solo puede leer sus propios tickets (reglas de Firestore lo exigen:
    // un rule que filtra por resource.data.tecnico rechaza un query sin este where).
    const ticketsQuery = (role === 'TECNICO' && tecnicoAsociado)
      ? query(ticketsRef, where('tecnico', '==', tecnicoAsociado))
      : ticketsRef;
    const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
      // Las que quedaron como ELIMINADO de antes se leen como canceladas (ya solo existe cancelada).
      const loadedTickets = snapshot.docs.map(doc => comoCancelada({ id: doc.id, ...doc.data() }));
      loadedTickets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTickets(loadedTickets);
      setTicketsCargados(true);
      if (role === 'TECNICO' && currentUserRef.current) {
        let vistos = cargarCobrosVistos(currentUserRef.current);
        if (vistos === null) {
          // Primera vez en este dispositivo: lo que ya estaba finalizado se da por visto, para
          // no mostrar de golpe cobros viejos; desde ahí, todo cobro nuevo queda pendiente.
          vistos = new Set(loadedTickets.filter(esCobroFinalizado).map(t => t.id));
          guardarCobrosVistos(currentUserRef.current, vistos);
        }
        setCobrosVistos(vistos);
      }

      // Primera lectura de esta sesión: se parte de lo último que vio este dispositivo, si hay.
      if (!estadoAnteriorRef.current) {
        const guardada = cargarBaseline(currentUserRef.current);
        if (guardada) {
          estadoAnteriorRef.current = guardada.estados;
          ubicacionAnteriorRef.current = guardada.ubicaciones;
          prioridadAnteriorRef.current = guardada.prioridades;
        }
      }

      if (estadoAnteriorRef.current) {
        if (role === 'ADMIN' || role === 'USUARIO') {
          // Avisa a quienes aprueban cuando un técnico deja una orden recién
          // en PRE-FINALIZADO.
          const nuevas = loadedTickets.filter(t =>
            t.estado === 'PRE-FINALIZADO' && estadoAnteriorRef.current.get(t.id) !== 'PRE-FINALIZADO'
          );
          if (nuevas.length === 1) {
            const t = nuevas[0];
            const texto = `${t.codigo || 'Orden'} (${t.tecnico || 'técnico'}) fue marcada PRE-FINALIZADA - revisar.`;
            setToastMsg({ type: 'prefinalizado', text: texto, duration: 7000 });
            onNotify?.({ type: 'prefinalizado', text: texto, ticketId: t.id });
            playPreFinalizadoSound();
          } else if (nuevas.length > 1) {
            const texto = `${nuevas.length} órdenes marcadas PRE-FINALIZADO - revisar.`;
            setToastMsg({ type: 'prefinalizado', text: texto, duration: 7000 });
            onNotify?.({ type: 'prefinalizado', text: texto });
            playPreFinalizadoSound();
          }
          // Avisa a la oficina cuando una promotora carga una venta (id que no estaba en el snapshot anterior).
          const ventasNuevas = loadedTickets.filter(t =>
            t.ventaPromotora === true && !estadoAnteriorRef.current.has(t.id)
          );
          if (ventasNuevas.length > 0) {
            const t = ventasNuevas[0];
            const texto = ventasNuevas.length === 1 ? TEXTO_AVISO_NUEVA_VENTA : `${ventasNuevas.length} nuevas ventas`;
            setToastMsg({ type: 'nuevaVenta', text: texto, duration: 7000 });
            onNotify?.({ type: 'nuevaVenta', text: texto, ...(ventasNuevas.length === 1 && { ticketId: t.id }) });
            playNuevaAsignacionSound();
          }
        } else if (role === 'TECNICO') {
          // Avisa al técnico cuando le llega una orden nueva: el query ya está
          // acotado a sus propios tickets (where tecnico == tecnicoAsociado),
          // así que un id que no estaba en el snapshot anterior es una
          // asignación nueva, sea por creación directa o por reasignación
          // desde Editar.
          const nuevasAsignaciones = loadedTickets.filter(t =>
            !estadoAnteriorRef.current.has(t.id)
          );
          const conPrioridadN = nuevasAsignaciones.filter(esPrioritaria).length;
          if (nuevasAsignaciones.length === 1) {
            const t = nuevasAsignaciones[0];
            const prio = conPrioridadN > 0;
            const texto = `Te asignaron una nueva orden${prio ? ' con PRIORIDAD ALTA' : ''}: ${t.codigo || 'S/C'}${t.nombre ? ` - ${t.nombre}` : ''}.${prio ? ' Atiéndela primero.' : ''}`;
            setToastMsg({ type: prio ? 'prioridad' : 'nuevaAsignacion', text: texto, duration: prio ? 9000 : 6000 });
            onNotify?.({ type: prio ? 'prioridad' : 'nuevaAsignacion', text: texto, ticketId: t.id });
            (prio ? playPrioridadSound : playNuevaAsignacionSound)();
          } else if (nuevasAsignaciones.length > 1) {
            const prio = conPrioridadN > 0;
            const texto = `Te asignaron ${nuevasAsignaciones.length} órdenes nuevas${prio ? `, ${conPrioridadN} con PRIORIDAD ALTA` : ''}.`;
            setToastMsg({ type: prio ? 'prioridad' : 'nuevaAsignacion', text: texto, duration: prio ? 9000 : 6000 });
            onNotify?.({ type: prio ? 'prioridad' : 'nuevaAsignacion', text: texto });
            (prio ? playPrioridadSound : playNuevaAsignacionSound)();
          }

          // Avisa al técnico cuando le marcan prioridad alta en una orden que ya tenía.
          const conPrioridadNueva = prioridadNueva(loadedTickets, prioridadAnteriorRef.current);
          if (conPrioridadNueva.length === 1) {
            const t = conPrioridadNueva[0];
            const texto = textoAvisoPrioridad(t);
            setToastMsg({ type: 'prioridad', text: texto, duration: 9000 });
            onNotify?.({ type: 'prioridad', text: texto, ticketId: t.id });
            playPrioridadSound();
          } else if (conPrioridadNueva.length > 1) {
            const texto = `${conPrioridadNueva.length} órdenes tienen PRIORIDAD ALTA. Atiéndelas primero.`;
            setToastMsg({ type: 'prioridad', text: texto, duration: 9000 });
            onNotify?.({ type: 'prioridad', text: texto });
            playPrioridadSound();
          }

          const conUbicacionNueva = loadedTickets.filter(t =>
            t.ubicacion
            && ubicacionAnteriorRef.current?.has(t.id) && !ubicacionAnteriorRef.current.get(t.id)
          );
          if (conUbicacionNueva.length === 1) {
            const t = conUbicacionNueva[0];
            const texto = `La orden ${t.codigo || 'S/C'}${t.nombre ? ` - ${t.nombre}` : ''} ya tiene ubicación.`;
            setToastMsg({ type: 'nuevaAsignacion', text: texto, duration: 6000 });
            onNotify?.({ type: 'nuevaAsignacion', text: texto, ticketId: t.id });
            playNuevaAsignacionSound();
          } else if (conUbicacionNueva.length > 1) {
            const texto = `${conUbicacionNueva.length} órdenes recibieron ubicación.`;
            setToastMsg({ type: 'nuevaAsignacion', text: texto, duration: 6000 });
            onNotify?.({ type: 'nuevaAsignacion', text: texto });
            playNuevaAsignacionSound();
          }

          // Avisa al técnico cuando le cancelan una orden que tenía por atender.
          const canceladas = loadedTickets.filter(t =>
            t.estado === 'CANCELADO'
            && ['PENDIENTE', 'PRE-FINALIZADO'].includes(estadoAnteriorRef.current.get(t.id))
          );
          if (canceladas.length > 0) {
            const t = canceladas[0];
            const texto = canceladas.length === 1
              ? `La orden ${etiquetaOrden(t)} fue cancelada.${motivoCancelacion(t) ? ` Motivo: ${motivoCancelacion(t)}.` : ''} Ya no tienes que atenderla.`
              : `${canceladas.length} órdenes fueron canceladas. Ya no tienes que atenderlas.`;
            setToastMsg({ type: 'cancelada', text: texto, duration: 9000 });
            onNotify?.({ type: 'cancelada', text: texto, ...(canceladas.length === 1 && { ticketId: t.id }) });
            playDevueltaSound();
          }

          // Avisa al técnico cuando le quitan una orden (la reasignaron a otro técnico o la dejaron sin técnico):
          // deja de llegarle en el listado, así que se detecta porque desaparece.
          const idsActuales = new Set(loadedTickets.map(t => t.id));
          const quitadas = [...activasVistasRef.current.values()].filter(t => !idsActuales.has(t.id));
          if (quitadas.length > 0) {
            const texto = quitadas.length === 1
              ? `Te quitaron la orden ${etiquetaOrden(quitadas[0])}. Ya no tienes que atenderla.`
              : `Te quitaron ${quitadas.length} órdenes. Ya no tienes que atenderlas.`;
            setToastMsg({ type: 'desasignada', text: texto, duration: 9000 });
            onNotify?.({ type: 'desasignada', text: texto });
            playDevueltaSound();
          }

          // Avisa al técnico cuando le devuelven una orden (PRE-FINALIZADO -> PENDIENTE).
          const devueltas = loadedTickets.filter(t =>
            t.estado === 'PENDIENTE' && estadoAnteriorRef.current.get(t.id) === 'PRE-FINALIZADO'
          );
          if (devueltas.length > 0) {
            const t = devueltas[0];
            const { motivo } = devolucionPendiente(t) || {};
            const texto = devueltas.length === 1
              ? `${t.codigo || 'Orden'} fue devuelta${motivo ? `: ${motivo}` : '. Revisa los detalles.'}`
              : `${devueltas.length} órdenes fueron devueltas. Revisa los detalles.`;
            setToastMsg({ type: 'devuelto', text: texto, duration: 9000 });
            onNotify?.({ type: 'devuelto', text: texto, ...(devueltas.length === 1 && { ticketId: t.id }) });
            playDevueltaSound();
          }

          // Avisa al técnico cuando le aprueban una orden (PRE-FINALIZADO ->
          // FINALIZADO), para que sepa que ya puede seguir adelante.
          const aprobadas = loadedTickets.filter(t =>
            t.estado === 'FINALIZADO' && (
              estadoAnteriorRef.current.get(t.id) === 'PRE-FINALIZADO'
              || (estadoAnteriorRef.current.get(t.id) === 'PENDIENTE' && avisoCobro(t))
            )
          );
          if (aprobadas.length === 1) {
            const t = aprobadas[0];
            const texto = `${t.codigo || 'Orden'} fue aprobada y finalizada.${avisoCobro(t) || ' Ya puedes continuar.'}`;
            setToastMsg({ type: 'aprobado', text: texto, duration: 6000 });
            onNotify?.({ type: 'aprobado', text: texto, ticketId: t.id });
            playAprobadoSound();
          } else if (aprobadas.length > 1) {
            const cobros = aprobadas.filter(t => avisoCobro(t)).map(t => `${t.codigo || 'Orden'}: ${estaExonerado(t) ? 'exonerada' : textoMonto(t.cobroBs, monedaDe(t))}`);
            const texto = `${aprobadas.length} órdenes fueron aprobadas y finalizadas.${cobros.length ? ` Cobro resultante al cliente: ${cobros.join(', ')}.` : ''}`;
            setToastMsg({ type: 'aprobado', text: texto, duration: 6000 });
            onNotify?.({ type: 'aprobado', text: texto });
            playAprobadoSound();
          }
        }
      }
      if (role === 'ADMIN' || role === 'USUARIO') {
        // Avisa a la oficina cuando un técnico marca que va en camino o que llegó.
        const { enCamino, llegadas } = viajesNuevos(loadedTickets, viajeAnteriorRef.current, Date.now());
        const avisarViajes = (lista, type, textoUno, textoVarios, sonido) => {
          if (lista.length === 0) return;
          const texto = lista.length === 1 ? textoUno(lista[0]) : textoVarios(lista.length);
          setToastMsg({ type, text: texto, duration: 6000 });
          onNotify?.({ type, text: texto, ...(lista.length === 1 && { ticketId: lista[0].id }) });
          sonido();
        };
        avisarViajes(enCamino, 'encamino', textoAvisoEnCamino, (n) => `${n} técnicos van en camino a sus órdenes.`, playTecnicoStatusSound);
        avisarViajes(llegadas, 'llegada', textoAvisoLlegada, (n) => `${n} técnicos llegaron al sitio de sus órdenes.`, playAprobadoSound);
      }
      // Consulta del cobro de un recableado: la oficina se entera de la pregunta y el técnico de la respuesta.
      if (role === 'ADMIN' || role === 'USUARIO' || role === 'TECNICO') {
        const { consultas, respuestas } = consultasNuevas(loadedTickets, consultaAnteriorRef.current);
        const lista = role === 'TECNICO' ? respuestas : consultas;
        if (lista.length > 0) {
          const type = role === 'TECNICO' ? 'respuestaCobro' : 'consultaCobro';
          const textoUno = role === 'TECNICO' ? textoAvisoRespuesta : textoAvisoConsulta;
          const texto = lista.length === 1 ? textoUno(lista[0]) : (role === 'TECNICO' ? `${lista.length} consultas de cobro fueron respondidas.` : `${lista.length} técnicos preguntan el cobro de un recableado.`);
          setToastMsg({ type, text: texto, duration: 9000 });
          onNotify?.({ type, text: texto, ...(lista.length === 1 && { ticketId: lista[0].id }) });
          (role === 'TECNICO' ? playAprobadoSound : playTecnicoStatusSound)();
        }
      }
      // Escalar a infraestructura: la oficina se entera de lo que escaló un técnico; el técnico, de lo que escaló la oficina y de lo que se resolvió.
      if (role === 'ADMIN' || role === 'USUARIO' || role === 'TECNICO') {
        const { escaladas, resueltas } = cambiosInfraestructura(loadedTickets, infraestructuraAnteriorRef.current);
        const delTecnico = escaladas.filter((t) => infraestructuraDe(t).origen === ORIGEN_TECNICO);
        const delaOficina = escaladas.filter((t) => infraestructuraDe(t).origen === ORIGEN_OFICINA);
        const avisos = role === 'TECNICO'
          ? [{ lista: delaOficina, textoUno: textoEscaladaTecnico, textoVarios: (n) => `${n} órdenes fueron escaladas a infraestructura. Ya no tienes que atenderlas por ahora.` },
            { lista: resueltas, textoUno: textoResueltaTecnico, textoVarios: (n) => `${n} órdenes salieron de infraestructura. Revisa tu lista.` }]
          : [{ lista: delTecnico, textoUno: textoEscaladaOficina, textoVarios: (n) => `Los técnicos escalaron ${n} órdenes a infraestructura.` }];
        for (const { lista, textoUno, textoVarios } of avisos) {
          if (lista.length === 0) continue;
          const texto = lista.length === 1 ? textoUno(lista[0]) : textoVarios(lista.length);
          setToastMsg({ type: 'infraestructura', text: texto, duration: 9000 });
          onNotify?.({ type: 'infraestructura', text: texto, ...(lista.length === 1 && { ticketId: lista[0].id }) });
          (role === 'TECNICO' ? playDevueltaSound : playTecnicoStatusSound)();
        }
      }
      infraestructuraAnteriorRef.current = mapaInfraestructura(loadedTickets);
      consultaAnteriorRef.current = mapaConsultas(loadedTickets);
      viajeAnteriorRef.current = mapaViaje(loadedTickets);
      estadoAnteriorRef.current = new Map(loadedTickets.map(t => [t.id, t.estado]));
      activasVistasRef.current = new Map(loadedTickets.filter(esActiva).map(t => [t.id, { id: t.id, codigo: t.codigo, nombre: t.nombre }]));
      ubicacionAnteriorRef.current = new Map(loadedTickets.map(t => [t.id, t.ubicacion ? 1 : '']));
      prioridadAnteriorRef.current = mapaPrioridad(loadedTickets);
      guardarBaseline(currentUserRef.current, estadoAnteriorRef.current, ubicacionAnteriorRef.current, prioridadAnteriorRef.current);
    }, (error) => {
      console.error('No se pudo cargar tickets:', error);
      setToastMsg({ type: 'error', text: 'No se pudieron cargar las órdenes.' });
    });
    return () => {
      unsubTickets();
      // Otra sesión (otro usuario en el mismo teléfono) no debe heredar este punto de partida:
      // la siguiente lectura lo vuelve a cargar del almacenamiento del usuario que corresponda.
      estadoAnteriorRef.current = null;
      ubicacionAnteriorRef.current = null;
      prioridadAnteriorRef.current = null;
      activasVistasRef.current = new Map();
      viajeAnteriorRef.current = null;
      consultaAnteriorRef.current = null;
      infraestructuraAnteriorRef.current = null;
    };
  }, [firebaseUser, role, tecnicoAsociado, setToastMsg, onNotify]);

  // Una venta que cargó una promotora con el técnico de la plantilla llega asignada pero sin número ("IS"): los contadores son
  // de la oficina. La primera sesión de ADMIN/USUARIO que la ve la numera (en una transacción: si otra la numeró antes, se
  // reutiliza ese código) y le avisa al técnico, como al asignarla desde Nueva Asignación. No consume el turno: es venta suya.
  const numerarVentaRef = useRef(null);
  useEffect(() => {
    numerarVentaRef.current = async (t) => {
      const fecha = t.createdAt ? new Date(t.createdAt) : new Date();
      // Varias sesiones de la oficina ven la venta a la vez: solo la que le puso el número deja la línea en el historial
      // y avisa al técnico; las demás reutilizan el código sin repetir ninguna de las dos cosas.
      let reutilizada = false;
      const guardada = await guardarConNumeracion(tickets, t.id, t.codigo, t.tipoTrabajo, t.tecnico, fecha, (codigo, yaNumerada) => {
        reutilizada = Boolean(yaNumerada);
        if (yaNumerada) return { ...t, codigo };
        return {
          ...t,
          codigo,
          historialEdiciones: [...(t.historialEdiciones || []), {
            fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
            operador: currentUserRef.current || 'OPERADOR',
            detalle: `Cód: ${codigo} | ${lineaTecnico('', t.tecnico)} | Venta cargada por ${t.creadoNombre || t.creado || 'la promotora'} con el técnico de su plantilla`,
          }],
        };
      }, t);
      if (!reutilizada) notifyTicketChange(null, guardada);
    };
  });
  const ventasNumeradasRef = useRef(new Set());
  useEffect(() => {
    if (!firebaseUser || !ticketsCargados || (role !== 'ADMIN' && role !== 'USUARIO')) return;
    for (const t of tickets) {
      if (!esVentaPorNumerar(t) || ventasNumeradasRef.current.has(t.id)) continue;
      ventasNumeradasRef.current.add(t.id);
      numerarVentaRef.current(t).catch((err) => { ventasNumeradasRef.current.delete(t.id); console.error('No se pudo numerar la venta:', err); });
    }
  }, [firebaseUser, ticketsCargados, role, tickets]);

  // Para los formularios: si el código escrito a mano se salta números (ej. "AO150"
  // cuando va por AO15), devuelve { codigo, ultimo, esperado } para pedir confirmación.
  // `ticketId` (al editar): no avisa si el código no cambió. Si no se puede consultar el
  // contador, no bloquea el guardado.
  const verificarCodigoManual = async (tipoTrabajo, codigo, ticketId = null) => {
    const limpio = (codigo || '').trim().toUpperCase();
    const original = ticketId ? tickets.find(t => t.id === ticketId) : null;
    if (!limpio || (original && (original.codigo || '').toUpperCase() === limpio)) return null;
    const fecha = original?.createdAt ? new Date(original.createdAt) : new Date();
    try {
      return await detectarSaltoManual(db, appId, tickets, tipoTrabajo, limpio, fecha);
    } catch (err) {
      console.error('No se pudo verificar el código manual:', err);
      return null;
    }
  };

  // Evita que un doble clic en "Crear" genere dos órdenes (y gaste dos números).
  const creandoRef = useRef(false);

  // Devuelve false si falta el teléfono (el llamador deja el formulario abierto para no perder lo escrito).
  const createTicket = async (formData) => {
    if (!firebaseUser || creandoRef.current) return;
    // Toda orden lleva el teléfono del cliente: el formulario lo exige y aquí se vuelve a comprobar.
    if (!tieneTelefono(formData.telefono)) {
      setToastMsg({ type: 'error', text: MENSAJE_TELEFONO_OBLIGATORIO });
      return false;
    }
    // Toda instalación lleva su promotor (si no, ninguna promotora la vería): el formulario lo exige y aquí se vuelve a comprobar.
    if (formData.tipoTrabajo?.toUpperCase().includes('INSTAL') && !claveNombre(formData.promotora)) {
      setToastMsg({ type: 'error', text: MENSAJE_PROMOTOR_OBLIGATORIO });
      return false;
    }
    // Garantía de otro técnico: con el check marcado hace falta la orden original, de un técnico distinto.
    const errorDeGarantia = errorGarantia(formData.garantiaDe, { tecnico: formData.tecnico });
    if (errorDeGarantia) {
      setToastMsg({ type: 'error', text: errorDeGarantia });
      return false;
    }
    creandoRef.current = true;
    try {
      return await crearTicketSinGuardia(formData);
    } finally {
      creandoRef.current = false;
    }
  };

  const crearTicketSinGuardia = async (formData) => {
    const finalFalla = formData.falla.trim() === '' ? formData.tipoTrabajo : formData.falla;
    // Id automático de Firestore: con Date.now() dos órdenes creadas en el mismo
    // milisegundo compartían id y la segunda pisaba a la primera.
    const newId = doc(collection(db, 'artifacts', appId, 'public', 'data', 'tickets')).id;

    // Código manual (si el usuario lo escribió) tiene prioridad y no consume el contador automático.
    const codigoManual = (formData.codigo || '').trim();
    const esInstalacion = formData.tipoTrabajo?.toUpperCase().includes('INSTAL');
    const tieneTecnico = Boolean(formData.tecnico && formData.tecnico.trim());
    const { ventaTecnico, garantiaDe, ...datosOrden } = formData;
    // La promotora de una instalación (sale de la plantilla): se guarda con una clave para que cada promotora vea las suyas.
    const datosPromotora = esInstalacion ? { promotora: nombrePromotora(formData.promotora), promotoraClave: claveNombre(formData.promotora) } : {};
    const armarTicket = (codigo) => ({
      ...datosOrden,
      nombre: nombrePersona(formData.nombre),
      direccion: direccionCliente(formData.direccion),
      ...datosPromotora,
      ...(ventaTecnico ? { ventaTecnico } : {}),
      ...(garantiaDe?.id ? { garantiaDe } : {}),
      ubicacion: normalizarUbicacion(formData.ubicacion).valor || '',
      napCoordenadas: normalizarCoordenadasNap(formData.napCoordenadas).valor || '',
      falla: finalFalla,
      codigo,
      creado: currentUser,
      // El nombre real de quien la crea: la plantilla lo muestra como operador, también a quienes no pueden leer la lista de usuarios.
      creadoNombre: currentUserName || currentUser,
      createdAt: Date.now(),
      // Si ya nace con técnico, queda anotado quién se la asignó y cuándo.
      historialEdiciones: tieneTecnico ? [{ fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }), operador: currentUser || 'OPERADOR', detalle: lineaTecnico('', formData.tecnico.trim()) }] : [],
      isAsignado: false,
    });
    const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'tickets', newId);

    let newTicket;
    if (codigoManual || (esInstalacion && !tieneTecnico)) {
      // "IS" — sin número mientras no tenga técnico; o código manual, que no consume el contador.
      const codigo = codigoManual ? codigoManual.toUpperCase() : generarCodigoBase(formData.tipoTrabajo);
      newTicket = armarTicket(codigo);
      await setDoc(ticketRef, newTicket);

      // Si el código se escribió a mano y sigue el patrón automático (ej. "AS4"),
      // el próximo automático debe continuar desde ahí, no ignorar lo tecleado.
      if (codigoManual) {
        sincronizarCorrelativoManual(db, appId, formData.tipoTrabajo, codigo).catch(
          (err) => console.error('No se pudo sincronizar el correlativo manual:', err)
        );
      }
    } else {
      // ej. "IS1" (instalación con técnico) / "AS184" / "VS12": el número y la orden
      // se guardan en una sola transacción, así un fallo no deja un salto en el correlativo.
      await generarCorrelativoConCatchUp(tickets, formData.tipoTrabajo, new Date(), (transaction, codigo) => {
        newTicket = armarTicket(codigo);
        transaction.set(ticketRef, newTicket);
      });
    }

    setToastMsg({ type: 'success', text: 'Orden creada exitosamente.' });
    const creada = { id: newId, ...newTicket };
    notifyTicketChange(null, creada);
    return creada;
  };

  // Devuelve false si la validación rechazó el guardado (el llamador debe dejar
  // el formulario abierto para no perder lo que se escribió).
  // `base`: la orden como estaba al abrir Editar. Solo se guarda lo que cambió
  // respecto a ella; sin `base` se compara con la versión más reciente.
  const updateTicket = async (editingTicket, base = null) => {
    if (!firebaseUser || !editingTicket) return false;

    if (role === 'TECNICO' && editingTicket.estado === 'FINALIZADO') {
      setToastMsg({ type: 'error', text: 'Los técnicos solo pueden marcar órdenes como pre-finalizadas.' });
      return false;
    }

    if (role === 'TECNICO' && editingTicket.estado === 'PRE-FINALIZADO' && !(editingTicket.observacionTecnico || editingTicket.observacion || '').trim()) {
      setToastMsg({ type: 'error', text: 'Debes describir el trabajo realizado antes de pre-finalizar.' });
      return false;
    }

    // Toda orden lleva el teléfono del cliente. Los técnicos no lo editan, así que no se les exige.
    if (role !== 'TECNICO' && !tieneTelefono(editingTicket.telefono)) {
      setToastMsg({ type: 'error', text: MENSAJE_TELEFONO_OBLIGATORIO });
      return false;
    }

    // Lo mismo al editar una instalación (la oficina): también las viejas sin promotor deben completarse.
    if (role !== 'TECNICO' && esInstalacion(editingTicket.tipoTrabajo) && !promotoraDeOrden(editingTicket)) {
      setToastMsg({ type: 'error', text: MENSAJE_PROMOTOR_OBLIGATORIO });
      return false;
    }

    if (role !== 'TECNICO') {
      const errorDeGarantia = errorGarantia(editingTicket.garantiaDe, { tecnico: editingTicket.tecnico });
      if (errorDeGarantia) {
        setToastMsg({ type: 'error', text: errorDeGarantia });
        return false;
      }
    }

    const potencia = parsePotencia(editingTicket.potenciaDbm);
    if (potencia.error) {
      setToastMsg({ type: 'error', text: `Potencia óptica: ${potencia.error}` });
      return false;
    }

    const ubicacion = normalizarUbicacion(editingTicket.ubicacion);
    if (ubicacion.error) {
      setToastMsg({ type: 'error', text: `Ubicación: ${ubicacion.error}` });
      return false;
    }

    const napCoordenadas = normalizarCoordenadasNap(editingTicket.napCoordenadas);
    if (napCoordenadas.error) {
      setToastMsg({ type: 'error', text: `Coordenadas NAP: ${napCoordenadas.error}` });
      return false;
    }

    const originalTicket = base || tickets.find(t => t.id === editingTicket.id);

    // Finalizar siempre pasa por "Finalizar" o "Aprobar" de la lista: ahí se elige el cobro resultante.
    if (editingTicket.estado === 'FINALIZADO' && originalTicket?.estado !== 'FINALIZADO') {
      setToastMsg({ type: 'error', text: 'Para finalizar una orden usa "Finalizar" o "Aprobar" en la lista: ahí se elige el cobro resultante.' });
      return false;
    }

    // Un técnico no pre-finaliza una instalación por aquí sin los datos obligatorios: se llenan con
    // el botón "Pre-finalizar" (que los pide).
    if (role === 'TECNICO' && editingTicket.estado === 'PRE-FINALIZADO' && originalTicket?.estado !== 'PRE-FINALIZADO'
      && esInstalacion(editingTicket.tipoTrabajo) && (!instalacionCompleta(editingTicket) || errorConectoresInstalacion(editingTicket.instalacion?.conectores) || errorSerialCaja(editingTicket.instalacion?.serial))) {
      setToastMsg({ type: 'error', text: 'En una instalación llena el serial, la VLAN, la NAP, el puerto, el metraje del drop, la posteadura, los puertos disponibles y los conectores usados con el botón "Pre-finalizar".' });
      return false;
    }

    // Cancelar una orden pide el motivo (se ve en la lista, el historial, ventas y los reportes).
    if (cancelaAhora(originalTicket, editingTicket)) {
      const motivo = parseMotivoCancelacion(editingTicket.motivoCancelacion);
      if (motivo.error) {
        setToastMsg({ type: 'error', text: motivo.error });
        return false;
      }
    }

    const ticketFecha = originalTicket?.createdAt ? new Date(originalTicket.createdAt) : new Date();

    const armarTicket = (codigo) => {
      const ticketToSave = { ...editingTicket, nombre: nombrePersona(editingTicket.nombre), direccion: direccionCliente(editingTicket.direccion), codigo, potenciaDbm: potencia.valor ?? null, ubicacion: ubicacion.valor || '', napCoordenadas: napCoordenadas.valor || '' };
      // Otra cédula es otro cliente: la OLT guardada ya no vale (se vuelve a llenar al buscarlo o al aprobar o finalizar la orden).
      if (originalTicket?.olt && soloDigitos(originalTicket.cedula) !== soloDigitos(editingTicket.cedula)) ticketToSave.olt = '';
      // Sin el check de garantía (o sin original elegida) la orden no lleva ese campo.
      if (!ticketToSave.garantiaDe?.id) delete ticketToSave.garantiaDe;
      // Fecha en que se finalizó (la usa el módulo de materiales para filtrar por período).
      if (editingTicket.estado === 'FINALIZADO' && originalTicket?.estado !== 'FINALIZADO') ticketToSave.finalizadoEn = Date.now();
      // Si la orden deja de estar pendiente, el viaje "en camino" / "en sitio" termina.
      if (originalTicket?.enCamino && editingTicket.estado !== 'PENDIENTE') ticketToSave.enCamino = null;
      // Motivo de la cancelación (con quién y cuándo); si la orden no está cancelada no queda ningún motivo escrito a medias en el formulario.
      const cancelacion = camposCancelacion(originalTicket, ticketToSave, { por: currentUser });
      if (ticketToSave.estado !== ESTADO_CANCELADO && !('motivoCancelacion' in cancelacion)) delete ticketToSave.motivoCancelacion;
      Object.assign(ticketToSave, cancelacion);
      // Promotora de la instalación: la escrita o, si se vacía, la que dice la plantilla.
      if (role !== 'TECNICO' && esInstalacion(editingTicket.tipoTrabajo)) {
        ticketToSave.promotora = promotoraDeOrden(editingTicket);
        ticketToSave.promotoraClave = claveNombre(ticketToSave.promotora);
      }
      // Si la oficina corrige una instalación ya finalizada, la plantilla guardada se rehace con lo corregido.
      if (ticketToSave.estado === 'FINALIZADO') Object.assign(ticketToSave, plantillaFinalDe(ticketToSave));
      if (originalTicket) {
        let cambios = [];
        if (originalTicket.estado !== editingTicket.estado) cambios.push(`Estado: ${editingTicket.estado}`);
        if (ticketToSave.estado === ESTADO_CANCELADO && (originalTicket.motivoCancelacion || '') !== (ticketToSave.motivoCancelacion || '')) cambios.push(lineaMotivoCancelacion(motivoCancelacion(ticketToSave)));
        if (originalTicket.tecnico !== editingTicket.tecnico) cambios.push(lineaTecnico(originalTicket.tecnico, editingTicket.tecnico));
        if (originalTicket.tipoTrabajo !== editingTicket.tipoTrabajo) cambios.push(`Trabajo: ${editingTicket.tipoTrabajo}`);
        if (originalTicket.fechaProgramada !== editingTicket.fechaProgramada) cambios.push(`Prog: ${editingTicket.fechaProgramada || 'Ninguna'}`);
        if (originalTicket.codigo !== ticketToSave.codigo) cambios.push(`Cód: ${ticketToSave.codigo}`);
        if (originalTicket.observacion !== editingTicket.observacion) cambios.push(`Obs. modificada`);
        if ((originalTicket.observacionTecnico || '') !== (editingTicket.observacionTecnico || '')) cambios.push('Obs. del técnico modificada');
        if (!String(originalTicket.plantillaOriginal || '').trim() && String(editingTicket.plantillaOriginal || '').trim()) cambios.push('Plantilla de la promotora pegada');
        if (esInstalacion(editingTicket.tipoTrabajo) && promotoraDeOrden(originalTicket) !== ticketToSave.promotora) cambios.push(`Promotor: ${ticketToSave.promotora || 'Vacío'}`);
        if (originalTicket.nap !== editingTicket.nap) cambios.push(`NAP: ${editingTicket.nap || 'Vacío'}`);
        if ((originalTicket.garantiaDe?.id || '') !== (ticketToSave.garantiaDe?.id || '')) cambios.push(ticketToSave.garantiaDe?.id ? `Garantía de otro técnico: ${ticketToSave.garantiaDe.codigo} (${ticketToSave.garantiaDe.tecnico})` : 'Garantía de otro técnico quitada');
        // Lo que cargó el técnico y la oficina corrigió (serial, VLAN, metraje, conectores, tipo de visita...).
        cambios.push(...cambiosDatosTecnico(originalTicket, ticketToSave));
        if ((originalTicket.ubicacion || '') !== ticketToSave.ubicacion) cambios.push('Ubicación modificada');
        if ((originalTicket.napCoordenadas || '') !== ticketToSave.napCoordenadas) cambios.push(`Coord. NAP: ${ticketToSave.napCoordenadas || 'Vacías'}`);
        if ((originalTicket.potenciaDbm ?? null) !== ticketToSave.potenciaDbm) cambios.push(`Potencia: ${ticketToSave.potenciaDbm ?? 'Vacía'}${ticketToSave.potenciaDbm != null ? ' dBm' : ''}`);

        if (cambios.length > 0) {
          const nuevaEdicion = {
            fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
            operador: currentUser || 'OPERADOR',
            detalle: cambios.join(' | ')
          };
          ticketToSave.historialEdiciones = [...(originalTicket.historialEdiciones || []), nuevaEdicion];
        }
      }
      // Las horas del ciclo (asignación, salida, llegada, pre-finalización) para el reporte de esperas.
      Object.assign(ticketToSave, camposTiempos(originalTicket, ticketToSave));
      return ticketToSave;
    };

    // Si esta edición cambia el estado (por ejemplo, cancelar), la orden debe seguir en el estado en que se abrió: si otra persona ya la
    // finalizó o la canceló, no se pisa.
    const verificarCambioDeEstado = originalTicket && editingTicket.estado !== originalTicket.estado
      ? verificarEstado([originalTicket.estado])
      : null;
    let ticketToSave;
    try {
      ticketToSave = await guardarConNumeracion(
        tickets,
        editingTicket.id,
        editingTicket.codigo,
        editingTicket.tipoTrabajo,
        editingTicket.tecnico,
        ticketFecha,
        armarTicket,
        originalTicket || null,
        verificarCambioDeEstado
      );
    } catch (error) {
      if (error instanceof ConflictoOrdenError) {
        setToastMsg({ type: 'error', duration: 12000, text: error.message });
        return false;
      }
      throw error;
    }

    // Corrección manual del código (no la generada arriba): sincroniza el contador también.
    if (originalTicket && originalTicket.codigo !== editingTicket.codigo && ticketToSave.codigo === editingTicket.codigo) {
      sincronizarCorrelativoManual(db, appId, editingTicket.tipoTrabajo, editingTicket.codigo, ticketFecha).catch(
        (err) => console.error('No se pudo sincronizar el correlativo manual:', err)
      );
    }

    setToastMsg({ type: 'success', text: 'Orden actualizada correctamente.' });
    notifyTicketChange(originalTicket, ticketToSave);
    return true;
  };

  // Guarda solo la ubicación (pegado rápido desde la fila, sin abrir Editar).
  const guardarUbicacion = async (ticket, valor) => {
    if (!firebaseUser || !ticket) return false;
    const ubicacion = normalizarUbicacion(valor);
    if (!ubicacion.valor) {
      setToastMsg({ type: 'error', text: ubicacion.error || 'Escribe o pega una ubicación.' });
      return false;
    }
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'OPERADOR',
      tipo: 'ubicacion',
      detalle: ticket.ubicacion ? 'Ubicación modificada' : 'Ubicación agregada'
    };
    const updatedTicket = {
      ...ticket,
      ubicacion: ubicacion.valor,
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };
    if (updatedTicket.estado === 'FINALIZADO') Object.assign(updatedTicket, plantillaFinalDe(updatedTicket));
    await actualizarTicket(ticket, updatedTicket);
    setToastMsg({ type: 'success', text: 'Ubicación guardada.' });
    notifyTicketChange(ticket, updatedTicket);
    return true;
  };

  // `montoBs`: cobro que se le informa al técnico en este momento (solo con conector interno); se deja en el historial.
  // `instalacion`: serial, VLAN, posteadura, NAP y puerto que llena el técnico al instalar (ver utils/instalacion).
  const preFinalizarTicket = async (ticket, { nap, observacionTecnico, potenciaDbm, potencia1490Dbm, tipoVisita, metrosCable, conectorExterno, conectorInterno, conectoresUsados, serialEquipo, tipoEquipoNuevo, montoBs, instalacion } = {}) => {
    if (!firebaseUser || !ticket) return;

    if (!(observacionTecnico || '').trim()) {
      setToastMsg({ type: 'error', text: 'Debes describir el trabajo realizado antes de pre-finalizar.' });
      return false;
    }

    // El tipo de visita es obligatorio (menos en instalaciones) y, con conector externo o drop atenuado, también la NAP y el puerto.
    const errorVisita = errorTipoVisita(ticket.tipoTrabajo, tipoVisita) || errorNapPuertoVisita(tipoVisita, nap);
    if (errorVisita) {
      setToastMsg({ type: 'error', text: errorVisita });
      return false;
    }

    // Recableado: los metros de cable son obligatorios (los conectores no).
    if (tipoVisita === TIPO_RECABLEADO && !(Number.isInteger(metrosCable) && metrosCable >= 1)) {
      setToastMsg({ type: 'error', text: 'Indica los metros de cable usados en el recableado.' });
      return false;
    }

    // Visita de conector: la cantidad de conectores usados (verdes y/o azules) es obligatoria.
    const errorCantidades = errorCantidadesConector(tipoVisita, conectoresUsados);
    if (errorCantidades) {
      setToastMsg({ type: 'error', text: errorCantidades });
      return false;
    }

    // Cambio de equipo: el serial del equipo nuevo es obligatorio.
    const serialEquipoParseado = esCambioEquipo(tipoVisita) ? parseSerialEquipo(serialEquipo) : null;
    const errorSerialEquipo = serialEquipoParseado?.error || (serialEquipoParseado ? errorSerialCaja(serialEquipo) : '');
    if (errorSerialEquipo) {
      setToastMsg({ type: 'error', text: errorSerialEquipo });
      return false;
    }
    // Cambio de equipo: el tipo del equipo nuevo (MRTV, MTV, MR o SM) también es obligatorio.
    const errorTipoEquipo = errorTipoEquipoNuevo(tipoVisita, tipoEquipoNuevo);
    if (errorTipoEquipo) {
      setToastMsg({ type: 'error', text: errorTipoEquipo });
      return false;
    }

    // Instalación: el serial, la VLAN, al menos un poste, la NAP y el puerto son obligatorios. El serial, además, debe ser el
    // de la etiqueta (PON S/N o GPON...): el envío al inventario del almacén falla con una MAC o un "GOPN" mal escrito.
    const reporteInstalacion = esInstalacion(ticket.tipoTrabajo) ? validarInstalacion(instalacion || {}) : null;
    if (reporteInstalacion?.error) {
      setToastMsg({ type: 'error', text: Object.values(reporteInstalacion.errores)[0] });
      return false;
    }
    const errorSerialInstalacion = reporteInstalacion ? errorSerialCaja(instalacion?.serial) : '';
    if (errorSerialInstalacion) {
      setToastMsg({ type: 'error', text: errorSerialInstalacion });
      return false;
    }
    if (reporteInstalacion && !instalacionCompleta({ instalacion })) {
      setToastMsg({ type: 'error', text: 'En una instalación indica la NAP y el puerto.' });
      return false;
    }
    // Los conectores usados (externos e internos, por color) son obligatorios en una instalación nueva.
    const errorConectoresInst = reporteInstalacion ? errorConectoresInstalacion(instalacion?.conectores) : '';
    if (errorConectoresInst) {
      setToastMsg({ type: 'error', text: errorConectoresInst });
      return false;
    }
    const datosInstalacion = reporteInstalacion
      ? { ...reporteInstalacion.datos, conectores: normalizarConectoresInstalacion(instalacion?.conectores) }
      : null;

    // Los datos de metros y conectores solo se escriben si el tipo de visita los lleva o si hay que
    // borrar los de una visita anterior; así las demás visitas no suman campos vacíos a la orden.
    const camposConectores = tipoVisita !== undefined && (llevaConectores(tipoVisita) || tieneDatosRecableado(ticket) || ticket.conectoresUsados)
      ? datosConectores(tipoVisita, { metros: metrosCable, conectorExterno, conectorInterno, conectores: conectoresUsados })
      : {};

    // El serial del equipo nuevo solo se escribe en un cambio de equipo, o para borrar uno anterior.
    const camposSerialEquipo = tipoVisita !== undefined && (esCambioEquipo(tipoVisita) || ticket.serialEquipo)
      ? datosSerialEquipo(tipoVisita, serialEquipo, tipoEquipoNuevo)
      : {};

    let detalle = 'Marcado como PRE-FINALIZADO';
    detalle += ` | Obs: ${observacionTecnico.trim()}`;
    if (nap && nap.trim()) detalle += ` | NAP: ${nap.trim()}`;
    detalle += detalleInstalacion(datosInstalacion);
    if (potenciaDbm != null) detalle += ` | Potencia: ${potenciaDbm} dBm`;
    if (potencia1490Dbm != null) detalle += ` | ONU Rx 1490 nm: ${potencia1490Dbm} dBm`;
    if (tipoVisita === TIPO_RECABLEADO) detalle += ` | Recableado: ${partesRecableado({ metrosCable, conectorExterno, conectorInterno }).join(', ')}`;
    else if (tipoVisita && ETIQUETA_TIPO_VISITA[tipoVisita]) {
      detalle += ` | ${ETIQUETA_TIPO_VISITA[tipoVisita]}`;
      const conector = textoConectorVisita({ tipoVisita, ...camposConectores });
      if (conector) detalle += ` | ${conector}`;
      if (serialEquipoParseado) detalle += ` | Equipo nuevo: ${tipoEquipoNuevo} | Serial del equipo nuevo: ${serialEquipoParseado.valor}`;
    }
    if (avisaCobroAlPreFinalizar(tipoVisita)) detalle += detalleCobro(montoBs, COBRO_VISITA, false);

    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'TÉCNICO',
      tipo: 'prefinalizado',
      detalle
    };

    const updatedTicket = {
      ...ticket,
      estado: 'PRE-FINALIZADO',
      nap: nap !== undefined ? nap : (ticket.nap || ''),
      potenciaDbm: potenciaDbm !== undefined ? potenciaDbm : (ticket.potenciaDbm ?? null),
      potencia1490Dbm: potencia1490Dbm !== undefined ? potencia1490Dbm : (ticket.potencia1490Dbm ?? null),
      // Lo que escribe el técnico va aparte: la observación de la oficina (`observacion`) no se toca.
      observacionTecnico: observacionTecnico.trim(),
      tipoVisita: tipoVisita !== undefined ? tipoVisita : (ticket.tipoVisita || ''),
      ...camposConectores,
      ...camposSerialEquipo,
      // `null` borra lo registrado antes si el técnico lo vació; solo se toca en una instalación.
      ...(reporteInstalacion ? { instalacion: datosInstalacion } : {}),
      // Al pre-finalizar termina el viaje: si la devuelven, el técnico vuelve a avisar que sale.
      ...(ticket.enCamino ? { enCamino: null } : {}),
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    await actualizarTicket(ticket, updatedTicket);
    setToastMsg({ type: 'success', text: datosInstalacion ? 'Orden marcada como Pre-finalizada. La plantilla ya lleva los datos de la instalación.' : 'Orden marcada como Pre-finalizada.' });
    notifyTicketChange(ticket, updatedTicket);
    return true;
  };

  // El técnico le pregunta a la oficina cuánto se cobra un recableado de `metros` m. Solo se guarda la consulta y se avisa a
  // la oficina; la respuesta la escribe ella (ver responderConsultaCobro).
  const consultarCobroRecableado = async (ticket, metros) => {
    if (!firebaseUser || !ticket) return false;
    if (!Number.isInteger(metros) || metros < 1) {
      setToastMsg({ type: 'error', text: 'Indica los metros de cable para consultar el cobro.' });
      return false;
    }
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'TÉCNICO',
      tipo: 'consultaCobro',
      detalle: `Consulta del cobro del recableado: ${metros} m`,
    };
    const updatedTicket = {
      ...ticket,
      consultaCobro: construirConsulta(metros, currentUser),
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion],
    };
    try {
      await actualizarTicket(ticket, updatedTicket);
    } catch (error) {
      console.error('No se pudo enviar la consulta del cobro:', error);
      setToastMsg({ type: 'error', text: 'No se pudo enviar la consulta. Revisa tu conexión e intenta de nuevo.' });
      return false;
    }
    avisarPush({
      target: { type: 'oficina' },
      title: 'Consulta de cobro',
      body: `${ticket.tecnico || 'Un técnico'} pregunta el cobro del recableado de ${ticket.codigo || 'una orden'} (${metros} m).`,
      tipo: 'consultaCobro',
      ticketId: ticket.id,
    });
    setToastMsg({ type: 'success', text: 'Consulta enviada a la oficina. Te avisaremos con la respuesta.' });
    return true;
  };

  // La oficina responde el cobro que preguntó el técnico: un monto (en Bs o $) o exonerado. Al técnico le llega un aviso.
  const responderConsultaCobro = async (ticket, seleccion) => {
    if (!firebaseUser || !ticket) return false;
    const { respuesta, error } = construirRespuesta(ticket.consultaCobro, seleccion, currentUser);
    if (error) {
      setToastMsg({ type: 'error', text: error });
      return false;
    }
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'OFICINA',
      tipo: 'respuestaCobro',
      detalle: `Cobro del recableado (${respuesta.metros} m): ${textoRespuesta(respuesta)}`,
    };
    const updatedTicket = {
      ...ticket,
      respuestaCobro: respuesta,
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion],
    };
    try {
      await actualizarTicket(ticket, updatedTicket);
    } catch (error) {
      console.error('No se pudo guardar la respuesta del cobro:', error);
      setToastMsg({ type: 'error', text: 'No se pudo guardar la respuesta. Intenta de nuevo.' });
      return false;
    }
    if (ticket.tecnico) {
      avisarPush({
        target: { type: 'tecnico', name: ticket.tecnico },
        title: 'Cobro del recableado',
        body: `${ticket.codigo || 'Orden'} (${respuesta.metros} m): ${textoRespuesta(respuesta)}.`,
        tipo: 'respuestaCobro',
        ticketId: ticket.id,
      });
    }
    setToastMsg({ type: 'success', text: 'Respuesta enviada al técnico.' });
    return true;
  };

  // `montoBs`: cobro de la visita ya formateado (ej. "5.696"); solo se guarda en
  // órdenes con tipo de visita, para que el técnico lo vea al aprobarse.
  const aprobarFinalizarTicket = async (ticket, { montoBs, cobroTipo, cobroMoneda } = {}) => {
    if (!firebaseUser || !ticket) return;

    // Los valores del cliente son obligatorios; se leen de la orden más reciente, no de la copia que abrió el modal
    // (que no incluye lo que acaba de guardar).
    ticket = tickets.find(t => t.id === ticket.id) || ticket;
    if (exigeValoresCliente(ticket) && !valoresGuardados(ticket)) {
      setToastMsg({ type: 'error', text: 'Guarda los valores del cliente antes de cerrar la orden.' });
      return false;
    }

    const exonerado = llevaCobro(ticket) && cobroTipo === COBRO_EXONERADO;
    const cobroBs = llevaCobro(ticket) && !exonerado && montoBs ? montoBs : null;
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'ADMIN',
      tipo: 'aprobado',
      detalle: `Aprobado y marcado como FINALIZADO${detalleCobro(cobroBs, cobroTipo, exonerado, cobroMoneda)}`
    };

    const updatedTicket = {
      ...ticket,
      estado: 'FINALIZADO',
      finalizadoEn: Date.now(),
      // La plantilla final de una instalación queda guardada para que el cierre del día la pase al historial de las promotoras.
      ...plantillaFinalDe(ticket),
      // `cobroTipo` se escribe siempre que hay decisión de cobro, para no arrastrar una exoneración vieja.
      ...camposCobro({ exonerado, cobroBs, cobroTipo, moneda: cobroMoneda }),
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    if (!(await guardarConGuardia(ticket, updatedTicket, verificarEstado(['PRE-FINALIZADO'])))) return false;
    setToastMsg({ type: 'success', text: 'Orden aprobada y finalizada con éxito.' });
    notifyTicketChange(ticket, updatedTicket);
    enviarAlInventario(updatedTicket);
    completarOlt(updatedTicket);
    return true;
  };

  // El admin regresa una orden PRE-FINALIZADA al técnico con un motivo: vuelve a
  // PENDIENTE y el técnico recibe el aviso (push + in-app).
  const devolverTicket = async (ticket, motivo) => {
    if (!firebaseUser || !ticket) return;
    const motivoLimpio = (motivo || '').trim();
    if (!motivoLimpio) {
      setToastMsg({ type: 'error', text: 'Escribe el motivo de la devolución.' });
      return false;
    }

    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'ADMIN',
      tipo: 'devuelto',
      detalle: `Devuelta al técnico | Motivo: ${motivoLimpio}`,
      motivo: motivoLimpio
    };

    const updatedTicket = {
      ...ticket,
      estado: 'PENDIENTE',
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    if (!(await guardarConGuardia(ticket, updatedTicket, verificarEstado(['PRE-FINALIZADO'])))) return false;
    setToastMsg({ type: 'success', text: 'Orden devuelta al técnico.' });
    notifyTicketChange(ticket, updatedTicket);
    return true;
  };

  // Cierre directo de una orden PENDIENTE desde la tabla, sin pasar por el
  // formulario de edición ni por la pre-finalización del técnico.
  const finalizarTicket = async (ticket, { montoBs, cobroTipo, cobroMoneda } = {}) => {
    if (!firebaseUser || !ticket) return;

    // Los valores del cliente son obligatorios; se leen de la orden más reciente, no de la copia que abrió el modal
    // (que no incluye lo que acaba de guardar).
    ticket = tickets.find(t => t.id === ticket.id) || ticket;
    if (exigeValoresCliente(ticket) && !valoresGuardados(ticket)) {
      setToastMsg({ type: 'error', text: 'Guarda los valores del cliente antes de cerrar la orden.' });
      return false;
    }

    const exonerado = llevaCobro(ticket) && cobroTipo === COBRO_EXONERADO;
    const cobroBs = llevaCobro(ticket) && !exonerado && montoBs ? montoBs : null;
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'OPERADOR',
      tipo: 'finalizado',
      detalle: `Marcado como FINALIZADO${detalleCobro(cobroBs, cobroTipo, exonerado, cobroMoneda)}`
    };

    const updatedTicket = {
      ...ticket,
      estado: 'FINALIZADO',
      finalizadoEn: Date.now(),
      // La plantilla final de una instalación queda guardada para que el cierre del día la pase al historial de las promotoras.
      ...plantillaFinalDe(ticket),
      ...camposCobro({ exonerado, cobroBs, cobroTipo, moneda: cobroMoneda }),
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    if (!(await guardarConGuardia(ticket, updatedTicket, verificarEstado(['PENDIENTE'], (actual) => !enInfraestructura(actual))))) return false;
    setToastMsg({ type: 'success', text: 'Orden finalizada.' });
    notifyTicketChange(ticket, updatedTicket);
    enviarAlInventario(updatedTicket);
    completarOlt(updatedTicket);
    return true;
  };

  // La oficina guarda los valores de señal del cliente (OLT Rx 1310 nm y ONU Rx 1490 nm) antes de aprobar o
  // finalizar; el técnico los ve con el cobro. `valores` ya viene validado por parseValoresCliente: aquí se
  // vuelve a validar. Devuelve lo guardado (con quién y cuándo) o null si no se pudo.
  const guardarValoresCliente = async (ticket, valores) => {
    if (!firebaseUser || !ticket || !ofreceValoresCliente(ticket)) return null;
    const revisado = parseValoresCliente({ olt: String(valores?.olt1310Dbm ?? ''), onu: String(valores?.onu1490Dbm ?? '') });
    if (!revisado.valor) {
      setToastMsg({ type: 'error', text: 'Revisa los valores del cliente: ' + Object.values(revisado.errores).join(' ') });
      return null;
    }
    // Sobre la orden más reciente: así el historial no pisa entradas que se hayan agregado después de abrir el modal.
    const actual = tickets.find(t => t.id === ticket.id) || ticket;
    const valoresCliente = { ...revisado.valor, guardadoPor: currentUser || 'ADMIN', guardadoEn: Date.now() };
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'ADMIN',
      tipo: 'valores',
      detalle: `Valores del cliente guardados | ${detalleValoresCliente(valoresCliente)}`
    };
    await actualizarTicket(actual, { ...actual, valoresCliente, historialEdiciones: [...(actual.historialEdiciones || []), nuevaEdicion] });
    setToastMsg({ type: 'success', text: exigeValoresCliente(actual) ? 'Valores del cliente guardados. El técnico los verá con el cobro.' : 'Valores del cliente guardados.' });
    return valoresCliente;
  };


  // ADMIN/USUARIO marcan (o quitan) la prioridad alta de una orden pendiente. Al marcarla, el técnico
  // asignado recibe un aviso (push y en la app); si aún no tiene técnico, le llega marcada al asignarla.
  const togglePrioridad = async (ticket) => {
    if (!firebaseUser || !ticket) return;
    if (ticket.estado !== 'PENDIENTE') {
      setToastMsg({ type: 'error', text: 'Solo se puede dar prioridad a una orden pendiente.' });
      return;
    }

    const activar = !ticket.prioridadAlta;
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'OPERADOR',
      tipo: 'prioridad',
      detalle: activar ? 'Prioridad alta marcada' : 'Prioridad alta retirada'
    };

    const updatedTicket = {
      ...ticket,
      prioridadAlta: activar,
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    await actualizarTicket(ticket, updatedTicket);
    setToastMsg({
      type: 'success',
      text: !activar ? 'Prioridad alta retirada.'
        : ticket.tecnico ? `Prioridad alta marcada. Se le avisó a ${ticket.tecnico}.`
          : 'Prioridad alta marcada. Aún no tiene técnico: le llegará marcada cuando la asignes.'
    });
    notifyTicketChange(ticket, updatedTicket);
  };

  // --- Escalar a infraestructura (ver utils/infraestructura) ---
  // El técnico (en una orden suya) o la oficina dejan la orden esperando a infraestructura, con un motivo. Sigue PENDIENTE, pero sale de
  // la lista del técnico (la pantalla la oculta) y cae el aviso de "en camino". Quien no la escaló recibe el aviso.
  const escalarAInfraestructura = async (ticket, motivoEscrito) => {
    if (!firebaseUser || !ticket) return false;
    // Sobre la orden más reciente: si otro la escaló o la cerró mientras tanto, no se pisa.
    const actual = tickets.find(t => t.id === ticket.id) || ticket;
    if (!puedeEscalar(actual)) {
      setToastMsg({ type: 'error', text: enInfraestructura(actual) ? 'Esta orden ya está en infraestructura.' : 'Esta orden no se puede escalar a infraestructura.' });
      return false;
    }
    const motivo = parseMotivo(motivoEscrito);
    if (motivo.error) {
      setToastMsg({ type: 'error', text: motivo.error });
      return false;
    }
    const origen = role === 'TECNICO' ? ORIGEN_TECNICO : ORIGEN_OFICINA;
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || (origen === ORIGEN_TECNICO ? 'TÉCNICO' : 'OFICINA'),
      tipo: 'infraestructura',
      detalle: `Escalada a infraestructura | Motivo: ${motivo.valor}`,
    };
    const updatedTicket = {
      ...actual,
      infraestructura: construirEscalada({ motivo: motivo.valor, por: currentUser, origen, tecnico: actual.tecnico }),
      ...(actual.enCamino ? { enCamino: null } : {}),
      historialEdiciones: [...(actual.historialEdiciones || []), nuevaEdicion],
    };
    try {
      if (!(await guardarConGuardia(actual, updatedTicket, verificarEstado(['PENDIENTE'], puedeEscalar)))) return false;
    } catch (error) {
      console.error('No se pudo escalar la orden a infraestructura:', error);
      setToastMsg({ type: 'error', text: 'No se pudo escalar la orden. Revisa tu conexión e intenta de nuevo.' });
      return false;
    }
    if (origen === ORIGEN_TECNICO) {
      avisarPush({
        target: { type: 'oficina' },
        title: 'Escalada a infraestructura',
        body: `${actual.tecnico || 'Un técnico'} escaló la orden ${etiquetaOrden(actual)} a infraestructura: ${motivo.valor}`,
        tipo: 'infraestructura',
        ticketId: actual.id,
      });
      setToastMsg({ type: 'success', text: 'Orden escalada a infraestructura. La oficina ya lo sabe.' });
    } else {
      if (actual.tecnico) {
        avisarPush({
          target: { type: 'tecnico', name: actual.tecnico },
          title: 'Orden escalada a infraestructura',
          body: textoEscaladaTecnico(actual),
          tipo: 'infraestructura',
          ticketId: actual.id,
        });
      }
      setToastMsg({ type: 'success', text: actual.tecnico ? `Orden escalada a infraestructura. Se le avisó a ${actual.tecnico}.` : 'Orden escalada a infraestructura.' });
    }
    return true;
  };

  // La oficina resuelve una escalada: `devolver` la orden al técnico (sigue PENDIENTE y vuelve a su lista) o `cerrar` como trabajo
  // adicional (TA: se finaliza sin cobro y sin gastar material). `nota` es opcional y el técnico la lee al recibirla.
  // Para pasarla a otro técnico: devolverla y cambiar el técnico desde Editar (así se respeta la numeración del código).
  const resolverInfraestructura = async (ticket, { resultado, nota } = {}) => {
    if (!firebaseUser || !ticket) return false;
    const actual = tickets.find(t => t.id === ticket.id) || ticket;
    if (!enInfraestructura(actual)) {
      setToastMsg({ type: 'error', text: 'Esta orden ya no está esperando a infraestructura.' });
      return false;
    }
    const cerrar = resultado === RESULTADO_CERRADA;
    const infraestructura = construirResolucion(infraestructuraDe(actual), { resultado: cerrar ? RESULTADO_CERRADA : RESULTADO_DEVUELTA, por: currentUser, nota });
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'OFICINA',
      tipo: 'infraestructura',
      detalle: `${cerrar ? 'Cerrada como trabajo adicional de infraestructura (TA)' : 'Devuelta por infraestructura al técnico'}${infraestructura.nota ? ` | Nota: ${infraestructura.nota}` : ''}`,
    };
    const updatedTicket = {
      ...actual,
      infraestructura,
      ...(cerrar ? { estado: 'FINALIZADO', finalizadoEn: Date.now() } : {}),
      historialEdiciones: [...(actual.historialEdiciones || []), nuevaEdicion],
    };
    try {
      if (!(await guardarConGuardia(actual, updatedTicket, verificarEstado(['PENDIENTE'], enInfraestructura)))) return false;
    } catch (error) {
      console.error('No se pudo resolver la escalada a infraestructura:', error);
      setToastMsg({ type: 'error', text: 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.' });
      return false;
    }
    if (actual.tecnico) {
      avisarPush({
        target: { type: 'tecnico', name: actual.tecnico },
        title: cerrar ? 'Orden cerrada' : 'Orden de vuelta de infraestructura',
        body: textoResueltaTecnico(updatedTicket),
        tipo: 'infraestructura',
        ticketId: actual.id,
      });
    }
    setToastMsg({ type: 'success', text: cerrar ? 'Orden cerrada como trabajo adicional (TA).' : 'Orden devuelta al técnico.' });
    return true;
  };

  // --- "En camino" / "En sitio" (el técnico avisa a la oficina; ver utils/enCamino) ---
  // Guarda el cambio del viaje con su entrada en el historial. La oficina se entera por el listener de arriba
  // (sin push: los avisos a un técnico o a los aprobadores no llegan a un USUARIO normal).
  const guardarViaje = async (ticket, enCamino, detalle, tipo) => {
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'TÉCNICO',
      tipo,
      detalle
    };
    await actualizarTicket(ticket, {
      ...ticket,
      enCamino,
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    });
  };

  // "Estoy en camino": un viaje a la vez; si ya va hacia otra orden, primero debe llegar o cancelar.
  const iniciarEnCamino = async (ticket) => {
    if (!firebaseUser || !ticket) return false;
    const ahora = Date.now();
    if (!puedeIniciarViaje(ticket, ahora)) return false;
    // Seguro mientras se guarda el primer viaje: dos toques seguidos en órdenes distintas, antes de que la
    // lista se actualice, pasarían ambos por la revisión de abajo.
    if (iniciandoViajeRef.current.has(ticket.tecnico)) {
      setToastMsg({ type: 'error', duration: 7000, text: 'Ya estás avisando que vas en camino a otra orden. Espera un momento.' });
      return false;
    }
    const otra = viajeEnCursoDe(tickets, ticket.tecnico, ticket.id, ahora);
    if (otra) {
      setToastMsg({ type: 'error', duration: 7000, text: `Ya vas en camino a la orden ${otra.codigo || 'S/C'}. Marca "Llegué" o cancela ese viaje primero.` });
      return false;
    }
    iniciandoViajeRef.current.add(ticket.tecnico);
    try {
      await guardarViaje(ticket, iniciarViaje(ticket, ahora), 'Va en camino', 'encamino');
    } finally {
      iniciandoViajeRef.current.delete(ticket.tecnico);
    }
    setToastMsg({ type: 'success', duration: 2500, text: 'Listo, la oficina sabe que vas en camino.' });
    return true;
  };

  const marcarLlegada = async (ticket) => {
    if (!firebaseUser || !ticket) return false;
    const ahora = Date.now();
    if (!estaEnCamino(ticket, ahora)) return false;
    await guardarViaje(ticket, registrarLlegada(ticket, ahora), 'Llegó al sitio', 'llegada');
    setToastMsg({ type: 'success', duration: 2500, text: 'Listo, la oficina sabe que llegaste.' });
    return true;
  };

  // "Cancelar" (estando en camino) o "Deshacer" (estando en sitio, vuelve a en camino).
  const cancelarViaje = async (ticket) => {
    if (!firebaseUser || !ticket) return false;
    const ahora = Date.now();
    const estado = estadoViaje(ticket, ahora);
    if (!estado) return false;
    if (estado === ESTADO_EN_SITIO) {
      await guardarViaje(ticket, deshacerLlegada(ticket, ahora), 'Deshizo «Llegué»: sigue en camino', 'encamino');
      setToastMsg({ type: 'success', duration: 2500, text: 'Volviste a «en camino».' });
    } else {
      await guardarViaje(ticket, null, 'Canceló «En camino»', 'encamino');
      setToastMsg({ type: 'success', duration: 2500, text: 'Viaje cancelado.' });
    }
    return true;
  };

  // Cancela una orden (ya no hay "eliminar": cancelada es el único estado de baja). El motivo es obligatorio y queda con quién y cuándo; se ve en la
  // lista, el historial, ventas y los reportes, y el técnico recibe un aviso con él. La guardia evita pisar a otra persona que ya la cerró o la canceló.
  const cancelarTicket = async (ticket, motivoEscrito) => {
    if (!firebaseUser || !ticket) return false;
    const actual = tickets.find(t => t.id === ticket.id) || ticket;
    if (actual.estado === ESTADO_CANCELADO) {
      setToastMsg({ type: 'error', text: 'Esta orden ya está cancelada.' });
      return false;
    }
    const motivo = parseMotivoCancelacion(motivoEscrito);
    if (motivo.error) {
      setToastMsg({ type: 'error', text: motivo.error });
      return false;
    }
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'OPERADOR',
      tipo: 'cancelado',
      detalle: `Estado: CANCELADO | ${lineaMotivoCancelacion(motivo.valor)}`,
    };
    const cancelada = { ...actual, estado: ESTADO_CANCELADO, ...(actual.enCamino ? { enCamino: null } : {}) };
    const updatedTicket = { ...cancelada, ...camposCancelacion(actual, { ...cancelada, motivoCancelacion: motivo.valor }, { por: currentUser }), historialEdiciones: [...(actual.historialEdiciones || []), nuevaEdicion] };
    if (!(await guardarConGuardia(actual, updatedTicket, verificarEstado([actual.estado])))) return false;
    notifyTicketChange(actual, updatedTicket);
    setToastMsg({ type: 'success', text: 'Orden cancelada.' });
    return true;
  };

  // Devuelve el ticket ya guardado (con el código final) para que quien llame
  // pueda armar el mensaje de WhatsApp con el código correcto. `silencioso`
  // omite el toast propio cuando el llamador muestra el suyo.
  const toggleAsignado = async (ticket, newValue, { silencioso = false, reenvio = false } = {}) => {
    if (!firebaseUser) return null;

    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'OPERADOR',
      tipo: newValue ? (reenvio ? 'reenvio' : 'envio') : 'envio-retirado',
      detalle: newValue ? `Check de ENVIADO marcado${reenvio ? ' (reenvío)' : ''}` : 'Check de ENVIADO retirado'
    };

    const ticketFecha = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
    const updatedTicket = await guardarConNumeracion(
      tickets,
      ticket.id,
      ticket.codigo,
      ticket.tipoTrabajo,
      ticket.tecnico,
      ticketFecha,
      (codigo) => ({
        ...ticket,
        codigo,
        isAsignado: newValue,
        historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
      }),
      ticket
    );
    if (!silencioso) {
      setToastMsg({
        type: newValue ? 'success' : 'error',
        text: newValue ? 'Orden marcada como Enviada.' : 'Check de Enviado retirado.'
      });
    }
    return updatedTicket;
  };

  return {
    tickets,
    ticketsCargados,
    cobrosPendientes,
    mostrarCobro,
    mostrarCobroInmediato,
    cerrarCobro,
    createTicket,
    verificarCodigoManual,
    updateTicket,
    cancelarTicket,
    toggleAsignado,
    guardarUbicacion,
    preFinalizarTicket,
    consultarCobroRecableado,
    responderConsultaCobro,
    aprobarFinalizarTicket,
    guardarValoresCliente,
    devolverTicket,
    finalizarTicket,
    togglePrioridad,
    escalarAInfraestructura,
    resolverInfraestructura,
    iniciarEnCamino,
    marcarLlegada,
    cancelarViaje
  };
}
