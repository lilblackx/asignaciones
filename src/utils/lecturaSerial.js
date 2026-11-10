import { MAX_LARGO_SERIAL } from './instalacion.js';
import { evaluarSerialCaja, serialParaOlt } from './serialOlt.js';

// Lo que el técnico escanea con la cámara es el código de barras de la etiqueta de la caja. Una etiqueta trae varios (la MAC, el S/N de fábrica, el EAN-13...) y solo sirve uno: el PON S/N
// (V-SOL, BT-PON...) o el GPON SN (TP-Link). Aquí se decide qué se acepta con LA MISMA verificación que ya usa el campo del serial a mano (evaluarSerialCaja de utils/serialOlt):
// lo que da "Serial correcto" se acepta y lo demás se rechaza, con el motivo.

const MARCAS = { VSOL: 'V-SOL', TPLG: 'TP-Link', HWTC: 'Huawei', BTPT: 'BT-PON', ZTEG: 'ZTE', FHTT: 'FiberHome', GPON: 'GPON' };

// El texto leído como lo acepta el campo del serial (letras, números y guion, en mayúsculas); los ":" y los espacios del código se quitan (XPSN:4857544310184360 -> XPSN4857544310184360).
export const normalizarLectura = (texto) => String(texto ?? '').toUpperCase().replace(/[\s:]/g, '').replace(/[^0-9A-Z-]/g, '');

// Una lectura: { tipo: 'ok' | 'mac' | 'otro', leido, serial, etiqueta, mensaje }
//   ok:   es un serial válido; `serial` es lo que va al campo (tal como está en la etiqueta) y `etiqueta` dice qué es ("PON S/N · V-SOL", "GPON SN · TP-Link").
//   mac:  la MAC de la caja.
//   otro: cualquier otro código (el S/N de fábrica, el EAN-13, un código cortado...).
export function leerCodigo(texto) {
  const leido = normalizarLectura(texto);
  if (!leido || leido.length > MAX_LARGO_SERIAL) {
    return { tipo: 'otro', leido, serial: '', etiqueta: '', mensaje: leido ? `Leí ${leido.slice(0, 20)}…: no es el serial del equipo.` : '' };
  }
  // 12 caracteres hexadecimales y nada más es una MAC (CC-BA-BD-AA-8E-40 -> CCBABDAA8E40), aunque empiece con cuatro letras A-F y por eso se parezca a "4 letras + 8 hexadecimales". Un serial
  // de OLT siempre trae en sus 4 letras alguna que no es hexadecimal (VSOL, TPLG, HWTC, BTPT...). La MAC va justo junto al serial en la etiqueta, así que aquí no puede colarse.
  if (/^[0-9A-F]{12}$/.test(leido)) return { tipo: 'mac', leido, serial: '', etiqueta: '', mensaje: `Leí ${leido}: es la MAC de la caja.` };
  const evaluacion = evaluarSerialCaja(leido);
  if (evaluacion.codigo === 'GOPN') return { tipo: 'otro', leido, serial: '', etiqueta: '', mensaje: `Leí ${leido}: dice GOPN y debe ser GPON.` };
  if (evaluacion.estado === 'ok') {
    const olt = serialParaOlt(leido);
    const marca = MARCAS[olt.slice(0, 4)] || '';
    const esPonSn = leido === olt;
    return { tipo: 'ok', leido, serial: leido, etiqueta: `${esPonSn ? 'PON S/N' : 'GPON SN'}${marca ? ` · ${marca}` : ''}`, mensaje: '' };
  }
  if (evaluacion.codigo === 'MAC') return { tipo: 'mac', leido, serial: '', etiqueta: '', mensaje: `Leí ${leido}: es la MAC de la caja.` };
  return { tipo: 'otro', leido, serial: '', etiqueta: '', mensaje: `Leí ${leido}: no es el PON S/N ni el GPON SN.` };
}

// Entre todos los códigos que se ven a la vez (una etiqueta trae tres o cuatro): el primero válido manda. Si ninguno lo es, se devuelve el rechazo más útil (la MAC antes que otro código) para
// decirle al técnico qué leyó. Sin ningún código legible devuelve null.
export function mejorLectura(textos) {
  const lecturas = [...new Set((textos || []).map(normalizarLectura).filter(Boolean))].map(leerCodigo);
  if (lecturas.length === 0) return null;
  return lecturas.find((l) => l.tipo === 'ok') || lecturas.find((l) => l.tipo === 'mac') || lecturas[0];
}
