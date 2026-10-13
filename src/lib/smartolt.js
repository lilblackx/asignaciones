import { consultarWorker } from './integraciones';

export async function buscarClienteSmartOlt(cedula, signal) {
  const { resultados } = await consultarWorker('/onu', { cedula }, signal, 'SmartOLT');
  return Array.isArray(resultados) ? resultados : [];
}

// Potencia de la ONU del cliente de una orden (el Worker lee la cédula de la propia
// orden). Devuelve una lista: normalmente una ONU; varias si el cliente tiene varios servicios.
export async function consultarSenalOnu(ticketId, signal) {
  const { resultados } = await consultarWorker('/onu/senal', { ticketId }, signal, 'SmartOLT');
  return Array.isArray(resultados) ? resultados : [];
}
