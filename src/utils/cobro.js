// Cobro resultante que se le informa al técnico al finalizar cualquier orden.
//
// Quien finaliza elige entre:
//   - "Visita técnica": el monto de siempre (monto base en EUR x tasa BCV del momento), siempre en Bs.
//   - "Otro monto": un monto escrito a mano, en Bs o en $ (ej. un cambio de equipo de 30 $), que es el que verá el técnico en su aviso.
//   - "Exonerar": la visita no se cobra; el técnico ve en su aviso que no debe cobrar nada.

import { esInstalacion } from './instalacion.js';
import { etiquetaTipoVisita } from './tipoVisita.js';

export const COBRO_VISITA = 'VISITA_TECNICA';
export const COBRO_OTRO = 'OTRO_MONTO';
export const COBRO_EXONERADO = 'EXONERADO';

// Moneda del cobro. Solo "Otro monto" puede ir en dólares; se guarda en la orden como `cobroMoneda: 'USD'`
// (sin el campo, o con otro valor, es Bs: así se leen las órdenes anteriores).
export const MONEDA_BS = 'BS';
export const MONEDA_USD = 'USD';

export const monedaDe = (t) => (t?.cobroMoneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS);

// "5.696 Bs" o "30 $".
export const textoMonto = (monto, moneda) => `${monto} ${moneda === MONEDA_USD ? '$' : 'Bs'}`;

export const ETIQUETA_COBRO = { [COBRO_VISITA]: 'Visita técnica', [COBRO_OTRO]: 'Otro monto', [COBRO_EXONERADO]: 'Exonerar' };

// Monto escrito a mano (en Bs o en $): solo dígitos y, si hace falta, coma con hasta 2 decimales
// (no se aceptan puntos para que "5.696" no se confunda con 5,696).
export function parseMontoBs(raw) {
  const txt = String(raw ?? '').trim();
  if (txt === '') return { error: 'Escribe el monto a cobrar.' };
  if (!/^\d{1,9}(,\d{1,2})?$/.test(txt)) return { error: 'Escribe solo números y usa coma para los decimales. Ejemplo: 5000 o 5000,50' };
  const valor = Number(txt.replace(',', '.'));
  if (!(valor > 0)) return { error: 'El monto debe ser mayor a 0.' };
  return { valor };
}

// Mismo formato que el monto de la visita técnica ("5.696"), con decimales solo si los hay.
export const formatoMontoBs = (valor) => valor.toLocaleString('es-VE', { maximumFractionDigits: 2 });

// Elección de quien finaliza -> { cobroBs, tipo, moneda } listo para guardar, o { error }.
//   seleccion: { modo: 'VISITA_TECNICA' | 'OTRO_MONTO' | 'EXONERADO', otro: texto del monto, moneda: 'BS' | 'USD' }
//   (`cobroBs` guarda el monto en la moneda elegida; el nombre es el del campo ya existente en las órdenes.)
//   montoVisita: monto de la visita técnica ya formateado (null si la tasa no está configurada)
export function resolverCobro(seleccion, montoVisita) {
  if (seleccion?.modo === COBRO_EXONERADO) return { cobroBs: null, tipo: COBRO_EXONERADO, moneda: MONEDA_BS };
  if (seleccion?.modo === COBRO_OTRO) {
    const monto = parseMontoBs(seleccion.otro);
    if (monto.error) return { error: monto.error };
    return { cobroBs: formatoMontoBs(monto.valor), tipo: COBRO_OTRO, moneda: seleccion.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS };
  }
  return { cobroBs: montoVisita || null, tipo: COBRO_VISITA, moneda: MONEDA_BS };
}

export const COBRO_INICIAL = { modo: COBRO_VISITA, otro: '', moneda: MONEDA_BS };

// --- Cobro ya registrado en una orden finalizada ---

export const estaExonerado = (t) => t?.cobroTipo === COBRO_EXONERADO;

// Toda orden lleva cobro resultante, menos las instalaciones: quien la aprueba o la finaliza siempre elige
// "Visita técnica", "Otro monto" o "Exonerar", y el técnico lo ve cuando se finaliza (sin importar el tipo de visita).
export const llevaCobro = (t) => Boolean(t) && !esInstalacion(t.tipoTrabajo);

// Nombre de lo que se cobra: el tipo de visita ("Conector interno", "Recableado") o, sin visita, el tipo de
// trabajo ("Instalación", "Avería").
export const conceptoCobro = (t) => {
  if (t?.tipoVisita) return etiquetaTipoVisita(t.tipoVisita);
  const trabajo = String(t?.tipoTrabajo || '').trim().toLowerCase();
  return trabajo ? trabajo.charAt(0).toUpperCase() + trabajo.slice(1) : 'Orden';
};

// ¿Hay algo que avisarle al técnico del cobro de esta orden: un monto o que se exoneró?
export const tieneCobroFinal = (t) => llevaCobro(t) && (estaExonerado(t) || Boolean(t.cobroBs));

// Lo que se le avisó al técnico: el monto (con su moneda si no es Bs) o "EXONERADO". Si cambia, se le avisa de nuevo.
export const valorCobro = (t) => {
  if (estaExonerado(t)) return COBRO_EXONERADO;
  const monto = String(t?.cobroBs ?? '');
  return monto && monedaDe(t) === MONEDA_USD ? textoMonto(monto, MONEDA_USD) : monto;
};

// --- Historial de la orden ---

// " (Otro monto)" / " (Visita técnica)"; vacío si no se indicó el tipo.
const etiquetaCobro = (tipo) => (ETIQUETA_COBRO[tipo] ? ` (${ETIQUETA_COBRO[tipo]})` : '');

// Campos de la orden que guardan el cobro elegido. `cobroMoneda` queda en null salvo en dólares, para no arrastrar
// una moneda vieja. Con exoneración no hay monto.
export const camposCobro = ({ exonerado, cobroBs, cobroTipo, moneda }) => {
  if (exonerado) return { cobroTipo: COBRO_EXONERADO, cobroBs: null, cobroMoneda: null };
  if (!cobroBs) return {};
  return { cobroBs, cobroTipo: cobroTipo || COBRO_VISITA, cobroMoneda: moneda === MONEDA_USD ? MONEDA_USD : null };
};

// Parte del historial sobre el cobro, lista para pegar a un detalle: el monto con su tipo,
// o la exoneración. Vacía si no hay nada que registrar.
export const detalleCobro = (cobroBs, cobroTipo, exonerado, moneda = MONEDA_BS) => {
  if (exonerado) return ' | Visita exonerada: sin cobro al cliente';
  return cobroBs ? ` | Cobro resultante: ${textoMonto(cobroBs, moneda)}${etiquetaCobro(cobroTipo)}` : '';
};
