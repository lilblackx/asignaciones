import { separarNapPuerto } from './napPuerto.js';
import { fechaISO, partesISO } from './calendario.js';
import { textoPlantillaFinal } from './estadoInstalacion.js';

// Módulo de Infraestructura: las instalaciones ya realizadas (finalizadas), con la NAP y el puerto donde quedó conectado cada cliente. Funciones puras.
// Las órdenes vivas (aún sin cierre del día) y las archivadas por los cierres de los últimos DIAS_INFRAESTRUCTURA días se unen en una sola lista.
export const DIAS_INFRAESTRUCTURA = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

export const PERIODOS_INFRAESTRUCTURA = [
  { valor: 'HOY', etiqueta: 'Hoy', dias: 1 },
  { valor: '7', etiqueta: '7 días', dias: 7 },
  { valor: '30', etiqueta: '30 días', dias: DIAS_INFRAESTRUCTURA },
];
// "Rango": el período lo elige quien mira con dos fechas (Desde y Hasta, ambas incluidas), dentro de los días que se leen.
export const PERIODO_RANGO = 'RANGO';

const texto = (v) => String(v ?? '').trim();
const sinTildes = (t) => texto(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const inicioDelDia = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Desde cuándo cuenta un período: "Hoy" desde las 12 de la noche; "7 días" y "30 días", los días completos que dice, contando hoy.
export const desdePeriodo = (valor, ahora = Date.now()) => {
  const p = PERIODOS_INFRAESTRUCTURA.find((x) => x.valor === valor) || PERIODOS_INFRAESTRUCTURA[PERIODOS_INFRAESTRUCTURA.length - 1];
  return inicioDelDia(ahora) - (p.dias - 1) * DIA_MS;
};

// Los límites que puede elegir en un rango: de hace DIAS_INFRAESTRUCTURA - 1 días a hoy ("AAAA-MM-DD").
export const limitesRango = (ahora = Date.now()) => ({ min: fechaISO(desdePeriodo('30', ahora)), max: fechaISO(ahora) });

// Una fecha "AAAA-MM-DD" -> el instante en que empieza ese día (12 de la noche, hora local); null si no es una fecha.
const inicioDeFecha = (iso) => { const f = partesISO(iso); return f ? new Date(f.anio, f.mes - 1, f.dia).getTime() : null; };

// Una orden -> la fila del módulo. La NAP y el puerto salen de los datos de la instalación o, si no están sueltos, del texto de la orden ("NAP O02D10 - Puerto 3").
export function filaInstalacion(t) {
  const inst = t.instalacion || {};
  const separado = separarNapPuerto(t.nap);
  return {
    id: t.id ?? `${t.codigo}-${t.createdAt}`,
    codigo: texto(t.codigo),
    cliente: texto(t.nombre),
    direccion: texto(t.direccion),
    tecnico: texto(t.tecnico),
    nap: texto(inst.nap || separado.nap),
    puerto: texto(inst.puerto || separado.puerto),
    puertosDisponibles: texto(inst.puertosDisponibles),
    fecha: t.finalizadoEn || t._cierreEn || t.archivadoEn || t.createdAt || 0,
    // La plantilla final ya llena (la que copia la oficina); vacía si la orden nunca tuvo la plantilla de la promotora.
    plantilla: textoPlantillaFinal(t),
  };
}

// Las instalaciones finalizadas de las órdenes vivas y de los cierres, sin repetir (si una orden está en las dos, vale la viva), de la más reciente a la más vieja.
export function instalacionesRealizadas(tickets = [], reports = []) {
  const archivadas = reports.flatMap((r) => (r.ticketsDetalle || []).map((t) => ({ ...t, _cierreEn: r.createdAt })));
  const vistas = new Set();
  const filas = [];
  for (const t of [...tickets, ...archivadas]) {
    if (t.tipoTrabajo !== 'INSTALACIÓN' || t.estado !== 'FINALIZADO') continue;
    const fila = filaInstalacion(t);
    if (vistas.has(fila.id)) continue;
    vistas.add(fila.id);
    filas.push(fila);
  }
  return filas.sort((a, b) => b.fecha - a.fecha);
}

// Por período y por lo que se escribe en el buscador (cliente, código, técnico, NAP o dirección; cada palabra debe aparecer en alguno).
// Con el período "RANGO" cuentan los días de `desde` a `hasta` (ambos incluidos); si falta una de las dos fechas, ese lado queda abierto, y si vienen al revés se toman en el orden correcto.
export function filtrarInstalaciones(filas, { periodo = '30', busqueda = '', desde: desdeIso = '', hasta: hastaIso = '', ahora = Date.now() } = {}) {
  let desde = desdePeriodo(periodo, ahora);
  let antesDe = Infinity;
  if (periodo === PERIODO_RANGO) {
    const a = inicioDeFecha(desdeIso);
    const b = inicioDeFecha(hastaIso);
    const [primero, ultimo] = a !== null && b !== null && a > b ? [b, a] : [a, b];
    desde = primero ?? desdePeriodo('30', ahora);
    antesDe = ultimo === null || ultimo === undefined ? Infinity : new Date(ultimo).setDate(new Date(ultimo).getDate() + 1);
  }
  const palabras = sinTildes(busqueda).split(/\s+/).filter(Boolean);
  return filas.filter((f) => {
    if (f.fecha < desde || f.fecha >= antesDe) return false;
    if (!palabras.length) return true;
    const pajar = sinTildes(`${f.cliente} ${f.codigo} ${f.tecnico} ${f.nap} ${f.direccion}`);
    return palabras.every((p) => pajar.includes(p));
  });
}

// Las marcas de "ya la anoté" viven en un documento por mes ("AAAA-MM", hora local) según cuándo se hizo la instalación.
export const mesDeMarcas = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// Los meses que toca leer para cubrir los últimos DIAS_INFRAESTRUCTURA días (el actual y, casi siempre, el anterior).
export const mesesDeMarcas = (ahora = Date.now()) => [...new Set([mesDeMarcas(desdePeriodo('30', ahora)), mesDeMarcas(ahora)])];

export const FILTROS_ANOTADA = [
  { valor: 'TODAS', etiqueta: 'Todas' },
  { valor: 'POR_ANOTAR', etiqueta: 'Por anotar' },
  { valor: 'ANOTADAS', etiqueta: 'Anotadas' },
];

// `marcas`: { idDeLaOrden: { por, en } }. Con "TODAS" no se filtra.
export const filtrarPorAnotada = (filas, marcas = {}, modo = 'TODAS') => {
  if (modo === 'POR_ANOTAR') return filas.filter((f) => !marcas[f.id]);
  if (modo === 'ANOTADAS') return filas.filter((f) => marcas[f.id]);
  return filas;
};
