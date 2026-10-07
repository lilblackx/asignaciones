import { extraerCodigoNap } from './codigoNap';
import { normalizarCoordenadasNap } from './ubicacion';

// Coordenadas de NAP que ya se usaron en órdenes anteriores (activas y de
// cierres archivados): código de NAP -> [{ lat, lng }], la más reciente primero
// y sin repetidas. Sirve para no depender de Tomodat cuando la NAP ya se conoce.
export function construirNapsConocidas(activos = [], archivados = []) {
  const ordenadas = [...activos, ...archivados]
    .filter(t => t?.nap && t.napCoordenadas && t.estado !== 'ELIMINADO')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const mapa = new Map();
  for (const t of ordenadas) {
    const codigo = extraerCodigoNap(t.nap);
    const { valor } = normalizarCoordenadasNap(t.napCoordenadas);
    if (!codigo || !valor) continue;
    const lista = mapa.get(codigo) || [];
    if (!lista.some(c => c.valor === valor)) {
      const [lat, lng] = valor.split(',').map(n => parseFloat(n));
      lista.push({ valor, lat, lng });
    }
    mapa.set(codigo, lista);
  }
  return mapa;
}

// Coordenadas conocidas para un código ("D13P01-5" prueba también "D13P01" si
// la caja con sufijo nunca se registró). Siempre devuelve un arreglo.
export function buscarNapConocida(mapa, codigo) {
  if (!mapa || !codigo) return [];
  const clave = String(codigo).toUpperCase();
  const base = clave.replace(/-\d$/, '');
  return mapa.get(clave) || (base !== clave ? mapa.get(base) : null) || [];
}
