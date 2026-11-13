import { requiereAutorizar } from './datosAutorizacion.js';
import { llevaCobro } from './cobro.js';
import { ofreceValoresCliente } from './valoresCliente.js';

// Los pasos de la revisión de la oficina antes de aprobar o finalizar una orden (ver components/modals/AprobarFinalizarModal), solo los que aplican a esa orden:
//   revisar   lo que cargó el técnico (siempre; solo lectura)
//   autorizar los datos del equipo para autorizarlo en SmartOLT (solo si hay algo que autorizar: serial, VLAN, tipo de equipo nuevo, drop...; la NAP y el puerto solos no cuentan, ver requiereAutorizar)
//   cobro     el cobro que verá el técnico (si la orden lleva cobro)
//   valores   los valores de señal del cliente (si se piden u ofrecen)
//   decision  el resumen y aprobar o devolver (siempre)
export function pasosDeRevision(ticket) {
  return ['revisar', ...(requiereAutorizar(ticket) ? ['autorizar'] : []), ...(llevaCobro(ticket) ? ['cobro'] : []), ...(ofreceValoresCliente(ticket) ? ['valores'] : []), 'decision'];
}

// Con 2 pasos o menos (una avería simple: revisar y decidir) la revisión es una sola pantalla; con más es un asistente por pasos.
export const PASOS_PARA_ASISTENTE = 3;
export const esAsistenteDeRevision = (claves) => claves.length >= PASOS_PARA_ASISTENTE;

// La regla de bloqueo entre pasos es común a todos los asistentes (ver utils/pasos).
export { motivoNoSePuedeLlegar } from './pasos.js';
