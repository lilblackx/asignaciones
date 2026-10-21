// Módulo de Finanzas: pagar a los técnicos. Todo son funciones puras: las usan la pantalla de Finanzas y las pruebas. Finanzas no toca las
// órdenes; lo que guarda va en sus propias colecciones:
//   tarifasPago/actual          lo que se paga por cada concepto, en dólares
//   pagosTecnicos/{pago}        un pago a un técnico por un periodo (con sus tarifas y cantidades de ese momento)
//   ordenesPagadas/{orden}      cada orden incluida en un pago: así una orden no se paga dos veces
//
// Qué se le paga al técnico (lo mismo que la columna "pagadas a técnico" del Registro de estadísticas):
//   INSTALACION  instalación finalizada
//   VISITA       visita (mudanza, retiro de equipo) exonerada o cobrada; la garantía no se paga
//   AVERIA       avería exonerada o cobrada (low signal siempre cuenta); la garantía no se paga
//   RECABLEADO   visita o avería pagada cuyo tipo de visita fue un recableado: lleva su propia tarifa en lugar de la de visita o avería
//   LOW_SIGNAL   trabajo de low signal (siempre exonerado): su propia tarifa
//   CAMBIO_EQUIPO  cambio de equipo (el trabajo, o una visita cuyo tipo fue cambio de equipo): su propia tarifa
// Para mostrar, todo lo que no es instalación se agrupa como avería (ver gruposDelReporte); los precios sí se distinguen.
// Las canceladas, las sin cobro registrado, las validaciones de NAP y lo escalado a infraestructura no entran.
import { diaDe } from './totalesMes.js';
import { enRango } from './periodoReporte.js';
import { fechaDeHoja, ordenesDeHoja, tipoDeAveria, tipoDeVisita } from './reporteMensual.js';
import { TIPO_CAMBIO_EQUIPO, TIPO_RECABLEADO } from './tipoVisita.js';

export const CONCEPTOS_PAGO = [
  { id: 'INSTALACION', nombre: 'Instalación', singular: 'instalación', plural: 'instalaciones' },
  { id: 'VISITA', nombre: 'Visita pagada', singular: 'visita', plural: 'visitas' },
  { id: 'AVERIA', nombre: 'Avería pagada', singular: 'avería', plural: 'averías' },
  { id: 'RECABLEADO', nombre: 'Recableado', singular: 'recableado', plural: 'recableados' },
  { id: 'LOW_SIGNAL', nombre: 'Low signal', singular: 'low signal', plural: 'low signal' },
  { id: 'CAMBIO_EQUIPO', nombre: 'Cambio de equipo', singular: 'cambio de equipo', plural: 'cambios de equipo' },
];

// "1 orden" / "5 órdenes".
export const textoOrdenes = (n) => `${n} ${n === 1 ? 'orden' : 'órdenes'}`;
export const MAX_TARIFA = 100000;
// Una operación por lote de Firestore es de 500: el pago y sus órdenes caben en uno solo.
export const MAX_ORDENES_POR_PAGO = 450;
export const SIN_TECNICO = 'SIN ASIGNAR';

// La clave con que una orden se guarda en ordenesPagadas (id de documento: sin "/" ni espacios).
export const claveOrden = (t) => String(t?.id ?? `${t?.codigo}-${t?.createdAt}`).replace(/[/\s]+/g, '_');

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

// --- Tarifas ---

// "5" / "5,50" / "5.50" → número de dólares (0 a MAX_TARIFA, dos decimales) o { error }.
export function parseTarifa(texto) {
  const limpio = String(texto ?? '').trim().replace(',', '.');
  if (limpio === '') return { error: 'Escribe el monto (0 si no se paga).' };
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(limpio)) return { error: 'Escribe solo números, con hasta 2 decimales. Ejemplo: 5 o 5,50' };
  const valor = Number(limpio);
  if (valor > MAX_TARIFA) return { error: `El monto no puede pasar de ${MAX_TARIFA}.` };
  return { valor };
}

// Las tarifas guardadas → un monto por concepto (0 si falta).
export const tarifasCompletas = (guardadas) => Object.fromEntries(CONCEPTOS_PAGO.map(({ id }) => [id, redondear(guardadas?.[id])]));

// --- Qué se paga ---

// El concepto con que se le paga una orden al técnico, o null si no se paga.
// Una visita o avería pagada que fue un recableado se paga con la tarifa de recableado, no con la de visita o avería.
export function conceptoDePago(t, hoja) {
  if (!t || t.estado !== 'FINALIZADO') return null;
  if (hoja === 'INSTALACIONES') return 'INSTALACION';
  const pagada = hoja === 'VISITAS' ? ['EX', 'AC'].includes(tipoDeVisita(t)) : hoja === 'AVERIAS' ? ['EX', 'AC'].includes(tipoDeAveria(t)) : false;
  if (!pagada) return null;
  if (t.tipoVisita === TIPO_RECABLEADO) return 'RECABLEADO';
  const trabajo = String(t.tipoTrabajo || '').trim().toUpperCase();
  if (trabajo === 'LOW SIGNAL') return 'LOW_SIGNAL';
  if (trabajo === 'CAMBIO DE EQUIPO' || t.tipoVisita === TIPO_CAMBIO_EQUIPO) return 'CAMBIO_EQUIPO';
  return hoja === 'VISITAS' ? 'VISITA' : 'AVERIA';
}

// Las órdenes que se le pagan al técnico en el periodo, con su concepto: [{ orden, clave, concepto, tecnico, dia }]. El día es el mismo con que cuenta la
// orden en el Registro de estadísticas (cuando se terminó el trabajo).
export function ordenesPagables(ordenes, rango, { tecnico } = {}) {
  const lista = [];
  for (const hoja of ['INSTALACIONES', 'VISITAS', 'AVERIAS']) {
    for (const orden of ordenesDeHoja(ordenes, hoja, rango, { tecnico })) {
      const concepto = conceptoDePago(orden, hoja);
      if (concepto) lista.push({ orden, clave: claveOrden(orden), concepto, tecnico: String(orden.tecnico || '').trim() || SIN_TECNICO, dia: diaDe(fechaDeHoja(orden)) });
    }
  }
  return lista.sort((a, b) => a.dia.localeCompare(b.dia) || String(a.orden.codigo).localeCompare(String(b.orden.codigo)));
}

const vacio = () => Object.fromEntries(CONCEPTOS_PAGO.map(({ id }) => [id, 0]));

// Lo que se le debe a cada técnico: las órdenes pagables que todavía no están en ningún pago (`pagadas`: ids de ordenesPagadas).
// [{ tecnico, cantidades, total, pendientes: [item], pagadas: n }] de más a menos por pagar. El total son dólares.
export function resumenPagos(items, tarifas, pagadas) {
  const ya = pagadas instanceof Set ? pagadas : new Set(pagadas);
  const mapa = new Map();
  for (const item of items) {
    if (!mapa.has(item.tecnico)) mapa.set(item.tecnico, { tecnico: item.tecnico, cantidades: vacio(), total: 0, pendientes: [], pagadas: 0 });
    const fila = mapa.get(item.tecnico);
    if (ya.has(item.clave)) { fila.pagadas++; continue; }
    fila.cantidades[item.concepto]++;
    fila.total += tarifas[item.concepto] || 0;
    fila.pendientes.push(item);
  }
  return [...mapa.values()]
    .map((f) => ({ ...f, total: redondear(f.total) }))
    .sort((a, b) => b.total - a.total || b.pendientes.length - a.pendientes.length || a.tecnico.localeCompare(b.tecnico));
}

export const totalPendiente = (filas) => redondear(filas.reduce((s, f) => s + f.total, 0));

// Si el técnico tiene órdenes pendientes pero alguna tarifa en 0, avisa (para no pagar de menos sin darse cuenta).
export const conceptosSinTarifa = (fila, tarifas) => CONCEPTOS_PAGO.filter(({ id }) => fila.cantidades[id] > 0 && !(tarifas[id] > 0)).map(({ nombre }) => nombre);

// --- Registrar un pago ---

export const idDePago = (tecnico, ahora) => `${ahora}-${String(tecnico).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 20) || 'TECNICO'}`;

// El pago y sus órdenes, listos para guardar en un lote: { pagoId, pago, ordenes: [{ id, datos }] } o { error }.
// `tasa`: bolívares por dólar (BCV) del momento del pago; se guarda para que el pago en Bs no cambie después.
export function armarPago(fila, rango, tarifas, { por, ahora, nota = '', tasa = null }) {
  if (fila.tecnico === SIN_TECNICO) return { error: 'Estas órdenes no tienen técnico: no se pueden pagar.' };
  if (fila.pendientes.length === 0) return { error: 'No hay órdenes por pagar.' };
  if (fila.pendientes.length > MAX_ORDENES_POR_PAGO) return { error: `Son demasiadas órdenes para un solo pago (máximo ${MAX_ORDENES_POR_PAGO}). Elige un periodo más corto.` };
  if (fila.total <= 0) return { error: 'Configura las tarifas antes de pagar: el total es 0.' };
  const pagoId = idDePago(fila.tecnico, ahora);
  const pago = {
    tecnico: fila.tecnico,
    desde: rango.desde,
    hasta: rango.hasta,
    cantidades: fila.cantidades,
    tarifas: Object.fromEntries(CONCEPTOS_PAGO.map(({ id }) => [id, tarifas[id] || 0])),
    total: fila.total,
    cantidadOrdenes: fila.pendientes.length,
    nota: String(nota || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    por,
    creadoEn: ahora,
    anulado: false,
    ...(tasa > 0 && { tasa: redondear(tasa) }),
  };
  const ordenes = fila.pendientes.map((item) => ({
    id: item.clave,
    datos: { pagoId, tecnico: fila.tecnico, concepto: item.concepto, monto: tarifas[item.concepto] || 0, dia: item.dia, codigo: String(item.orden.codigo || '') },
  }));
  return { pagoId, pago, ordenes };
}

// --- Bolívares (tasa BCV del dólar) ---

// La respuesta de la API (ve.dolarapi.com/v1/dolares/oficial) → { tasa, fecha } o null si no trae una tasa usable.
export function parseTasaDolar(json) {
  const tasa = Number(json?.promedio ?? json?.venta);
  if (!(tasa > 0)) return null;
  const fecha = Date.parse(json?.fechaActualizacion);
  return { tasa: redondear(tasa), fecha: Number.isFinite(fecha) ? fecha : null };
}

// Dólares → bolívares con la tasa dada (null si no hay tasa).
export const aBs = (usd, tasa) => (tasa > 0 ? redondear((Number(usd) || 0) * tasa) : null);

// "113.980,00 Bs" (con espacio sin salto); "—" si no hay monto.
export const bolivares = (valor) => (valor == null ? '—' : `${valor.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${String.fromCharCode(160)}Bs`);

// --- Textos ---

// Con espacio sin salto: "109,00 $" no se parte en dos líneas en las tablas de los PDF y Word.
export const dolares = (valor) => `${(Number(valor) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${String.fromCharCode(160)}$`;

export const columnasPagosTecnico = () => [{ titulo: 'Técnico' }, { titulo: 'Órdenes', derecha: true }, { titulo: 'Instalaciones', derecha: true }, { titulo: 'Averías', derecha: true }, { titulo: 'Total por pagar', derecha: true }, { titulo: 'En Bs', derecha: true }];
export const filaPagoTecnico = (f, tasa = null) => [f.tecnico, String(f.pendientes.length), String(gruposDelReporte(f.cantidades).instalaciones), String(gruposDelReporte(f.cantidades).averias), dolares(f.total), bolivares(aBs(f.total, tasa))];

// Cómo se nombra el trabajo de una orden pagada: o instalación o avería (todo lo que no es instalación es avería).
export const grupoDePago = (concepto) => (concepto === 'INSTALACION' ? 'Instalación' : 'Avería');

// { ordenes, monto } de varios técnicos de totalesPagados.
export const sumaPagado = (lista) => ({ ordenes: lista.reduce((s, v) => s + v.ordenes, 0), monto: redondear(lista.reduce((s, v) => s + v.total, 0)), bs: redondear(lista.reduce((s, v) => s + (v.bs || 0), 0)) });

// Lo ya pagado en el periodo, por técnico: { [técnico]: { ordenes, total, bs } } a partir de los documentos de ordenesPagadas. `tasaDe(pagoId)` da la tasa
// con que se hizo cada pago (los bolívares de un pago no cambian con la tasa de hoy).
export function totalesPagados(pagadas, tasaDe = () => null) {
  const por = {};
  for (const p of pagadas) {
    por[p.tecnico] ??= { ordenes: 0, total: 0, bs: 0 };
    por[p.tecnico].ordenes += 1;
    por[p.tecnico].total = redondear(por[p.tecnico].total + (Number(p.monto) || 0));
    por[p.tecnico].bs = redondear(por[p.tecnico].bs + (aBs(p.monto, tasaDe(p.pagoId)) || 0));
  }
  return por;
}

export const NOTA_PAGOS = 'Se paga lo que el Registro de estadísticas cuenta como pagado a técnico: instalaciones finalizadas y visitas o averías exoneradas o cobradas (low signal siempre); los recableados llevan su propia tarifa. La garantía, las canceladas, las órdenes sin cobro registrado, las validaciones de NAP y lo escalado a infraestructura no entran. Cada orden se paga una sola vez.';

// `yaPagado`: { ordenes, monto } de lo que ya se pagó en el periodo.
export function cifrasPagos(filas, yaPagado, tasa = null) {
  const conPendientes = filas.filter((f) => f.pendientes.length > 0);
  return [
    { etiqueta: 'Total a pagar', valor: dolares(totalPendiente(filas)), detalle: tasa > 0 ? bolivares(aBs(totalPendiente(filas), tasa)) : 'con las tarifas de hoy' },
    { etiqueta: 'Técnicos por pagar', valor: conPendientes.length, detalle: `${textoOrdenes(conPendientes.reduce((s, f) => s + f.pendientes.length, 0))} por pagar` },
    { etiqueta: 'Ya pagado', valor: dolares(yaPagado.monto), detalle: yaPagado.bs > 0 ? bolivares(yaPagado.bs) : `${textoOrdenes(yaPagado.ordenes)} del periodo` },
  ];
}

export const columnasPagosRegistrados = () => [{ titulo: 'Fecha' }, { titulo: 'Técnico' }, { titulo: 'Periodo' }, { titulo: 'Órdenes', derecha: true }, { titulo: 'Total', derecha: true }, { titulo: 'En Bs', derecha: true }, { titulo: 'Estado' }, { titulo: 'Nota' }];
// `tasaHoy`: se usa solo si el pago no guardó la tasa de su momento (pagos hechos antes de mostrar bolívares).
export const filaPagoRegistrado = (p, tasaHoy = null) => [
  diaDe(Number(p.creadoEn)).split('-').reverse().join('/'), p.tecnico, `${p.desde.split('-').reverse().join('/')} – ${p.hasta.split('-').reverse().join('/')}`,
  String(p.cantidadOrdenes), dolares(p.total), bolivares(aBs(p.total, p.tasa > 0 ? p.tasa : tasaHoy)), p.anulado ? 'Anulado' : 'Pagado', p.nota || '',
];
// Los pagos hechos (no anulados primero) en el periodo.
export const pagosDelPeriodo = (pagos, rango) => pagos.filter((p) => enRango(diaDe(Number(p.creadoEn)), rango)).sort((a, b) => Number(b.creadoEn) - Number(a.creadoEn));

// --- Resumen de lo pagado ---

// Lo que se pagó en el periodo (los pagos registrados ese día y no anulados), en total y por técnico:
// { total, ordenes, pagos, porTecnico: [{ tecnico, pagos, ordenes, total, cantidades, ultimo }] } de más a menos pagado.
// `tasa`: la de hoy, para los pagos que no guardaron la suya. Cada pago convierte a bolívares con la tasa de su momento.
export function resumenPagado(pagos, rango, { tecnico, tasa = null } = {}) {
  const vigentes = pagosDelPeriodo(pagos, rango).filter((p) => !p.anulado && (!tecnico || String(p.tecnico).toUpperCase() === tecnico.toUpperCase()));
  const mapa = new Map();
  for (const p of vigentes) {
    if (!mapa.has(p.tecnico)) mapa.set(p.tecnico, { tecnico: p.tecnico, pagos: 0, ordenes: 0, total: 0, cantidades: vacio(), ultimo: 0, bs: 0 });
    const f = mapa.get(p.tecnico);
    f.pagos += 1;
    f.ordenes += Number(p.cantidadOrdenes) || 0;
    f.total = redondear(f.total + (Number(p.total) || 0));
    f.bs = redondear(f.bs + (aBs(p.total, p.tasa > 0 ? p.tasa : tasa) || 0));
    for (const { id } of CONCEPTOS_PAGO) f.cantidades[id] += Number(p.cantidades?.[id]) || 0;
    f.ultimo = Math.max(f.ultimo, Number(p.creadoEn) || 0);
  }
  const porTecnico = [...mapa.values()].sort((a, b) => b.total - a.total || a.tecnico.localeCompare(b.tecnico));
  return { total: redondear(porTecnico.reduce((s, f) => s + f.total, 0)), bs: redondear(porTecnico.reduce((s, f) => s + f.bs, 0)), ordenes: porTecnico.reduce((s, f) => s + f.ordenes, 0), pagos: vigentes.length, porTecnico };
}

export const cifrasResumenPagado = (r) => [
  { etiqueta: 'Total pagado', valor: dolares(r.total), detalle: r.bs > 0 ? bolivares(r.bs) : `${r.pagos} ${r.pagos === 1 ? 'pago' : 'pagos'} en el periodo` },
  { etiqueta: 'Órdenes pagadas', valor: r.ordenes },
  { etiqueta: 'Técnicos pagados', valor: r.porTecnico.length },
];

// En el reporte de lo pagado solo hay dos grupos: instalaciones y averías. Todo lo que no es instalación (visitas, averías y recableados) cuenta como avería.
export const gruposDelReporte = (cantidades) => ({
  instalaciones: Number(cantidades?.INSTALACION) || 0,
  averias: CONCEPTOS_PAGO.filter(({ id }) => id !== 'INSTALACION').reduce((suma, { id }) => suma + (Number(cantidades?.[id]) || 0), 0),
});

// "6 instalaciones · 18 averías" (solo los grupos que tienen órdenes).
export function textoGrupos(cantidades) {
  const { instalaciones, averias } = gruposDelReporte(cantidades);
  return [instalaciones > 0 && `${instalaciones} ${instalaciones === 1 ? 'instalación' : 'instalaciones'}`, averias > 0 && `${averias} ${averias === 1 ? 'avería' : 'averías'}`].filter(Boolean).join(' · ');
}

export const columnasResumenPagado = () => [{ titulo: 'Técnico' }, { titulo: 'Órdenes pagadas', derecha: true }, { titulo: 'Instalaciones', derecha: true }, { titulo: 'Averías', derecha: true }, { titulo: 'Total pagado', derecha: true }, { titulo: 'En Bs', derecha: true }];
export const filaResumenPagado = (f) => [f.tecnico, String(f.ordenes), String(gruposDelReporte(f.cantidades).instalaciones), String(gruposDelReporte(f.cantidades).averias), dolares(f.total), bolivares(f.bs || null)];

// "Se pagó 245,00 $ por 15 órdenes a REINEL BRAVO".
export const frasePagado = (f) => `Se pagó ${dolares(f.total)} por ${textoOrdenes(f.ordenes)} a ${f.tecnico}`;
