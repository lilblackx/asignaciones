// Causas de avería: qué fallas se reportan, cuánto tardan en resolverse y en qué NAPs se concentran. Sale de las órdenes de tipo AVERÍA
// (vivas y ya archivadas en los cierres cargados). Cada avería cuenta en el día en que se reportó (se creó la orden).
import { diaDe, mesDe } from './totalesMes.js';
import { enRango } from './periodoReporte.js';
import { napSinPuerto } from './codigoNap.js';
import { duracionAtencion, porcentaje } from './gestionTecnicos.js';

// Una NAP con averías de tantos clientes distintos en el periodo apunta a un problema de la NAP, no de cada cliente.
export const CLIENTES_NAP_SOSPECHOSA = 3;
const MESES_EVOLUCION = 6;
const FALLAS_EN_EVOLUCION = 5;

const delTecnico = (t, tecnico) => !tecnico || (t.tecnico || '').toUpperCase() === tecnico.toUpperCase();
const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '');

// La falla tal como la eligió la oficina. Sin falla (o con el tipo de trabajo guardado como falla) cuenta como "SIN ESPECIFICAR".
export function nombreDeFalla(t) {
  const falla = String(t.falla || '').trim().toUpperCase();
  return !falla || falla === 'AVERÍA' || falla === 'AVERIA' ? 'SIN ESPECIFICAR' : falla;
}

// El código de la NAP normalizado (N10D14), o el texto que escribieron en mayúsculas; null si no hay.
export function napDeOrden(t) {
  return napSinPuerto(t.nap);
}

const media = (lista) => (lista.length ? lista.reduce((s, n) => s + n, 0) / lista.length : null);

export function causasDeAveria(ordenes, rango, { tecnico } = {}) {
  const averias = ordenes.filter((t) => t.tipoTrabajo === 'AVERÍA' && Number(t.createdAt) > 0 && delTecnico(t, tecnico));
  const delPeriodo = averias.filter((t) => enRango(diaDe(Number(t.createdAt)), rango));

  const fallas = new Map();
  for (const t of delPeriodo) {
    const nombre = nombreDeFalla(t);
    if (!fallas.has(nombre)) fallas.set(nombre, { nombre, total: 0, resueltas: 0, canceladas: 0, duraciones: [] });
    const f = fallas.get(nombre);
    f.total += 1;
    if (t.estado === 'FINALIZADO') f.resueltas += 1;
    if (t.estado === 'CANCELADO') f.canceladas += 1;
    const ms = duracionAtencion(t);
    if (ms !== null) f.duraciones.push(ms);
  }
  const porFalla = [...fallas.values()]
    .map(({ duraciones, ...f }) => ({ ...f, pct: porcentaje(f.total, delPeriodo.length), resolucionMedia: media(duraciones) }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));

  const naps = new Map();
  for (const t of delPeriodo) {
    const nap = napDeOrden(t);
    if (!nap) continue;
    if (!naps.has(nap)) naps.set(nap, { nap, total: 0, clientes: new Set(), fallas: new Map(), ultima: 0, ordenes: [] });
    const n = naps.get(nap);
    n.total += 1;
    n.clientes.add(soloDigitos(t.cedula) || `orden-${t.id ?? t.codigo}`);
    n.fallas.set(nombreDeFalla(t), (n.fallas.get(nombreDeFalla(t)) || 0) + 1);
    n.ultima = Math.max(n.ultima, Number(t.createdAt));
    n.ordenes.push({ orden: t, dato: nombreDeFalla(t) });
  }
  const porNap = [...naps.values()]
    .map((n) => ({
      nap: n.nap,
      total: n.total,
      clientes: n.clientes.size,
      principales: [...n.fallas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([nombre]) => nombre),
      ultima: n.ultima,
      ordenes: n.ordenes,
      sospechosa: n.clientes.size >= CLIENTES_NAP_SOSPECHOSA,
    }))
    .sort((a, b) => b.total - a.total || a.nap.localeCompare(b.nap))
    .slice(0, 10);

  // Evolución: las fallas más frecuentes de todo lo cargado, mes a mes (los últimos meses con averías, sin importar el periodo elegido).
  const porMes = new Map();
  const totalPorFalla = new Map();
  for (const t of averias) {
    const mes = mesDe(Number(t.createdAt));
    const nombre = nombreDeFalla(t);
    if (!porMes.has(mes)) porMes.set(mes, new Map());
    porMes.get(mes).set(nombre, (porMes.get(mes).get(nombre) || 0) + 1);
    totalPorFalla.set(nombre, (totalPorFalla.get(nombre) || 0) + 1);
  }
  const principales = [...totalPorFalla.entries()].sort((a, b) => b[1] - a[1]).slice(0, FALLAS_EN_EVOLUCION).map(([nombre]) => nombre);
  const meses = [...porMes.keys()].sort().slice(-MESES_EVOLUCION);
  const evolucion = { fallas: principales, filas: meses.map((mes) => ({ mes, valores: principales.map((f) => porMes.get(mes).get(f) || 0), total: [...porMes.get(mes).values()].reduce((s, n) => s + n, 0) })) };

  const resueltas = delPeriodo.filter((t) => t.estado === 'FINALIZADO');
  const duracionesTotal = resueltas.map(duracionAtencion).filter((ms) => ms !== null);
  return {
    total: delPeriodo.length,
    resueltas: resueltas.length,
    resolucionMedia: media(duracionesTotal),
    napsAfectadas: naps.size,
    porFalla,
    porNap,
    evolucion,
    napsSospechosas: porNap.filter((n) => n.sospechosa),
  };
}
