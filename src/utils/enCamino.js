// "En camino" / "En sitio": el técnico avisa a la oficina que va hacia una orden y cuándo llegó. Se guarda en
// la orden como `enCamino: { tecnico, desde, llegoEn }` (`desde`: cuándo salió; `llegoEn`: cuándo marcó "Llegué").
// Solo vale con la orden PENDIENTE y para el técnico que la tiene: si la pre-finalizan, la cancelan o la pasan
// a otro técnico, el campo queda sin efecto. Un "en camino" que nadie cierra caduca solo, para que un olvido no
// deje a la oficina creyendo que el técnico sigue viajando.

export const ESTADO_EN_CAMINO = 'EN_CAMINO';
export const ESTADO_EN_SITIO = 'EN_SITIO';

export const CADUCA_EN_CAMINO_MS = 4 * 60 * 60 * 1000;
export const CADUCA_EN_SITIO_MS = 12 * 60 * 60 * 1000;

// ESTADO_EN_CAMINO, ESTADO_EN_SITIO o null (sin viaje en curso).
export function estadoViaje(t, ahora = Date.now()) {
  const v = t?.enCamino;
  if (!v || t.estado !== 'PENDIENTE' || !t.tecnico || v.tecnico !== t.tecnico) return null;
  if (v.llegoEn) return ahora - v.llegoEn < CADUCA_EN_SITIO_MS ? ESTADO_EN_SITIO : null;
  return ahora - v.desde < CADUCA_EN_CAMINO_MS ? ESTADO_EN_CAMINO : null;
}

export const estaEnCamino = (t, ahora) => estadoViaje(t, ahora) === ESTADO_EN_CAMINO;
export const estaEnSitio = (t, ahora) => estadoViaje(t, ahora) === ESTADO_EN_SITIO;

// Se puede avisar que se va en camino si la orden es del técnico, está pendiente y no hay un viaje en curso en ella.
export const puedeIniciarViaje = (t, ahora) => t?.estado === 'PENDIENTE' && Boolean(t.tecnico) && !estadoViaje(t, ahora);

// Un técnico va hacia una orden a la vez: la otra orden suya que sigue "en camino" (sin llegar), si hay.
export const viajeEnCursoDe = (tickets, tecnico, exceptoId, ahora) =>
  tickets.find((t) => t.id !== exceptoId && t.tecnico === tecnico && estaEnCamino(t, ahora)) || null;

// --- Valores que se guardan en `enCamino` ---
export const iniciarViaje = (t, ahora = Date.now()) => ({ tecnico: t.tecnico, desde: ahora });
export const registrarLlegada = (t, ahora = Date.now()) => ({ tecnico: t.tecnico, desde: t.enCamino?.desde ?? ahora, llegoEn: ahora });
// "Deshacer" la llegada: vuelve a estar en camino, con la hora de salida original.
export const deshacerLlegada = (t, ahora = Date.now()) => ({ tecnico: t.tecnico, desde: t.enCamino?.desde ?? ahora });

// "hace 5 min", "hace 2 h 10 min"; menos de un minuto: "justo ahora".
export function tiempoTranscurrido(desde, ahora = Date.now()) {
  const min = Math.max(0, Math.floor((ahora - desde) / 60000));
  if (min < 1) return 'justo ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return `hace ${h} h${resto ? ` ${resto} min` : ''}`;
}

const etiquetaOrden = (t) => `${t.codigo || 'S/C'}${t.nombre ? ` - ${t.nombre}` : ''}`;
export const textoAvisoEnCamino = (t) => `${t.tecnico} va en camino a la orden ${etiquetaOrden(t)}.`;
export const textoAvisoLlegada = (t) => `${t.tecnico} llegó al sitio de la orden ${etiquetaOrden(t)}.`;

// --- Detectar los viajes que empezaron mientras se miraba la lista (para avisar a la oficina) ---
// id -> "desde|llegoEn" del viaje (cadena vacía si no hay): el punto de partida para notar el cambio.
export const claveViaje = (t) => (t?.enCamino && t.enCamino.tecnico === t.tecnico ? `${t.enCamino.desde}|${t.enCamino.llegoEn || ''}` : '');
export const mapaViaje = (tickets) => new Map(tickets.map((t) => [t.id, claveViaje(t)]));

// { enCamino, llegadas }: las órdenes cuyo viaje empezó o terminó desde el punto de partida. Solo cuentan las que ya
// estaban en la lista (una orden nueva no avisa) y los viajes vigentes. Sin punto de partida (`previa` nula) no se
// puede saber qué cambió y no se avisa nada.
export function viajesNuevos(tickets, previa, ahora = Date.now()) {
  const resultado = { enCamino: [], llegadas: [] };
  if (!previa) return resultado;
  for (const t of tickets) {
    if (!previa.has(t.id)) continue;
    const [desdePrevio, llegoPrevio] = previa.get(t.id).split('|');
    const estado = estadoViaje(t, ahora);
    if (estado === ESTADO_EN_CAMINO && String(t.enCamino.desde) !== desdePrevio) resultado.enCamino.push(t);
    else if (estado === ESTADO_EN_SITIO && !llegoPrevio) resultado.llegadas.push(t);
  }
  return resultado;
}
