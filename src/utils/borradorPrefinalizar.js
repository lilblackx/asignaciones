// Borrador del formulario de Pre-finalizar: lo que el técnico va escribiendo se guarda en su teléfono (no en Firestore) para no perderlo si el teléfono se bloquea, el navegador cierra la app o la página se recarga.
// Un borrador por técnico y orden. Se borra al pre-finalizar, cuando la orden deja de estar pendiente, a los 7 días y al cerrar sesión a mano. Funciones puras con el almacenamiento inyectado: las usan el formulario, la
// lista de órdenes y las pruebas.
const PREFIJO = 'asignaciones:borrador-prefinalizar:';
export const VIGENCIA_BORRADOR_MS = 7 * 24 * 60 * 60 * 1000;
export const EVENTO_BORRADORES = 'borradores-prefinalizar';
const MAX_TEXTO = 5000;
const MAX_POSTES = 20;

// Los campos que se guardan y su tipo: 's' texto, 'b' sí o no, 'a' lista de textos. Lo demás (errores, "enviando") no.
const CAMPOS = {
  nap: 's', puerto: 's', serial: 's', vlan: 's', metrajeInicial: 's', metrajeFinal: 's', metrajeExiste: 'b', puertosDisponibles: 's', postes: 'a',
  instExternoVerde: 's', instInternoVerde: 's', instInternoAzul: 's', tipoVisita: 's', observacion: 's', potencia: 's', potencia1490: 's',
  metrosInicial: 's', metrosFinal: 's', colorExterno: 's', colorInterno: 's', cantVerde: 's', cantAzul: 's', serialEquipo: 's', tipoEquipo: 's', vlanVisita: 's',
};

// Solo los campos conocidos y con el tipo correcto: lo guardado puede venir de una versión vieja o estar dañado.
export function valoresValidos(crudo) {
  const limpios = {};
  if (!crudo || typeof crudo !== 'object') return limpios;
  for (const [campo, tipo] of Object.entries(CAMPOS)) {
    const v = crudo[campo];
    if (tipo === 's' && typeof v === 'string') limpios[campo] = v.slice(0, MAX_TEXTO);
    else if (tipo === 'b' && typeof v === 'boolean') limpios[campo] = v;
    else if (tipo === 'a' && Array.isArray(v) && v.length > 0 && v.length <= MAX_POSTES && v.every((x) => typeof x === 'string')) limpios[campo] = v.map((x) => x.slice(0, MAX_TEXTO));
  }
  return limpios;
}

// Cuántas veces cambió la orden (su historial): si la oficina la tocó después de guardar el borrador, se avisa.
export const versionDeOrden = (orden) => (Array.isArray(orden?.historialEdiciones) ? orden.historialEdiciones.length : 0);

export const claveBorrador = (usuario, ordenId) => `${PREFIJO}${usuario}:${ordenId}`;
const almacenPorDefecto = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const avisar = () => { try { globalThis.dispatchEvent?.(new Event(EVENTO_BORRADORES)); } catch { /* sin ventana (pruebas) */ } };
const vigente = (b, ahora) => Boolean(b) && Number(b.t) > 0 && ahora - Number(b.t) <= VIGENCIA_BORRADOR_MS;

// El borrador de la orden, o null (no hay, está dañado o venció: en esos casos se borra). { valores, version, t }.
export function leerBorrador(usuario, ordenId, { almacen = almacenPorDefecto(), ahora = Date.now() } = {}) {
  if (!almacen || !usuario || ordenId == null) return null;
  const clave = claveBorrador(usuario, ordenId);
  try {
    const crudo = almacen.getItem(clave);
    if (crudo === null) return null;
    const b = JSON.parse(crudo);
    const valores = valoresValidos(b?.v);
    if (!vigente(b, ahora) || Object.keys(valores).length === 0) { almacen.removeItem(clave); return null; }
    return { valores, version: Number(b.h) || 0, t: Number(b.t) };
  } catch {
    try { almacen.removeItem(clave); } catch { /* sin almacenamiento */ }
    return null;
  }
}

export function olvidarBorrador(usuario, ordenId, { almacen = almacenPorDefecto() } = {}) {
  if (!almacen || !usuario || ordenId == null) return;
  try { almacen.removeItem(claveBorrador(usuario, ordenId)); } catch { /* sin almacenamiento */ }
  avisar();
}

// Solo los campos que el técnico cambió respecto de lo que la orden traía: los demás se llenan, al recuperar, con lo más nuevo de la orden (si la oficina la cambió mientras tanto, no se pisa con valores viejos).
export function camposCambiados(valores, base) {
  const escritos = valoresValidos(valores);
  const originales = valoresValidos(base);
  return Object.fromEntries(Object.entries(escritos).filter(([campo, v]) => JSON.stringify(v) !== JSON.stringify(originales[campo])));
}

// Guarda lo escrito. Si no cambió nada respecto de lo que la orden ya traía (el formulario sin tocar) no hay borrador: se borra el que hubiera. `base`: los valores con que abre la orden sin borrador.
export function guardarBorrador(usuario, orden, valores, base, { almacen = almacenPorDefecto(), ahora = Date.now() } = {}) {
  if (!almacen || !usuario || orden?.id == null) return false;
  const cambios = camposCambiados(valores, base);
  if (Object.keys(cambios).length === 0) { olvidarBorrador(usuario, orden.id, { almacen }); return false; }
  try {
    almacen.setItem(claveBorrador(usuario, orden.id), JSON.stringify({ t: ahora, h: versionDeOrden(orden), v: cambios }));
    avisar();
    return true;
  } catch {
    return false; // sin espacio o sin almacenamiento: solo se pierde la recuperación
  }
}

const clavesDe = (almacen, usuario) => {
  const prefijo = `${PREFIJO}${usuario}:`;
  const claves = [];
  for (let i = 0; i < almacen.length; i++) { const k = almacen.key(i); if (k && k.startsWith(prefijo)) claves.push(k); }
  return claves;
};

// Los ids de las órdenes con borrador vigente (para marcarlas en la lista).
export function ordenesConBorrador(usuario, { almacen = almacenPorDefecto(), ahora = Date.now() } = {}) {
  const ids = new Set();
  if (!almacen || !usuario) return ids;
  try {
    for (const clave of clavesDe(almacen, usuario)) {
      try { if (vigente(JSON.parse(almacen.getItem(clave)), ahora)) ids.add(clave.slice(`${PREFIJO}${usuario}:`.length)); } catch { /* dañado: lo limpia limpiarBorradores */ }
    }
  } catch { /* sin almacenamiento */ }
  return ids;
}

// Borra los borradores de órdenes que ya no están pendientes (se pre-finalizaron, las devolvieron o cancelaron, o ya no son del técnico), los vencidos y los dañados. `ordenes`: las órdenes del técnico.
export function limpiarBorradores(usuario, ordenes, { almacen = almacenPorDefecto(), ahora = Date.now() } = {}) {
  if (!almacen || !usuario) return 0;
  const pendientes = new Set((ordenes || []).filter((o) => o.estado === 'PENDIENTE').map((o) => String(o.id)));
  let borrados = 0;
  try {
    for (const clave of clavesDe(almacen, usuario)) {
      const id = clave.slice(`${PREFIJO}${usuario}:`.length);
      let guardado = null;
      try { guardado = JSON.parse(almacen.getItem(clave)); } catch { /* dañado */ }
      if (!pendientes.has(id) || !vigente(guardado, ahora)) { almacen.removeItem(clave); borrados++; }
    }
  } catch { /* sin almacenamiento */ }
  if (borrados > 0) avisar();
  return borrados;
}

// Al cerrar sesión a mano: el teléfono puede ser de otra persona.
export function olvidarBorradoresDe(usuario, { almacen = almacenPorDefecto() } = {}) {
  if (!almacen || !usuario) return;
  try { clavesDe(almacen, usuario).forEach((k) => almacen.removeItem(k)); } catch { /* sin almacenamiento */ }
  avisar();
}
