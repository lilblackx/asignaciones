// Módulo de Finanzas: pagar a los técnicos. Todo son funciones puras: las usan la pantalla de Finanzas y las pruebas. Finanzas no toca las
// órdenes; lo que guarda va en sus propias colecciones:
//   tarifasPago/actual          lo que se paga por cada concepto, en dólares
//   pagosTecnicos/{pago}        un pago a un técnico por un periodo (con sus tarifas y cantidades de ese momento)
//   ordenesPagadas/{orden}      cada orden incluida en un pago: así una orden no se paga dos veces
//
// Qué se le paga al técnico (lo mismo que la columna "pagadas a técnico" del Registro de estadísticas):
//   INSTALACION  instalación finalizada
//   AVERIA       avería o visita (retiro de equipo) exonerada o cobrada, con un mismo precio; la garantía no se paga. Los pagos hechos cuando la visita
//                tenía precio aparte guardan su cantidad en VISITA: al sumarlos cuenta como avería
//   MUDANZA_INTERNA, MUDANZA_EXTERNA  mudanza exonerada o cobrada: cada tipo (el que se elige en el campo TIPO de la orden) con su propia tarifa; una mudanza
//                sin tipo (anterior a ese campo) no se paga hasta que la oficina le ponga el tipo: Finanzas las lista aparte (ver mudanzasSinTipo)
//   VALIDACION_NAP y TRABAJO_ADICIONAL  no salen de una orden sino de una fila del registro de VN y TA (utils/registroVnTa) que tiene técnico: el técnico que
//                apoyó. Una fila sin técnico (lo hizo infraestructura sola) no se paga a nadie. Cada una lleva su propia tarifa
//   RECABLEADO   visita o avería pagada cuyo tipo de visita fue un recableado: lleva su propia tarifa en lugar de la de visita o avería
//   LOW_SIGNAL   trabajo de low signal (siempre exonerado): su propia tarifa
//   CAMBIO_EQUIPO  cambio de equipo (el trabajo, o una visita cuyo tipo fue cambio de equipo): su propia tarifa
// Para mostrar, todo lo que no es instalación, validación de NAP ni trabajo adicional se agrupa como avería (ver gruposDelReporte); los precios sí se distinguen.
// Las canceladas, las sin cobro registrado, las validaciones de NAP y lo escalado a infraestructura no entran.
import { diaDe } from './totalesMes.js';
import { enRango } from './periodoReporte.js';
import { fechaDeHoja, ordenesDeHoja, tipoDeAveria, tipoDeVisita } from './reporteMensual.js';
import { TIPO_CAMBIO_EQUIPO, TIPO_RECABLEADO } from './tipoVisita.js';
import { TRABAJOS_VNTA } from './registroVnTa.js';

export const CONCEPTOS_PAGO = [
  { id: 'INSTALACION', nombre: 'Instalación', singular: 'instalación', plural: 'instalaciones' },
  { id: 'AVERIA', nombre: 'Visita / avería pagada', singular: 'avería', plural: 'averías' },
  { id: 'MUDANZA_INTERNA', nombre: 'Mudanza interna', singular: 'mudanza interna', plural: 'mudanzas internas' },
  { id: 'MUDANZA_EXTERNA', nombre: 'Mudanza externa', singular: 'mudanza externa', plural: 'mudanzas externas' },
  { id: 'VALIDACION_NAP', nombre: 'Validación de NAP', singular: 'validación de NAP', plural: 'validaciones de NAP' },
  { id: 'TRABAJO_ADICIONAL', nombre: 'Trabajo adicional', singular: 'trabajo adicional', plural: 'trabajos adicionales' },
  { id: 'RECABLEADO', nombre: 'Recableado', singular: 'recableado', plural: 'recableados' },
  { id: 'LOW_SIGNAL', nombre: 'Low signal', singular: 'low signal', plural: 'low signal' },
  { id: 'CAMBIO_EQUIPO', nombre: 'Cambio de equipo', singular: 'cambio de equipo', plural: 'cambios de equipo' },
];

// "1 orden" / "5 órdenes".
export const textoOrdenes = (n) => `${n} ${n === 1 ? 'orden' : 'órdenes'}`;
export const MAX_TARIFA = 100000;
// Una operación por lote de Firestore es de 500: el pago y sus órdenes caben en uno solo.
export const MAX_ORDENES_POR_PAGO = 450;
// El pago, cada orden pagada y cada fila de VN y TA que se marca: todo va en el mismo lote.
export const MAX_ESCRITURAS_POR_PAGO = 499;
export const SIN_TECNICO = 'SIN ASIGNAR';

// La clave con que una orden se guarda en ordenesPagadas (id de documento: sin "/" ni espacios).
export const claveOrden = (t) => String(t?.id ?? `${t?.codigo}-${t?.createdAt}`).replace(/[/\s]+/g, '_');
// La de una fila del registro de VN y TA: con prefijo para que nunca choque con la de una orden.
export const claveRegistro = (r) => `vnta_${String(r?.id ?? r?.codigo).replace(/[/\s]+/g, '_')}`;

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

const TIPOS_MUDANZA = { INTERNA: 'MUDANZA_INTERNA', EXTERNA: 'MUDANZA_EXTERNA' };
const normalizarTipoMudanza = (valor) => String(valor || '').trim().toUpperCase();
// El tipo de una mudanza: el que tiene la orden en su campo TIPO o, si no lo tiene (mudanza anterior a ese campo, ya en un cierre que no se edita), el que Finanzas
// le eligió (`tiposElegidos`: { [claveOrden]: 'INTERNA' | 'EXTERNA' }). '' si no tiene ninguno.
const tipoDeMudanza = (t, tiposElegidos) => {
  const propio = normalizarTipoMudanza(t?.falla);
  if (TIPOS_MUDANZA[propio]) return propio;
  const elegido = normalizarTipoMudanza(tiposElegidos?.[claveOrden(t)]);
  return TIPOS_MUDANZA[elegido] ? elegido : '';
};

// El concepto con que se le paga una orden al técnico, o null si no se paga (o si es una mudanza todavía sin tipo).
// Una visita o avería pagada que fue un recableado se paga con la tarifa de recableado, no con la de visita o avería; una mudanza, con la suya.
export function conceptoDePago(t, hoja, tiposElegidos = null) {
  if (!t || t.estado !== 'FINALIZADO') return null;
  if (hoja === 'INSTALACIONES') return 'INSTALACION';
  const pagada = hoja === 'VISITAS' ? ['EX', 'AC'].includes(tipoDeVisita(t)) : hoja === 'AVERIAS' ? ['EX', 'AC'].includes(tipoDeAveria(t)) : false;
  if (!pagada) return null;
  if (t.tipoVisita === TIPO_RECABLEADO) return 'RECABLEADO';
  const trabajo = String(t.tipoTrabajo || '').trim().toUpperCase();
  if (trabajo === 'LOW SIGNAL') return 'LOW_SIGNAL';
  if (trabajo === 'CAMBIO DE EQUIPO' || t.tipoVisita === TIPO_CAMBIO_EQUIPO) return 'CAMBIO_EQUIPO';
  if (trabajo === 'MUDANZA') return TIPOS_MUDANZA[tipoDeMudanza(t, tiposElegidos)] || null;
  return 'AVERIA';
}

// Las filas del registro de VN y TA que se le pagan al técnico que apoyó: [{ orden, registro, clave, concepto, tecnico, dia }] con el mismo formato que las
// órdenes (`orden` trae el código y el trabajo para listarla). Las filas sin técnico no se pagan a nadie y no salen. El día es la fecha de la fila.
export function registrosPagables(registros, rango, { tecnico } = {}) {
  const buscado = String(tecnico || '').trim().toUpperCase();
  return (registros || [])
    .filter((r) => TRABAJOS_VNTA[r.trabajo] && String(r.tecnico || '').trim() && enRango(r.fecha, rango) && (!buscado || String(r.tecnico).trim().toUpperCase() === buscado))
    .map((r) => ({
      orden: { codigo: r.codigo, nombre: TRABAJOS_VNTA[r.trabajo].nombre, observacion: r.observacion || '' },
      registro: r,
      clave: claveRegistro(r),
      concepto: r.trabajo === 'VN' ? 'VALIDACION_NAP' : 'TRABAJO_ADICIONAL',
      tecnico: String(r.tecnico).trim(),
      dia: r.fecha,
    }));
}

// Las órdenes que se le pagan al técnico en el periodo, con su concepto: [{ orden, clave, concepto, tecnico, dia }]. El día es el mismo con que cuenta la
// orden en el Registro de estadísticas (cuando se terminó el trabajo). `registros`: las filas de VN y TA del periodo, que se pagan junto con las órdenes.
export function ordenesPagables(ordenes, rango, { tecnico, registros = [], tiposMudanza = null } = {}) {
  const lista = registrosPagables(registros, rango, { tecnico });
  for (const hoja of ['INSTALACIONES', 'VISITAS', 'AVERIAS']) {
    for (const orden of ordenesDeHoja(ordenes, hoja, rango, { tecnico })) {
      const concepto = conceptoDePago(orden, hoja, tiposMudanza);
      if (concepto) lista.push({ orden, clave: claveOrden(orden), concepto, tecnico: String(orden.tecnico || '').trim() || SIN_TECNICO, dia: diaDe(fechaDeHoja(orden)) });
    }
  }
  return lista.sort((a, b) => a.dia.localeCompare(b.dia) || String(a.orden.codigo).localeCompare(String(b.orden.codigo)));
}

// Las mudanzas que se pagarían pero no tienen tipo (interna o externa): no se pagan hasta que la oficina se lo ponga. [{ orden, clave, tecnico, dia }].
export function mudanzasSinTipo(ordenes, rango, { tecnico, tiposMudanza = null } = {}) {
  return ordenesDeHoja(ordenes, 'VISITAS', rango, { tecnico })
    .filter((orden) => orden.estado === 'FINALIZADO' && String(orden.tipoTrabajo || '').trim().toUpperCase() === 'MUDANZA' && !tipoDeMudanza(orden, tiposMudanza) && orden.tipoVisita !== TIPO_RECABLEADO && orden.tipoVisita !== TIPO_CAMBIO_EQUIPO && ['EX', 'AC'].includes(tipoDeVisita(orden)))
    .map((orden) => ({ orden, clave: claveOrden(orden), tecnico: String(orden.tecnico || '').trim() || SIN_TECNICO, dia: diaDe(fechaDeHoja(orden)) }))
    .sort((a, b) => a.dia.localeCompare(b.dia) || String(a.orden.codigo).localeCompare(String(b.orden.codigo)));
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
  const registros = fila.pendientes.filter((item) => item.registro).length;
  if (fila.pendientes.length > MAX_ORDENES_POR_PAGO || 1 + fila.pendientes.length + registros > MAX_ESCRITURAS_POR_PAGO) return { error: 'Son demasiadas órdenes para un solo pago. Elige un periodo más corto.' };
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
  // Las filas de VN y TA que entran en el pago se marcan con él (así la oficina ve que ya se pagaron y no las cambia).
  const registrosMarcados = fila.pendientes.filter((item) => item.registro).map((item) => ({ id: item.registro.id, datos: { pagoId, pagadoEn: ahora } }));
  return { pagoId, pago, ordenes, registros: registrosMarcados };
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

const COLUMNAS_GRUPOS = [{ titulo: 'Instalaciones', derecha: true }, { titulo: 'Averías', derecha: true }, { titulo: 'Val. NAP', derecha: true }, { titulo: 'Trab. adicional', derecha: true }];
const celdasGrupos = (cantidades) => { const g = gruposDelReporte(cantidades); return [g.instalaciones, g.averias, g.validacionesNap, g.adicionales].map(String); };

export const columnasPagosTecnico = () => [{ titulo: 'Técnico' }, { titulo: 'Órdenes', derecha: true }, ...COLUMNAS_GRUPOS, { titulo: 'Total por pagar', derecha: true }, { titulo: 'En Bs', derecha: true }];
export const filaPagoTecnico = (f, tasa = null) => [f.tecnico, String(f.pendientes.length), ...celdasGrupos(f.cantidades), dolares(f.total), bolivares(aBs(f.total, tasa))];

// Cómo se nombra el trabajo de una orden pagada: instalación, validación de NAP, trabajo adicional o avería (todo lo demás es avería).
export const grupoDePago = (concepto) => ({ INSTALACION: 'Instalación', VALIDACION_NAP: 'Validación de NAP', TRABAJO_ADICIONAL: 'Trabajo adicional' })[concepto] || 'Avería';

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

export const NOTA_PAGOS = 'Se paga lo que el Registro de estadísticas cuenta como pagado a técnico: instalaciones finalizadas y visitas o averías exoneradas o cobradas (low signal siempre); los recableados llevan su propia tarifa. Las validaciones de NAP y los trabajos adicionales salen del registro de VN y TA: se le pagan al técnico que apoyó, y si no tienen técnico no se pagan. La garantía, las canceladas, las órdenes sin cobro registrado y lo escalado a infraestructura no entran. Cada orden se paga una sola vez.';

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
    f.cantidades.AVERIA += Number(p.cantidades?.VISITA) || 0;
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

// En el reporte de lo pagado hay cuatro grupos: instalaciones, averías, validaciones de NAP y trabajos adicionales. Todo lo demás (visitas, mudanzas,
// recableados, low signal y cambios de equipo) cuenta como avería.
const GRUPO_PROPIO = ['INSTALACION', 'VALIDACION_NAP', 'TRABAJO_ADICIONAL'];
export const gruposDelReporte = (cantidades) => ({
  instalaciones: Number(cantidades?.INSTALACION) || 0,
  averias: CONCEPTOS_PAGO.filter(({ id }) => !GRUPO_PROPIO.includes(id)).reduce((suma, { id }) => suma + (Number(cantidades?.[id]) || 0), 0),
  validacionesNap: Number(cantidades?.VALIDACION_NAP) || 0,
  adicionales: Number(cantidades?.TRABAJO_ADICIONAL) || 0,
});

// "6 instalaciones · 18 averías · 2 validaciones de NAP · 1 trabajo adicional" (solo los grupos que tienen órdenes).
export function textoGrupos(cantidades) {
  const { instalaciones, averias, validacionesNap, adicionales } = gruposDelReporte(cantidades);
  const texto = (n, uno, varios) => n > 0 && `${n} ${n === 1 ? uno : varios}`;
  return [texto(instalaciones, 'instalación', 'instalaciones'), texto(averias, 'avería', 'averías'), texto(validacionesNap, 'validación de NAP', 'validaciones de NAP'), texto(adicionales, 'trabajo adicional', 'trabajos adicionales')].filter(Boolean).join(' · ');
}

export const columnasResumenPagado = () => [{ titulo: 'Técnico' }, { titulo: 'Órdenes pagadas', derecha: true }, ...COLUMNAS_GRUPOS, { titulo: 'Total pagado', derecha: true }, { titulo: 'En Bs', derecha: true }];
export const filaResumenPagado = (f) => [f.tecnico, String(f.ordenes), ...celdasGrupos(f.cantidades), dolares(f.total), bolivares(f.bs || null)];

// "Se pagó 245,00 $ por 15 órdenes a REINEL BRAVO".
export const frasePagado = (f) => `Se pagó ${dolares(f.total)} por ${textoOrdenes(f.ordenes)} a ${f.tecnico}`;
