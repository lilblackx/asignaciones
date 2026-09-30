import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { generarCodigoBase, generarCorrelativo, sincronizarCorrelativoManual, obtenerPrefijoTipo, obtenerCodigoMes, maxNumeroExistente } from '../utils/correlativo';
import { playAprobadoSound, playNuevaAsignacionSound, playPreFinalizadoSound } from '../utils/notificationSound';
import { sendPush } from '../lib/notify';
import { parsePotencia } from '../utils/potencia';
import { normalizarCoordenadasNap, normalizarUbicacion } from '../utils/ubicacion';

// Antes de generar, se pone al día contra los tickets ya existentes (createTicket
// nunca borra el "ultimo" guardado; solo lo adelanta si hay un número más alto por
// ahí, típicamente por un código manual de antes de que existiera la sincronización).
async function generarCorrelativoConCatchUp(tickets, tipoTrabajo, fecha = new Date()) {
  const prefijo = obtenerPrefijoTipo(tipoTrabajo);
  const mesCodigo = obtenerCodigoMes(fecha);
  const catchUpMax = maxNumeroExistente(tickets, prefijo, mesCodigo, fecha.getFullYear());
  return generarCorrelativo(db, appId, tipoTrabajo, fecha, catchUpMax);
}

// Instalación sin número aún ("IS", "IMZ", etc.). Si ya tiene técnico asignado,
// le corresponde numerarse con la misma transacción del contador.
async function resolveCodigoParaTecnico(tickets, codigoActual, tipoTrabajo, tecnicoFinal, fecha = new Date()) {
  const esInstalacionSinNumero = /^I[A-Z]{1,2}$/.test(codigoActual || '');
  const tieneTecnico = Boolean(tecnicoFinal && tecnicoFinal.toString().trim());
  if (esInstalacionSinNumero && tieneTecnico) {
    return await generarCorrelativoConCatchUp(tickets, tipoTrabajo, fecha);
  }
  return codigoActual;
}

export function useTickets(firebaseUser, currentUser, setToastMsg, role, tecnicoAsociado, onNotify) {
  const [tickets, setTickets] = useState([]);

  // Mismo criterio que el listener de abajo (nueva asignación / pre-finalizado /
  // aprobado), pero disparado por quien escribe el cambio, no por quien lo lee —
  // así el push llega aunque el destinatario tenga la app cerrada.
  const notifyTicketChange = (original, updated) => {
    if (updated.tecnico && (!original || original.tecnico !== updated.tecnico)) {
      sendPush(firebaseUser, {
        target: { type: 'tecnico', name: updated.tecnico },
        title: 'Nueva asignación',
        body: `Te asignaron la orden ${updated.codigo || 'S/C'}${updated.nombre ? ` — ${updated.nombre}` : ''}.`,
      });
    }
    // Ubicación que llega después de asignar (las promotoras la mandan aparte de
    // la plantilla). Si el técnico es nuevo en la orden, "Nueva asignación" ya cubre el aviso.
    if (updated.tecnico && updated.ubicacion && original && original.tecnico === updated.tecnico && (original.ubicacion || '') !== updated.ubicacion) {
      sendPush(firebaseUser, {
        target: { type: 'tecnico', name: updated.tecnico },
        title: 'Ubicación disponible',
        body: `La orden ${updated.codigo || 'S/C'}${updated.nombre ? ` — ${updated.nombre}` : ''} ya tiene ubicación.`,
      });
    }
    if (updated.estado === 'PRE-FINALIZADO' && (!original || original.estado !== 'PRE-FINALIZADO')) {
      sendPush(firebaseUser, {
        target: { type: 'aprobadores' },
        title: 'Orden pre-finalizada',
        body: `${updated.codigo || 'Orden'} (${updated.tecnico || 'técnico'}) fue marcada PRE-FINALIZADA — revisar.`,
      });
    }
    if (updated.estado === 'FINALIZADO' && original?.estado === 'PRE-FINALIZADO') {
      sendPush(firebaseUser, {
        target: { type: 'tecnico', name: updated.tecnico },
        title: 'Orden aprobada',
        body: `${updated.codigo || 'Orden'} fue aprobada y finalizada. Ya puedes continuar.`,
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
            onNotify?.({ type: 'prefinalizado', text: texto });
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
            onNotify?.({ type: 'nuevaAsignacion', text: texto });
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
            onNotify?.({ type: 'nuevaAsignacion', text: texto });
            playNuevaAsignacionSound();
          } else if (conUbicacionNueva.length > 1) {
            const texto = `${conUbicacionNueva.length} órdenes recibieron ubicación.`;
            setToastMsg({ type: 'nuevaAsignacion', text: texto, duration: 6000 });
            onNotify?.({ type: 'nuevaAsignacion', text: texto });
            playNuevaAsignacionSound();
          }

          // Avisa al técnico cuando le aprueban una orden (PRE-FINALIZADO ->
          // FINALIZADO), para que sepa que ya puede seguir adelante.
          const aprobadas = loadedTickets.filter(t =>
            t.estado === 'FINALIZADO' && estadoAnteriorRef.current.get(t.id) === 'PRE-FINALIZADO'
          );
          if (aprobadas.length === 1) {
            const t = aprobadas[0];
            const texto = `${t.codigo || 'Orden'} fue aprobada y finalizada. Ya puedes continuar.`;
            setToastMsg({ type: 'aprobado', text: texto, duration: 6000 });
            onNotify?.({ type: 'aprobado', text: texto });
            playAprobadoSound();
          } else if (aprobadas.length > 1) {
            const texto = `${aprobadas.length} órdenes fueron aprobadas y finalizadas.`;
            setToastMsg({ type: 'aprobado', text: texto, duration: 6000 });
            onNotify?.({ type: 'aprobado', text: texto });
            playAprobadoSound();
          }
        }
      }
      estadoAnteriorRef.current = new Map(loadedTickets.map(t => [t.id, t.estado]));
      ubicacionAnteriorRef.current = new Map(loadedTickets.map(t => [t.id, t.ubicacion || '']));
    }, (error) => {
      console.error('No se pudo cargar tickets:', error);
      setToastMsg({ type: 'error', text: 'No se pudieron cargar las órdenes.' });
    });
    return () => unsubTickets();
  }, [firebaseUser, role, tecnicoAsociado, setToastMsg, onNotify]);

  const createTicket = async (formData) => {
    if (!firebaseUser) return;
    const finalFalla = formData.falla.trim() === '' ? formData.tipoTrabajo : formData.falla;
    const newId = Date.now().toString();

    // Código manual (si el usuario lo escribió) tiene prioridad y no consume el contador automático.
    const codigoManual = (formData.codigo || '').trim();
    const esInstalacion = formData.tipoTrabajo?.toUpperCase().includes('INSTAL');
    const tieneTecnico = Boolean(formData.tecnico && formData.tecnico.trim());
    const codigo = codigoManual
      ? codigoManual.toUpperCase()
      : (esInstalacion && !tieneTecnico)
        ? generarCodigoBase(formData.tipoTrabajo)          // ej. "IS" — sin número mientras no tenga técnico
        : await generarCorrelativoConCatchUp(tickets, formData.tipoTrabajo); // ej. "IS1" (instalación con técnico) / "AS184" / "VS12"

    // Si el código se escribió a mano y sigue el patrón automático (ej. "AS4"),
    // el próximo automático debe continuar desde ahí, no ignorar lo tecleado.
    if (codigoManual) {
      sincronizarCorrelativoManual(db, appId, formData.tipoTrabajo, codigo).catch(
        (err) => console.error('No se pudo sincronizar el correlativo manual:', err)
      );
    }

    const newTicket = {
      ...formData,
      ubicacion: normalizarUbicacion(formData.ubicacion).valor || '',
      napCoordenadas: normalizarCoordenadasNap(formData.napCoordenadas).valor || '',
      falla: finalFalla,
      codigo,
      creado: currentUser,
      createdAt: Date.now(),
      historialEdiciones: [],
      isAsignado: false,
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', newId), newTicket);
    setToastMsg({ type: 'success', text: 'Orden creada exitosamente.' });
    notifyTicketChange(null, newTicket);
    return { id: newId, ...newTicket };
  };

  // Devuelve false si la validación rechazó el guardado (el llamador debe dejar
  // el formulario abierto para no perder lo que se escribió).
  const updateTicket = async (editingTicket) => {
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

    const originalTicket = tickets.find(t => t.id === editingTicket.id);
    let ticketToSave = { ...editingTicket, potenciaDbm: potencia.valor ?? null, ubicacion: ubicacion.valor || '', napCoordenadas: napCoordenadas.valor || '' };

    const ticketFecha = originalTicket?.createdAt ? new Date(originalTicket.createdAt) : new Date();
    ticketToSave.codigo = await resolveCodigoParaTecnico(
      tickets,
      editingTicket.codigo,
      editingTicket.tipoTrabajo,
      editingTicket.tecnico,
      ticketFecha
    );

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

    // Corrección manual del código (no la generada recién arriba): sincroniza el contador también.
    if (originalTicket && originalTicket.codigo !== editingTicket.codigo && ticketToSave.codigo === editingTicket.codigo) {
      sincronizarCorrelativoManual(db, appId, editingTicket.tipoTrabajo, editingTicket.codigo, ticketFecha).catch(
        (err) => console.error('No se pudo sincronizar el correlativo manual:', err)
      );
    }

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', editingTicket.id.toString()), ticketToSave);
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
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticket.id.toString()), updatedTicket);
    setToastMsg({ type: 'success', text: 'Ubicación guardada.' });
    notifyTicketChange(ticket, updatedTicket);
    return true;
  };

  const preFinalizarTicket = async (ticket, { nap, observacion, potenciaDbm } = {}) => {
    if (!firebaseUser || !ticket) return;

    if (!(observacion || '').trim()) {
      setToastMsg({ type: 'error', text: 'Debes describir el trabajo realizado antes de pre-finalizar.' });
      return;
    }

    let detalle = 'Marcado como PRE-FINALIZADO';
    if (observacion && observacion.trim()) detalle += ` | Obs: ${observacion.trim()}`;
    if (nap && nap.trim()) detalle += ` | NAP: ${nap.trim()}`;
    if (potenciaDbm != null) detalle += ` | Potencia: ${potenciaDbm} dBm`;

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
      observacion: observacion !== undefined ? observacion : (ticket.observacion || ''),
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticket.id.toString()), updatedTicket);
    setToastMsg({ type: 'success', text: 'Orden marcada como Pre-finalizada.' });
    notifyTicketChange(ticket, updatedTicket);
  };

  const aprobarFinalizarTicket = async (ticket) => {
    if (!firebaseUser || !ticket) return;

    const nuevaEdicion = {
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      operador: currentUser || 'ADMIN',
      tipo: 'aprobado',
      detalle: 'Aprobado y marcado como FINALIZADO'
    };

    const updatedTicket = {
      ...ticket,
      estado: 'FINALIZADO',
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticket.id.toString()), updatedTicket);
    setToastMsg({ type: 'success', text: 'Orden aprobada y finalizada con éxito.' });
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
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', deletingTicketId.toString()), updatedTicket);
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
    const codigoFinal = await resolveCodigoParaTecnico(tickets, ticket.codigo, ticket.tipoTrabajo, ticket.tecnico, ticketFecha);

    const updatedTicket = {
      ...ticket,
      codigo: codigoFinal,
      isAsignado: newValue,
      historialEdiciones: [...(ticket.historialEdiciones || []), nuevaEdicion]
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticket.id.toString()), updatedTicket);
    if (!silencioso) {
      setToastMsg({
        type: newValue ? 'success' : 'error',
        text: newValue ? 'Orden marcada como Enviada.' : 'Check de Enviado retirado.'
      });
    }
    return updatedTicket;
  };

  const deleteTicketsByIds = async (ids) => {
    for (const id of ids) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', id.toString()));
    }
  };

  return {
    tickets,
    createTicket,
    updateTicket,
    softDeleteTicket,
    toggleAsignado,
    guardarUbicacion,
    preFinalizarTicket,
    aprobarFinalizarTicket,
    deleteTicketsByIds
  };
}
