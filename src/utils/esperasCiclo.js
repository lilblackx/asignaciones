// Reporte "Esperas del ciclo": en cuánto tiempo se mueve cada tramo de una orden y de quién es la espera. Las horas salen de los
// campos que guarda utils/tiemposOrden.js (asignadoEn, salioEn, llegoEn, prefinalizadoEn...) y de `finalizadoEn`.
//   OFICINA  asignar  creada (o su fecha programada) → se le asigna técnico por primera vez
//            aprobar  pre-finalizada por el técnico → aprobada y finalizada
//   TÉCNICO  salir    recibida (o su fecha programada) → "En camino"
//            viaje    "En camino" → "Llegué"
//            sitio    "Llegué" → pre-finalizada
import { agrupar, delTecnico, estadisticaDuraciones, finalizadaEn, formatoTiempo, inicioAtencion } from './gestionTecnicos.js';

// Desde cuándo se guardan las horas (despliegue del reporte). Una orden creada antes y asignada antes no dice cuándo la recibió su
// técnico, así que su tramo "salir" no puede medirse: contaría la espera desde que se creó.
export const INICIO_REGISTRO_HORAS = 1792508069511;

export const TRAMOS = [
  { id: 'asignar', quien: 'OFICINA', nombre: 'Asignar técnico', detalle: 'Desde que se crea la orden (o su fecha programada) hasta que se le asigna técnico. Solo las que se crearon sin técnico.' },
  { id: 'aprobar', quien: 'OFICINA', nombre: 'Aprobar la orden', detalle: 'Desde que el técnico la pre-finaliza hasta que la oficina la aprueba.' },
  { id: 'salir', quien: 'TÉCNICO', nombre: 'Salir hacia la orden', detalle: 'Desde que recibe la orden (o su fecha programada) hasta que avisa «En camino».' },
  { id: 'viaje', quien: 'TÉCNICO', nombre: 'Viaje', detalle: 'Desde «En camino» hasta «Llegué».' },
  { id: 'sitio', quien: 'TÉCNICO', nombre: 'Trabajo en el sitio', detalle: 'Desde «Llegué» hasta que pre-finaliza la orden.' },
];
export const TRAMOS_OFICINA = TRAMOS.filter((t) => t.quien === 'OFICINA');
export const TRAMOS_TECNICO = TRAMOS.filter((t) => t.quien === 'TÉCNICO');

const hora = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
// Lo que dura un tramo (ms), o null si falta una de sus horas o están al revés.
const entre = (inicio, fin) => (inicio > 0 && fin > 0 && fin >= inicio ? fin - inicio : null);

// La duración de cada tramo de una orden (null donde no se puede medir).
export function duracionesDeOrden(t) {
  const inicio = inicioAtencion(t);
  const asignado = hora(t.asignadoEn);
  const sabeCuandoLaRecibio = asignado > 0 || hora(t.createdAt) >= INICIO_REGISTRO_HORAS;
  return {
    asignar: entre(inicio, hora(t.primerAsignadoEn)),
    aprobar: entre(hora(t.prefinalizadoEn), hora(t.finalizadoEn)),
    salir: sabeCuandoLaRecibio ? entre(Math.max(asignado, inicio), hora(t.salioEn)) : null,
    viaje: entre(hora(t.salioEn), hora(t.llegoEn)),
    sitio: entre(hora(t.llegoEn), hora(t.prefinalizadoEn)),
  };
}

const estadistica = (filas, id) => estadisticaDuraciones(filas.map((f) => f.d[id]).filter((v) => v !== null), 0);
const porNombre = (a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre);

// Las esperas de las órdenes finalizadas en el rango: por tramo, por técnico (sus tres tramos) y por tipo de trabajo (los de la oficina).
export function esperasDelCiclo(ordenes, rango, { tecnico } = {}) {
  const filas = ordenes
    .filter((t) => finalizadaEn(t, rango) && delTecnico(t, tecnico))
    .map((t) => ({ t, d: duracionesDeOrden(t) }));
  const conHoras = filas.filter((f) => TRAMOS.some((tr) => f.d[tr.id] !== null));

  const agrupado = (clave, tramos) => [...agrupar(filas, (f) => clave(f.t)).entries()]
    .map(([nombre, lista]) => ({ nombre, cantidad: lista.filter((f) => tramos.some((tr) => f.d[tr.id] !== null)).length, ...Object.fromEntries(tramos.map((tr) => [tr.id, estadistica(lista, tr.id)])) }))
    .filter((f) => f.cantidad > 0)
    .sort(porNombre);

  return {
    finalizadas: filas.length,
    conHoras: conHoras.length,
    tramos: TRAMOS.map((tr) => ({ ...tr, ...estadistica(filas, tr.id) })),
    porTecnico: agrupado((t) => t.tecnico, TRAMOS_TECNICO),
    porTipo: agrupado((t) => t.tipoTrabajo, TRAMOS_OFICINA),
  };
}

const LIMITE_COLA = 10;

// Lo que la oficina tiene esperando ahora: órdenes sin técnico (desde que se crearon o su fecha programada) y órdenes
// pre-finalizadas por aprobar (desde que el técnico las pre-finalizó), la más vieja primero.
export function colasDeLaOficina(ordenes, ahora, { tecnico } = {}) {
  const cola = (esDeLaCola, desde) => {
    const lista = ordenes
      .filter((t) => esDeLaCola(t) && delTecnico(t, tecnico))
      .map((orden) => ({ orden, desde: desde(orden) }))
      .filter(({ desde: d }) => d > 0 && d <= ahora)
      .map((x) => ({ ...x, esperaMs: ahora - x.desde }))
      .sort((a, b) => b.esperaMs - a.esperaMs);
    return { total: lista.length, lista: lista.slice(0, LIMITE_COLA) };
  };
  return {
    sinTecnico: cola((t) => t.estado === 'PENDIENTE' && !String(t.tecnico || '').trim(), inicioAtencion),
    porAprobar: cola((t) => t.estado === 'PRE-FINALIZADO', (t) => hora(t.prefinalizadoEn)),
  };
}

// --- Textos (los usan la pantalla, el PDF, el Word y el CSV) ---
export const tiempoOGuion = (f) => (f.cantidad ? formatoTiempo(f.promedio) : '—');

export const columnasTramo = (primera) => [{ titulo: primera }, { titulo: 'Órdenes', derecha: true }, { titulo: 'Promedio', derecha: true }, { titulo: 'Mediana', derecha: true }, { titulo: 'Más lenta', derecha: true }];
export const filaTramo = (f) => [f.nombre, String(f.cantidad), f.cantidad ? formatoTiempo(f.promedio) : '—', f.cantidad ? formatoTiempo(f.mediana) : '—', f.cantidad ? formatoTiempo(f.maximo) : '—'];

export const columnasPorTecnico = () => [{ titulo: 'Técnico' }, { titulo: 'Órdenes', derecha: true }, ...TRAMOS_TECNICO.map((t) => ({ titulo: t.nombre, derecha: true }))];
export const filaPorTecnico = (f) => [f.nombre, String(f.cantidad), ...TRAMOS_TECNICO.map((t) => tiempoOGuion(f[t.id]))];

export const columnasPorTipo = () => [{ titulo: 'Tipo' }, { titulo: 'Órdenes', derecha: true }, ...TRAMOS_OFICINA.map((t) => ({ titulo: t.nombre, derecha: true }))];
export const filaPorTipo = (f) => [f.nombre, String(f.cantidad), ...TRAMOS_OFICINA.map((t) => tiempoOGuion(f[t.id]))];

export const NOTA_HORAS = 'Las horas se guardan desde que se activó este reporte: las órdenes anteriores no cuentan en los tramos que no se pueden medir. Con una orden devuelta se mide el último ciclo.';

// Las cifras de arriba: el promedio de cada tramo de un grupo.
export function cifrasDeTramos(esperas, quien) {
  return esperas.tramos.filter((t) => t.quien === quien).map((t) => ({
    etiqueta: t.nombre,
    valor: t.cantidad ? formatoTiempo(t.promedio) : '—',
    detalle: t.cantidad ? `promedio de ${t.cantidad} · mediana ${formatoTiempo(t.mediana)}` : 'Sin horas registradas',
  }));
}
