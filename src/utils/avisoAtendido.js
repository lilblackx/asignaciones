import { consultaPendiente } from './consultaCobro.js';
import { enInfraestructura } from './infraestructura.js';
import { esPrioritaria } from './prioridad.js';

// ¿Ya se atendió lo que pedía un aviso de la campana? Si sí, el aviso se quita solo y el contador baja sin que nadie lo borre a mano.
// Solo cuentan los avisos de una orden concreta (`ticketId`): los que agrupan varias órdenes no se pueden dar por atendidos.
// Los avisos que solo informan (cancelada, aprobada, pagos...) se quedan hasta que alguien los quite: no hay nada que "atender".
// `ticket` es la orden tal como está ahora; undefined si ya no está en la lista (se cerró el día, o la reasignaron a otro técnico).

const esPendiente = (t) => t.estado === 'PENDIENTE';

const ATENDIDO_SI = {
  // Técnico: la orden que le asignaron, le subieron de prioridad o le devolvieron ya no está por atender.
  nuevaAsignacion: (t) => !esPendiente(t),
  prioridad: (t) => !esPrioritaria(t),
  devuelto: (t) => !esPendiente(t),
  respuestaCobro: (t) => !esPendiente(t),
  // Oficina: ya se aprobó o devolvió, ya tiene técnico, ya se respondió la consulta, ya salió de infraestructura.
  prefinalizado: (t) => t.estado !== 'PRE-FINALIZADO',
  nuevaVenta: (t) => Boolean(t.tecnico) || !esPendiente(t),
  consultaCobro: (t) => !consultaPendiente(t) || !esPendiente(t),
  encamino: (t) => !esPendiente(t),
  llegada: (t) => !esPendiente(t),
  infraestructura: (t, esOficina) => esOficina && !enInfraestructura(t),
};

export function avisoAtendido(aviso, ticket, esOficina) {
  if (!aviso?.ticketId) return false;
  const regla = ATENDIDO_SI[aviso.type];
  if (!regla) return false;
  // El aviso de infraestructura del técnico ("ya puedes atenderla") no se da por atendido solo por no estar la orden.
  if (!ticket) return aviso.type !== 'infraestructura' || esOficina;
  return regla(ticket, esOficina);
}
