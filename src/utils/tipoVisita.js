// Tipos de visita que el técnico puede registrar al pre-finalizar una orden.
//
// - Conector externo / interno: visita para cambiar un conector. Generan un cobro al cliente
//   (se calcula al finalizar con la tasa del momento) y el externo pide NAP y puerto. El técnico
//   indica CUÁNTOS conectores usó de cada color: el externo es siempre verde (al menos 1) y puede añadir
//   conectores internos azules (opcional); el interno, verdes y/o azules (al menos 1 en total). Se guarda
//   en `conectoresUsados: { verde, azul }` (en el externo, el azul es el interno); las
//   visitas anteriores solo tienen el color (`conectorExterno` / `conectorInterno`) y cuentan como 1.
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

// --- Cantidad de conectores de una visita de conector ---------------------------------------

// Tope por color: evita un error de dedo (un "20" por un "2").
export const MAX_CONECTORES_POR_COLOR = 10;

const entero = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

// Conectores de una visita de conector por color: { verde, azul }. Si la visita guardó las cantidades se usan
// esas; las visitas anteriores solo tienen el color y cuentan como 1 conector de ese color. En cualquier otro
// tipo de visita no aplica ({ verde: 0, azul: 0 }); en el externo, el azul es un conector interno opcional.
export function cantidadesConector(t) {
  const externo = t?.tipoVisita === TIPO_CONECTOR_EXTERNO;
  if (!externo && t?.tipoVisita !== TIPO_CONECTOR_INTERNO) return { verde: 0, azul: 0 };
  const c = t.conectoresUsados;
  if (c && typeof c === 'object') return { verde: entero(c.verde), azul: entero(c.azul) };
  const color = externo ? colorConectorExterno(t.conectorExterno) : colorConectorInterno(t.conectorInterno);
  return { verde: color === COLOR_VERDE ? 1 : 0, azul: color === COLOR_AZUL ? 1 : 0 };
}

// "2 verdes, 1 azul" ('' si no hay ninguno).
export function textoCantidades({ verde = 0, azul = 0 } = {}) {
  return [
    verde > 0 && `${verde} verde${verde === 1 ? '' : 's'}`,
    azul > 0 && `${azul} azul${azul === 1 ? '' : 'es'}`,
  ].filter(Boolean).join(', ');
}

// Cantidades escritas por el técnico (texto) -> { valor: { verde, azul } } o { error, campo }.
// Un campo vacío cuenta como 0. Externo: verdes, al menos 1 (azules internos opcionales). Interno: verdes y/o azules, al menos 1 en total.
export function parseCantidadesConector(tipoVisita, { verde, azul } = {}) {
  const leer = (raw, nombre) => {
    const txt = String(raw ?? '').trim();
    if (txt === '') return { valor: 0 };
    if (!/^\d{1,2}$/.test(txt)) return { error: `Escribe la cantidad de conectores ${nombre} como un número entero. Ejemplo: 2` };
    const n = parseInt(txt, 10);
    if (n > MAX_CONECTORES_POR_COLOR) return { error: `Máximo ${MAX_CONECTORES_POR_COLOR} conectores ${nombre}.` };
    return { valor: n };
  };
  if (!esVisitaConector(tipoVisita)) return { valor: null };
  const v = leer(verde, 'verdes');
  if (v.error) return { error: v.error, campo: 'verde' };
  const a = leer(azul, 'azules');
  if (a.error) return { error: a.error, campo: 'azul' };
  if (tipoVisita === TIPO_CONECTOR_EXTERNO) {
    if (v.valor < 1) return { error: 'Indica cuántos conectores verdes usaste.', campo: 'verde' };
    return { valor: { verde: v.valor, azul: a.valor } };
  }
  if (v.valor + a.valor < 1) return { error: 'Indica cuántos conectores usaste: verdes, azules o ambos.', campo: 'verde' };
  return { valor: { verde: v.valor, azul: a.valor } };
}

// Mensaje de error de las cantidades ya numéricas (la segunda comprobación al guardar), o '' si están bien.
export const errorCantidadesConector = (tipoVisita, conectores) =>
  parseCantidadesConector(tipoVisita, { verde: String(conectores?.verde ?? ''), azul: String(conectores?.azul ?? '') }).error || '';

// Datos de metros y conectores tal como se guardan en la orden:
//   - Recableado: metros y los conectores que se hayan marcado (opcionales).
//   - Visita de conector: las cantidades por color (`conectoresUsados`) y, por compatibilidad, el color si solo se
//     usó uno (el externo siempre es verde).
//   - Cualquier otro tipo: todo queda vacío.
// `null`/'' (y no omitir el campo) es lo que permite borrar un valor anterior.
export function datosConectores(tipoVisita, { metros, conectorExterno, conectorInterno, conectores } = {}) {
  const vacios = { metrosCable: null, conectorExterno: '', conectorInterno: '', conectoresUsados: null };
  if (tipoVisita === TIPO_RECABLEADO) {
    return { ...vacios, metrosCable: metros ?? null, conectorExterno: colorConectorExterno(conectorExterno), conectorInterno: colorConectorInterno(conectorInterno) };
  }
  if (tipoVisita === TIPO_CONECTOR_EXTERNO) {
    const azul = entero(conectores?.azul);
    return { ...vacios, conectorExterno: COLOR_VERDE, conectorInterno: azul > 0 ? COLOR_AZUL : '', conectoresUsados: { verde: entero(conectores?.verde), azul } };
  }
  if (tipoVisita === TIPO_CONECTOR_INTERNO) {
    const verde = entero(conectores?.verde);
    const azul = entero(conectores?.azul);
    const unSoloColor = verde > 0 && azul === 0 ? COLOR_VERDE : azul > 0 && verde === 0 ? COLOR_AZUL : '';
    return { ...vacios, conectorInterno: unSoloColor, conectoresUsados: { verde, azul } };
  }
  return vacios;
}

// Conectores de una visita de conector, para el historial: "Conectores: 2 verdes, 1 azul". Una visita anterior,
// que solo guardó el color, dice "Conector azul". '' si no hay.
export function textoConectorVisita(t) {
  if (!esVisitaConector(t?.tipoVisita)) return '';
  if (t.conectoresUsados && typeof t.conectoresUsados === 'object') {
    const { verde, azul } = cantidadesConector(t);
    if (t.tipoVisita === TIPO_CONECTOR_EXTERNO && azul > 0) {
      return `Conectores: ${verde} externo${verde === 1 ? '' : 's'} verde${verde === 1 ? '' : 's'}, ${azul} interno${azul === 1 ? '' : 's'} azul${azul === 1 ? '' : 'es'}`;
    }
    const texto = textoCantidades(cantidadesConector(t));
    return texto ? `Conectores: ${texto}` : '';
  }
  const color = t.tipoVisita === TIPO_CONECTOR_EXTERNO ? t.conectorExterno : t.conectorInterno;
  return ETIQUETA_COLOR[color] ? `Conector ${ETIQUETA_COLOR[color].toLowerCase()}` : '';
}

// El conector de una visita de conector, por separado del cobro de la visita: su tipo ('Externo' o 'Interno'), su
// color si fue uno solo (la etiqueta del color va vacía si no se registró) y las cantidades por color.
// null si la orden no es una visita de conector.
export function conectorDeVisita(t) {
  const externo = t?.tipoVisita === TIPO_CONECTOR_EXTERNO;
  if (!externo && t?.tipoVisita !== TIPO_CONECTOR_INTERNO) return null;
  const color = externo ? colorConectorExterno(t.conectorExterno) : colorConectorInterno(t.conectorInterno);
  return { tipo: externo ? 'Externo' : 'Interno', color, etiquetaColor: ETIQUETA_COLOR[color] || '', cantidades: cantidadesConector(t) };
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
