// Datos que el técnico llena al instalar, los que la plantilla de la promotora trae vacíos:
// serial de la ONU, VLAN, posteadura (uno o varios postes), el metraje de cable, NAP, el puerto donde
// conecta el cliente y los puertos que quedan disponibles en la NAP. Se guardan juntos en
// `ticket.instalacion` y se escriben en las líneas de la plantilla (ver utils/whatsapp).
// Todo es obligatorio: el serial, la VLAN, al menos un poste, el metraje (metros enteros, de 1 a 9999),
// la NAP, el puerto y los puertos disponibles (si no queda ninguno, "0"). Lo que se escribe también se valida.
// Los conectores usados (externos e internos, por color) también son obligatorios al pre-finalizar, pero se validan
// aparte (utils/conectoresInstalacion) y no entran en instalacionCompleta: las instalaciones anteriores no los
// tienen y no deben quedar bloqueadas al aprobarlas.
// El metraje cuenta como cable gastado en el módulo Materiales (ver utils/consumoMateriales).

import { napSinDato } from './napPuerto.js';
import { textoConectoresInstalacion } from './conectoresInstalacion.js';

export const esInstalacion = (tipoTrabajo) => String(tipoTrabajo || '').toUpperCase().includes('INSTAL');

export const MAX_POSTES = 10;
export const MAX_LARGO_POSTE = 40;
export const MAX_LARGO_SERIAL = 24;
export const MAX_LARGO_PUERTOS_DISPONIBLES = 30;
export const MAX_LARGO_METRAJE = 4; // dígitos: hasta 9999 m

// Metraje de cable de la instalación: metros enteros, de 1 a 9999. Vacío no da error aquí: que sea
// obligatorio lo exige validarInstalacion.
export function parseMetraje(raw) {
  const txt = String(raw ?? '').trim();
  if (txt === '') return { valor: null };
  if (!/^\d{1,4}$/.test(txt)) return { error: 'Escribe el metraje como un número entero de metros. Ejemplo: 120' };
  const valor = parseInt(txt, 10);
  if (valor < 1) return { error: 'El metraje debe ser mayor a 0.' };
  return { valor };
}

// Metros de cable de una instalación (número) o null si no se registraron.
export const metrajeInstalacion = (ticket) => {
  const metros = Number(ticket?.instalacion?.metraje);
  return Number.isFinite(metros) && metros > 0 ? metros : null;
};

// Serial de la ONU ("HWTC1A2B3C4D"): letras y números (y guiones), sin espacios y en mayúsculas.
// Vacío no da error aquí: que sea obligatorio lo exige validarInstalacion.
export function parseSerial(raw) {
  const txt = String(raw ?? '').replace(/\s+/g, '').toUpperCase();
  if (txt === '') return { valor: '' };
  if (!new RegExp(`^[A-Z0-9-]{6,${MAX_LARGO_SERIAL}}$`).test(txt)) {
    return { error: `El serial debe tener entre 6 y ${MAX_LARGO_SERIAL} caracteres, solo letras y números. Ejemplo: HWTC1A2B3C4D` };
  }
  return { valor: txt };
}

// Número de VLAN, de 1 a 4094. Vacío no da error aquí: que sea obligatoria lo exige validarInstalacion.
export function parseVlan(raw) {
  const txt = String(raw ?? '').trim();
  if (txt === '') return { valor: '' };
  const valor = /^\d{1,4}$/.test(txt) ? parseInt(txt, 10) : 0;
  if (valor < 1 || valor > 4094) return { error: 'La VLAN debe ser un número entre 1 y 4094.' };
  return { valor: String(valor) };
}

// Postes escritos por el técnico -> los que tienen texto, sin espacios de más.
export const limpiarPostes = (postes) =>
  (postes || [])
    .map((p) => String(p ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LARGO_POSTE))
    .filter(Boolean)
    .slice(0, MAX_POSTES);

// En la orden la NAP y el puerto viven en un solo texto ("NAP 08 - Puerto 3"); sin NAP queda solo el puerto.
export function napConPuerto(nap, puerto) {
  const codigo = String(nap || '').trim();
  const numero = String(puerto || '').trim();
  return [codigo, numero && `Puerto ${numero}`].filter(Boolean).join(' - ');
}

export const tieneDatosInstalacion = (datos) =>
  Boolean(datos) && Boolean(datos.serial || datos.vlan || datos.nap || datos.puerto || datos.puertosDisponibles || datos.posteadura?.length || datos.metraje || textoConectoresInstalacion(datos.conectores));

// Lo que escribió el técnico -> { datos, errores, error }: `datos` listo para guardar en
// `ticket.instalacion` (serial y VLAN normalizados, postes limpios) y `errores` por campo
// (serial, vlan, posteadura, metraje, puertosDisponibles): falta o no es válido. La NAP y el puerto los exige el formulario.
export function validarInstalacion({ serial, vlan, postes, posteadura, metraje, nap, puerto, puertosDisponibles } = {}) {
  const serialParseado = parseSerial(serial);
  const vlanParseada = parseVlan(vlan);
  const metrajeParseado = parseMetraje(metraje);
  const lista = limpiarPostes(postes ?? posteadura);
  const errores = {};
  if (serialParseado.error) errores.serial = serialParseado.error;
  else if (!serialParseado.valor) errores.serial = 'Escribe el serial de la ONU.';
  if (vlanParseada.error) errores.vlan = vlanParseada.error;
  else if (!vlanParseada.valor) errores.vlan = 'Escribe la VLAN.';
  if (lista.length === 0) errores.posteadura = 'Agrega al menos un poste.';
  if (metrajeParseado.error) errores.metraje = metrajeParseado.error;
  else if (!metrajeParseado.valor) errores.metraje = 'Indica el metraje de cable usado en la instalación.';
  const disponibles = String(puertosDisponibles ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LARGO_PUERTOS_DISPONIBLES);
  if (!disponibles) errores.puertosDisponibles = 'Indica los puertos disponibles de la NAP. Si no queda ninguno, escribe 0.';
  return {
    datos: {
      serial: serialParseado.valor ?? '',
      vlan: vlanParseada.valor ?? '',
      posteadura: lista,
      metraje: metrajeParseado.valor ?? null,
      nap: String(nap || '').trim(),
      puerto: String(puerto || '').replace(/\D/g, ''),
      // Texto libre: normalmente cuántos quedan ("6", o "0" si ninguno), pero pueden ser cuáles ("3, 5, 8").
      puertosDisponibles: disponibles,
    },
    errores,
    error: Object.keys(errores).length > 0,
  };
}

// ¿La orden ya trae todo lo obligatorio de una instalación (serial, VLAN, postes, metraje, NAP real y puerto)?
// Lo usa el guardado para que un técnico no pre-finalice una instalación por otro camino sin llenarlo.
export function instalacionCompleta(ticket) {
  const datos = ticket?.instalacion;
  if (!datos || validarInstalacion(datos).error) return false;
  return !napSinDato(datos.nap) && Boolean(String(datos.puerto || '').trim());
}

// Nombres con los que se muestra lo que falta de una instalación (los mismos del modal de revisión).
const NOMBRE_FALTANTE = { serial: 'Serial', vlan: 'VLAN', posteadura: 'Posteadura', metraje: 'Drop', nap: 'NAP', puerto: 'Puerto', puertosDisponibles: 'Puertos disponibles' };

// Lo que le falta (o no es válido) a una instalación para estar completa, con esos nombres y en el orden de
// la revisión. Lista vacía si está completa o si la orden no es una instalación.
export function faltantesInstalacion(ticket) {
  if (!esInstalacion(ticket?.tipoTrabajo)) return [];
  const datos = ticket.instalacion || {};
  const errores = validarInstalacion(datos).errores;
  const faltan = new Set(Object.keys(errores));
  if (napSinDato(datos.nap)) faltan.add('nap');
  if (!String(datos.puerto || '').trim()) faltan.add('puerto');
  return ['serial', 'vlan', 'nap', 'puerto', 'metraje', 'posteadura', 'puertosDisponibles'].filter((k) => faltan.has(k)).map((k) => NOMBRE_FALTANTE[k]);
}

// Líneas del historial con lo que registró el técnico ("Serial: ...", "VLAN: ...", "Posteadura: ...", "Metraje: ...",
// "Conectores: Externo: 1 verde · Interno: 1 azul").
// La NAP ya sale aparte en el historial (campo `nap`); aquí el puerto y los puertos disponibles.
export function detalleInstalacion(datos) {
  if (!tieneDatosInstalacion(datos)) return '';
  let detalle = '';
  if (datos.serial) detalle += ` | Serial: ${datos.serial}`;
  if (datos.vlan) detalle += ` | VLAN: ${datos.vlan}`;
  if (datos.posteadura?.length) detalle += ` | Posteadura: ${datos.posteadura.join(', ')}`;
  if (datos.metraje) detalle += ` | Metraje: ${datos.metraje} m`;
  if (datos.puerto) detalle += ` | Puerto: ${datos.puerto}`;
  if (datos.puertosDisponibles) detalle += ` | Puertos disponibles: ${datos.puertosDisponibles}`;
  const conectores = textoConectoresInstalacion(datos.conectores);
  if (conectores) detalle += ` | Conectores: ${conectores}`;
  return detalle;
}
