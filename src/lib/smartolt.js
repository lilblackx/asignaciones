import { consultarWorker } from './integraciones';

export async function buscarClienteSmartOlt(cedula, signal) {
  const { resultados } = await consultarWorker('/onu', { cedula }, signal, 'SmartOLT');
  return Array.isArray(resultados) ? resultados : [];
}
