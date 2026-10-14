// Tipos de visita que el técnico puede registrar al pre-finalizar una orden.
//
// - Conector externo / interno: visita para cambiar un conector. Generan un cobro al cliente
//   (se calcula al finalizar con la tasa del momento) y el externo pide NAP y puerto.
// - Recableado: se registran los metros de cable usados (obligatorio) y, opcionalmente, los
//   conectores colocados: un conector externo (solo verde) y/o uno interno (verde o azul).
//   No genera cobro.

export const TIPO_CONECTOR_EXTERNO = 'CONECTOR_EXTERNO';
export const TIPO_CONECTOR_INTERNO = 'CONECTOR_INTERNO';
export const TIPO_RECABLEADO = 'RECABLEADO';

export const ETIQUETA_TIPO_VISITA = {
  [TIPO_CONECTOR_EXTERNO]: 'Conector externo',
  [TIPO_CONECTOR_INTERNO]: 'Conector interno',
  [TIPO_RECABLEADO]: 'Recableado',
};

export const TIPOS_VISITA = [
  { value: '', label: 'Ninguno' },
  { value: TIPO_CONECTOR_EXTERNO, label: ETIQUETA_TIPO_VISITA[TIPO_CONECTOR_EXTERNO] },
  { value: TIPO_CONECTOR_INTERNO, label: ETIQUETA_TIPO_VISITA[TIPO_CONECTOR_INTERNO] },
  { value: TIPO_RECABLEADO, label: ETIQUETA_TIPO_VISITA[TIPO_RECABLEADO] },
];

// Solo las visitas de conector generan cobro; el recableado no.
export const generaCobro = (tipoVisita) => tipoVisita === TIPO_CONECTOR_EXTERNO || tipoVisita === TIPO_CONECTOR_INTERNO;

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

// Campos del recableado tal como se guardan en la orden. Fuera de un recableado todo queda
// vacío; `null`/'' (y no omitir el campo) es lo que permite borrar un valor anterior.
export function datosRecableado(tipoVisita, { metros, conectorExterno, conectorInterno } = {}) {
  if (tipoVisita !== TIPO_RECABLEADO) return { metrosCable: null, conectorExterno: '', conectorInterno: '' };
  return {
    metrosCable: metros ?? null,
    conectorExterno: colorConectorExterno(conectorExterno),
    conectorInterno: colorConectorInterno(conectorInterno),
  };
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
