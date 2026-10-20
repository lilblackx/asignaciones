// Las hojas del mes que el departamento lleva en su hoja de cálculo (Visitas, Averías, Instalaciones, Estadísticas), armadas desde las órdenes.
// Cada hoja es una lista con una fila por orden (ODT, cliente, técnico, horas, TIPO, materiales...) y un cuadro de estadística que
// cuenta esa misma lista. Todo son funciones puras: las usan la pantalla, el CSV y el PDF/Word.
//
// TIPO de una orden en la hoja de visitas (una sola por orden, como la columna TIPO de la hoja):
//   NR  trabajo no realizado (la orden se canceló)
//   GA  garantía (el tipo de trabajo es garantía): es solo informativo, no suma ni resta en ningún total ni en EX
//   EX  visita exonerada
//   AC  visita cobrada al cliente
//   SC  finalizada sin cobro registrado: no existe en la hoja; se muestra aparte para que no se pierda en silencio
// TIPO de una orden en la hoja de averías: NR (se canceló), EX (exonerada) o AC (cobrada al cliente); SC si se finalizó sin cobro registrado.
// PROCESO de una instalación en la hoja de instalaciones: F (finalizada) o NR (no realizada: se canceló).
// Estadística de instalaciones: TOTAL = F + NR; los planes (200 Mbps, 1 GB, 400 Mbps, 100 Mbps) salen de la línea "Plan a contratar" de la
// plantilla de la promotora; los equipos, del tipo de equipo de la orden; el drop, del metraje que registró el técnico; los conectores, de los
// que usó por color.
// Estadística de averías: TOTAL = EX + AC + NR; PAGADAS A TÉCNICO = EX + AC; LOW SIGNAL cuenta las órdenes de ese tipo y SIEMPRE son exoneradas (EX), tengan
// o no cobro registrado, así que también entran en pagadas a técnico (una low signal cancelada es NR);
// GA (garantía) es informativo: se cuenta aparte y no entra en EX, AC, NR ni en los totales.
// Estadística de visitas (las fórmulas de la hoja):
//   EX                 = las EX (la garantía NO cuenta como exonerada)
//   TOTAL VISITAS      = EX + AC + NR
//   PAGADAS A TÉCNICO  = EX + AC
//   GA                 = solo informativo: no suma ni resta en nada
// La validación de NAP (VN) y los trabajos adicionales de infraestructura (TA) no son visitas: van en su propia hoja ("VN y TA", la pestaña VN/TA de
// la hoja de cálculo), que se llena a mano (utils/registroVnTa). Las órdenes de validación de NAP y las escaladas a infraestructura no cuentan en
// ninguna de las hojas que se arman solas.
//   TOTAL ATENDIDO     = PAGADAS A TÉCNICO
import { diaDe } from './totalesMes.js';
import { enRango } from './periodoReporte.js';
import { delTecnico, inicioAtencion } from './gestionTecnicos.js';
import { estaExonerado, monedaDe, textoMonto } from './cobro.js';
import { formatearCedula } from './cedula.js';
import { conectoresPorColor } from './consumoMateriales.js';
import { esInstalacion, metrajeInstalacion } from './instalacion.js';
import { parseDatosClienteTemplate } from './whatsapp.js';
import { fueEscalada, infraestructuraDe } from './infraestructura.js';
import { motivoCancelacion } from './cancelacion.js';
import { TIPO_RECABLEADO, etiquetaTipoVisita } from './tipoVisita.js';

export const TIPOS_VISITA_HOJA = ['EX', 'AC', 'NR', 'GA'];
export const EQUIPOS = ['SM', 'MTV', 'MR', 'MRTV'];

const TRABAJOS_VISITA = ['MUDANZA', 'GARANTIA', 'RETIRO EQUIPO'];
const trabajoDe = (t) => String(t?.tipoTrabajo || '').trim().toUpperCase();

// ¿A qué hoja pertenece la orden? 'VISITAS' (mudanzas, retiros y garantías), 'INSTALACIONES' o 'AVERIAS' (el resto: averías, reconexiones, low signal y
// cambios de equipo). 'VNTA' (validaciones de NAP y lo escalado a infraestructura) es la hoja manual: esas órdenes no entran en las otras.
export function hojaDe(t) {
  if (esInstalacion(t?.tipoTrabajo)) return 'INSTALACIONES';
  if (fueEscalada(t) || trabajoDe(t) === 'VALIDACION NAP') return 'VNTA';
  if (TRABAJOS_VISITA.includes(trabajoDe(t))) return 'VISITAS';
  return 'AVERIAS';
}

// El TIPO de la orden para la hoja de visitas.
export function tipoDeVisita(t) {
  if (t?.estado === 'CANCELADO') return 'NR';
  if (trabajoDe(t) === 'GARANTIA') return 'GA';
  if (estaExonerado(t)) return 'EX';
  return t?.cobroBs ? 'AC' : 'SC';
}

// El TIPO de la orden para la hoja de averías.
export function tipoDeAveria(t) {
  if (t?.estado === 'CANCELADO') return 'NR';
  if (trabajoDe(t) === 'GARANTIA' || String(t?.falla || '').trim().toUpperCase().startsWith('GARANT')) return 'GA';
  // Low signal: siempre exonerada, aunque se haya registrado un cobro o ninguno.
  if (trabajoDe(t) === 'LOW SIGNAL' || estaExonerado(t)) return 'EX';
  return t?.cobroBs ? 'AC' : 'SC';
}

// El plan contratado de una instalación, de la línea "Plan a contratar" de la plantilla de la promotora: '100 Mbps', '200 Mbps', '400 Mbps',
// '1 GB', o el texto tal cual si no se reconoce; '' si la plantilla no lo trae.
export function planDe(t) {
  const texto = String(parseDatosClienteTemplate(t?.plantillaOriginal).plan || '').trim();
  if (!texto) return '';
  const giga = /(\d+)\s*(?:g\b|gb|gbps|giga)/i.exec(texto);
  if (giga) return `${Number(giga[1])} GB`;
  const mega = /(\d{2,4})\s*(?:m\b|mb|mbps|mega)?/i.exec(texto);
  if (mega) return Number(mega[1]) >= 1000 ? `${Number(mega[1]) / 1000} GB` : `${Number(mega[1])} Mbps`;
  return texto;
}

// El PROCESO de una instalación: F (finalizada) o NR (no realizada).
export const procesoDeInstalacion = (t) => (t?.estado === 'CANCELADO' ? 'NR' : t?.estado === 'FINALIZADO' ? 'F' : '');

const tipoDeHoja = (t, hoja) => (hoja === 'AVERIAS' ? tipoDeAveria(t) : tipoDeVisita(t));

// Cuándo se terminó el trabajo: la hora en que el técnico pre-finalizó (si la orden la guardó) y, si no, la hora en que la oficina la
// finalizó. Así el tiempo de respuesta no se infla cuando la oficina aprueba tarde. 0 = no se terminó.
export function culminadaEn(t) {
  const aprobada = Number(t?.finalizadoEn) || 0;
  const tecnico = Number(t?.prefinalizadoEn) || 0;
  return t?.estado === 'FINALIZADO' ? ((tecnico > 0 && (aprobada === 0 || tecnico <= aprobada) ? tecnico : aprobada)) : 0;
}

// Cuándo cuenta la orden en el periodo: lo finalizado, el día en que se terminó el trabajo (ver culminadaEn); lo cancelado, el día en que se canceló (las
// canceladas antes de que se guardara esa fecha, el día en que se crearon); lo escalado, el día en que se escaló. Una orden que sigue pendiente (y no está escalada) todavía no cuenta. 0 = no cuenta.
export function fechaDeHoja(t) {
  if (t?.estado === 'CANCELADO') return Number(t.canceladaEn) || Number(t.createdAt) || 0;
  const escalada = infraestructuraDe(t);
  if (escalada) return Number(escalada.en) || 0;
  return culminadaEn(t);
}

// Las órdenes de una hoja en el periodo, de la más antigua a la más nueva (como se lleva la hoja), sin repetir ninguna.
export function ordenesDeHoja(ordenes, hoja, rango, { tecnico } = {}) {
  const vistas = new Set();
  return ordenes
    .filter((t) => {
      const fecha = fechaDeHoja(t);
      if (!fecha || hojaDe(t) !== hoja || !delTecnico(t, tecnico) || !enRango(diaDe(fecha), rango)) return false;
      const clave = t.id ?? `${t.codigo}-${t.createdAt}`;
      if (vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    })
    .sort((a, b) => fechaDeHoja(a) - fechaDeHoja(b));
}

// El equipo (SM, MTV, MR, MRTV) de la orden, o '' (en un cambio de equipo el tipo de equipo va en la falla).
export function equipoDe(t) {
  const equipo = String(t?.falla || '').trim().toUpperCase();
  return EQUIPOS.includes(equipo) ? equipo : '';
}

// El material que gastó la orden: conectores por color y metros de cable (drop). Solo cuenta lo finalizado y que no se escaló.
export function materialDe(t) {
  if (t?.estado !== 'FINALIZADO' || fueEscalada(t)) return { verde: 0, azul: 0, drop: 0 };
  const { verde, azul } = conectoresPorColor(t);
  const drop = t.tipoVisita === TIPO_RECABLEADO ? Number(t.metrosCable) || 0 : (esInstalacion(t.tipoTrabajo) ? metrajeInstalacion(t) || 0 : 0);
  return { verde, azul, drop };
}

// "4:51:00" (horas sin tope) de una duración en ms.
export function horasMinSeg(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const dosDigitos = (n) => String(n).padStart(2, '0');
  return `${Math.floor(total / 3600)}:${dosDigitos(Math.floor((total % 3600) / 60))}:${dosDigitos(total % 60)}`;
}

// Cuánto tardó: desde que se creó (o desde el día programado) hasta que se terminó el trabajo (ver culminadaEn). null si no se finalizó.
export function tiempoDeRespuesta(t) {
  const inicio = inicioAtencion(t);
  const fin = culminadaEn(t);
  return t?.estado === 'FINALIZADO' && inicio > 0 && fin >= inicio ? fin - inicio : null;
}

// Lo que dice la columna OBSERVACIONES: qué se hizo.
export function observacionDe(t) {
  const cancelacion = motivoCancelacion(t);
  if (cancelacion) return `Cancelada: ${cancelacion}`;
  const escalada = infraestructuraDe(t);
  if (escalada) return `Infraestructura: ${escalada.motivo || ''}`.trim();
  if (t?.tipoVisita) return etiquetaTipoVisita(t.tipoVisita);
  const falla = String(t?.falla || '').trim();
  return falla && falla.toUpperCase() !== trabajoDe(t) ? falla : String(t?.tipoTrabajo || '');
}

// Lo que dice la columna OBSERVACIONES en una avería: el tipo de trabajo (si no es una avería común), la falla y el tipo de visita,
// por ejemplo "LOS / Conector externo".
export function observacionDeAveria(t) {
  const cancelacion = motivoCancelacion(t);
  if (cancelacion) return `Cancelada: ${cancelacion}`;
  const trabajo = String(t?.tipoTrabajo || '').trim();
  const partes = [];
  const agregar = (texto) => { if (texto && !partes.some((p) => p.toUpperCase() === texto.toUpperCase())) partes.push(texto); };
  if (trabajoDe(t) !== 'AVERÍA') agregar(trabajo);
  agregar(String(t?.falla || '').trim());
  if (t?.tipoVisita) agregar(etiquetaTipoVisita(t.tipoVisita));
  return partes.join(' / ') || trabajo;
}

const observacionDeHoja = (t, hoja) => (hoja === 'AVERIAS' ? observacionDeAveria(t) : observacionDe(t));

// Los materiales de una lista de órdenes: equipos (solo los de cambios de equipo finalizados), conectores por color y metros de drop.
function sumarMateriales(lista) {
  const materiales = { SM: 0, MTV: 0, MR: 0, MRTV: 0, azul: 0, verde: 0, drop: 0 };
  for (const t of lista) {
    const equipo = t.estado === 'FINALIZADO' && !fueEscalada(t) ? equipoDe(t) : '';
    if (equipo) materiales[equipo] += 1;
    const { verde, azul, drop } = materialDe(t);
    materiales.verde += verde;
    materiales.azul += azul;
    materiales.drop += drop;
  }
  return materiales;
}

// --- Estadística de visitas ---

// { ex, ac, nr, ga, sc, totalVisitas, pagadas, materiales: { SM, MTV, MR, MRTV, azul, verde, drop } } de una lista de visitas.
export function estadisticaVisitas(visitas) {
  const cuenta = { EX: 0, AC: 0, NR: 0, GA: 0, SC: 0 };
  for (const t of visitas) cuenta[tipoDeVisita(t)] += 1;
  const materiales = sumarMateriales(visitas);
  const ex = cuenta.EX;
  return {
    ex, ac: cuenta.AC, nr: cuenta.NR, ga: cuenta.GA, sc: cuenta.SC,
    totalVisitas: ex + cuenta.AC + cuenta.NR,
    pagadas: ex + cuenta.AC,
    materiales,
  };
}

// { ex, ac, nr, sc, lowSignal, totalAverias, pagadas, materiales } de una lista de averías.
export function estadisticaAverias(averias) {
  const cuenta = { EX: 0, AC: 0, NR: 0, GA: 0, SC: 0 };
  for (const t of averias) cuenta[tipoDeAveria(t)] += 1;
  return {
    ex: cuenta.EX, ac: cuenta.AC, nr: cuenta.NR, ga: cuenta.GA, sc: cuenta.SC,
    lowSignal: averias.filter((t) => trabajoDe(t) === 'LOW SIGNAL').length,
    totalAverias: cuenta.EX + cuenta.AC + cuenta.NR,
    pagadas: cuenta.EX + cuenta.AC,
    materiales: sumarMateriales(averias),
  };
}

export const PLANES = ['200 Mbps', '1 GB', '400 Mbps', '100 Mbps'];

// { f, nr, total, planes: { '200 Mbps': n, ..., otros }, materiales } de una lista de instalaciones.
export function estadisticaInstalaciones(instalaciones) {
  const finalizadas = instalaciones.filter((t) => procesoDeInstalacion(t) === 'F');
  const planes = Object.fromEntries(PLANES.map((p) => [p, 0]));
  planes.otros = 0;
  for (const t of finalizadas) {
    const plan = planDe(t);
    if (PLANES.includes(plan)) planes[plan] += 1;
    else planes.otros += 1;
  }
  const nr = instalaciones.filter((t) => procesoDeInstalacion(t) === 'NR').length;
  return { f: finalizadas.length, nr, total: finalizadas.length + nr, planes, materiales: sumarMateriales(finalizadas) };
}

// --- Textos (los usan la pantalla, el PDF, el Word y el CSV) ---
const fechaCorta = (ms) => (ms ? new Date(ms).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'numeric', year: 'numeric' }) : '');
const horaCorta = (ms) => (ms ? new Date(ms).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true }) : '');

// Cliente y Observaciones pueden partirse en varias líneas; el resto (cédula, horas, fechas...) se queda en una sola.
export const columnasVisitas = () => [
  { titulo: 'N°', derecha: true }, { titulo: 'ODT', sinSalto: true }, { titulo: 'Cliente' }, { titulo: 'Cédula', sinSalto: true }, { titulo: 'Técnico', sinSalto: true },
  { titulo: 'Hora inicio', sinSalto: true }, { titulo: 'Hora culminada', sinSalto: true }, { titulo: 'Fecha de creación', sinSalto: true }, { titulo: 'Fecha final', sinSalto: true }, { titulo: 'Tiempo/Respuesta', sinSalto: true },
  { titulo: 'Observaciones' }, { titulo: 'Tipo', sinSalto: true },
  { titulo: 'SM', derecha: true }, { titulo: 'MTV', derecha: true }, { titulo: 'MR', derecha: true }, { titulo: 'MRTV', derecha: true },
  { titulo: 'Azul', derecha: true }, { titulo: 'Verde', derecha: true }, { titulo: 'Drop', derecha: true },
];

// Una fila de la lista de una hoja (visitas o averías), en el orden de `columnasVisitas`. `n` es el número de la fila.
export function filaVisita(t, n, hoja = 'VISITAS') {
  const finalizada = t.estado === 'FINALIZADO';
  const escalada = fueEscalada(t);
  const inicio = inicioAtencion(t);
  const fin = culminadaEn(t);
  const tiempo = tiempoDeRespuesta(t);
  const equipo = finalizada && !escalada ? equipoDe(t) : '';
  const { verde, azul, drop } = materialDe(t);
  const cifra = (valor) => (valor ? String(valor) : '');
  return [
    String(n), t.codigo || '', t.nombre || '', formatearCedula(t.cedula, t.tipoDocumento), t.tecnico || '',
    finalizada ? horaCorta(inicio) : '', finalizada ? horaCorta(fin) : '', fechaCorta(inicio), finalizada ? fechaCorta(fin) : '', tiempo === null ? '' : horasMinSeg(tiempo),
    observacionDeHoja(t, hoja), tipoDeHoja(t, hoja) === 'SC' ? '' : tipoDeHoja(t, hoja),
    ...EQUIPOS.map((e) => (equipo === e ? '1' : '')),
    cifra(azul), cifra(verde), cifra(drop),
  ];
}

export const columnasEstadisticaVisitas = () => [{ titulo: 'Tipo' }, { titulo: 'Concepto' }, { titulo: 'Cantidad', derecha: true }];
export function filasEstadisticaVisitas(e) {
  return [
    ['EX', 'Exoneradas', String(e.ex)],
    ['AC', 'Visitas cobradas al cliente', String(e.ac)],
    ['NR', 'Trabajos no realizados', String(e.nr)],
    ['GA', 'Garantía (informativo)', String(e.ga)],
    ['', 'TOTAL VISITAS', String(e.totalVisitas)],
    ['', 'PAGADAS A TÉCNICO', String(e.pagadas)],
    ['', 'TOTAL ATENDIDO', String(e.pagadas)],
  ];
}

export function filasEstadisticaAverias(e) {
  return [
    ['EX', 'Exoneradas', String(e.ex)],
    ['AC', 'Avería cobrada al cliente', String(e.ac)],
    ['NR', 'Trabajos no realizados', String(e.nr)],
    ['GA', 'Garantía (informativo)', String(e.ga)],
    ['', 'PAGADAS A TÉCNICO', String(e.pagadas)],
    ['', 'LOW SIGNAL', String(e.lowSignal)],
    ['', 'TOTAL AVERÍAS', String(e.totalAverias)],
  ];
}

export const columnasMaterialesVisitas = () => [{ titulo: 'Material' }, { titulo: 'Cantidad', derecha: true }];
export function filasMaterialesVisitas({ materiales: m }) {
  return [['SM', m.SM], ['MTV', m.MTV], ['MR', m.MR], ['MRTV', m.MRTV], ['Azul (conectores)', m.azul], ['Verde (conectores)', m.verde], ['Drop (metros)', m.drop]].map(([nombre, valor]) => [nombre, String(valor)]);
}

export const NOTA_VISITAS = 'Una fila por orden: las finalizadas cuentan el día en que se terminó el trabajo, las canceladas (NR) el día en que se cancelaron, con su motivo en Observaciones.';
export const avisoSinCobro = (n, singular = 'visita', plural = 'visitas') => (n > 0 ? `${n} ${n === 1 ? `${singular} finalizada` : `${plural} finalizadas`} sin cobro registrado ${n === 1 ? 'no entra' : 'no entran'} en la estadística (la hoja no tiene esa categoría).` : '');

// Las cifras de arriba de la pantalla de visitas.
export const cifrasVisitas = (e) => [
  { id: 'TOTAL', etiqueta: 'Total visitas', valor: e.totalVisitas, detalle: 'en el periodo' },
  { id: 'PAGADAS', etiqueta: 'Pagadas a técnico', valor: e.pagadas, detalle: 'en el periodo' },
  { id: 'AC', etiqueta: 'Cobradas al cliente (AC)', valor: e.ac, detalle: `${e.ex} ${e.ex === 1 ? 'exonerada' : 'exoneradas'}` },
  { id: 'NR', etiqueta: 'No realizadas (NR)', valor: e.nr, detalle: 'canceladas · ver detalle' },
];

export const cifrasAverias = (e) => [
  { id: 'TOTAL', etiqueta: 'Total averías', valor: e.totalAverias, detalle: 'en el periodo' },
  { id: 'PAGADAS', etiqueta: 'Pagadas a técnico', valor: e.pagadas, detalle: 'en el periodo' },
  { id: 'AC', etiqueta: 'Cobradas al cliente (AC)', valor: e.ac, detalle: `${e.ex} ${e.ex === 1 ? 'exonerada' : 'exoneradas'}` },
  { id: 'NR', etiqueta: 'No realizadas (NR)', valor: e.nr, detalle: 'canceladas · ver detalle' },
];

export const NOTA_AVERIAS = 'Una fila por orden: las finalizadas cuentan el día en que se terminó el trabajo y las canceladas (NR) el día en que se cancelaron, con su motivo en Observaciones. Las averías escaladas a infraestructura van a la hoja de visitas como TA.';

// La lista resumida del PDF y del Word (la hoja completa, de 19 columnas, no cabe en una hoja vertical: va en pantalla y en el CSV).
export const columnasVisitasCompacta = () => [
  { titulo: 'ODT' }, { titulo: 'Cliente' }, { titulo: 'Técnico' }, { titulo: 'Fecha final' }, { titulo: 'Tiempo' }, { titulo: 'Tipo' }, { titulo: 'Observaciones' }, { titulo: 'Material' },
];
export function filaVisitaCompacta(t, hoja = 'VISITAS') {
  const completa = filaVisita(t, 0, hoja);
  const equipo = EQUIPOS.find((e, i) => completa[12 + i]) || '';
  const { verde, azul, drop } = materialDe(t);
  const material = [equipo, verde ? `${verde} verde${verde === 1 ? '' : 's'}` : '', azul ? `${azul} azul${azul === 1 ? '' : 'es'}` : '', drop ? `${drop} m` : ''].filter(Boolean).join(', ');
  return [completa[1], completa[2], completa[4], completa[8], completa[9], completa[11], completa[10], material];
}

// --- Hoja de instalaciones ---
export const columnasInstalaciones = () => [
  { titulo: 'N°', derecha: true }, { titulo: 'ODT', sinSalto: true }, { titulo: 'Cliente' }, { titulo: 'Cédula', sinSalto: true }, { titulo: 'Técnico', sinSalto: true },
  { titulo: 'Hora inicio', sinSalto: true }, { titulo: 'Hora culminada', sinSalto: true }, { titulo: 'Fecha de creación', sinSalto: true }, { titulo: 'Fecha final', sinSalto: true }, { titulo: 'Tiempo/Respuesta', sinSalto: true },
  { titulo: 'Proceso', sinSalto: true }, { titulo: 'Observaciones' },
  { titulo: 'SM', derecha: true }, { titulo: 'MTV', derecha: true }, { titulo: 'MR', derecha: true }, { titulo: 'MRTV', derecha: true },
  { titulo: 'Tipo de plan', sinSalto: true }, { titulo: 'Drop', derecha: true }, { titulo: 'Azul', derecha: true }, { titulo: 'Verde', derecha: true },
];

// Una fila de la lista de instalaciones, en el orden de `columnasInstalaciones`.
export function filaInstalacion(t, n) {
  const finalizada = t.estado === 'FINALIZADO';
  const inicio = inicioAtencion(t);
  const fin = culminadaEn(t);
  const tiempo = tiempoDeRespuesta(t);
  const equipo = finalizada ? equipoDe(t) : '';
  const { verde, azul, drop } = materialDe(t);
  const cifra = (valor) => (valor ? String(valor) : '');
  return [
    String(n), t.codigo || '', t.nombre || '', formatearCedula(t.cedula, t.tipoDocumento), t.tecnico || '',
    finalizada ? horaCorta(inicio) : '', finalizada ? horaCorta(fin) : '', fechaCorta(inicio), finalizada ? fechaCorta(fin) : '', tiempo === null ? '' : horasMinSeg(tiempo),
    procesoDeInstalacion(t), motivoCancelacion(t) ? `Cancelada: ${motivoCancelacion(t)}` : '',
    ...EQUIPOS.map((e) => (equipo === e ? '1' : '')),
    finalizada ? planDe(t) : '', cifra(drop), cifra(azul), cifra(verde),
  ];
}

export const columnasInstalacionesCompacta = () => [
  { titulo: 'ODT' }, { titulo: 'Cliente' }, { titulo: 'Técnico' }, { titulo: 'Fecha final' }, { titulo: 'Tiempo' }, { titulo: 'Proceso' }, { titulo: 'Plan' }, { titulo: 'Material' },
];
export function filaInstalacionCompacta(t) {
  const completa = filaInstalacion(t, 0);
  const equipo = EQUIPOS.find((e, i) => completa[12 + i]) || '';
  const { verde, azul, drop } = materialDe(t);
  const material = [equipo, drop ? `${drop} m` : '', verde ? `${verde} verde${verde === 1 ? '' : 's'}` : '', azul ? `${azul} azul${azul === 1 ? '' : 'es'}` : ''].filter(Boolean).join(', ');
  return [completa[1], completa[2], completa[4], completa[8], completa[9], completa[10], completa[16], material];
}

export const columnasEstadisticaInstalaciones = () => [{ titulo: 'Proceso' }, { titulo: 'Concepto' }, { titulo: 'Cantidad', derecha: true }];
export function filasEstadisticaInstalaciones(e) {
  return [
    ['F', 'Finalizadas', String(e.f)],
    ['NR', 'No realizadas', String(e.nr)],
    ['', 'TOTAL', String(e.total)],
    ...PLANES.map((plan) => ['', `Plan ${plan}`, String(e.planes[plan])]),
    ...(e.planes.otros ? [['', 'Otro plan o sin plan', String(e.planes.otros)]] : []),
  ];
}

export const cifrasInstalaciones = (e) => [
  { id: 'F', etiqueta: 'Finalizadas', valor: e.f, detalle: 'en el periodo' },
  { id: 'NR', etiqueta: 'No realizadas (NR)', valor: e.nr, detalle: 'canceladas · ver detalle' },
  { id: 'TOTAL', etiqueta: 'Total', valor: e.total, detalle: 'en el periodo' },
  { id: 'DROP', etiqueta: 'Drop', valor: `${e.materiales.drop} m`, detalle: 'metraje de las finalizadas' },
];

export const NOTA_INSTALACIONES = 'Una fila por instalación: las finalizadas (F) cuentan el día en que se terminó el trabajo y las canceladas (NR) el día en que se cancelaron, con su motivo en Observaciones. El plan sale de la línea "Plan a contratar" de la plantilla de la promotora; el drop, del metraje que registró el técnico.';

// --- Las hojas del registro, listas para la pantalla y el documento ---
export const HOJAS = [
  { id: 'VISITAS', nombre: 'Visitas técnicas' },
  { id: 'AVERIAS', nombre: 'Averías' },
  { id: 'INSTALACIONES', nombre: 'Instalaciones' },
  // La de VN y TA no se arma con órdenes: se llena a mano (ver utils/registroVnTa y useRegistroVnTa).
  { id: 'VNTA', nombre: 'VN y TA', manual: true },
];

// Todo lo que se muestra de una hoja armada con órdenes en el periodo (no sirve para la de VN y TA, que es manual): la lista de órdenes, las cifras, el cuadro de estadística, los materiales, las
// columnas y filas de la lista (completa y resumida) y su nota. `hoja`: 'VISITAS', 'AVERIAS' o 'INSTALACIONES'.
export function armarHoja(hoja, ordenes, rango, { tecnico } = {}) {
  const lista = ordenesDeHoja(ordenes, hoja, rango, { tecnico });
  const comun = { hoja, nombre: HOJAS.find((h) => h.id === hoja).nombre, lista, noRealizadas: ordenesNoRealizadas(lista) };
  if (hoja === 'AVERIAS') {
    const e = estadisticaAverias(lista);
    return {
      ...comun, singular: 'las averías', tituloEstadistica: 'Estadística de averías', estadistica: e, cifras: cifrasAverias(e), filasEstadistica: filasEstadisticaAverias(e),
      columnasEstadistica: columnasEstadisticaVisitas(), columnasLista: columnasVisitas(), filaLista: (t, n) => filaVisita(t, n, 'AVERIAS'),
      columnasCompacta: columnasVisitasCompacta(), filaCompacta: (t) => filaVisitaCompacta(t, 'AVERIAS'), nota: NOTA_AVERIAS, aviso: avisoSinCobro(e.sc, 'avería', 'averías'),
    };
  }
  if (hoja === 'INSTALACIONES') {
    const e = estadisticaInstalaciones(lista);
    return {
      ...comun, singular: 'las instalaciones', tituloEstadistica: 'Estadística de instalaciones', estadistica: e, cifras: cifrasInstalaciones(e), filasEstadistica: filasEstadisticaInstalaciones(e),
      columnasEstadistica: columnasEstadisticaInstalaciones(), columnasLista: columnasInstalaciones(), filaLista: filaInstalacion,
      columnasCompacta: columnasInstalacionesCompacta(), filaCompacta: filaInstalacionCompacta, nota: NOTA_INSTALACIONES, aviso: '',
    };
  }
  const e = estadisticaVisitas(lista);
  return {
    ...comun, singular: 'las visitas', tituloEstadistica: 'Estadística de visitas técnicas', estadistica: e, cifras: cifrasVisitas(e), filasEstadistica: filasEstadisticaVisitas(e),
    columnasEstadistica: columnasEstadisticaVisitas(), columnasLista: columnasVisitas(), filaLista: (t, n) => filaVisita(t, n),
    columnasCompacta: columnasVisitasCompacta(), filaCompacta: (t) => filaVisitaCompacta(t), nota: NOTA_VISITAS, aviso: avisoSinCobro(e.sc),
  };
}

// --- Detalle de las órdenes no realizadas (lo que se abre al pulsar la cifra "No realizadas") ---
// Las no realizadas (NR) de cualquier hoja son las órdenes canceladas del periodo.
export const ordenesNoRealizadas = (lista) => lista.filter((t) => t.estado === 'CANCELADO');

export const columnasNoRealizadas = () => [
  { titulo: 'ODT', sinSalto: true }, { titulo: 'Cliente' }, { titulo: 'Cédula', sinSalto: true }, { titulo: 'Técnico', sinSalto: true }, { titulo: 'Trabajo' },
  { titulo: 'Cancelada el', sinSalto: true }, { titulo: 'Cancelada por', sinSalto: true }, { titulo: 'Motivo' },
];

export function filaNoRealizada(t) {
  const trabajo = [t.tipoTrabajo, t.falla && String(t.falla).toUpperCase() !== trabajoDe(t) ? t.falla : ''].filter(Boolean).join(' · ');
  return [
    t.codigo || '', t.nombre || '', formatearCedula(t.cedula, t.tipoDocumento), t.tecnico || 'Sin técnico', trabajo,
    fechaCorta(Number(t.canceladaEn) || Number(t.createdAt) || 0), t.canceladaPor || '', motivoCancelacion(t) || 'Sin motivo registrado',
  ];
}

// --- Detalle de un material: las órdenes donde se usó (lo que se abre al pulsar una fila de "Materiales") ---
// `material`: 'SM', 'MTV', 'MR', 'MRTV' (equipos), 'azul', 'verde' (conectores) o 'drop' (metros de cable).
export const MATERIALES = [
  { id: 'SM', nombre: 'SM', equipo: true }, { id: 'MTV', nombre: 'MTV', equipo: true }, { id: 'MR', nombre: 'MR', equipo: true }, { id: 'MRTV', nombre: 'MRTV', equipo: true },
  { id: 'azul', nombre: 'Azul (conectores)' }, { id: 'verde', nombre: 'Verde (conectores)' }, { id: 'drop', nombre: 'Drop (metros)' },
];

// Cuánto de ese material usó la orden: 1 equipo, N conectores o N metros (0 si no lo usó). Es la misma cuenta de la tabla de materiales.
export function cantidadDeMaterial(t, material) {
  if (EQUIPOS.includes(material)) return t.estado === 'FINALIZADO' && !fueEscalada(t) && equipoDe(t) === material ? 1 : 0;
  return materialDe(t)[material] || 0;
}

export const ordenesConMaterial = (lista, material) => lista.filter((t) => cantidadDeMaterial(t, material) > 0);

// El serial del equipo: el de la ONU de una instalación o el del equipo nuevo de un cambio de equipo ('' si no se registró).
export const serialDeEquipo = (t) => String((t?.tipoVisita === 'CAMBIO_EQUIPO' ? t.serialEquipo : t?.instalacion?.serial) ?? '').trim();

export function columnasDetalleMaterial(material) {
  const equipo = EQUIPOS.includes(material);
  return [
    { titulo: 'ODT', sinSalto: true }, { titulo: 'Cliente' }, { titulo: 'Cédula', sinSalto: true }, { titulo: 'Técnico', sinSalto: true }, { titulo: 'Trabajo' },
    { titulo: 'Fecha final', sinSalto: true }, { titulo: equipo ? 'Equipo' : 'Cantidad', sinSalto: true, derecha: !equipo },
    ...(equipo ? [{ titulo: 'Serial', sinSalto: true }] : []),
  ];
}

export function filaDetalleMaterial(t, material) {
  const equipo = EQUIPOS.includes(material);
  const cantidad = cantidadDeMaterial(t, material);
  const trabajo = [t.tipoTrabajo, t.tipoVisita ? etiquetaTipoVisita(t.tipoVisita) : (t.falla && String(t.falla).toUpperCase() !== trabajoDe(t) ? t.falla : '')].filter(Boolean).join(' · ');
  return [
    t.codigo || '', t.nombre || '', formatearCedula(t.cedula, t.tipoDocumento), t.tecnico || 'Sin técnico', trabajo, fechaCorta(culminadaEn(t)),
    equipo ? material : (material === 'drop' ? `${cantidad} m` : String(cantidad)),
    ...(equipo ? [serialDeEquipo(t) || 'Sin serial registrado'] : []),
  ];
}

// --- Detalle de una cifra: las órdenes que la forman (lo que se abre al pulsar una cifra de arriba) ---
// `id` es el de la cifra: 'TOTAL', 'PAGADAS', 'AC' y 'NR' en visitas y averías; 'F', 'NR', 'TOTAL' y 'DROP' en instalaciones. Siempre son las mismas
// órdenes que cuenta el número de la cifra (lo comprueba test:hoja).
const TIPOS_DE_CIFRA = { TOTAL: ['EX', 'AC', 'NR'], PAGADAS: ['EX', 'AC'], AC: ['AC'], NR: ['NR'] };

export function ordenesDeCifra(hoja, id, lista) {
  if (hoja === 'INSTALACIONES') {
    if (id === 'DROP') return ordenesConMaterial(lista, 'drop');
    const procesos = { F: ['F'], NR: ['NR'], TOTAL: ['F', 'NR'] }[id] || [];
    return lista.filter((t) => procesos.includes(procesoDeInstalacion(t)));
  }
  const tipos = TIPOS_DE_CIFRA[id] || [];
  return lista.filter((t) => tipos.includes(tipoDeHoja(t, hoja)));
}

// Lo que se cobró en la orden: "Exonerada", el monto ("5.696 Bs", "30 $") o '' si no lleva cobro.
const cobroDe = (t) => (estaExonerado(t) ? 'Exonerada' : t.cobroBs ? textoMonto(t.cobroBs, monedaDe(t)) : '');

export const columnasDetalleOrdenes = () => [
  { titulo: 'ODT', sinSalto: true }, { titulo: 'Cliente' }, { titulo: 'Cédula', sinSalto: true }, { titulo: 'Técnico', sinSalto: true }, { titulo: 'Fecha', sinSalto: true },
  { titulo: 'Tipo', sinSalto: true }, { titulo: 'Cobro', sinSalto: true }, { titulo: 'Observaciones' },
];

// Una fila del detalle de una cifra. La fecha es cuando se terminó el trabajo (o, en las canceladas, cuando se cancelaron).
export function filaDetalleOrden(t, hoja) {
  const tipo = hoja === 'INSTALACIONES' ? procesoDeInstalacion(t) : tipoDeHoja(t, hoja);
  const observacion = hoja === 'INSTALACIONES' ? (motivoCancelacion(t) ? `Cancelada: ${motivoCancelacion(t)}` : '') : observacionDeHoja(t, hoja);
  return [
    t.codigo || '', t.nombre || '', formatearCedula(t.cedula, t.tipoDocumento), t.tecnico || 'Sin técnico', fechaCorta(fechaDeHoja(t)),
    tipo === 'SC' ? 'Sin cobro' : tipo, cobroDe(t), observacion,
  ];
}
