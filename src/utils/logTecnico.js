// Registro de activación de los técnicos (technicianLog): un evento por cada vez que se marca activo o inactivo, y de ahí cuánto
// tiempo estuvo activo cada técnico por día. Pensado para un reporte: filas listas para exportar (filasLogTecnico, filasDuracionDiaria).
// El día es el de Caracas, como lo cuentan el cierre y los totales del mes.
import { diaDe } from './totalesMes.js';
import { celda } from './csvReporte.js';
import { enRango } from './periodoReporte.js';

const MIN_MS = 60 * 1000;
const HORA_MS = 60 * MIN_MS;
const DIA_MS = 24 * HORA_MS;

// El documento que se guarda junto al cambio de `activo` en el técnico. Nunca se edita ni se borra.
export function eventoActivacion({ tecnicoId, tecnico, activo, por, rol }, ahora = Date.now()) {
  return { tecnicoId, tecnico, activo: Boolean(activo), en: ahora, dia: diaDe(ahora), por: por || null, rol: rol || null };
}

// "2026-10-19" → inicio (ms) de ese día en Caracas (UTC-4, sin horario de verano).
const inicioDia = (dia) => Date.parse(`${dia}T00:00:00-04:00`);

// Ordena por hora (y por id si coinciden, para que el resultado no cambie entre lecturas).
const porHora = (a, b) => (a.en - b.en) || String(a.id || '').localeCompare(String(b.id || ''));

// { 'GERARDO': { '2026-10-19': [[inicioMs, finMs], ...], ... }, ... } los tramos en que estuvo activo cada técnico, por día.
//   eventos: los del registro (tecnico, activo, en). Pueden venir de varios técnicos y sin orden.
//   hasta: hasta cuándo se cuenta (ahora). Un técnico que sigue activo suma hasta ese momento.
// Solo cuenta el tiempo entre una activación registrada y su desactivación (o `hasta`): lo anterior al primer evento no se conoce.
// Una activación repetida (ya estaba activo) no reinicia el reloj, y un tramo que cruza la medianoche se reparte entre los dos días.
export function tramosActivosPorDia(eventos, hasta = Date.now()) {
  const resultado = {};
  const porTecnico = new Map();
  for (const e of eventos || []) {
    if (!e?.tecnico || !Number.isFinite(e.en)) continue;
    if (!porTecnico.has(e.tecnico)) porTecnico.set(e.tecnico, []);
    porTecnico.get(e.tecnico).push(e);
  }
  for (const [tecnico, lista] of porTecnico) {
    const dias = {};
    let desde = null;
    const cerrar = (fin) => {
      if (desde === null || fin <= desde) { desde = null; return; }
      for (let cursor = desde; cursor < fin;) {
        const dia = diaDe(cursor);
        const finDia = Math.min(inicioDia(dia) + DIA_MS, fin);
        (dias[dia] ||= []).push([cursor, finDia]);
        cursor = finDia;
      }
      desde = null;
    };
    for (const e of [...lista].sort(porHora)) {
      if (e.en > hasta) break;
      if (e.activo) { if (desde === null) desde = e.en; } else cerrar(e.en);
    }
    cerrar(hasta);
    resultado[tecnico] = dias;
  }
  return resultado;
}

// { 'GERARDO': { '2026-10-19': 3_600_000, ... }, ... } milisegundos activo por técnico y por día (los mismos tramos, sumados).
export function duracionActivaPorDia(eventos, hasta = Date.now()) {
  const resultado = {};
  for (const [tecnico, dias] of Object.entries(tramosActivosPorDia(eventos, hasta))) {
    resultado[tecnico] = Object.fromEntries(Object.entries(dias).map(([dia, tramos]) => [dia, tramos.reduce((suma, [ini, fin]) => suma + (fin - ini), 0)]));
  }
  return resultado;
}

// En qué parte del día (0 a 1) cae un instante, para dibujar el tramo en una barra de 24 horas.
export const fraccionDelDia = (ms, dia) => Math.min(1, Math.max(0, (ms - inicioDia(dia)) / DIA_MS));

// "2 h 05 min", "35 min", "0 min".
export function formatoDuracion(ms) {
  const minutos = Math.round((ms || 0) / MIN_MS);
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

const formatoFechaHora = (ms) => new Intl.DateTimeFormat('es-VE', {
  timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(ms)).replace(',', '');

// Filas para el reporte de movimientos: una por evento, de más antiguo a más nuevo.
//   desde/hasta: días "YYYY-MM-DD" (incluidos); sin ellos, todo.
export function filasLogTecnico(eventos, { desde, hasta, tecnico } = {}) {
  return [...(eventos || [])]
    .filter((e) => Number.isFinite(e.en) && (!desde || e.dia >= desde) && (!hasta || e.dia <= hasta) && (!tecnico || e.tecnico === tecnico))
    .sort(porHora)
    .map((e) => ({
      tecnico: e.tecnico,
      accion: e.activo ? 'ACTIVADO' : 'DESACTIVADO',
      fechaHora: formatoFechaHora(e.en),
      dia: e.dia,
      por: e.por || '',
      rol: e.rol || '',
    }));
}

// Filas para el reporte de duración: una por técnico y día, con el tiempo activo.
export function filasDuracionDiaria(eventos, { desde, hasta, tecnico, ahora = Date.now() } = {}) {
  const filas = [];
  for (const [nombre, dias] of Object.entries(duracionActivaPorDia(eventos, ahora))) {
    if (tecnico && nombre !== tecnico) continue;
    for (const [dia, ms] of Object.entries(dias)) {
      if ((desde && dia < desde) || (hasta && dia > hasta)) continue;
      filas.push({ tecnico: nombre, dia, ms, duracion: formatoDuracion(ms) });
    }
  }
  return filas.sort((a, b) => a.dia.localeCompare(b.dia) || a.tecnico.localeCompare(b.tecnico));
}

// El reporte de activación listo para bajar: primero el tiempo activo por técnico y día, luego cada movimiento.
export function csvActivacionTecnicos(eventos, filtros = {}) {
  const duracion = filasDuracionDiaria(eventos, filtros);
  const movimientos = filasLogTecnico(eventos, filtros);
  const lineas = [
    ['Activación de técnicos'],
    [`Del ${filtros.desde || 'inicio'} al ${filtros.hasta || 'hoy'}`, filtros.tecnico ? `Técnico: ${filtros.tecnico}` : 'Todos los técnicos'],
    [],
    ['Tiempo activo por día'],
    ['Técnico', 'Día', 'Tiempo activo', 'Horas'],
    ...duracion.map((f) => [f.tecnico, f.dia, f.duracion, (f.ms / HORA_MS).toFixed(2).replace('.', ',')]),
    [],
    ['Movimientos'],
    ['Técnico', 'Acción', 'Fecha y hora', 'Hecho por', 'Rol'],
    ...movimientos.map((f) => [f.tecnico, f.accion, f.fechaHora, f.por, f.rol]),
  ];
  return `${String.fromCharCode(0xFEFF)}${lineas.map((fila) => fila.map(celda).join(';')).join('\r\n')}\r\n`;
}

// Lo que muestra el reporte de activación para un rango: por técnico los días con actividad y el total, más los movimientos del rango.
//   tecnicos: [{ nombre, dias (del más nuevo al más viejo), total }] de más a menos tiempo activo; tramos y duraciones por técnico y día.
export function activacionPorTecnico(eventos, rango, tecnico, ahora) {
  const tramos = tramosActivosPorDia(eventos, ahora);
  const duraciones = duracionActivaPorDia(eventos, ahora);
  const tecnicos = Object.keys(tramos)
    .filter((t) => !tecnico || t === tecnico)
    .map((nombre) => {
      const dias = Object.keys(tramos[nombre]).filter((d) => enRango(d, rango)).sort().reverse();
      return { nombre, dias, total: dias.reduce((suma, d) => suma + duraciones[nombre][d], 0) };
    })
    .filter((t) => t.dias.length > 0)
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  return {
    tramos,
    duraciones,
    tecnicos,
    movimientos: filasLogTecnico(eventos, { ...rango, tecnico: tecnico || undefined }).reverse(),
    total: tecnicos.reduce((suma, t) => suma + t.total, 0),
    diasConTecnico: tecnicos.reduce((suma, t) => suma + t.dias.length, 0),
  };
}
