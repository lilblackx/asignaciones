// Cobro resultante que se le informa al técnico al finalizar cualquier orden.
//
// Quien finaliza elige entre:
//   - "Visita técnica": el monto de siempre (monto base en EUR x tasa BCV del momento).
//   - "Otro monto": un monto escrito a mano, que es el que verá el técnico en su aviso.
//   - "Exonerar": la visita no se cobra; el técnico ve en su aviso que no debe cobrar nada.

import { etiquetaTipoVisita } from './tipoVisita.js';

export const COBRO_VISITA = 'VISITA_TECNICA';
export const COBRO_OTRO = 'OTRO_MONTO';
export const COBRO_EXONERADO = 'EXONERADO';

export const ETIQUETA_COBRO = { [COBRO_VISITA]: 'Visita técnica', [COBRO_OTRO]: 'Otro monto', [COBRO_EXONERADO]: 'Exonerar' };

// Monto escrito a mano en bolívares: solo dígitos y, si hace falta, coma con hasta 2 decimales
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

// Elección de quien finaliza -> { cobroBs, tipo } listo para guardar, o { error }.
//   seleccion: { modo: 'VISITA_TECNICA' | 'OTRO_MONTO' | 'EXONERADO', otro: texto del monto }
//   montoVisita: monto de la visita técnica ya formateado (null si la tasa no está configurada)
export function resolverCobro(seleccion, montoVisita) {
  if (seleccion?.modo === COBRO_EXONERADO) return { cobroBs: null, tipo: COBRO_EXONERADO };
  if (seleccion?.modo === COBRO_OTRO) {
    const monto = parseMontoBs(seleccion.otro);
    if (monto.error) return { error: monto.error };
    return { cobroBs: formatoMontoBs(monto.valor), tipo: COBRO_OTRO };
  }
  return { cobroBs: montoVisita || null, tipo: COBRO_VISITA };
}

export const COBRO_INICIAL = { modo: COBRO_VISITA, otro: '' };

// --- Cobro ya registrado en una orden finalizada ---

export const estaExonerado = (t) => t?.cobroTipo === COBRO_EXONERADO;

// Toda orden lleva cobro resultante: quien la aprueba o la finaliza siempre elige "Visita técnica", "Otro monto" o
// "Exonerar", y el técnico lo ve cuando se finaliza (sin importar el tipo de trabajo ni de visita).
export const llevaCobro = (t) => Boolean(t);

// Nombre de lo que se cobra: el tipo de visita ("Conector interno", "Recableado") o, sin visita, el tipo de
// trabajo ("Instalación", "Avería").
export const conceptoCobro = (t) => {
  if (t?.tipoVisita) return etiquetaTipoVisita(t.tipoVisita);
  const trabajo = String(t?.tipoTrabajo || '').trim().toLowerCase();
  return trabajo ? trabajo.charAt(0).toUpperCase() + trabajo.slice(1) : 'Orden';
};

// ¿Hay algo que avisarle al técnico del cobro de esta orden: un monto o que se exoneró?
export const tieneCobroFinal = (t) => llevaCobro(t) && (estaExonerado(t) || Boolean(t.cobroBs));

// Lo que se le avisó al técnico: el monto o "EXONERADO". Si cambia, se le avisa de nuevo.
export const valorCobro = (t) => (estaExonerado(t) ? COBRO_EXONERADO : String(t?.cobroBs ?? ''));

// --- Historial de la orden ---

// " (Otro monto)" / " (Visita técnica)"; vacío si no se indicó el tipo.
const etiquetaCobro = (tipo) => (ETIQUETA_COBRO[tipo] ? ` (${ETIQUETA_COBRO[tipo]})` : '');

// Parte del historial sobre el cobro, lista para pegar a un detalle: el monto con su tipo,
// o la exoneración. Vacía si no hay nada que registrar.
export const detalleCobro = (cobroBs, cobroTipo, exonerado) => {
  if (exonerado) return ' | Visita exonerada: sin cobro al cliente';
  return cobroBs ? ` | Cobro resultante: ${cobroBs} Bs${etiquetaCobro(cobroTipo)}` : '';
};
