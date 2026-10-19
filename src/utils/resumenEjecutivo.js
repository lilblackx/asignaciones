// Resumen ejecutivo: lo esencial de los demás reportes en una sola hoja, con alertas automáticas ("puntos de atención") cuando un indicador
// se sale de lo esperado. Los umbrales están aquí arriba para ajustarlos en un solo lugar.
import {
  calidad, formatoTiempo, pendientesMasAntiguas, productividad, textoPorcentaje, tiempoDeAtencion,
} from './gestionTecnicos.js';
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

const aviso = (texto) => ({ nivel: 'aviso', texto });
const bien = (texto) => ({ nivel: 'ok', texto });

// Los puntos de atención del periodo: primero las alertas, y si no hay ninguna, una línea que lo dice.
export function hallazgos({ atencion, cal, pendientesViejas, filasMes, causas }) {
  const lista = [];
  const { total } = atencion;
  if (total.cantidad > 0) {
    lista.push(total.pctMeta < UMBRALES.metaCumplida
      ? aviso(`Solo el ${total.pctMeta}% de las órdenes se resolvió en ${META_HORAS_RESUMEN} h o menos (lo esperado es ${UMBRALES.metaCumplida}% o más).`)
      : bien(`El ${total.pctMeta}% de las órdenes se resolvió en ${META_HORAS_RESUMEN} h o menos.`));
  }
  if (pendientesViejas.length > 0) {
    const mas = pendientesViejas[0];
    lista.push(aviso(`${pendientesViejas.length} ${pendientesViejas.length === 1 ? 'orden pendiente lleva' : 'órdenes pendientes llevan'} más de ${UMBRALES.pendienteDias} días; la más antigua es ${mas.orden.codigo || 'sin código'} (${formatoTiempo(mas.esperaMs)}).`));
  }
  const t = cal.total;
  if (t.pctReincidencia !== null && t.pctReincidencia > UMBRALES.reincidencia) lista.push(aviso(`El ${t.pctReincidencia}% de las órdenes terminadas reincidió (el cliente volvió con una avería); lo esperado es ${UMBRALES.reincidencia}% o menos.`));
  for (const f of cal.filas) {
    if (f.reincidieron >= UMBRALES.minimoCasosTecnico && t.pctReincidencia !== null && f.pctReincidencia >= t.pctReincidencia * 2) lista.push(aviso(`${f.tecnico} tiene reincidencia de ${f.pctReincidencia}% (${f.reincidieron} casos), al menos el doble del promedio (${t.pctReincidencia}%).`));
    if (f.conPotencia >= 5 && f.pctDebil > UMBRALES.senalDebilTecnico) lista.push(aviso(`${f.tecnico} dejó señal débil en el ${f.pctDebil}% de sus mediciones (${f.debiles} de ${f.conPotencia}).`));
  }
  if (t.pctDebil !== null && t.pctDebil > UMBRALES.senalDebil) lista.push(aviso(`El ${t.pctDebil}% de las mediciones de potencia quedó con señal débil.`));
  if (t.pctDevueltas !== null && t.pctDevueltas > UMBRALES.devueltas) lista.push(aviso(`La oficina devolvió el ${t.pctDevueltas}% de las órdenes al técnico para corregirlas.`));

  const completos = filasMes.filter((f) => !f.enCurso);
  if (completos.length >= 2) {
    const [antes, ultimo] = completos.slice(-2);
    if (antes.finalizadas > 0 && ((antes.finalizadas - ultimo.finalizadas) / antes.finalizadas) * 100 >= UMBRALES.caidaFinalizadas) {
      lista.push(aviso(`Las finalizadas bajaron de ${antes.finalizadas} a ${ultimo.finalizadas} entre ${antes.etiqueta} y ${ultimo.etiqueta} (${Math.round(((antes.finalizadas - ultimo.finalizadas) / antes.finalizadas) * 100)}% menos).`));
    }
  }
  const actual = filasMes[filasMes.length - 1];
  const previo = filasMes[filasMes.length - 2];
  if (actual && previo && actual.pctCancelacion !== null && previo.pctCancelacion !== null && actual.pctCancelacion - previo.pctCancelacion >= UMBRALES.subidaCancelacion) {
    lista.push(aviso(`La tasa de cancelación subió de ${previo.pctCancelacion}% a ${actual.pctCancelacion}% (${actual.etiqueta}${actual.enCurso ? ', mes en curso' : ''}).`));
  }
  for (const n of causas.napsSospechosas.slice(0, 3)) {
    lista.push(aviso(`La NAP ${n.nap} tuvo ${n.total} averías de ${n.clientes} clientes distintos: posible problema en la NAP.`));
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

  return { cifras, cifrasMes, filasMes, tecnicos, hallazgos: hallazgos({ atencion, cal, pendientesViejas, filasMes, causas }) };
}
