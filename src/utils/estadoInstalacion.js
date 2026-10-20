// Lo que ve una promotora de cada instalación: un estado en palabras claras (sin términos internos como
// PRE-FINALIZADO), y el historial liviano de las terminadas que el cierre del día saca de la lista.
import { estadoViaje, ESTADO_EN_SITIO, tiempoTranscurrido } from './enCamino.js';
import { categoriaProgramada } from './programada.js';
import { prioritariasPrimero } from './prioridad.js';
import { claveNombre } from './promotora.js';
import { motivoCancelacion } from './cancelacion.js';
import { generarMensajeWhatsAppInstalacion, promotoraDeOrden } from './whatsapp.js';

export const TIPO_INSTALACION = 'INSTALACIÓN';
export const TIPO_AVERIA = 'AVERÍA';
// El perfil de ventas (el PROMOTOR con "Ver todas las instalaciones") también sigue las averías de tipo LOS.
export const FALLA_LOS = 'LOS';

// Cuántos días de historial ve cada quien de una instalación ya cerrada (finalizada o cancelada): las promotoras 7 y el
// perfil de ventas (ve todas) 30. Cada día de más son documentos de más que se leen cada vez que se abre la app (se guarda una
// copia en el equipo por 30 minutos para no leerlos de nuevo). En Firestore el historial se conserva lo que ve ventas, que
// es lo más largo (30); cada pantalla descarta lo que sobra para ella. En cf-worker hay otra constante que debe valer igual.
export const RETENCION_DIAS_HISTORIAL = 7;
export const RETENCION_DIAS_HISTORIAL_VENTAS = 30;
const DIA_MS = 24 * 60 * 60 * 1000;
export const RETENCION_MS_HISTORIAL = RETENCION_DIAS_HISTORIAL * DIA_MS;
export const RETENCION_MS_HISTORIAL_VENTAS = RETENCION_DIAS_HISTORIAL_VENTAS * DIA_MS;

// Una avería de tipo LOS: lo único que, además de las instalaciones, llega al módulo de ventas.
export const esAveriaLos = (t) => t?.tipoTrabajo === TIPO_AVERIA && t?.falla === FALLA_LOS;

// Con qué orden se trabaja en ventas: 'INSTALACION', 'LOS'. (Los resúmenes viejos del historial no traen tipoTrabajo: son instalaciones.)
export const categoriaOrden = (t) => (esAveriaLos(t) ? 'LOS' : 'INSTALACION');

export const ESTADOS_PROMOTORA = {
  SIN_TECNICO: 'Sin técnico asignado',
  PROGRAMADA: 'Programada',
  ASIGNADA: 'Asignada',
  EN_CAMINO: 'Técnico en camino',
  EN_SITIO: 'Técnico en el sitio',
  EN_REVISION: 'Instalada, en revisión',
  INSTALADA: 'Instalada',
  CANCELADA: 'Cancelada',
};

// Orden en que se muestran los filtros y las tarjetas (lo que más urge arriba).
export const ORDEN_ESTADOS_PROMOTORA = ['SIN_TECNICO', 'PROGRAMADA', 'ASIGNADA', 'EN_CAMINO', 'EN_SITIO', 'EN_REVISION', 'INSTALADA', 'CANCELADA'];

export const fechaCorta = (iso) => {
  const [anio, mes, dia] = String(iso || '').split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '';
};

// Las dos etiquetas que cambian en una avería LOS (no se "instala" nada).
const ESTADOS_LOS = {
  EN_REVISION: 'Atendida, en revisión',
  INSTALADA: 'Resuelta',
};

// El texto de un filtro de estado según lo que se está viendo: 'INSTALACION', 'LOS' o 'TODO' (instalaciones y LOS juntas).
export function etiquetaFiltroEstado(clave, categoria = 'INSTALACION') {
  if (categoria === 'LOS') return ESTADOS_LOS[clave] || ESTADOS_PROMOTORA[clave];
  if (categoria === 'TODO' && ESTADOS_LOS[clave]) return clave === 'INSTALADA' ? 'Instalada / Resuelta' : 'En revisión';
  return ESTADOS_PROMOTORA[clave];
}

// { clave, etiqueta, detalle } o null si la orden no se muestra (otro estado interno).
export function estadoParaPromotora(t, ahora = Date.now()) {
  if (!t) return null;
  const hecho = (clave, detalle = '') => ({ clave, etiqueta: (esAveriaLos(t) && ESTADOS_LOS[clave]) || ESTADOS_PROMOTORA[clave], detalle });
  switch (t.estado) {
    case 'FINALIZADO': return hecho('INSTALADA', t.tecnico || '');
    case 'CANCELADO': return hecho('CANCELADA');
    case 'PRE-FINALIZADO': return hecho('EN_REVISION', t.tecnico || '');
    case 'PENDIENTE': {
      // Sin técnico pero con fecha futura: no es que falte asignarla, está agendada para ese día.
      if (!t.tecnico) return categoriaProgramada(t.fechaProgramada, new Date(ahora)) === 'futura' ? hecho('PROGRAMADA', fechaCorta(t.fechaProgramada)) : hecho('SIN_TECNICO');
      const viaje = estadoViaje(t, ahora);
      if (viaje === ESTADO_EN_SITIO) return hecho('EN_SITIO', `${t.tecnico} · llegó ${tiempoTranscurrido(t.enCamino.llegoEn, ahora)}`);
      if (viaje) return hecho('EN_CAMINO', `${t.tecnico} · salió ${tiempoTranscurrido(t.enCamino.desde, ahora)}`);
      if (categoriaProgramada(t.fechaProgramada, new Date(ahora)) === 'futura') return hecho('PROGRAMADA', `${fechaCorta(t.fechaProgramada)} · ${t.tecnico}`);
      return hecho('ASIGNADA', t.tecnico);
    }
    default: return null;
  }
}

// La plantilla final de una instalación finalizada, ya llena por el técnico (la misma que copia la oficina). Una orden
// activa la arma al momento con sus datos; una archivada solo trae la que se guardó al finalizarla (`plantillaFinal`).
// Vacía si la orden no está finalizada o nunca tuvo plantilla de la promotora.
export function textoPlantillaFinal(t) {
  if (t?.estado !== 'FINALIZADO' || esAveriaLos(t)) return '';
  return generarMensajeWhatsAppInstalacion(t) || String(t.plantillaFinal || '');
}

// Lo único que se guarda de una instalación al cerrar el día: lo que la promotora necesita ver. Incluye la plantilla
// final de las finalizadas (es lo que la promotora pidió poder copiar), pero nada de cobro ni de contacto.
export function resumenInstalacion(t, ahoraMs = Date.now()) {
  const promotora = promotoraDeOrden(t);
  return {
    codigo: t.codigo || '',
    nombre: t.nombre || '',
    cedula: t.cedula || '',
    tipoDocumento: t.tipoDocumento || '',
    direccion: t.direccion || '',
    tecnico: t.tecnico || '',
    estado: t.estado,
    // Para que ventas distinga las averías LOS del historial de las instalaciones.
    tipoTrabajo: t.tipoTrabajo || TIPO_INSTALACION,
    falla: esAveriaLos(t) ? FALLA_LOS : '',
    creadaEn: t.createdAt || null,
    finalizadoEn: t.finalizadoEn || null,
    // Por qué se canceló (solo en las canceladas): ventas lo ve en la tarjeta, también cuando la orden ya salió de la lista.
    motivoCancelacion: motivoCancelacion(t),
    promotora,
    promotoraClave: claveNombre(promotora),
    plantillaFinal: textoPlantillaFinal(t),
    archivadoEn: ahoraMs,
  };
}

export const esInstalacionDeLista = (t) => t?.tipoTrabajo === TIPO_INSTALACION;

// Lo que se sigue desde este módulo: instalaciones y, para ventas, las averías LOS.
export const esDeVentas = (t) => esInstalacionDeLista(t) || esAveriaLos(t);

// Instalaciones activas (en la colección de órdenes) más las ya cerradas (historial), cada una con su estado.
// Si una orden está en las dos partes, gana la activa. Las activas van primero; dentro de cada grupo, las más recientes.
export function unirInstalaciones(tickets, historial, ahora = Date.now()) {
  const activas = tickets.filter(esDeVentas).map((t) => ({ ...t, origen: 'activa' }));
  const ids = new Set(activas.map((t) => t.id));
  const cerradas = historial.filter((h) => !ids.has(h.id)).map((h) => ({ ...h, origen: 'historial' }));
  return [...activas, ...cerradas]
    .map((t) => ({ ...t, vista: estadoParaPromotora(t, ahora) }))
    .filter((t) => t.vista)
    .sort((a, b) => (a.origen === b.origen ? 0 : a.origen === 'activa' ? -1 : 1)
      || (b.archivadoEn || b.createdAt || 0) - (a.archivadoEn || a.createdAt || 0));
}

// --- Lo que ventas usa para seguir las órdenes: fecha, filtro por fecha, atraso y resumen por promotor ---

// ¿Salió alguna orden de la lista en vivo desde la lectura anterior? (`antes`: Set de ids, o null en la primera lectura.) Cuando el cierre
// del día saca una orden de la lista, pasa al historial: ahí hay que volver a leer las cerradas.
export const algunaOrdenSalio = (antes, tickets) => {
  if (!antes) return false;
  const ahora = new Set(tickets.map((t) => t.id));
  return [...antes].some((id) => !ahora.has(id));
};

// La fecha con la que se ordena y se filtra: cuando se cerró (finalizada o cancelada) o, si sigue abierta, cuando se creó. Es la misma
// que muestra la tarjeta.
export function fechaOrden(t) {
  const cerrada = t?.origen === 'historial' || t?.estado === 'FINALIZADO' || t?.estado === 'CANCELADO';
  return (cerrada ? (t.finalizadoEn || t.archivadoEn) : t?.createdAt) || 0;
}

export const FILTROS_FECHA = [
  ['TODAS', 'Todas las fechas'],
  ['HOY', 'Hoy'],
  ['AYER', 'Ayer'],
  ['7_DIAS', 'Últimos 7 días'],
];

// La clave con que se filtra: "DIA" (un día elegido en el calendario del filtro, que no es una opción de la lista) con una fecha es esa fecha ("DIA:2026-10-19", como la da el calendario);
// sin fecha todavía no filtra nada.
export const claveFiltroFecha = (fecha, dia) => (fecha === 'DIA' ? (/^\d{4}-\d{2}-\d{2}$/.test(dia || '') ? `DIA:${dia}` : 'TODAS') : fecha);

// ¿La fecha cae en el rango elegido? Los días se cuentan en hora local (como el resto de la app).
export function enRangoFecha(ms, clave, ahora = Date.now()) {
  if (clave === 'TODAS') return true;
  if (!ms) return false;
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);
  const inicioHoy = hoy.getTime();
  if (clave === 'HOY') return ms >= inicioHoy;
  if (clave === 'AYER') return ms >= inicioHoy - DIA_MS && ms < inicioHoy;
  if (clave === '7_DIAS') return ms >= inicioHoy - 6 * DIA_MS;
  // Un día en concreto ("DIA:2026-10-19"): de su medianoche a la del día siguiente, en hora local.
  if (typeof clave === 'string' && clave.startsWith('DIA:')) {
    const [anio, mes, dia] = clave.slice(4).split('-').map(Number);
    if (!anio || !mes || !dia) return true;
    return ms >= new Date(anio, mes - 1, dia).getTime() && ms < new Date(anio, mes - 1, dia + 1).getTime();
  }
  return true;
}

// Cuántos días de espera hacen que una orden se marque como atrasada: [aviso, urgente]. Solo las que aún no tienen quién las haga
// (sin técnico) o que ya tienen técnico pero no se han hecho (asignada). Una programada se cuenta desde su fecha, no desde que se creó.
const UMBRALES_ATRASO = { SIN_TECNICO: [1, 2], ASIGNADA: [2, 4] };

// null si no está atrasada; si lo está, { nivel: 'aviso' | 'urgente', dias, que: 'Sin técnico' | 'Sin instalar' | 'Sin resolver', texto }.
export function atrasoOrden(t, ahora = Date.now()) {
  const umbral = UMBRALES_ATRASO[t?.vista?.clave];
  if (!umbral) return null;
  let desde = t.createdAt || 0;
  const [anio, mes, dia] = String(t.fechaProgramada || '').split('-').map(Number);
  if (anio && mes && dia) desde = new Date(anio, mes - 1, dia).getTime();
  if (!desde) return null;
  const dias = Math.floor((ahora - desde) / DIA_MS);
  if (dias < umbral[0]) return null;
  const que = t.vista.clave === 'SIN_TECNICO' ? 'Sin técnico' : esAveriaLos(t) ? 'Sin resolver' : 'Sin instalar';
  return { nivel: dias >= umbral[1] ? 'urgente' : 'aviso', dias, que, texto: `${que} hace ${dias === 1 ? '1 día' : `${dias} días`}` };
}

// De cada promotor: cuántas órdenes hay en cada grupo de estados. Agrupa por la clave del nombre (mayúsculas y tildes no separan
// a la misma persona); las órdenes sin promotor van juntas. Ordenado por instaladas y luego por total.
export function resumenPorPromotor(ordenes) {
  const grupo = { INSTALADA: 'instaladas', EN_REVISION: 'enRevision', CANCELADA: 'canceladas' };
  const filas = new Map();
  for (const o of ordenes) {
    const nombre = promotoraDeOrden(o);
    const clave = claveNombre(nombre);
    const fila = filas.get(clave) || { clave, nombre: nombre || 'Sin promotor', instaladas: 0, enRevision: 0, enCurso: 0, canceladas: 0, total: 0 };
    fila[grupo[o.vista?.clave] || 'enCurso']++;
    fila.total++;
    filas.set(clave, fila);
  }
  return [...filas.values()].sort((a, b) => b.instaladas - a.instaladas || b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
}

// Lo más reciente arriba; la urgencia (atrasadas primero) queda como opción.
// Se elige por qué ordenar (fecha, código, urgencia o estado) y en qué dirección: descendente (lo más reciente / urgente primero) o ascendente.
// "RECIENTES" y "ANTIGUAS" siguen valiendo como "fecha descendente" y "fecha ascendente".
export const ORDEN_POR_DEFECTO = 'FECHA';
export const DIRECCION_POR_DEFECTO = 'DESC';
// Lo que se elige en el menú "Ordenar por": criterio y dirección juntos ("FECHA:DESC"). Cada criterio con sus dos direcciones.
export const OPCIONES_ORDEN_DIRECCION = [
  ['FECHA:DESC', 'Fecha · descendente (más recientes)'],
  ['FECHA:ASC', 'Fecha · ascendente (más antiguas)'],
  ['CODIGO:ASC', 'Código · ascendente (menor a mayor)'],
  ['CODIGO:DESC', 'Código · descendente (mayor a menor)'],
  ['URGENCIA:DESC', 'Urgencia · descendente (más urgentes)'],
  ['URGENCIA:ASC', 'Urgencia · ascendente (menos urgentes)'],
  ['ESTADO:DESC', 'Por estado · descendente (sin técnico primero)'],
  ['ESTADO:ASC', 'Por estado · ascendente (canceladas primero)'],
];

// Orden de urgencia: primero las atrasadas (las de más días antes); después, por estado: sin técnico, asignada, en camino, en sitio,
// programada, en revisión, instalada o resuelta y cancelada. Dentro de cada grupo, la creada antes primero (sin fecha, al final).
// En camino, en sitio y programada no estaban en la lista pedida: van justo después de "asignada", que es lo más cercano a "por hacer".
const GRUPOS_URGENCIA = ['SIN_TECNICO', 'ASIGNADA', 'EN_CAMINO', 'EN_SITIO', 'PROGRAMADA', 'EN_REVISION', 'INSTALADA', 'CANCELADA'];
const creadaEn = (t) => t.createdAt || t.creadaEn || fechaOrden(t) || 0;
const porFechaAscendente = (a, b) => (!creadaEn(a) - !creadaEn(b)) || creadaEn(a) - creadaEn(b);

function ordenarPorUrgencia(ordenes, ahora) {
  const atraso = new Map(ordenes.map((o) => [o, atrasoOrden(o, ahora)]));
  const grupo = (o) => (atraso.get(o) ? 0 : 1 + GRUPOS_URGENCIA.indexOf(o.vista.clave));
  return [...ordenes].sort((a, b) => grupo(a) - grupo(b)
    || ((atraso.get(b)?.dias || 0) - (atraso.get(a)?.dias || 0))
    || porFechaAscendente(a, b));
}

// Medianoche local del día de una fecha en milisegundos (0 si no hay fecha).
const inicioDelDia = (ms) => { if (!ms) return 0; const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Compara dos códigos de orden por su letra y su número ("IO82" < "IO83" < "IO100"; no por texto, donde "IO100" iría antes que "IO82").
// Un código sin número ("IS") va después de los numerados.
export function compararCodigos(a, b) {
  const [pa, na] = partesCodigo(a);
  const [pb, nb] = partesCodigo(b);
  return pa < pb ? -1 : pa > pb ? 1 : (na ?? Infinity) - (nb ?? Infinity) || 0;
}
const partesCodigo = (codigo) => {
  const m = /^([A-Z]*)(\d+)?/.exec(String(codigo || '').trim().toUpperCase());
  return [m?.[1] || '', m?.[2] ? Number(m[2]) : null];
};

// Ordena una copia de la lista. Las de prioridad alta van siempre primero (como en la lista de la oficina), sea cual sea el criterio;
// dentro de ellas y entre las demás rige el criterio elegido. `ahora` solo hace falta para 'URGENCIA' (calcula los atrasos).
export function ordenarOrdenes(ordenes, criterio, ahora = Date.now(), direccion = DIRECCION_POR_DEFECTO) {
  return prioritariasPrimero(ordenarPorCriterio(ordenes, criterio, ahora, direccion));
}

function ordenarPorCriterio(ordenes, criterio, ahora, direccion) {
  let ascendente = direccion === 'ASC';
  let por = criterio;
  if (por === 'RECIENTES') { por = 'FECHA'; ascendente = false; }
  if (por === 'ANTIGUAS') { por = 'FECHA'; ascendente = true; }
  // Por día y, dentro del mismo día, por número de código (IO82, IO83, IO84...); la hora exacta solo desempata al final. Las que no traen
  // fecha van al final también al revés.
  if (por === 'FECHA') {
    const sentido = ascendente ? 1 : -1;
    return [...ordenes].sort((a, b) => (!fechaOrden(a) - !fechaOrden(b))
      || sentido * (inicioDelDia(fechaOrden(a)) - inicioDelDia(fechaOrden(b)))
      || sentido * compararCodigos(a.codigo, b.codigo)
      || sentido * (fechaOrden(a) - fechaOrden(b)));
  }
  // Solo por el número del código (IO73, IO76, IO77...), sin importar el día; la fecha desempata los códigos repetidos. Sin código, al final.
  if (por === 'CODIGO') {
    const sentido = ascendente ? 1 : -1;
    return [...ordenes].sort((a, b) => (!a.codigo - !b.codigo) || sentido * compararCodigos(a.codigo, b.codigo) || sentido * (fechaOrden(a) - fechaOrden(b)));
  }
  if (por !== 'URGENCIA' && por !== 'ESTADO') return ordenes;
  const lista = por === 'URGENCIA'
    ? ordenarPorUrgencia(ordenes, ahora)
    : [...ordenes].sort((a, b) => ORDEN_ESTADOS_PROMOTORA.indexOf(a.vista.clave) - ORDEN_ESTADOS_PROMOTORA.indexOf(b.vista.clave) || fechaOrden(b) - fechaOrden(a));
  return ascendente ? [...lista].reverse() : lista;
}
