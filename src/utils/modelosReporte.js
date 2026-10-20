// Lo que muestra cada reporte, armado como datos puros: las cifras de arriba (las usan las pantallas) y el "documento" que se baja en PDF o
// Word. Un documento es { titulo, subtitulo, generado, bloques }; cada bloque es uno de:
//   { tipo: 'cifras', items: [{ etiqueta, valor, detalle? }] }
//   { tipo: 'seccion', titulo }                      { tipo: 'texto', texto }
//   { tipo: 'lista', titulo, items: [{ nivel: 'aviso' | 'ok', texto }] }   (puntos de atención)
//   { tipo: 'tabla', titulo?, nota?, columnas: [{ titulo, derecha? }], filas: [[texto, ...]], vacio? }
//   { tipo: 'grafico', variante: 'columnas' | 'barras', titulo, subtitulo?, series: [{ nombre, color }], categorias: [{ etiqueta, valores, textos? }] }
// Los textos son planos (sin JSX), así el mismo modelo sirve para el PDF y el Word.
import { lineasPeriodo } from './csvReporte.js';
import { diaLegible } from './periodoReporte.js';
import { estadisticasOperativas } from './estadisticasOperativas.js';
import {
  VENTANA_REINCIDENCIA_DIAS, calidad, formatoTiempo, pendientesMasAntiguas, porcentaje, productividad, textoPorcentaje, tiempoDeAtencion,
} from './gestionTecnicos.js';
import { activacionPorTecnico, formatoDuracion } from './logTecnico.js';
import { CLIENTES_NAP_SOSPECHOSA, causasDeAveria } from './causasAveria.js';
import { resumenEjecutivo } from './resumenEjecutivo.js';
import { NOTA_COBROS, RESULTADOS, cifrasCobros, columnasDesglose, columnasMonto, columnasResultado, filaDesglose, filasMonto, filasResultado, resumenCobros } from './cobrosReporte.js';
import { NOTA_HORAS, cifrasDeTramos, colasDeLaOficina, columnasPorTecnico, columnasPorTipo, columnasTramo, esperasDelCiclo, filaPorTecnico, filaPorTipo, filaTramo } from './esperasCiclo.js';
import { HOJAS, armarHoja, columnasMaterialesVisitas, filasMaterialesVisitas } from './reporteMensual.js';
import { cifrasVnTa, columnasEstadisticaVnTa, columnasVnTa, estadisticaRegistros, filaVnTa, filasEstadisticaVnTa, ordenarRegistros } from './registroVnTa.js';
import { NOTA_PAGOS, cifrasPagos, cifrasResumenPagado, columnasPagosRegistrados, columnasPagosTecnico, columnasResumenPagado, filaPagoRegistrado, filaPagoTecnico, filaResumenPagado, pagosDelPeriodo, resumenPagado, sumaPagado } from './finanzas.js';
import { etiquetaMes } from './totalesMes.js';
import { mesesDeLaTendencia, tendenciaMensual, textoVariacion } from './tendenciaMensual.js';

const HORA_MS = 3600000;
const AZUL = '#2a78d6';
const NARANJA = '#eb6834';
const decimal = (n) => n.toFixed(2).replace('.', ',');
const horas = (ms) => Math.round((ms / HORA_MS) * 100) / 100;

// --- Cifras de arriba de cada reporte ---
export function cifrasEstadisticas({ finalizadas, totalOrdenes, porTecnico, reincidentes }) {
  return [
    { etiqueta: 'Órdenes', valor: totalOrdenes, detalle: 'incluye las canceladas' },
    { etiqueta: 'Finalizadas', valor: finalizadas, detalle: totalOrdenes ? `${Math.round((finalizadas / totalOrdenes) * 100)}% de las órdenes` : 'Sin órdenes' },
    { etiqueta: 'Técnico líder', valor: porTecnico[0]?.name || '—', detalle: porTecnico[0] ? `${porTecnico[0].count} finalizadas` : 'Sin finalizadas' },
    { etiqueta: 'Clientes reincidentes', valor: reincidentes.length, detalle: 'con más de una orden' },
  ];
}

export function cifrasTiempoAtencion(atencion, metaHoras) {
  const { total } = atencion;
  return [
    { etiqueta: 'Órdenes finalizadas', valor: atencion.finalizadas, detalle: 'en el periodo' },
    { etiqueta: 'Tiempo promedio', valor: total.cantidad ? formatoTiempo(total.promedio) : '—', detalle: 'desde que se creó la orden' },
    { etiqueta: 'Tiempo típico (mediana)', valor: total.cantidad ? formatoTiempo(total.mediana) : '—', detalle: total.cantidad ? `la más lenta: ${formatoTiempo(total.maximo)}` : 'Sin datos' },
    { etiqueta: `Resueltas en ${metaHoras} h o menos`, valor: textoPorcentaje(total.pctMeta), detalle: `${total.dentroMeta} de ${total.cantidad}` },
  ];
}

export function cifrasProductividad(filas) {
  const finalizadas = filas.reduce((s, f) => s + f.finalizadas, 0);
  const activoMs = filas.reduce((s, f) => s + f.activoMs, 0);
  const mejor = filas.filter((f) => f.porHora !== null).sort((a, b) => b.porHora - a.porHora)[0];
  return [
    { etiqueta: 'Órdenes finalizadas', valor: finalizadas, detalle: `${filas.filter((f) => f.finalizadas > 0).length} técnicos` },
    { etiqueta: 'Tiempo activo total', valor: formatoDuracion(activoMs), detalle: 'según el registro de activación' },
    { etiqueta: 'Finalizadas por hora activa', valor: activoMs >= 1800000 ? decimal(finalizadas / (activoMs / HORA_MS)) : '—', detalle: 'promedio de todos' },
    { etiqueta: 'Mejor ritmo', valor: mejor ? mejor.tecnico : '—', detalle: mejor ? `${decimal(mejor.porHora)} por hora activa` : 'Sin datos suficientes' },
  ];
}

export function cifrasCalidad({ total }) {
  return [
    { etiqueta: 'Órdenes revisadas', valor: total.finalizadas, detalle: 'finalizadas en el periodo' },
    { etiqueta: 'Reincidencia', valor: textoPorcentaje(total.pctReincidencia), detalle: `cliente con avería en ${VENTANA_REINCIDENCIA_DIAS} días` },
    { etiqueta: 'Señal débil', valor: textoPorcentaje(total.pctDebil), detalle: 'de las que tienen potencia' },
    { etiqueta: 'Devueltas por la oficina', valor: textoPorcentaje(total.pctDevueltas), detalle: 'regresadas al técnico' },
  ];
}

export function cifrasActivacion(a) {
  const lider = a.tecnicos[0];
  return [
    { etiqueta: 'Tiempo activo total', valor: formatoDuracion(a.total), detalle: `${a.tecnicos.length} ${a.tecnicos.length === 1 ? 'técnico' : 'técnicos'}` },
    { etiqueta: 'Promedio por técnico y día', valor: a.diasConTecnico ? formatoDuracion(a.total / a.diasConTecnico) : '—', detalle: `${a.diasConTecnico} ${a.diasConTecnico === 1 ? 'jornada' : 'jornadas'}` },
    { etiqueta: 'Más activo', valor: lider ? lider.nombre : '—', detalle: lider ? formatoDuracion(lider.total) : 'Sin actividad' },
    { etiqueta: 'Movimientos', valor: a.movimientos.length, detalle: 'activar y desactivar' },
  ];
}

export function cifrasTendencia(filas) {
  const actual = filas[filas.length - 1];
  const anterior = filas.length > 1 ? filas[filas.length - 2] : null;
  const contra = (campo) => (anterior ? `${textoVariacion(campo(actual), campo(anterior), anterior.etiqueta)}${actual.enCurso ? ' · mes en curso' : ''}` : 'primer mes con datos');
  return [
    { etiqueta: `Instalaciones finalizadas · ${actual.etiqueta}`, valor: actual.instalaciones.finalizadas, detalle: contra((f) => f.instalaciones.finalizadas) },
    { etiqueta: `Averías LOS resueltas · ${actual.etiqueta}`, valor: actual.los.finalizadas, detalle: contra((f) => f.los.finalizadas) },
    { etiqueta: `Canceladas · ${actual.etiqueta}`, valor: actual.canceladas, detalle: contra((f) => f.canceladas) },
    { etiqueta: 'Tasa de cancelación', valor: textoPorcentaje(actual.pctCancelacion), detalle: anterior ? `${anterior.etiqueta}: ${textoPorcentaje(anterior.pctCancelacion)}` : 'primer mes con datos' },
  ];
}

// --- Documentos (PDF / Word) ---
const encabezado = (titulo, rango, tecnico, { generadoPor, ahora }, bloques) => ({
  titulo,
  subtitulo: rango ? lineasPeriodo(rango, tecnico).join('  ·  ') : 'Todo el negocio, mes contra mes',
  generado: { en: ahora, por: generadoPor || '' },
  bloques,
});

const tecnicoYTexto = (lista, valor, texto) => lista.slice(0, 12).map((f) => ({ etiqueta: f.nombre ?? f.tecnico ?? f.name, valores: [valor(f)], textos: [texto(f)] }));

export function documentoEstadisticas(ctx) {
  const { ordenes, rango, tecnico } = ctx;
  const e = estadisticasOperativas(ordenes, rango, tecnico);
  return encabezado('Estadísticas operativas', rango, tecnico, ctx, [
    { tipo: 'cifras', items: cifrasEstadisticas(e) },
    ...(e.porTecnico.length ? [{ tipo: 'grafico', variante: 'barras', titulo: 'Órdenes finalizadas por técnico', series: [{ nombre: 'Finalizadas', color: AZUL }], categorias: tecnicoYTexto(e.porTecnico, (f) => f.count, (f) => String(f.count)) }] : []),
    { tipo: 'tabla', titulo: 'NAPs con más órdenes', columnas: [{ titulo: 'NAP' }, { titulo: 'Órdenes', derecha: true }], filas: e.porNap.map((f) => [f.nap, String(f.count)]), vacio: 'Sin datos de NAP registrados.' },
    { tipo: 'tabla', titulo: 'Clientes con más de una orden', columnas: [{ titulo: 'Cliente' }, { titulo: 'Cédula' }, { titulo: 'Órdenes', derecha: true }], filas: e.reincidentes.map((f) => [f.nombre || '—', f.cedula, String(f.count)]), vacio: 'Ningún cliente tiene más de una orden.' },
    { tipo: 'texto', texto: 'Solo cuenta el historial cargado (los cierres más recientes) y las órdenes activas del periodo.' },
  ]);
}

export function documentoTiempoAtencion(ctx) {
  const { ordenes, rango, tecnico, metaHoras, ahora } = ctx;
  const atencion = tiempoDeAtencion(ordenes, rango, { tecnico, metaMs: metaHoras * HORA_MS });
  const pendientes = pendientesMasAntiguas(ordenes, ahora, { tecnico });
  const columnas = (primera) => [{ titulo: primera }, { titulo: 'Finalizadas', derecha: true }, { titulo: 'Promedio', derecha: true }, { titulo: 'Mediana', derecha: true }, { titulo: 'Más lenta', derecha: true }, { titulo: `En ${metaHoras} h o menos`, derecha: true }];
  const fila = (f) => [f.nombre, String(f.cantidad), formatoTiempo(f.promedio), formatoTiempo(f.mediana), formatoTiempo(f.maximo), textoPorcentaje(f.pctMeta)];
  return encabezado('Tiempo de atención', rango, tecnico, ctx, [
    { tipo: 'cifras', items: cifrasTiempoAtencion(atencion, metaHoras) },
    ...(atencion.porTecnico.length ? [{ tipo: 'grafico', variante: 'barras', titulo: 'Tiempo promedio de atención por técnico (horas)', series: [{ nombre: 'Horas', color: AZUL }], categorias: tecnicoYTexto(atencion.porTecnico, (f) => horas(f.promedio), (f) => formatoTiempo(f.promedio)) }] : []),
    { tipo: 'tabla', titulo: 'Por tipo de trabajo', columnas: columnas('Tipo'), filas: atencion.porTipo.map(fila), vacio: 'Ninguna orden finalizada en este periodo.' },
    { tipo: 'tabla', titulo: 'Por técnico', columnas: columnas('Técnico'), filas: atencion.porTecnico.map(fila), vacio: 'Ninguna orden finalizada en este periodo.' },
    { tipo: 'tabla', titulo: 'Pendientes más antiguas', nota: 'Órdenes abiertas a la fecha del reporte, sin contar las programadas para más adelante.', columnas: [{ titulo: 'Código' }, { titulo: 'Cliente' }, { titulo: 'Técnico' }, { titulo: 'Tipo' }, { titulo: 'Espera', derecha: true }], filas: pendientes.map(({ orden, esperaMs }) => [orden.codigo || '', orden.nombre || '', orden.tecnico || 'Sin técnico', orden.tipoTrabajo || '', formatoTiempo(esperaMs)]), vacio: 'No hay órdenes pendientes.' },
    { tipo: 'texto', texto: 'El tiempo corre desde que se crea la orden (o desde su fecha programada, si es posterior) hasta que se finaliza.' },
  ]);
}

export function documentoProductividad(ctx) {
  const { ordenes, eventos, rango, tecnico, ahora } = ctx;
  const filas = productividad(ordenes, eventos, rango, ahora, { tecnico });
  const conRitmo = filas.filter((f) => f.porHora !== null);
  return encabezado('Productividad por técnico', rango, tecnico, ctx, [
    { tipo: 'cifras', items: cifrasProductividad(filas) },
    ...(filas.some((f) => f.finalizadas > 0) ? [{ tipo: 'grafico', variante: 'barras', titulo: 'Órdenes finalizadas por técnico', series: [{ nombre: 'Finalizadas', color: AZUL }], categorias: tecnicoYTexto(filas.filter((f) => f.finalizadas > 0), (f) => f.finalizadas, (f) => String(f.finalizadas)) }] : []),
    ...(conRitmo.length ? [{ tipo: 'grafico', variante: 'barras', titulo: 'Finalizadas por hora activa', series: [{ nombre: 'Por hora', color: NARANJA }], categorias: tecnicoYTexto([...conRitmo].sort((a, b) => b.porHora - a.porHora), (f) => Math.round(f.porHora * 100) / 100, (f) => decimal(f.porHora)) }] : []),
    { tipo: 'tabla', titulo: 'Detalle por técnico', columnas: [{ titulo: 'Técnico' }, { titulo: 'Finalizadas', derecha: true }, { titulo: 'Tiempo activo', derecha: true }, { titulo: 'Por hora activa', derecha: true }, { titulo: 'Atención media', derecha: true }], filas: filas.map((f) => [f.tecnico, String(f.finalizadas), f.activoMs > 0 ? formatoDuracion(f.activoMs) : '—', f.porHora === null ? '—' : decimal(f.porHora), f.atencionMedia === null ? '—' : formatoTiempo(f.atencionMedia)]), vacio: 'Sin órdenes finalizadas ni actividad registrada en este periodo.' },
    { tipo: 'texto', texto: 'Las finalizadas por hora activa se calculan con el tiempo registrado entre activar y desactivar al técnico (solo desde su primer movimiento registrado; con menos de 30 minutos activo no se calcula).' },
  ]);
}

export function documentoCalidad(ctx) {
  const { ordenes, rango, tecnico } = ctx;
  const cal = calidad(ordenes, rango, { tecnico });
  const porcentajes = cal.filas.filter((f) => f.pctReincidencia !== null);
  return encabezado('Calidad y reincidencias', rango, tecnico, ctx, [
    { tipo: 'cifras', items: cifrasCalidad(cal) },
    ...(porcentajes.length ? [{ tipo: 'grafico', variante: 'barras', titulo: 'Reincidencia por técnico (%)', series: [{ nombre: '% de reincidencia', color: NARANJA }], categorias: tecnicoYTexto(porcentajes, (f) => f.pctReincidencia, (f) => `${f.pctReincidencia}%`) }] : []),
    { tipo: 'tabla', titulo: 'Calidad por técnico', nota: 'Menos es mejor en las tres columnas de porcentaje.', columnas: [{ titulo: 'Técnico' }, { titulo: 'Finalizadas', derecha: true }, { titulo: 'Reincidencia', derecha: true }, { titulo: 'Señal débil', derecha: true }, { titulo: 'Devueltas', derecha: true }], filas: cal.filas.map((f) => [f.tecnico, String(f.finalizadas), `${textoPorcentaje(f.pctReincidencia)} (${f.reincidieron})`, f.conPotencia ? `${textoPorcentaje(f.pctDebil)} (${f.debiles}/${f.conPotencia})` : '—', `${textoPorcentaje(f.pctDevueltas)} (${f.devueltas})`]), vacio: 'Ninguna orden finalizada en este periodo.' },
    { tipo: 'tabla', titulo: 'Clientes que reincidieron', columnas: [{ titulo: 'Técnico' }, { titulo: 'Cliente' }, { titulo: 'Orden' }, { titulo: 'Nueva avería' }, { titulo: 'Después', derecha: true }], filas: cal.reincidencias.map((r) => [r.tecnico, r.cliente, r.codigo || '', r.siguiente || '', r.dias === 0 ? 'mismo día' : `${r.dias} d`]), vacio: 'Ningún cliente reincidió.' },
    { tipo: 'texto', texto: `Reincidencia: el mismo cliente abre una avería dentro de ${VENTANA_REINCIDENCIA_DIAS} días después de finalizar la orden (las más recientes aún pueden reincidir).` },
  ]);
}

export function documentoActivacion(ctx) {
  const { eventos, rango, tecnico, ahora } = ctx;
  const a = activacionPorTecnico(eventos, rango, tecnico, ahora);
  const porDia = a.tecnicos.flatMap((t) => t.dias.map((dia) => ({ dia, nombre: t.nombre, ms: a.duraciones[t.nombre][dia] })))
    .sort((x, y) => y.dia.localeCompare(x.dia) || x.nombre.localeCompare(y.nombre));
  const MAX_MOVIMIENTOS = 100;
  return encabezado('Activación de técnicos', rango, tecnico, ctx, [
    { tipo: 'cifras', items: cifrasActivacion(a) },
    ...(a.tecnicos.length ? [{ tipo: 'grafico', variante: 'barras', titulo: 'Tiempo activo por técnico (horas)', series: [{ nombre: 'Horas activo', color: AZUL }], categorias: tecnicoYTexto(a.tecnicos, (t) => horas(t.total), (t) => formatoDuracion(t.total)) }] : []),
    { tipo: 'tabla', titulo: 'Tiempo activo por día', columnas: [{ titulo: 'Día' }, { titulo: 'Técnico' }, { titulo: 'Tiempo activo', derecha: true }], filas: porDia.map((f) => [diaLegible(f.dia), f.nombre, formatoDuracion(f.ms)]), vacio: 'Sin actividad registrada en este periodo.' },
    { tipo: 'tabla', titulo: 'Movimientos (activaciones y desactivaciones)', nota: a.movimientos.length > MAX_MOVIMIENTOS ? `Se muestran los ${MAX_MOVIMIENTOS} más recientes de ${a.movimientos.length}.` : undefined, columnas: [{ titulo: 'Fecha y hora' }, { titulo: 'Técnico' }, { titulo: 'Acción' }, { titulo: 'Hecho por' }], filas: a.movimientos.slice(0, MAX_MOVIMIENTOS).map((m) => [m.fechaHora, m.tecnico, m.accion === 'ACTIVADO' ? 'Activado' : 'Desactivado', m.por || '']), vacio: 'Sin movimientos en este periodo.' },
    { tipo: 'texto', texto: 'El tiempo activo suma los tramos entre activar y desactivar, por día (hora de Caracas). Solo cuenta desde el primer movimiento registrado de cada técnico.' },
  ]);
}

export function documentoTendencia(ctx) {
  const { contadores, tickets, ventana, ahora } = ctx;
  const filas = tendenciaMensual(contadores, tickets, mesesDeLaTendencia(contadores, ahora, ventana), ahora);
  const etiqueta = (f) => `${f.etiqueta}${f.enCurso ? '*' : ''}`;
  const series = [{ nombre: 'Instalaciones', color: AZUL }, { nombre: 'Averías LOS', color: NARANJA }];
  const base = encabezado('Tendencia mensual', null, '', ctx, [
    { tipo: 'cifras', items: cifrasTendencia(filas) },
    { tipo: 'grafico', variante: 'columnas', titulo: 'Finalizadas por mes', subtitulo: 'Instalaciones y averías LOS terminadas', series, categorias: filas.map((f) => ({ etiqueta: etiqueta(f), valores: [f.instalaciones.finalizadas, f.los.finalizadas] })) },
    { tipo: 'grafico', variante: 'columnas', titulo: 'Canceladas por mes', subtitulo: 'Instalaciones y averías LOS canceladas', series, categorias: filas.map((f) => ({ etiqueta: etiqueta(f), valores: [f.instalaciones.canceladas, f.los.canceladas] })) },
    { tipo: 'tabla', titulo: 'Detalle por mes', columnas: [{ titulo: 'Mes' }, { titulo: 'Inst. finalizadas', derecha: true }, { titulo: 'Inst. canceladas', derecha: true }, { titulo: 'LOS resueltas', derecha: true }, { titulo: 'LOS canceladas', derecha: true }, { titulo: '% cancelación', derecha: true }], filas: filas.map((f) => [`${etiquetaMes(f.mes)}${f.enCurso ? ' (en curso)' : ''}`, String(f.instalaciones.finalizadas), String(f.instalaciones.canceladas), String(f.los.finalizadas), String(f.los.canceladas), textoPorcentaje(f.pctCancelacion)]) },
    { tipo: 'texto', texto: '* Mes en curso: incluye lo de hoy que todavía no se cierra, pero está incompleto y no es comparable con un mes terminado. Cuenta instalaciones y averías de tipo LOS; las demás averías no entran en estos totales.' },
  ]);
  return base;
}

// --- Resumen ejecutivo y causas de avería ---
export function cifrasCausas(c) {
  const top = c.porFalla[0];
  return [
    { etiqueta: 'Averías reportadas', valor: c.total, detalle: `${c.resueltas} resueltas en el periodo` },
    { etiqueta: 'Falla más frecuente', valor: top ? top.nombre : '—', detalle: top ? `${top.total} averías (${top.pct}%)` : 'Sin averías' },
    { etiqueta: 'Tiempo medio de resolución', valor: c.resolucionMedia === null ? '—' : formatoTiempo(c.resolucionMedia), detalle: 'de las averías resueltas' },
    { etiqueta: 'NAPs afectadas', valor: c.napsAfectadas, detalle: `${c.napsSospechosas.length} con averías de varios clientes` },
  ];
}

const fechaCorta = (ms) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ms));
export const textoNapSospechosa = (n) => `La NAP ${n.nap} tuvo ${n.total} averías de ${n.clientes} clientes distintos: posible problema en la NAP.`;

// Las tablas de causas (las comparten la pantalla y el documento): por falla, evolución por mes y NAPs.
export function tablasCausas(c) {
  const evolucion = c.evolucion;
  return {
    porFalla: { columnas: [{ titulo: 'Falla' }, { titulo: 'Averías', derecha: true }, { titulo: '% del total', derecha: true }, { titulo: 'Resueltas', derecha: true }, { titulo: 'Canceladas', derecha: true }, { titulo: 'Resolución media', derecha: true }], filas: c.porFalla.map((f) => [f.nombre, String(f.total), `${f.pct}%`, String(f.resueltas), String(f.canceladas), f.resolucionMedia === null ? '—' : formatoTiempo(f.resolucionMedia)]) },
    evolucion: { columnas: [{ titulo: 'Mes' }, ...evolucion.fallas.map((f) => ({ titulo: f, derecha: true })), { titulo: 'Total', derecha: true }], filas: evolucion.filas.map((f) => [etiquetaMes(f.mes), ...f.valores.map(String), String(f.total)]) },
    porNap: { columnas: [{ titulo: 'NAP' }, { titulo: 'Averías', derecha: true }, { titulo: 'Clientes', derecha: true }, { titulo: 'Fallas principales' }, { titulo: 'Última avería', derecha: true }], filas: c.porNap.map((n) => [n.nap, String(n.total), String(n.clientes), n.principales.join(', '), fechaCorta(n.ultima)]) },
  };
}

export function documentoCausasAveria(ctx) {
  const { ordenes, rango, tecnico } = ctx;
  const c = causasDeAveria(ordenes, rango, { tecnico });
  const t = tablasCausas(c);
  return encabezado('Causas de avería', rango, tecnico, ctx, [
    { tipo: 'cifras', items: cifrasCausas(c) },
    ...(c.napsSospechosas.length ? [{ tipo: 'lista', titulo: 'Puntos de atención', items: c.napsSospechosas.map((n) => ({ nivel: 'aviso', texto: textoNapSospechosa(n) })) }] : []),
    ...(c.porFalla.length ? [{ tipo: 'grafico', variante: 'barras', titulo: 'Averías por tipo de falla', series: [{ nombre: 'Averías', color: AZUL }], categorias: c.porFalla.slice(0, 10).map((f) => ({ etiqueta: f.nombre, valores: [f.total], textos: [`${f.total} (${f.pct}%)`] })) }] : []),
    { tipo: 'tabla', titulo: 'Detalle por falla', ...t.porFalla, vacio: 'Ninguna avería reportada en este periodo.' },
    { tipo: 'tabla', titulo: 'Evolución mensual de las fallas más frecuentes', nota: 'Averías reportadas cada mes (todo el historial cargado, sin importar el periodo elegido).', ...t.evolucion, vacio: 'Sin averías en el historial cargado.' },
    { tipo: 'tabla', titulo: 'NAPs con más averías', ...t.porNap, vacio: 'Ninguna avería tiene NAP registrada.' },
    { tipo: 'texto', texto: `Cada avería cuenta en el día en que se reportó. Una NAP con averías de ${CLIENTES_NAP_SOSPECHOSA} o más clientes distintos en el periodo apunta a un problema de la NAP, no de cada cliente.` },
  ]);
}

export function documentoResumenEjecutivo(ctx) {
  const r = resumenEjecutivo(ctx);
  const { rango, tecnico } = ctx;
  const decimalHora = (n) => n.toFixed(2).replace('.', ',');
  return encabezado('Resumen ejecutivo', rango, tecnico, ctx, [
    { tipo: 'cifras', items: r.cifras },
    { tipo: 'cifras', items: r.cifrasMes },
    { tipo: 'lista', titulo: 'Puntos de atención', items: r.hallazgos },
    { tipo: 'grafico', variante: 'columnas', titulo: 'Finalizadas por mes', subtitulo: 'Instalaciones y averías LOS terminadas (todo el negocio)', series: [{ nombre: 'Instalaciones', color: AZUL }, { nombre: 'Averías LOS', color: NARANJA }], categorias: r.filasMes.map((f) => ({ etiqueta: `${f.etiqueta}${f.enCurso ? '*' : ''}`, valores: [f.instalaciones.finalizadas, f.los.finalizadas] })) },
    { tipo: 'tabla', titulo: 'Comparativo por técnico', nota: 'Del periodo elegido. Reincidencia, señal débil y devueltas: menos es mejor.', columnas: [{ titulo: 'Técnico' }, { titulo: 'Finalizadas', derecha: true }, { titulo: 'Atención media', derecha: true }, { titulo: 'Por hora activa', derecha: true }, { titulo: 'Reincidencia', derecha: true }, { titulo: 'Señal débil', derecha: true }, { titulo: 'Devueltas', derecha: true }], filas: r.tecnicos.map((f) => [f.tecnico, String(f.finalizadas), f.atencionMedia === null ? '—' : formatoTiempo(f.atencionMedia), f.porHora === null ? '—' : decimalHora(f.porHora), textoPorcentaje(f.pctReincidencia), textoPorcentaje(f.pctDebil), textoPorcentaje(f.pctDevueltas)]), vacio: 'Sin órdenes finalizadas ni actividad en este periodo.' },
    { tipo: 'texto', texto: '* Mes en curso: incompleto, no es comparable con un mes terminado. Las alertas se activan con estos umbrales: menos de 80% de órdenes resueltas en 48 h, pendientes de más de 3 días, reincidencia mayor a 10%, señal débil mayor a 20%, devoluciones mayores a 15%, caída de finalizadas de 20% o más entre meses completos y aumento de 5 puntos en la tasa de cancelación.' },
  ]);
}

export function documentoEsperasCiclo(ctx) {
  const { ordenes, rango, tecnico, ahora } = ctx;
  const esperas = esperasDelCiclo(ordenes, rango, { tecnico });
  const colas = colasDeLaOficina(ordenes, ahora, { tecnico });
  const filaCola = ({ orden, esperaMs }) => [orden.codigo || '', orden.nombre || '', orden.tecnico || 'Sin técnico', orden.tipoTrabajo || '', formatoTiempo(esperaMs)];
  const columnasCola = [{ titulo: 'Código' }, { titulo: 'Cliente' }, { titulo: 'Técnico' }, { titulo: 'Tipo' }, { titulo: 'Espera', derecha: true }];
  const promedioHoras = (lista) => lista.filter((f) => f.cantidad > 0).map((f) => ({ nombre: f.nombre, valores: [horas(f.promedio)], textos: [formatoTiempo(f.promedio)] }));
  const graficoTramos = (quien, titulo) => {
    const categorias = promedioHoras(esperas.tramos.filter((t) => t.quien === quien));
    return categorias.length ? [{ tipo: 'grafico', variante: 'barras', titulo, series: [{ nombre: 'Horas', color: quien === 'OFICINA' ? NARANJA : AZUL }], categorias: categorias.map(({ nombre, valores, textos }) => ({ etiqueta: nombre, valores, textos })) }] : [];
  };
  return encabezado('Esperas del ciclo', rango, tecnico, ctx, [
    { tipo: 'cifras', items: [{ etiqueta: 'Órdenes finalizadas', valor: esperas.finalizadas, detalle: 'en el periodo' }, { etiqueta: 'Con horas registradas', valor: esperas.conHoras, detalle: 'miden al menos un tramo' }] },
    { tipo: 'seccion', titulo: 'Oficina' },
    { tipo: 'cifras', items: cifrasDeTramos(esperas, 'OFICINA') },
    ...graficoTramos('OFICINA', 'Tiempo promedio por tramo de la oficina (horas)'),
    { tipo: 'tabla', titulo: 'Tramos de la oficina', columnas: columnasTramo('Tramo'), filas: esperas.tramos.filter((t) => t.quien === 'OFICINA').map(filaTramo), vacio: 'Sin órdenes en este periodo.' },
    { tipo: 'tabla', titulo: 'Por tipo de trabajo', columnas: columnasPorTipo(), filas: esperas.porTipo.map(filaPorTipo), vacio: 'Ninguna orden con horas de la oficina en este periodo.' },
    { tipo: 'tabla', titulo: `Sin técnico ahora (${colas.sinTecnico.total})`, nota: 'Órdenes pendientes que aún no tienen técnico, la más vieja primero.', columnas: columnasCola, filas: colas.sinTecnico.lista.map(filaCola), vacio: 'Todas las órdenes pendientes tienen técnico.' },
    { tipo: 'tabla', titulo: `Pre-finalizadas por aprobar (${colas.porAprobar.total})`, nota: 'Esperan la aprobación de la oficina, la más vieja primero.', columnas: columnasCola, filas: colas.porAprobar.lista.map(filaCola), vacio: 'No hay órdenes por aprobar.' },
    { tipo: 'seccion', titulo: 'Técnico' },
    { tipo: 'cifras', items: cifrasDeTramos(esperas, 'TÉCNICO') },
    ...graficoTramos('TÉCNICO', 'Tiempo promedio por tramo del técnico (horas)'),
    { tipo: 'tabla', titulo: 'Tramos del técnico', columnas: columnasTramo('Tramo'), filas: esperas.tramos.filter((t) => t.quien === 'TÉCNICO').map(filaTramo), vacio: 'Sin órdenes en este periodo.' },
    { tipo: 'tabla', titulo: 'Por técnico', columnas: columnasPorTecnico(), filas: esperas.porTecnico.map(filaPorTecnico), vacio: 'Ninguna orden con horas del técnico en este periodo.' },
    { tipo: 'texto', texto: NOTA_HORAS },
  ]);
}

export function documentoCobros(ctx) {
  const { ordenes, rango, tecnico } = ctx;
  const resumen = resumenCobros(ordenes, rango, { tecnico });
  const { total } = resumen;
  const cuenta = { visita: total.visita, otro: total.otro, exonerada: total.exoneradas, sinCobro: total.sinCobro };
  return encabezado('Cobros y exoneraciones', rango, tecnico, ctx, [
    { tipo: 'cifras', items: cifrasCobros(resumen) },
    ...(total.total ? [{ tipo: 'grafico', variante: 'barras', titulo: 'Órdenes por resultado del cobro', series: [{ nombre: 'Órdenes', color: AZUL }], categorias: RESULTADOS.map((r) => ({ etiqueta: r.nombre, valores: [cuenta[r.id]], textos: [`${cuenta[r.id]} (${textoPorcentaje(porcentaje(cuenta[r.id], total.total))})`] })) }] : []),
    { tipo: 'tabla', titulo: 'Resultado del cobro', columnas: columnasResultado(), filas: filasResultado(resumen), vacio: 'Ninguna orden con cobro en este periodo.' },
    { tipo: 'tabla', titulo: 'Monto cobrado', nota: 'Suma de las órdenes cobradas, separada por moneda.', columnas: columnasMonto(), filas: filasMonto(resumen) },
    { tipo: 'tabla', titulo: 'Por concepto (tipo de visita)', columnas: columnasDesglose('Concepto'), filas: resumen.porConcepto.map(filaDesglose), vacio: 'Ninguna orden con cobro en este periodo.' },
    { tipo: 'tabla', titulo: 'Por técnico', columnas: columnasDesglose('Técnico'), filas: resumen.porTecnico.map(filaDesglose), vacio: 'Ninguna orden con cobro en este periodo.' },
    { tipo: 'texto', texto: NOTA_COBROS },
  ]);
}

// Registro de estadísticas: las hojas del mes que el departamento lleva en su hoja de cálculo. Visitas técnicas, averías e instalaciones se arman solas
// con las órdenes (cuadro de estadística, materiales y lista de cada orden); VN y TA se llena a mano (`registrosVnTa`, ver utils/registroVnTa). La
// lista completa (19 o 20 columnas) va solo en el CSV; el PDF y el Word llevan una lista resumida que cabe en la hoja vertical.
export function documentoRegistroEstadisticas(ctx) {
  const { ordenes, rango, tecnico, registrosVnTa = [] } = ctx;
  const bloquesDeHoja = (h) => [
    { tipo: 'seccion', titulo: h.nombre },
    { tipo: 'cifras', titulo: `Resumen de ${h.singular}`, items: h.cifras },
    { tipo: 'tabla', titulo: h.tituloEstadistica, columnas: h.columnasEstadistica, filas: h.filasEstadistica },
    { tipo: 'tabla', titulo: `Materiales de ${h.singular}`, columnas: columnasMaterialesVisitas(), filas: filasMaterialesVisitas(h.estadistica) },
    { tipo: 'texto', texto: `${h.nota}${h.aviso ? ` ${h.aviso}` : ''}` },
    { tipo: 'tabla', noCsv: true, titulo: `${h.nombre} del periodo (${h.lista.length})`, columnas: h.columnasCompacta, filas: h.lista.map((t) => h.filaCompacta(t)), vacio: 'Ninguna orden en este periodo.' },
    { tipo: 'tabla', soloCsv: true, titulo: `Hoja de ${h.singular}`, columnas: h.columnasLista, filas: h.lista.map((t, i) => h.filaLista(t, i + 1)), vacio: 'Ninguna orden en este periodo.' },
  ];
  // VN y TA (a mano): el técnico filtrado de arriba también aplica a sus filas.
  const filasVnTa = ordenarRegistros(registrosVnTa).filter((r) => !tecnico || String(r.tecnico || '').toUpperCase() === tecnico.toUpperCase());
  const eVnTa = estadisticaRegistros(filasVnTa);
  const bloquesVnTa = [
    { tipo: 'seccion', titulo: 'VN y TA' },
    { tipo: 'cifras', titulo: 'Resumen de VN y TA', items: cifrasVnTa(eVnTa) },
    { tipo: 'tabla', titulo: 'Estadística de VN y TA', columnas: columnasEstadisticaVnTa(), filas: filasEstadisticaVnTa(eVnTa) },
    { tipo: 'tabla', titulo: `Hoja de VN y TA (${filasVnTa.length})`, columnas: columnasVnTa(), filas: filasVnTa.map(filaVnTa), vacio: 'Ningún registro de VN o TA en este periodo.' },
  ];
  return encabezado('Registro de estadísticas', rango, tecnico, ctx, [
    ...HOJAS.filter((h) => !h.manual).flatMap(({ id }) => bloquesDeHoja(armarHoja(id, ordenes, rango, { tecnico }))),
    ...bloquesVnTa,
  ]);
}

// Finanzas: lo que se le debe a cada técnico (con las tarifas de hoy) y los pagos registrados en el periodo.
export function documentoPagosTecnicos(ctx) {
  const { rango, tecnico, pagosFinanzas } = ctx;
  const { filas, pagos, pagadasPorTecnico, tasa = null } = pagosFinanzas;
  const delTecnico = (nombre) => !tecnico || String(nombre).toUpperCase() === tecnico.toUpperCase();
  const visibles = filas.filter((f) => delTecnico(f.tecnico));
  const registrados = pagosDelPeriodo(pagos, rango).filter((p) => delTecnico(p.tecnico));
  return encabezado('Pago a técnicos', rango, tecnico, ctx, [
    { tipo: 'cifras', items: cifrasPagos(visibles, sumaPagado(Object.entries(pagadasPorTecnico).filter(([nombre]) => delTecnico(nombre)).map(([, v]) => v)), tasa) },
    { tipo: 'tabla', titulo: 'Por pagar a cada técnico', columnas: columnasPagosTecnico(), filas: visibles.filter((f) => f.pendientes.length > 0).map((f) => filaPagoTecnico(f, tasa)), vacio: 'Nada por pagar en este periodo.' },
    { tipo: 'tabla', titulo: `Pagos registrados (${registrados.length})`, columnas: columnasPagosRegistrados(), filas: registrados.map((p) => filaPagoRegistrado(p, tasa)), vacio: 'Ningún pago registrado en este periodo.' },
    { tipo: 'texto', texto: NOTA_PAGOS },
  ]);
}

// Finanzas: el resumen de lo pagado en el periodo, por técnico (cuánto se le pagó y por cuántas órdenes) y cada pago registrado.
export function documentoResumenPagos(ctx) {
  const { rango, tecnico, pagosFinanzas } = ctx;
  const { tasa = null } = pagosFinanzas;
  const resumen = resumenPagado(pagosFinanzas.pagos, rango, { tecnico, tasa });
  const registrados = pagosDelPeriodo(pagosFinanzas.pagos, rango).filter((p) => !tecnico || String(p.tecnico).toUpperCase() === tecnico.toUpperCase());
  return encabezado('Resumen de pagos', rango, tecnico, ctx, [
    { tipo: 'cifras', items: cifrasResumenPagado(resumen) },
    { tipo: 'tabla', titulo: 'Pagado a cada técnico', columnas: columnasResumenPagado(), filas: resumen.porTecnico.map(filaResumenPagado), vacio: 'Ningún pago registrado en este periodo.' },
    { tipo: 'tabla', titulo: `Pagos registrados (${registrados.length})`, columnas: columnasPagosRegistrados(), filas: registrados.map((p) => filaPagoRegistrado(p, tasa)), vacio: 'Ningún pago registrado en este periodo.' },
    { tipo: 'texto', texto: 'Cuenta los pagos registrados en el periodo; los anulados no suman. Los montos son los del tabulador de precios del momento de cada pago, y los bolívares, con la tasa BCV del dólar de ese momento (si un pago no la guardó, con la de hoy).' },
  ]);
}
