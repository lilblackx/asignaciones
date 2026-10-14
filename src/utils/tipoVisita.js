// Tipos de visita que el técnico puede registrar al pre-finalizar una orden.
//
// - Conector externo / interno: visita para cambiar un conector. Generan un cobro al cliente
//   (se calcula al finalizar con la tasa del momento) y el externo pide NAP y puerto. El técnico
//   indica el color del conector colocado: el externo es siempre verde; el interno, verde o azul
//   (obligatorio). Se guarda en `conectorExterno` / `conectorInterno`, igual que en el recableado.
// - Recableado: se registran los metros de cable usados (obligatorio) y, opcionalmente, los
//   conectores colocados: un conector externo (solo verde) y/o uno interno (verde o azul).
//   No genera cobro.
// - Cambio de equipo: el técnico indica el serial del equipo nuevo (obligatorio). Se guarda en
//   `serialEquipo`.
// - Drop atenuado: solo se registra el tipo de visita, sin datos extra.

import { parseSerial } from './instalacion.js';

export const TIPO_CONECTOR_EXTERNO = 'CONECTOR_EXTERNO';
export const TIPO_CONECTOR_INTERNO = 'CONECTOR_INTERNO';
export const TIPO_RECABLEADO = 'RECABLEADO';
export const TIPO_CAMBIO_EQUIPO = 'CAMBIO_EQUIPO';
export const TIPO_DROP_ATENUADO = 'DROP_ATENUADO';

export const ETIQUETA_TIPO_VISITA = {
  [TIPO_CONECTOR_EXTERNO]: 'Conector externo',
  [TIPO_CONECTOR_INTERNO]: 'Conector interno',
  [TIPO_RECABLEADO]: 'Recableado',
  [TIPO_CAMBIO_EQUIPO]: 'Cambio de equipo',
  [TIPO_DROP_ATENUADO]: 'Drop atenuado',
};

export const TIPOS_VISITA = [
  { value: '', label: 'Ninguno' },
  { value: TIPO_CONECTOR_EXTERNO, label: ETIQUETA_TIPO_VISITA[TIPO_CONECTOR_EXTERNO] },
  { value: TIPO_CONECTOR_INTERNO, label: ETIQUETA_TIPO_VISITA[TIPO_CONECTOR_INTERNO] },
  { value: TIPO_RECABLEADO, label: ETIQUETA_TIPO_VISITA[TIPO_RECABLEADO] },
  { value: TIPO_CAMBIO_EQUIPO, label: ETIQUETA_TIPO_VISITA[TIPO_CAMBIO_EQUIPO] },
  { value: TIPO_DROP_ATENUADO, label: ETIQUETA_TIPO_VISITA[TIPO_DROP_ATENUADO] },
];

// --- Cambio de equipo ---------------------------------------------------------------------

export const esCambioEquipo = (tipoVisita) => tipoVisita === TIPO_CAMBIO_EQUIPO;

// Serial del equipo nuevo: mismo formato que el de la ONU de una instalación, y obligatorio.
// { valor } | { error }
export function parseSerialEquipo(raw) {
  const serial = parseSerial(raw);
  if (serial.error) return serial;
  if (!serial.valor) return { error: 'Escribe el serial del equipo nuevo.' };
  return serial;
}

// Serial tal como se guarda en la orden: solo en un cambio de equipo; en cualquier otro tipo queda
// vacío ('' y no omitir el campo es lo que permite borrar un serial anterior).
export const datosSerialEquipo = (tipoVisita, serial) => ({
  serialEquipo: esCambioEquipo(tipoVisita) ? (parseSerial(serial).valor ?? '') : '',
});

export const esVisitaConector = (tipoVisita) => tipoVisita === TIPO_CONECTOR_EXTERNO || tipoVisita === TIPO_CONECTOR_INTERNO;

// Solo las visitas de conector generan cobro; el recableado no.
export const generaCobro = (tipoVisita) => esVisitaConector(tipoVisita);

// Tipos de visita en los que el técnico registra conectores (recableado o visita de conector).
export const llevaConectores = (tipoVisita) => tipoVisita === TIPO_RECABLEADO || esVisitaConector(tipoVisita);

// ¿Cuándo ve el técnico el aviso de cobro? Con conector interno, apenas pre-finaliza (el cobro se
// le informa al cliente en el momento); en las demás visitas con cobro, hasta que se finaliza la orden.
export const avisaCobroAlPreFinalizar = (tipoVisita) => tipoVisita === TIPO_CONECTOR_INTERNO;

export const etiquetaTipoVisita = (tipoVisita) => ETIQUETA_TIPO_VISITA[tipoVisita] || tipoVisita || '';

// --- Recableado ---------------------------------------------------------------------------

export const COLOR_VERDE = 'VERDE';
export const COLOR_AZUL = 'AZUL';
export const ETIQUETA_COLOR = { [COLOR_VERDE]: 'Verde', [COLOR_AZUL]: 'Azul' };

// Colores que se pueden elegir según el conector: el externo solo es verde.
export const COLORES_CONECTOR_EXTERNO = [COLOR_VERDE];
export const COLORES_CONECTOR_INTERNO = [COLOR_VERDE, COLOR_AZUL];

export const METROS_MAX = 9999;

// Texto escrito por el técnico -> metros enteros. Obligatorio en un recableado.
export function parseMetros(raw) {
  const txt = String(raw ?? '').trim();
  if (txt === '') return { error: 'Indica los metros de cable que usaste.' };
  if (!/^\d{1,4}$/.test(txt)) return { error: 'Escribe los metros como un número entero. Ejemplo: 35' };
  const valor = parseInt(txt, 10);
  if (valor < 1) return { error: 'Los metros de cable deben ser mayores a 0.' };
  return { valor };
}

// Deja solo un color permitido para ese conector ('' si no hay o no es válido).
export const colorConectorExterno = (color) => (COLORES_CONECTOR_EXTERNO.includes(color) ? color : '');
export const colorConectorInterno = (color) => (COLORES_CONECTOR_INTERNO.includes(color) ? color : '');

// Colores que puede elegir el técnico en una visita de conector (en las demás no hay elección).
export const coloresConectorVisita = (tipoVisita) => {
  if (tipoVisita === TIPO_CONECTOR_EXTERNO) return COLORES_CONECTOR_EXTERNO;
  if (tipoVisita === TIPO_CONECTOR_INTERNO) return COLORES_CONECTOR_INTERNO;
  return [];
};

// En la visita de conector interno el color es obligatorio (el externo siempre es verde).
// Devuelve el mensaje de error, o '' si está bien.
export const errorColorConector = (tipoVisita, colorInterno) =>
  tipoVisita === TIPO_CONECTOR_INTERNO && !colorConectorInterno(colorInterno) ? 'Elige el tipo de conector: verde o azul.' : '';

// Datos de metros y conectores tal como se guardan en la orden:
//   - Recableado: metros y los conectores que se hayan marcado (opcionales).
//   - Visita de conector: solo el conector de esa visita (el externo siempre es verde).
//   - Cualquier otro tipo: todo queda vacío.
// `null`/'' (y no omitir el campo) es lo que permite borrar un valor anterior.
export function datosConectores(tipoVisita, { metros, conectorExterno, conectorInterno } = {}) {
  const vacios = { metrosCable: null, conectorExterno: '', conectorInterno: '' };
  if (tipoVisita === TIPO_RECABLEADO) {
    return { metrosCable: metros ?? null, conectorExterno: colorConectorExterno(conectorExterno), conectorInterno: colorConectorInterno(conectorInterno) };
  }
  if (tipoVisita === TIPO_CONECTOR_EXTERNO) return { ...vacios, conectorExterno: COLOR_VERDE };
  if (tipoVisita === TIPO_CONECTOR_INTERNO) return { ...vacios, conectorInterno: colorConectorInterno(conectorInterno) };
  return vacios;
}

// Color del conector de una visita de conector, con su nombre ("Conector azul"); '' si no hay.
export function textoConectorVisita(t) {
  const color = t?.tipoVisita === TIPO_CONECTOR_EXTERNO ? t.conectorExterno : t?.tipoVisita === TIPO_CONECTOR_INTERNO ? t.conectorInterno : '';
  return ETIQUETA_COLOR[color] ? `Conector ${ETIQUETA_COLOR[color].toLowerCase()}` : '';
}

export const tieneDatosRecableado = (t) => Boolean(t) && (t.metrosCable != null || Boolean(t.conectorExterno) || Boolean(t.conectorInterno));

// Partes legibles del recableado de una orden, en el orden en que se muestran:
//   ['35 m de cable', 'Conector externo: Verde', 'Conector interno: Azul']
export function partesRecableado(t) {
  if (!t) return [];
  const partes = [];
  if (t.metrosCable != null) partes.push(`${t.metrosCable} m de cable`);
  if (t.conectorExterno) partes.push(`Conector externo: ${ETIQUETA_COLOR[t.conectorExterno] || t.conectorExterno}`);
  if (t.conectorInterno) partes.push(`Conector interno: ${ETIQUETA_COLOR[t.conectorInterno] || t.conectorInterno}`);
  return partes;
}
