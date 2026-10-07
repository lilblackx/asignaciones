import { consultarWorker } from './integraciones';

// Busca en Tomodat, a través del Worker (ver /cf-worker-tomodat), las cajas cuyo
// nombre corresponde al código de NAP. Devuelve [{ nombre, tipo, lat, lng }] o
// lanza Error si el Worker o Tomodat no respondieron.
export async function buscarNapTomodat(codigo, signal) {
  const { resultados } = await consultarWorker('/nap', { codigo }, signal, 'Tomodat');
  return Array.isArray(resultados) ? resultados : [];
}
