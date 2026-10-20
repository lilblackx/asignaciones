// Reportes de gestión de técnicos: tiempo de atención, productividad y calidad. Todo sale de las órdenes (vivas y ya archivadas en los
// cierres) y del registro de activación de técnicos. Los días son los de Caracas, como en el resto de los reportes.
import { comoCancelada } from './cancelacion.js';
import { diaDe } from './totalesMes.js';
import { enRango } from './periodoReporte.js';
import { clasificarEvento } from './historial.js';
import { POTENCIA_MIN_DBM } from './potencia.js';
import { duracionActivaPorDia } from './logTecnico.js';

const MIN_MS = 60 * 1000;
export const HORA_MS = 60 * MIN_MS;
const DIA_MS = 24 * HORA_MS;

// Las metas de atención que se pueden elegir, en horas (168 = 7 días).
export const META_HORAS = [24, 48, 72, 168];

// Una reincidencia es una avería del mismo cliente que llega dentro de estos días después de finalizar una orden.
export const VENTANA_REINCIDENCIA_DIAS = 30;
// Tiempo mínimo activo para calcular órdenes por hora: con menos, un solo trabajo dispararía la cifra.
const ACTIVO_MINIMO_MS = 30 * MIN_MS;

const ABIERTAS = ['PENDIENTE', 'PRE-FINALIZADO', 'PRE-FINALIZADA'];
const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '');

// "35 min", "5 h 20 min", "3 d 4 h".
export function formatoTiempo(ms) {
  const minutos = Math.round((ms || 0) / MIN_MS);
  if (minutos < 60) return `${minutos} min`;
  if (minutos < 48 * 60) return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
  return `${Math.floor(minutos / 1440)} d ${Math.floor((minutos % 1440) / 60)} h`;
}

export const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : null);
export const textoPorcentaje = (valor) => (valor === null ? '—' : `${valor}%`);

// Las órdenes vivas y las archivadas en los cierres cargados, sin repetir ninguna (si una está en los dos lados, gana la viva).
export function todasLasOrdenes(tickets, reports) {
  const vistas = new Set();
  const lista = [];
  // A las archivadas se les agrega cuándo se hizo el cierre que las guardó (`_cierreEn`), por si no traen fecha propia.
  const archivadas = reports.flatMap((r) => (r.ticketsDetalle || []).map((t) => ({ ...t, _cierreEn: r.createdAt })));
  for (const original of [...tickets, ...archivadas]) {
    // Una que quedó como ELIMINADO de antes se lee como cancelada (ya solo existe cancelada).
    const t = comoCancelada(original);
    const clave = t.id ?? `${t.codigo}-${t.createdAt}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    lista.push(t);
  }
  return lista;
}

// Desde cuándo corre el tiempo de una orden: cuando se creó o, si se programó para después, desde ese día (la espera programada no es atraso).
export function inicioAtencion(t) {
  const creada = Number(t.createdAt) || 0;
  const programada = /^\d{4}-\d{2}-\d{2}$/.test(t.fechaProgramada || '') ? Date.parse(`${t.fechaProgramada}T00:00:00-04:00`) : 0;
  return Math.max(creada, programada || 0);
}

export const finalizadaEn = (t, rango) => t.estado === 'FINALIZADO' && Number(t.finalizadoEn) > 0 && enRango(diaDe(Number(t.finalizadoEn)), rango);
export const delTecnico = (t, tecnico) => !tecnico || (t.tecnico || '').toUpperCase() === tecnico.toUpperCase();

// Cuánto tardó en finalizarse (ms), o null si faltan fechas.
export function duracionAtencion(t) {
  const inicio = inicioAtencion(t);
  const fin = Number(t.finalizadoEn) || 0;
  return t.estado === 'FINALIZADO' && inicio > 0 && fin >= inicio ? fin - inicio : null;
}

const mediana = (ordenadas) => {
  const n = ordenadas.length;
  if (n === 0) return 0;
  return n % 2 ? ordenadas[(n - 1) / 2] : (ordenadas[n / 2 - 1] + ordenadas[n / 2]) / 2;
};

// { cantidad, promedio, mediana, maximo, dentroMeta, pctMeta } de una lista de duraciones (ms).
export function estadisticaDuraciones(duraciones, metaMs) {
  const lista = [...duraciones].sort((a, b) => a - b);
  const cantidad = lista.length;
  const dentroMeta = lista.filter((d) => d <= metaMs).length;
  return {
    cantidad,
    promedio: cantidad ? lista.reduce((s, d) => s + d, 0) / cantidad : 0,
    mediana: mediana(lista),
    maximo: cantidad ? lista[cantidad - 1] : 0,
    dentroMeta,
    pctMeta: porcentaje(dentroMeta, cantidad),
  };
}

export const agrupar = (lista, clave) => {
  const mapa = new Map();
  for (const item of lista) {
    const k = clave(item) || 'SIN ASIGNAR';
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(item);
  }
  return mapa;
};

// Tiempo de atención de las órdenes finalizadas en el rango: en total, por tipo de trabajo y por técnico.
export function tiempoDeAtencion(ordenes, rango, { tecnico, metaMs }) {
  const finalizadas = ordenes.filter((t) => finalizadaEn(t, rango) && delTecnico(t, tecnico));
  const conDuracion = finalizadas.map((t) => ({ t, ms: duracionAtencion(t) })).filter((x) => x.ms !== null);
  const filas = (clave) => [...agrupar(conDuracion, (x) => clave(x.t)).entries()]
    .map(([nombre, lista]) => ({ nombre, ...estadisticaDuraciones(lista.map((x) => x.ms), metaMs) }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
  return {
    finalizadas: finalizadas.length,
    sinFecha: finalizadas.length - conDuracion.length,
    total: estadisticaDuraciones(conDuracion.map((x) => x.ms), metaMs),
    porTipo: filas((t) => t.tipoTrabajo),
    porTecnico: filas((t) => t.tecnico),
  };
}

// Las órdenes abiertas que llevan más tiempo esperando (sin contar las programadas para más adelante), la más vieja primero.
export function pendientesMasAntiguas(ordenes, ahora, { tecnico, limite = 10 } = {}) {
  return ordenes
    .filter((t) => ABIERTAS.includes(t.estado) && delTecnico(t, tecnico))
    .map((orden) => ({ orden, desde: inicioAtencion(orden) }))
    .filter(({ desde }) => desde > 0 && desde <= ahora)
    .map(({ orden, desde }) => ({ orden, desde, esperaMs: ahora - desde }))
    .sort((a, b) => b.esperaMs - a.esperaMs)
    .slice(0, limite);
}

// Por técnico: órdenes finalizadas en el rango, tiempo activo (del registro de activación), órdenes por hora activa y tiempo medio de atención.
export function productividad(ordenes, eventos, rango, ahora, { tecnico } = {}) {
  const filas = new Map();
  const fila = (nombre) => {
    if (!filas.has(nombre)) filas.set(nombre, { tecnico: nombre, finalizadas: 0, activoMs: 0, duraciones: [] });
    return filas.get(nombre);
  };
  for (const t of ordenes) {
    if (!t.tecnico || !finalizadaEn(t, rango) || !delTecnico(t, tecnico)) continue;
    const f = fila(t.tecnico.toUpperCase());
    f.finalizadas += 1;
    const ms = duracionAtencion(t);
    if (ms !== null) f.duraciones.push(ms);
  }
  for (const [nombre, dias] of Object.entries(duracionActivaPorDia(eventos, ahora))) {
    if (!delTecnico({ tecnico: nombre }, tecnico)) continue;
    const activoMs = Object.entries(dias).filter(([dia]) => enRango(dia, rango)).reduce((s, [, ms]) => s + ms, 0);
    if (activoMs > 0) fila(nombre.toUpperCase()).activoMs += activoMs;
  }
  return [...filas.values()]
    .map(({ duraciones, ...f }) => ({
      ...f,
      atencionMedia: duraciones.length ? duraciones.reduce((s, d) => s + d, 0) / duraciones.length : null,
      porHora: f.activoMs >= ACTIVO_MINIMO_MS ? f.finalizadas / (f.activoMs / HORA_MS) : null,
    }))
    .sort((a, b) => b.finalizadas - a.finalizadas || a.tecnico.localeCompare(b.tecnico));
}

const tuvoDevolucion = (t) => (t.historialEdiciones || []).some((e) => clasificarEvento(e) === 'devuelto');

// Calidad del trabajo de las órdenes finalizadas en el rango, por técnico:
//   reincidencia: el cliente abrió una avería dentro de VENTANA_REINCIDENCIA_DIAS después de finalizar;
//   señal débil: de las órdenes con potencia registrada, las que quedaron por debajo del mínimo;
//   devueltas: la oficina las regresó al técnico al menos una vez.
export function calidad(ordenes, rango, { tecnico } = {}) {
  const averiasPorCliente = new Map();
  for (const t of ordenes) {
    const cliente = soloDigitos(t.cedula);
    if (cliente.length < 5 || t.tipoTrabajo !== 'AVERÍA' || !(Number(t.createdAt) > 0)) continue;
    if (!averiasPorCliente.has(cliente)) averiasPorCliente.set(cliente, []);
    averiasPorCliente.get(cliente).push(t);
  }

  const filas = new Map();
  const reincidencias = [];
  for (const t of ordenes) {
    if (!t.tecnico || !finalizadaEn(t, rango) || !delTecnico(t, tecnico)) continue;
    const nombre = t.tecnico.toUpperCase();
    if (!filas.has(nombre)) filas.set(nombre, { tecnico: nombre, finalizadas: 0, reincidieron: 0, conPotencia: 0, debiles: 0, devueltas: 0 });
    const f = filas.get(nombre);
    f.finalizadas += 1;
    if (tuvoDevolucion(t)) f.devueltas += 1;
    const potencia = t.potenciaDbm;
    if (potencia !== null && potencia !== undefined && potencia !== '' && !Number.isNaN(Number(potencia))) {
      f.conPotencia += 1;
      if (Number(potencia) < POTENCIA_MIN_DBM) f.debiles += 1;
    }
    const fin = Number(t.finalizadoEn);
    const siguiente = (averiasPorCliente.get(soloDigitos(t.cedula)) || [])
      .filter((a) => a !== t && (t.id === undefined || a.id !== t.id) && Number(a.createdAt) > fin && Number(a.createdAt) <= fin + VENTANA_REINCIDENCIA_DIAS * DIA_MS)
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (siguiente) {
      f.reincidieron += 1;
      reincidencias.push({ tecnico: nombre, cliente: t.nombre || '', codigo: t.codigo, finalizadoEn: fin, siguiente: siguiente.codigo, siguienteEn: Number(siguiente.createdAt), dias: Math.floor((Number(siguiente.createdAt) - fin) / DIA_MS) });
    }
  }
  const lista = [...filas.values()].map((f) => ({
    ...f,
    pctReincidencia: porcentaje(f.reincidieron, f.finalizadas),
    pctDebil: porcentaje(f.debiles, f.conPotencia),
    pctDevueltas: porcentaje(f.devueltas, f.finalizadas),
  })).sort((a, b) => b.finalizadas - a.finalizadas || a.tecnico.localeCompare(b.tecnico));
  const suma = (campo) => lista.reduce((s, f) => s + f[campo], 0);
  return {
    filas: lista,
    reincidencias: reincidencias.sort((a, b) => b.finalizadoEn - a.finalizadoEn),
    total: {
      finalizadas: suma('finalizadas'),
      pctReincidencia: porcentaje(suma('reincidieron'), suma('finalizadas')),
      pctDebil: porcentaje(suma('debiles'), suma('conPotencia')),
      pctDevueltas: porcentaje(suma('devueltas'), suma('finalizadas')),
    },
  };
}

// --- Secciones de CSV (lo mismo que muestran las pantallas) ---
const fechaHora = (ms) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms)).replace(',', '');
const horasDecimal = (ms) => (ms / HORA_MS).toFixed(2).replace('.', ',');
const pct = (v) => (v === null ? '' : `${v}%`);

export function seccionesTiempoAtencion(atencion, pendientes, metaHoras) {
  const filasEstadistica = (lista) => lista.map((f) => [f.nombre, f.cantidad, formatoTiempo(f.promedio), formatoTiempo(f.mediana), formatoTiempo(f.maximo), pct(f.pctMeta)]);
  const cabecera = (primera) => [primera, 'Finalizadas', 'Promedio', 'Mediana', 'Más lenta', `Dentro de ${metaHoras} h`];
  return [
    { titulo: 'Por tipo de trabajo', cabecera: cabecera('Tipo'), filas: filasEstadistica(atencion.porTipo) },
    { titulo: 'Por técnico', cabecera: cabecera('Técnico'), filas: filasEstadistica(atencion.porTecnico) },
    { titulo: 'Pendientes más antiguas', cabecera: ['Código', 'Cliente', 'Técnico', 'Tipo', 'Estado', 'Espera'], filas: pendientes.map(({ orden, esperaMs }) => [orden.codigo, orden.nombre, orden.tecnico || 'SIN TÉCNICO', orden.tipoTrabajo, orden.estado, formatoTiempo(esperaMs)]) },
  ];
}

export function seccionesProductividad(filas) {
  return [{
    titulo: 'Productividad por técnico',
    cabecera: ['Técnico', 'Finalizadas', 'Tiempo activo (h)', 'Finalizadas por hora activa', 'Tiempo medio de atención'],
    filas: filas.map((f) => [f.tecnico, f.finalizadas, horasDecimal(f.activoMs), f.porHora === null ? '' : f.porHora.toFixed(2).replace('.', ','), f.atencionMedia === null ? '' : formatoTiempo(f.atencionMedia)]),
  }];
}

export function seccionesCalidad(cal) {
  return [
    {
      titulo: 'Calidad por técnico',
      cabecera: ['Técnico', 'Finalizadas', 'Reincidieron', '% reincidencia', 'Con potencia', 'Señal débil', '% señal débil', 'Devueltas por la oficina', '% devueltas'],
      filas: cal.filas.map((f) => [f.tecnico, f.finalizadas, f.reincidieron, pct(f.pctReincidencia), f.conPotencia, f.debiles, pct(f.pctDebil), f.devueltas, pct(f.pctDevueltas)]),
    },
    {
      titulo: `Clientes que reincidieron (avería dentro de ${VENTANA_REINCIDENCIA_DIAS} días)`,
      cabecera: ['Técnico', 'Cliente', 'Orden finalizada', 'Finalizada el', 'Nueva avería', 'Días después'],
      filas: cal.reincidencias.map((r) => [r.tecnico, r.cliente, r.codigo, fechaHora(r.finalizadoEn), r.siguiente, r.dias]),
    },
  ];
}
