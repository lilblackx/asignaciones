// Lo que ve un cliente de sus solicitudes cuando las consulta en la web de la empresa con su cédula (cf-worker/src/consulta-cliente.js).
// Es información pública para quien conozca la cédula, así que aquí se decide, en un solo lugar, qué sale y qué no: solo el estado, el tipo de
// trabajo, el código de la orden, el nombre del técnico y las fechas. Nunca el nombre del cliente, la dirección, el teléfono, el cobro, los seriales
// ni el motivo de una cancelación. Módulo sin dependencias del navegador: lo usan el Worker y las pruebas.
import { estadoViaje, ESTADO_EN_CAMINO, ESTADO_EN_SITIO } from './enCamino.js';
import { nombrePersona } from './datosCliente.js';

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
// Cuánto tiempo después de cerrada (finalizada o cancelada) se puede consultar una solicitud.
export const DIAS_DE_CONSULTA = 30;

// Cédula/RIF de 6 a 9 dígitos, igual que la que acepta la app al crear una orden. Admite la letra (V, E, J, G), los puntos y el dígito verificador del RIF
// ("J-12345678-9"). Devuelve null si no parece una cédula; si sí, `variantes` son las dos formas en que puede estar guardada ("12.345.678" y "12345678").
export function cedulaDeConsulta(texto) {
  let resto = String(texto ?? '').trim().slice(0, 30);
  resto = resto.replace(/^[VEJGvejg][\s.-]*(?=\d)/, '').replace(/\s*-\s*\d$/, '');
  if (!/^\d{1,3}([.,\s]\d{3})+$|^\d+$/.test(resto)) return null;
  const digitos = resto.replace(/\D/g, '');
  if (!/^[1-9]\d{5,8}$/.test(digitos)) return null;
  const conPuntos = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return { digitos, variantes: conPuntos === digitos ? [digitos] : [conPuntos, digitos] };
}

// "2026-11-05" del instante `ms` en hora de Venezuela (UTC-4 todo el año), que es la fecha que ve el cliente.
export const diaCaracas = (ms) => new Date(ms - 4 * HORA_MS).toISOString().slice(0, 10);

// Cómo se le llama al trabajo al cliente. Lo que no figura aquí (una validación de NAP es interna) no se muestra.
const TIPOS_PARA_CLIENTE = {
  'INSTALACIÓN': 'Instalación',
  'AVERÍA': 'Avería',
  'RECONEXIÓN': 'Reconexión',
  'MUDANZA': 'Mudanza',
  'GARANTIA': 'Garantía',
  'LOW SIGNAL': 'Revisión de señal',
  'RETIRO EQUIPO': 'Retiro de equipo',
  'CAMBIO DE EQUIPO': 'Cambio de equipo',
  VISITA: 'Visita técnica',
};
export const tipoParaCliente = (tipoTrabajo) => (tipoTrabajo === 'VALIDACION NAP' ? null : TIPOS_PARA_CLIENTE[tipoTrabajo] || 'Servicio técnico');

export const ESTADOS_CLIENTE = {
  RECIBIDA: 'Recibida, estamos asignando un técnico',
  PROGRAMADA: 'Programada',
  ASIGNADA: 'Técnico asignado',
  EN_CAMINO: 'Técnico en camino',
  EN_SITIO: 'Técnico en el sitio',
  EN_REVISION: 'Trabajo realizado, en verificación',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

// La solicitud como la ve el cliente, o null si no se muestra (otro estado interno o un trabajo interno). `t` trae los campos de la orden o los del historial
// (`creadaEn` en vez de `createdAt`). Los campos que nunca se muestran se descartan aquí aunque lleguen.
function armar(t, ahora) {
  const tipo = tipoParaCliente(t?.tipoTrabajo);
  if (!t || !tipo) return null;
  const hoy = diaCaracas(ahora);
  const futura = Boolean(t.fechaProgramada) && String(t.fechaProgramada) > hoy;
  let clave;
  switch (t.estado) {
    case 'FINALIZADO': clave = 'COMPLETADA'; break;
    case 'CANCELADO': clave = 'CANCELADA'; break;
    case 'PRE-FINALIZADO': clave = 'EN_REVISION'; break;
    case 'PENDIENTE': {
      const viaje = estadoViaje(t, ahora);
      if (viaje === ESTADO_EN_SITIO) clave = 'EN_SITIO';
      else if (viaje === ESTADO_EN_CAMINO) clave = 'EN_CAMINO';
      else if (futura) clave = 'PROGRAMADA';
      else clave = t.tecnico ? 'ASIGNADA' : 'RECIBIDA';
      break;
    }
    default: return null;
  }
  const cerradaMs = Number(t.finalizadoEn) || Number(t.canceladaEn) || 0;
  const creadaMs = Number(t.createdAt ?? t.creadaEn) || 0;
  const publica = {
    codigo: String(t.codigo || ''),
    tipo,
    estado: clave,
    etiqueta: ESTADOS_CLIENTE[clave],
    // El técnico solo si hay uno y la solicitud sigue su curso o se completó (una cancelada no lo muestra).
    tecnico: t.tecnico && clave !== 'CANCELADA' && clave !== 'RECIBIDA' ? nombrePersona(t.tecnico) : '',
    solicitadaEn: creadaMs ? diaCaracas(creadaMs) : '',
    programadaPara: clave === 'PROGRAMADA' || clave === 'ASIGNADA' ? String(t.fechaProgramada || '') : '',
    cerradaEn: (clave === 'COMPLETADA' || clave === 'CANCELADA') && cerradaMs ? diaCaracas(cerradaMs) : '',
  };
  // `orden` y `cerrada` sirven para ordenar y para no mostrar lo ya vencido; no salen en la respuesta.
  return { publica, orden: cerradaMs || creadaMs, cerrada: clave === 'COMPLETADA' || clave === 'CANCELADA' };
}

export const solicitudParaCliente = (t, ahora = Date.now()) => armar(t, ahora)?.publica ?? null;

// Las solicitudes de un cliente a partir de las órdenes (activas e historial) que tienen su cédula: sin repetir (`id`), solo las abiertas y las cerradas
// en los últimos DIAS_DE_CONSULTA días, lo más reciente primero y sin los campos internos.
export function solicitudesDeCliente(ordenes, ahora = Date.now()) {
  const vistas = new Set();
  const lista = [];
  for (const o of ordenes) {
    if (o.id && vistas.has(o.id)) continue;
    const s = armar(o, ahora);
    if (!s) continue;
    if (o.id) vistas.add(o.id);
    // Una cerrada sin fecha no se puede situar en el tiempo: no se muestra.
    if (s.cerrada && (!s.orden || ahora - s.orden > DIAS_DE_CONSULTA * DIA_MS)) continue;
    lista.push(s);
  }
  // Primero las abiertas (lo que el cliente espera), después las cerradas; dentro de cada grupo, la más reciente primero.
  lista.sort((a, b) => Number(a.cerrada) - Number(b.cerrada) || b.orden - a.orden);
  return lista.map((x) => x.publica);
}
