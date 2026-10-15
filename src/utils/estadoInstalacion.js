// Lo que ve una promotora de cada instalación: un estado en palabras claras (sin términos internos como
// PRE-FINALIZADO), y el historial liviano de las terminadas que el cierre del día saca de la lista.
import { estadoViaje, ESTADO_EN_SITIO, tiempoTranscurrido } from './enCamino.js';
import { categoriaProgramada } from './programada.js';
import { claveNombre } from './promotora.js';
import { generarMensajeWhatsAppInstalacion, promotoraDeOrden } from './whatsapp.js';

export const TIPO_INSTALACION = 'INSTALACIÓN';
export const TIPO_AVERIA = 'AVERÍA';
// El perfil de ventas (el PROMOTOR con "Ver todas las instalaciones") también sigue las averías de tipo LOS.
export const FALLA_LOS = 'LOS';

// Cuántos días de historial ve cada quien de una instalación ya cerrada (finalizada o cancelada): las promotoras 7 y el
// perfil de ventas (ve todas) 15. Cada día de más son documentos de más que se leen cada vez que se abre la app (se guarda una
// copia en el equipo por 30 minutos para no leerlos de nuevo). En Firestore el historial se conserva lo que ve ventas, que
// es lo más largo (15); cada pantalla descarta lo que sobra para ella. En cf-worker hay otra constante que debe valer igual.
export const RETENCION_DIAS_HISTORIAL = 7;
export const RETENCION_DIAS_HISTORIAL_VENTAS = 15;
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

const fechaCorta = (iso) => {
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

// { clave, etiqueta, detalle } o null si la orden no se muestra (eliminada, u otro estado interno).
export function estadoParaPromotora(t, ahora = Date.now()) {
  if (!t) return null;
  const hecho = (clave, detalle = '') => ({ clave, etiqueta: (esAveriaLos(t) && ESTADOS_LOS[clave]) || ESTADOS_PROMOTORA[clave], detalle });
  switch (t.estado) {
    case 'FINALIZADO': return hecho('INSTALADA', t.tecnico || '');
    case 'CANCELADO': return hecho('CANCELADA');
    case 'PRE-FINALIZADO': return hecho('EN_REVISION', t.tecnico || '');
    case 'PENDIENTE': {
      if (!t.tecnico) return hecho('SIN_TECNICO');
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
