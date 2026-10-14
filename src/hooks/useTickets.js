import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { generarCodigoBase, generarCorrelativoConCatchUp as generarCorrelativoConCatchUpBase, guardarConNumeracion as guardarConNumeracionBase, sincronizarCorrelativoManual, detectarSaltoManual } from '../utils/correlativo';
import { playAprobadoSound, playDevueltaSound, playNuevaAsignacionSound, playPreFinalizadoSound } from '../utils/notificationSound';
import { sendPush } from '../lib/notify';
import { parsePotencia } from '../utils/potencia';
import { normalizarCoordenadasNap, normalizarUbicacion } from '../utils/ubicacion';
import { cambiosDeTicket } from '../utils/cambiosTicket';
import { devolucionPendiente } from '../utils/devolucion';
import { COBRO_EXONERADO, COBRO_VISITA, ETIQUETA_COBRO, estaExonerado, tieneCobroFinal, valorCobro } from '../utils/cobro';
import { ETIQUETA_TIPO_VISITA, TIPO_RECABLEADO, datosRecableado, generaCobro, partesRecableado, tieneDatosRecableado } from '../utils/tipoVisita';

// Texto del cobro que se le muestra al técnico cuando finalizan una orden con tipo
// de visita de conector (externo o interno; el recableado no genera cobro). El monto lo calcula quien finaliza (con la
// tasa de ese momento) y queda guardado en la orden como `cobroBs`. Antes de
// finalizar no se muestra ningún cobro.
const avisoCobro = (t) => {
  if (!t.tipoVisita) return '';
  if (estaExonerado(t)) return ' Visita exonerada: no se cobra al cliente.';
  return t.cobroBs ? ` Cobro resultante al cliente: ${t.cobroBs} Bs.` : '';
};

// " (Otro monto)" / " (Visita técnica)" para el historial; vacío si no se indicó.
const etiquetaCobro = (tipo) => (ETIQUETA_COBRO[tipo] ? ` (${ETIQUETA_COBRO[tipo]})` : '');

// Parte del historial sobre el cobro: el monto con su tipo, o la exoneración.
const detalleCobro = (cobroBs, cobroTipo, exonerado) => {
  if (exonerado) return ' | Visita exonerada: sin cobro al cliente';
  return cobroBs ? ` | Cobro resultante: ${cobroBs} Bs${etiquetaCobro(cobroTipo)}` : '';
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
    return { estados: new Map(raw.e), ubicaciones: new Map(raw.u) };
  } catch {
    return null;
  }
}
function guardarBaseline(usuario, estados, ubicaciones) {
  if (!usuario) return;
  try {
    localStorage.setItem(BASELINE_PREFIX + usuario, JSON.stringify({ t: Date.now(), e: [...estados], u: [...ubicaciones] }));
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
  const cambios = cambiosDeTicket(original, actualizada);
  if (Object.keys(cambios).length === 0) return;
  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', original.id.toString()), cambios);
}

export function useTickets(firebaseUser, currentUser, setToastMsg, role, tecnicoAsociado, onNotify) {
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
    if (updated.tecnico && (!original || original.tecnico !== updated.tecnico)) {
      avisarPush({
        target: { type: 'tecnico', name: updated.tecnico },
        title: 'Nueva asignación',
        body: `Te asignaron la orden ${updated.codigo || 'S/C'}${updated.nombre ? ` — ${updated.nombre}` : ''}.`,
        tipo: 'nuevaAsignacion',
        ticketId,
      });
    }
    // Ubicación que llega después de asignar (las promotoras la mandan aparte de
    // la plantilla). Si el técnico es nuevo en la orden, "Nueva asignación" ya cubre el aviso.
    if (updated.tecnico && updated.ubicacion && original && original.tecnico === updated.tecnico && (original.ubicacion || '') !== updated.ubicacion) {
      avisarPush({
        target: { type: 'tecnico', name: updated.tecnico },
        title: 'Ubicación disponible',
        body: `La orden ${updated.codigo || 'S/C'}${updated.nombre ? ` — ${updated.nombre}` : ''} ya tiene ubicación.`,
        tipo: 'nuevaAsignacion',
        ticketId,
      });
    }
    if (updated.estado === 'PRE-FINALIZADO' && (!original || original.estado !== 'PRE-FINALIZADO')) {
      avisarPush({
        target: { type: 'aprobadores' },
        title: 'Orden pre-finalizada',
        body: `${updated.codigo || 'Orden'} (${updated.tecnico || 'técnico'}) fue marcada PRE-FINALIZADA — revisar.`,
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
    if (updated.estado === 'FINALIZADO' && original?.estado === 'PENDIENTE' && avisoCobro(updated)) {
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

  useEffect(() => {
    if (!firebaseUser) return;
    const ticketsRef = collection(db, 'artifacts', appId, 'public', 'data', 'tickets');
    // TECNICO solo puede leer sus propios tickets (reglas de Firestore lo exigen:
    // un rule que filtra por resource.data.tecnico rechaza un query sin este where).
    const ticketsQuery = (role === 'TECNICO' && tecnicoAsociado)
      ? query(ticketsRef, where('tecnico', '==', tecnicoAsociado))
      : ticketsRef;
    const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
      const loadedTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            const texto = `${t.codigo || 'Orden'} (${t.tecnico || 'técnico'}) fue marcada PRE-FINALIZADA — revisar.`;
            setToastMsg({ type: 'prefinalizado', text: texto, duration: 7000 });
            onNotify?.({ type: 'prefinalizado', text: texto, ticketId: t.id });
            playPreFinalizadoSound();
          } else if (nuevas.length > 1) {
            const texto = `${nuevas.length} órdenes marcadas PRE-FINALIZADO — revisar.`;
            setToastMsg({ type: 'prefinalizado', text: texto, duration: 7000 });
            onNotify?.({ type: 'prefinalizado', text: texto });
            playPreFinalizadoSound();
          }
        } else if (role === 'TECNICO') {
          // Avisa al técnico cuando le llega una orden nueva: el query ya está
          // acotado a sus propios tickets (where tecnico == tecnicoAsociado),
          // así que un id que no estaba en el snapshot anterior es una
          // asignación nueva, sea por creación directa o por reasignación
          // desde Editar.
          const nuevasAsignaciones = loadedTickets.filter(t =>
            !estadoAnteriorRef.current.has(t.id) && t.estado !== 'ELIMINADO'
          );
          if (nuevasAsignaciones.length === 1) {
            const t = nuevasAsignaciones[0];
            const texto = `Te asignaron una nueva orden: ${t.codigo || 'S/C'}${t.nombre ? ` — ${t.nombre}` : ''}.`;
            setToastMsg({ type: 'nuevaAsignacion', text: texto, duration: 6000 });
            onNotify?.({ type: 'nuevaAsignacion', text: texto, ticketId: t.id });
            playNuevaAsignacionSound();
          } else if (nuevasAsignaciones.length > 1) {
            const texto = `Te asignaron ${nuevasAsignaciones.length} órdenes nuevas.`;
            setToastMsg({ type: 'nuevaAsignacion', text: texto, duration: 6000 });
            onNotify?.({ type: 'nuevaAsignacion', text: texto });
            playNuevaAsignacionSound();
          }

          const conUbicacionNueva = loadedTickets.filter(t =>
            t.ubicacion && t.estado !== 'ELIMINADO'
            && ubicacionAnteriorRef.current?.has(t.id) && !ubicacionAnteriorRef.current.get(t.id)
          );
          if (conUbicacionNueva.length === 1) {
            const t = conUbicacionNueva[0];
            const texto = `La orden ${t.codigo || 'S/C'}${t.nombre ? ` — ${t.nombre}` : ''} ya tiene ubicación.`;
            setToastMsg({ type: 'nuevaAsignacion', text: texto, duration: 6000 });
            onNotify?.({ type: 'nuevaAsignacion', text: texto, ticketId: t.id });
            playNuevaAsignacionSound();
          } else if (conUbicacionNueva.length > 1) {
            const texto = `${conUbicacionNueva.length} órdenes recibieron ubicación.`;
            setToastMsg({ type: 'nuevaAsignacion', text: texto, duration: 6000 });
            onNotify?.({ type: 'nuevaAsignacion', text: texto });
            playNuevaAsignacionSound();
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
            const cobros = aprobadas.filter(t => avisoCobro(t)).map(t => `${t.codigo || 'Orden'}: ${estaExonerado(t) ? 'exonerada' : `${t.cobroBs} Bs`}`);
            const texto = `${aprobadas.length} órdenes fueron aprobadas y finalizadas.${cobros.length ? ` Cobro resultante al cliente: ${cobros.join(', ')}.` : ''}`;
            setToastMsg({ type: 'aprobado', text: texto, duration: 6000 });
            onNotify?.({ type: 'aprobado', text: texto });
            playAprobadoSound();
          }
        }
      }
      estadoAnteriorRef.current = new Map(loadedTickets.map(t => [t.id, t.estado]));
      ubicacionAnteriorRef.current = new Map(loadedTickets.map(t => [t.id, t.ubicacion ? 1 : '']));
      guardarBaseline(currentUserRef.current, estadoAnteriorRef.current, ubicacionAnteriorRef.current);
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
    };
  }, [firebaseUser, role, tecnicoAsociado, setToastMsg, onNotify]);

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

  const createTicket = async (formData) => {
    if (!firebaseUser || creandoRef.current) return;
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
    const { ventaTecnico, ...datosOrden } = formData;
    const armarTicket = (codigo) => ({
      ...datosOrden,
      ...(ventaTecnico ? { ventaTecnico } : {}),
      ubicacion: normalizarUbicacion(formData.ubicacion).valor || '',
      napCoordenadas: normalizarCoordenadasNap(formData.napCoordenadas).valor || '',
      falla: finalFalla,
      codigo,
      creado: currentUser,
      createdAt: Date.now(),
      historialEdiciones: [],
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

    if (role === 'TECNICO' && editingTicket.estado === 'PRE-FINALIZADO' && !(editingTicket.observacion || '').trim()) {
      setToastMsg({ type: 'error', text: 'Debes describir el trabajo realizado antes de pre-finalizar.' });
      return false;
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
    const ticketFecha = originalTicket?.createdAt ? new Date(originalTicket.createdAt) : new Date();

    const armarTicket = (codigo) => {
      const ticketToSave = { ...editingTicket, codigo, potenciaDbm: potencia.valor ?? null, ubicacion: ubicacion.valor || '', napCoordenadas: napCoordenadas.valor || '' };
      // Fecha en que se finalizó (la usa el módulo de materiales para filtrar por período).
      if (editingTicket.estado === 'FINALIZADO' && originalTicket?.estado !== 'FINALIZADO') ticketToSave.finalizadoEn = Date.now();
      if (originalTicket) {
        let cambios = [];
        if (originalTicket.estado !== editingTicket.estado) cambios.push(`Estado: ${editingTicket.estado}`);
        if (originalTicket.tecnico !== editingTicket.tecnico) cambios.push(`Técnico: ${editingTicket.tecnico || 'Sin asignar'}`);
        if (originalTicket.tipoTrabajo !== editingTicket.tipoTrabajo) cambios.push(`Trabajo: ${editingTicket.tipoTrabajo}`);
        if (originalTicket.fechaProgramada !== editingTicket.fechaProgramada) cambios.push(`Prog: ${editingTicket.fechaProgramada || 'Ninguna'}`);
        if (originalTicket.codigo !== ticketToSave.codigo) cambios.push(`Cód: ${ticketToSave.codigo}`);
        if (originalTicket.observacion !== editingTicket.observacion) cambios.push(`Obs. modificada`);
        if (originalTicket.nap !== editingTicket.nap) cambios.push(`NAP: ${editingTicket.nap || 'Vacío'}`);
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
      return ticketToSave;
    };

    const ticketToSave = await guardarConNumeracion(
      tickets,
      editingTicket.id,
      editingTicket.codigo,
      editingTicket.tipoTrabajo,
      editingTicket.tecnico,
      ticketFecha,
      armarTicket,
      originalTicket || null
    );

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
    await actualizarTicket(ticket, updatedTicket);
    setToastMsg({ type: 'success', text: 'Ubicación guardada.' });
    notifyTicketChange(ticket, updatedTicket);
    return true;
  };

  const preFinalizarTicket = async (ticket, { nap, observacion, potenciaDbm, potencia1490Dbm, tipoVisita, metrosCable, conectorExterno, conectorInterno } = {}) => {
    if (!firebaseUser || !ticket) return;

    if (!(observacion || '').trim()) {
      setToastMsg({ type: 'error', text: 'Debes describir el trabajo realizado antes de pre-finalizar.' });
      return false;
    }

    // Recableado: los metros de cable son obligatorios (los conectores no).
    if (tipoVisita === TIPO_RECABLEADO && !(Number.isInteger(metrosCable) && metrosCable >= 1)) {
      setToastMsg({ type: 'error', text: 'Indica los metros de cable usados en el recableado.' });
      return false;
    }

    let detalle = 'Marcado como PRE-FINALIZADO';
    if (observacion && observacion.trim()) detalle += ` | Obs: ${observacion.trim()}`;
    if (nap && nap.trim()) detalle += ` | NAP: ${nap.trim()}`;
    if (potenciaDbm != null) detalle += ` | Potencia: ${potenciaDbm} dBm`;
    if (potencia1490Dbm != null) detalle += ` | ONU Rx 1490 nm: ${potencia1490Dbm} dBm`;
    if (tipoVisita === TIPO_RECABLEADO) detalle += ` | Recableado: ${partesRecableado({ metrosCable, conectorExterno, conectorInterno }).join(', ')}`;
    else if (tipoVisita && ETIQUETA_TIPO_VISITA[tipoVisita]) detalle += ` | ${ETIQUETA_TIPO_VISITA[tipoVisita]}`;

    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'TÉCNICO',
      tipo: 'prefinalizado',
      detalle
    };

    // Los datos del recableado solo se escriben si hay recableado o si hay que borrar los de
    // un recableado anterior; así las demás visitas no suman campos vacíos a la orden.
    const camposRecableado = tipoVisita !== undefined && (tipoVisita === TIPO_RECABLEADO || tieneDatosRecableado(ticket))
      ? datosRecableado(tipoVisita, { metros: metrosCable, conectorExterno, conectorInterno })
      : {};

    const updatedTicket = {
      ...ticket,
      estado: 'PRE-FINALIZADO',
      nap: nap !== undefined ? nap : (ticket.nap || ''),
      potenciaDbm: potenciaDbm !== undefined ? potenciaDbm : (ticket.potenciaDbm ?? null),
      potencia1490Dbm: potencia1490Dbm !== undefined ? potencia1490Dbm : (ticket.potencia1490Dbm ?? null),
      observacion: observacion !== undefined ? observacion : (ticket.observacion || ''),
      tipoVisita: tipoVisita !== undefined ? tipoVisita : (ticket.tipoVisita || ''),
      ...camposRecableado,
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    await actualizarTicket(ticket, updatedTicket);
    setToastMsg({ type: 'success', text: 'Orden marcada como Pre-finalizada.' });
    notifyTicketChange(ticket, updatedTicket);
    return true;
  };

  // `montoBs`: cobro de la visita ya formateado (ej. "5.696"); solo se guarda en
  // órdenes con tipo de visita, para que el técnico lo vea al aprobarse.
  const aprobarFinalizarTicket = async (ticket, { montoBs, cobroTipo } = {}) => {
    if (!firebaseUser || !ticket) return;

    const exonerado = generaCobro(ticket.tipoVisita) && cobroTipo === COBRO_EXONERADO;
    const cobroBs = generaCobro(ticket.tipoVisita) && !exonerado && montoBs ? montoBs : null;
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'ADMIN',
      tipo: 'aprobado',
      detalle: `Aprobado y marcado como FINALIZADO${detalleCobro(cobroBs, cobroTipo, exonerado)}`
    };

    const updatedTicket = {
      ...ticket,
      estado: 'FINALIZADO',
      finalizadoEn: Date.now(),
      // `cobroTipo` se escribe siempre que hay decisión de cobro, para no arrastrar una exoneración vieja.
      ...(exonerado ? { cobroTipo: COBRO_EXONERADO, cobroBs: null } : cobroBs ? { cobroBs, cobroTipo: cobroTipo || COBRO_VISITA } : {}),
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    await actualizarTicket(ticket, updatedTicket);
    setToastMsg({ type: 'success', text: 'Orden aprobada y finalizada con éxito.' });
    notifyTicketChange(ticket, updatedTicket);
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

    await actualizarTicket(ticket, updatedTicket);
    setToastMsg({ type: 'success', text: 'Orden devuelta al técnico.' });
    notifyTicketChange(ticket, updatedTicket);
    return true;
  };

  // Cierre directo de una orden PENDIENTE desde la tabla, sin pasar por el
  // formulario de edición ni por la pre-finalización del técnico.
  const finalizarTicket = async (ticket, { montoBs, cobroTipo } = {}) => {
    if (!firebaseUser || !ticket) return;

    const exonerado = generaCobro(ticket.tipoVisita) && cobroTipo === COBRO_EXONERADO;
    const cobroBs = generaCobro(ticket.tipoVisita) && !exonerado && montoBs ? montoBs : null;
    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'OPERADOR',
      tipo: 'finalizado',
      detalle: `Marcado como FINALIZADO${detalleCobro(cobroBs, cobroTipo, exonerado)}`
    };

    const updatedTicket = {
      ...ticket,
      estado: 'FINALIZADO',
      finalizadoEn: Date.now(),
      ...(exonerado ? { cobroTipo: COBRO_EXONERADO, cobroBs: null } : cobroBs ? { cobroBs, cobroTipo: cobroTipo || COBRO_VISITA } : {}),
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    await actualizarTicket(ticket, updatedTicket);
    setToastMsg({ type: 'success', text: 'Orden finalizada.' });
    notifyTicketChange(ticket, updatedTicket);
  };

  const softDeleteTicket = async (deletingTicketId) => {
    if (!firebaseUser || !deletingTicketId) return;
    const ticketToUpdate = tickets.find(t => t.id === deletingTicketId);
    if (ticketToUpdate) {
      const updatedTicket = {
        ...ticketToUpdate,
        estado: 'ELIMINADO',
        eliminadoPor: currentUser || 'OPERADOR',
        fechaEliminacion: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
      };
      await actualizarTicket(ticketToUpdate, updatedTicket);
    }
    setToastMsg({ type: 'success', text: 'Orden enviada a la papelera.' });
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
    softDeleteTicket,
    toggleAsignado,
    guardarUbicacion,
    preFinalizarTicket,
    aprobarFinalizarTicket,
    devolverTicket,
    finalizarTicket
  };
}
