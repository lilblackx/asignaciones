// Resumen ejecutivo: lo esencial de los demás reportes en una sola hoja, con alertas automáticas ("puntos de atención") cuando un indicador
// se sale de lo esperado. Los umbrales están aquí arriba para ajustarlos en un solo lugar.
import {
  calidad, delTecnico, duracionAtencion, finalizadaEn, formatoTiempo, pendientesMasAntiguas, productividad, textoPorcentaje, tiempoDeAtencion, tuvoDevolucion,
} from './gestionTecnicos.js';
import { clasificarEvento } from './historial.js';
import { motivoCancelacion } from './cancelacion.js';
import { diaDe, mesDe } from './totalesMes.js';
import { POTENCIA_MIN_DBM } from './potencia.js';
import { mesesDeLaTendencia, tendenciaMensual } from './tendenciaMensual.js';
import { causasDeAveria } from './causasAveria.js';
import { formatoDuracion } from './logTecnico.js';

const HORA_MS = 3600000;
const DIA_MS = 24 * HORA_MS;

export const META_HORAS_RESUMEN = 48;
export const UMBRALES = {
  metaCumplida: 80, // % de órdenes resueltas dentro de la meta; por debajo, alerta
  pendienteDias: 3, // una orden abierta que lleva más que esto es "vieja"
  reincidencia: 10, // % total; por encima, alerta
  senalDebil: 20, // % total de órdenes con señal débil
  senalDebilTecnico: 30, // % de un técnico (con al menos 5 mediciones)
  devueltas: 15, // % de órdenes que la oficina devolvió
  caidaFinalizadas: 20, // % que bajan las finalizadas entre los dos últimos meses completos
  subidaCancelacion: 5, // puntos porcentuales que sube la cancelación del mes en curso
  minimoCasosTecnico: 2,
};

// `ordenes` ([{ orden, dato }]) y `datoTitulo` son lo que se ve al pulsar el punto de atención: las órdenes que lo forman y el dato de cada una.
const aviso = (texto, ordenes, datoTitulo) => ({ nivel: 'aviso', texto, ...(ordenes?.length ? { ordenes, datoTitulo } : {}) });
const bien = (texto, ordenes, datoTitulo) => ({ nivel: 'ok', texto, ...(ordenes?.length ? { ordenes, datoTitulo } : {}) });

// Las órdenes de un técnico (o de todos) con lo que cuenta cada indicador de calidad, con las mismas reglas con que lo cuenta `calidad`.
const finalizadasConTecnico = (ordenes, rango, tecnico) => ordenes.filter((t) => t.tecnico && finalizadaEn(t, rango) && delTecnico(t, tecnico));
const conDevoluciones = (lista) => lista.filter(tuvoDevolucion).map((orden) => {
  const veces = (orden.historialEdiciones || []).filter((e) => clasificarEvento(e) === 'devuelto').length;
  return { orden, dato: `${veces} ${veces === 1 ? 'vez' : 'veces'}` };
});
const conSenalDebil = (lista) => lista
  .filter((t) => t.potenciaDbm !== null && t.potenciaDbm !== undefined && t.potenciaDbm !== '' && Number(t.potenciaDbm) < POTENCIA_MIN_DBM)
  .map((orden) => ({ orden, dato: `${String(Number(orden.potenciaDbm)).replace('.', ',')} dBm` }));
// Una reincidencia de `calidad` no es una orden: se arma una con lo que trae (la que se terminó y la avería que volvió).
const deReincidencias = (lista) => lista.map((r) => ({ orden: { codigo: r.codigo, nombre: r.cliente, tecnico: r.tecnico, tipoTrabajo: 'AVERÍA', estado: 'FINALIZADO' }, dato: `Volvió en ${r.dias} ${r.dias === 1 ? 'día' : 'días'} (${r.siguiente})` }));
const deMes = (mes, fecha) => Number(fecha) > 0 && mesDe(Number(fecha)) === mes;

// Los puntos de atención del periodo: primero las alertas, y si no hay ninguna, una línea que lo dice.
export function hallazgos({ atencion, cal, pendientesViejas, filasMes, causas, ordenes = [], rango = null, tecnico = '' }) {
  const lista = [];
  const finalizadas = rango ? finalizadasConTecnico(ordenes, rango, tecnico) : [];
  const { total } = atencion;
  if (total.cantidad > 0) {
    // Cada orden con lo que tardó (de la más lenta a la más rápida). Con alerta se ven las que pasaron de la meta; si va bien, todas.
    const tiempos = (rango ? ordenes.filter((t) => finalizadaEn(t, rango) && delTecnico(t, tecnico)) : [])
      .map((orden) => ({ orden, ms: duracionAtencion(orden) })).filter((x) => x.ms !== null).sort((a, b) => b.ms - a.ms)
      .map(({ orden, ms }) => ({ orden, ms, dato: formatoTiempo(ms) }));
    const alerta = total.pctMeta < UMBRALES.metaCumplida;
    const detalle = alerta ? tiempos.filter((x) => x.ms > META_HORAS_RESUMEN * HORA_MS) : tiempos;
    lista.push(alerta
      ? aviso(`Solo el ${total.pctMeta}% de las órdenes se resolvió en ${META_HORAS_RESUMEN} h o menos (lo esperado es ${UMBRALES.metaCumplida}% o más).`, detalle, 'Tiempo de atención')
      : bien(`El ${total.pctMeta}% de las órdenes se resolvió en ${META_HORAS_RESUMEN} h o menos.`, detalle, 'Tiempo de atención'));
  }
  if (pendientesViejas.length > 0) {
    const mas = pendientesViejas[0];
    lista.push(aviso(`${pendientesViejas.length} ${pendientesViejas.length === 1 ? 'orden pendiente lleva' : 'órdenes pendientes llevan'} más de ${UMBRALES.pendienteDias} días; la más antigua es ${mas.orden.codigo || 'sin código'} (${formatoTiempo(mas.esperaMs)}).`, pendientesViejas.map((p) => ({ orden: p.orden, dato: formatoTiempo(p.esperaMs) })), 'Espera'));
  }
  const t = cal.total;
  if (t.pctReincidencia !== null && t.pctReincidencia > UMBRALES.reincidencia) lista.push(aviso(`El ${t.pctReincidencia}% de las órdenes terminadas reincidió (el cliente volvió con una avería); lo esperado es ${UMBRALES.reincidencia}% o menos.`, deReincidencias(cal.reincidencias), 'Qué pasó'));
  for (const f of cal.filas) {
    if (f.reincidieron >= UMBRALES.minimoCasosTecnico && t.pctReincidencia !== null && f.pctReincidencia >= t.pctReincidencia * 2) lista.push(aviso(`${f.tecnico} tiene reincidencia de ${f.pctReincidencia}% (${f.reincidieron} casos), al menos el doble del promedio (${t.pctReincidencia}%).`, deReincidencias(cal.reincidencias.filter((r) => r.tecnico === f.tecnico)), 'Qué pasó'));
    if (f.conPotencia >= 5 && f.pctDebil > UMBRALES.senalDebilTecnico) lista.push(aviso(`${f.tecnico} dejó señal débil en el ${f.pctDebil}% de sus mediciones (${f.debiles} de ${f.conPotencia}).`, conSenalDebil(finalizadas.filter((o) => o.tecnico.toUpperCase() === f.tecnico)), 'Potencia'));
  }
  if (t.pctDebil !== null && t.pctDebil > UMBRALES.senalDebil) lista.push(aviso(`El ${t.pctDebil}% de las mediciones de potencia quedó con señal débil.`, conSenalDebil(finalizadas), 'Potencia'));
  if (t.pctDevueltas !== null && t.pctDevueltas > UMBRALES.devueltas) lista.push(aviso(`La oficina devolvió el ${t.pctDevueltas}% de las órdenes al técnico para corregirlas.`, conDevoluciones(finalizadas), 'Devuelta'));

  const completos = filasMes.filter((f) => !f.enCurso);
  if (completos.length >= 2) {
    const [antes, ultimo] = completos.slice(-2);
    if (antes.finalizadas > 0 && ((antes.finalizadas - ultimo.finalizadas) / antes.finalizadas) * 100 >= UMBRALES.caidaFinalizadas) {
      lista.push(aviso(`Las finalizadas bajaron de ${antes.finalizadas} a ${ultimo.finalizadas} entre ${antes.etiqueta} y ${ultimo.etiqueta} (${Math.round(((antes.finalizadas - ultimo.finalizadas) / antes.finalizadas) * 100)}% menos).`, ordenes.filter((t) => t.estado === 'FINALIZADO' && deMes(ultimo.mes, t.finalizadoEn)).map((orden) => ({ orden, dato: diaDe(Number(orden.finalizadoEn)).split('-').reverse().join('/') })), `Finalizada en ${ultimo.etiqueta}`));
    }
  }
  const actual = filasMes[filasMes.length - 1];
  const previo = filasMes[filasMes.length - 2];
  if (actual && previo && actual.pctCancelacion !== null && previo.pctCancelacion !== null && actual.pctCancelacion - previo.pctCancelacion >= UMBRALES.subidaCancelacion) {
    lista.push(aviso(`La tasa de cancelación subió de ${previo.pctCancelacion}% a ${actual.pctCancelacion}% (${actual.etiqueta}${actual.enCurso ? ', mes en curso' : ''}).`, ordenes.filter((t) => t.estado === 'CANCELADO' && deMes(actual.mes, Number(t.canceladaEn) || Number(t.createdAt))).map((orden) => ({ orden, dato: motivoCancelacion(orden) || 'Sin motivo' })), `Canceladas en ${actual.etiqueta}`));
  }
  for (const n of causas.napsSospechosas.slice(0, 3)) {
    lista.push(aviso(`La NAP ${n.nap} tuvo ${n.total} averías de ${n.clientes} clientes distintos: posible problema en la NAP.`, n.ordenes, 'Falla'));
  }

  const alertas = lista.filter((h) => h.nivel === 'aviso');
  if (alertas.length === 0) return [...lista, bien('Sin alertas: los indicadores están dentro de lo esperado.')];
  return [...alertas, ...lista.filter((h) => h.nivel === 'ok')];
}

// Todo lo que muestra el resumen: cifras (dos filas), meses de la tendencia, comparativo por técnico y puntos de atención.
export function resumenEjecutivo({ ordenes, eventos, contadores, tickets, rango, tecnico, ahora }) {
  const atencion = tiempoDeAtencion(ordenes, rango, { tecnico, metaMs: META_HORAS_RESUMEN * HORA_MS });
  const prod = productividad(ordenes, eventos, rango, ahora, { tecnico });
  const cal = calidad(ordenes, rango, { tecnico });
  const causas = causasDeAveria(ordenes, rango, { tecnico });
  const filasMes = tendenciaMensual(contadores, tickets, mesesDeLaTendencia(contadores, ahora, 6), ahora);
  const pendientesViejas = pendientesMasAntiguas(ordenes, ahora, { tecnico, limite: 1000 }).filter((p) => p.esperaMs > UMBRALES.pendienteDias * DIA_MS);

  const activoMs = prod.reduce((s, f) => s + f.activoMs, 0);
  const finalizadas = prod.reduce((s, f) => s + f.finalizadas, 0);
  const actual = filasMes[filasMes.length - 1];
  const previo = filasMes.length > 1 ? filasMes[filasMes.length - 2] : null;

  const nombres = [...new Set([...prod.map((f) => f.tecnico), ...cal.filas.map((f) => f.tecnico)])];
  const tecnicos = nombres.map((nombre) => {
    const p = prod.find((f) => f.tecnico === nombre) || {};
    const c = cal.filas.find((f) => f.tecnico === nombre) || {};
    return {
      tecnico: nombre,
      finalizadas: p.finalizadas || 0,
      atencionMedia: p.atencionMedia ?? null,
      activoMs: p.activoMs || 0,
      porHora: p.porHora ?? null,
      pctReincidencia: c.pctReincidencia ?? null,
      pctDebil: c.pctDebil ?? null,
      pctDevueltas: c.pctDevueltas ?? null,
    };
  }).sort((a, b) => b.finalizadas - a.finalizadas || a.tecnico.localeCompare(b.tecnico));

  const cifras = [
    { etiqueta: 'Órdenes finalizadas', valor: finalizadas, detalle: 'en el periodo' },
    { etiqueta: 'Tiempo promedio de atención', valor: atencion.total.cantidad ? formatoTiempo(atencion.total.promedio) : '—', detalle: atencion.total.cantidad ? `${textoPorcentaje(atencion.total.pctMeta)} en ${META_HORAS_RESUMEN} h o menos` : 'Sin datos' },
    { etiqueta: 'Reincidencia', valor: textoPorcentaje(cal.total.pctReincidencia), detalle: 'cliente con avería en 30 días' },
    { etiqueta: 'Tiempo activo de técnicos', valor: formatoDuracion(activoMs), detalle: 'según el registro de activación' },
  ];
  const cifrasMes = [
    { etiqueta: `Finalizadas · ${actual.etiqueta}${actual.enCurso ? ' (en curso)' : ''}`, valor: actual.finalizadas, detalle: previo ? `${previo.etiqueta}: ${previo.finalizadas}` : 'primer mes con datos' },
    { etiqueta: 'Tasa de cancelación del mes', valor: textoPorcentaje(actual.pctCancelacion), detalle: previo ? `${previo.etiqueta}: ${textoPorcentaje(previo.pctCancelacion)}` : 'primer mes con datos' },
    { etiqueta: 'Averías del periodo', valor: causas.total, detalle: causas.porFalla[0] ? `más frecuente: ${causas.porFalla[0].nombre}` : 'Sin averías' },
    { etiqueta: 'Pendientes de más de 3 días', valor: pendientesViejas.length, detalle: 'órdenes abiertas hoy' },
  ];

  return { cifras, cifrasMes, filasMes, tecnicos, hallazgos: hallazgos({ atencion, cal, pendientesViejas, filasMes, causas, ordenes, rango, tecnico }) };
}
