// Valores de señal del cliente (potencia OLT Rx de 1310 nm y señal ONU Rx de 1490 nm) que guarda la oficina al
// aprobar o finalizar una orden. El técnico los ve junto al cobro resultante. No son los que el técnico captura
// al pre-finalizar (`potenciaDbm`, solo informativos): estos van aparte, en `valoresCliente`.
//
// Son obligatorios en toda orden con cobro, salvo las que no tienen una ONU del cliente que medir (Retiro de
// equipo, Validación NAP). Las instalaciones no pasan por el cobro, así que el técnico nunca vería esta tarjeta.

import { llevaCobro } from './cobro.js';
import { parsePotencia } from './potencia.js';

const SIN_ONU_QUE_MEDIR = ['RETIRO EQUIPO', 'VALIDACION NAP'];

export const exigeValoresCliente = (t) => llevaCobro(t) && !SIN_ONU_QUE_MEDIR.includes(String(t?.tipoTrabajo || '').toUpperCase());

// Escala de la ONU (dBm). Bueno: -15 a -28. Regular: -29 a -31. Crítico: -31 a -33 (y por debajo).
// Los huecos se resuelven hacia el lado más cauto: entre -28 y -29 cuenta como Regular, -31 exacto como
// Regular, y por encima de -15 se avisa que sobrepasa la escala (no es una falla, pero no es "Bueno").
export function calidadValor(valor) {
  const n = Number(valor);
  if (valor === null || valor === undefined || valor === '' || Number.isNaN(n)) return null;
  if (n > -15) return { nivel: 'alta', texto: 'Sobre -15 dBm', clase: 'text-amber-600 dark:text-amber-400' };
  if (n >= -28) return { nivel: 'bueno', texto: 'Bueno', clase: 'text-emerald-600 dark:text-emerald-400' };
  if (n >= -31) return { nivel: 'regular', texto: 'Regular', clase: 'text-amber-600 dark:text-amber-400' };
  return { nivel: 'critico', texto: 'Crítico', clase: 'text-red-600 dark:text-red-400' };
}

// Textos que escribe la oficina -> { valor: { olt1310Dbm, onu1490Dbm } } o { errores: { olt, onu } }.
// Reusa el formato de la potencia óptica: coma o punto, y sin signo se toma como negativa ("19.5" -> -19.5).
export function parseValoresCliente({ olt, onu }) {
  const a = parsePotencia(olt);
  const b = parsePotencia(onu);
  const errores = {
    ...(a.valor === undefined ? { olt: a.error || 'Escribe la potencia OLT Rx (1310 nm).' } : {}),
    ...(b.valor === undefined ? { onu: b.error || 'Escribe la señal ONU Rx (1490 nm).' } : {}),
  };
  if (Object.keys(errores).length > 0) return { errores };
  return { valor: { olt1310Dbm: a.valor, onu1490Dbm: b.valor } };
}

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

// ¿La orden ya tiene los dos valores guardados?
export const valoresGuardados = (t) => esNumero(t?.valoresCliente?.olt1310Dbm) && esNumero(t?.valoresCliente?.onu1490Dbm);

export const textoDbm = (valor) => `${valor} dBm`;

// Una línea por valor, con su calidad: "-19.85 dBm (Bueno)".
export const textoValorConCalidad = (valor) => {
  const calidad = calidadValor(valor);
  return `${textoDbm(valor)}${calidad ? ` (${calidad.texto})` : ''}`;
};

// Para el historial de la orden y para copiar todo desde la tarjeta del técnico.
export const detalleValoresCliente = (v) => `OLT Rx 1310 nm: ${textoValorConCalidad(v.olt1310Dbm)} | ONU Rx 1490 nm: ${textoValorConCalidad(v.onu1490Dbm)}`;

export const textoValoresCliente = (v) => `*Valores del cliente*\nOLT Rx (1310 nm): ${textoValorConCalidad(v.olt1310Dbm)}\nONU Rx (1490 nm): ${textoValorConCalidad(v.onu1490Dbm)}`;
