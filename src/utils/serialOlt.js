// El serial que el técnico escribe es el de la caja del equipo; el inventario del almacén guarda el que ve la OLT (el "PON S/N":
// 4 letras del fabricante + 8 caracteres hexadecimales, ej. TPLGBDAA8DE0, VSOL00E65D25, BTPTDD9BA416, HWTC1A2B3C4D).
// Algunas cajas traen ese serial con "GPON" delante (o "GOPN", como lo han anotado), de dos maneras:
//   - En texto: GPONBTPTDD9BA416 (BT-PON) = GPON + BTPTDD9BA416 -> se quita el "GPON".
//   - En hexadecimal (TP-Link): GOPN54504C47BDAA8DE0 = GOPN + 54504C47 ("TPLG" en ASCII hexadecimal) + BDAA8DE0 -> TPLGBDAA8DE0.
// Las cajas de V-SOL ya traen el PON S/N (VSOL00E65D25) en su etiqueta: no se calcula desde la MAC (no coincide).
// Solo se convierte al enviar al almacén (utils/envioInventario); lo que escribió el técnico se guarda y se muestra tal cual.

const FORMATO_CAJA_TEXTO = /^G(?:PO|OP)N([A-Z]{4}[0-9A-F]{8})$/;
const FORMATO_CAJA_HEX = /^G(?:PO|OP)N([0-9A-F]{8})([0-9A-F]{8})$/;
const FORMATO_OLT = /^[A-Z]{4}[0-9A-F]{8}$/;

const limpio = (serial) => String(serial ?? '').replace(/\s+/g, '').toUpperCase();

// El serial como lo ve la OLT. Si no viene en uno de esos formatos de caja, queda como está.
export function serialParaOlt(serial) {
  const texto = limpio(serial);
  const enTexto = FORMATO_CAJA_TEXTO.exec(texto);
  if (enTexto) return enTexto[1];
  const enHex = FORMATO_CAJA_HEX.exec(texto);
  if (!enHex) return texto;
  const fabricante = enHex[1].match(/../g).map((par) => String.fromCharCode(parseInt(par, 16))).join('');
  return /^[A-Z]{4}$/.test(fabricante) ? fabricante + enHex[2] : texto;
}

// ¿Tiene la forma de un serial de OLT (4 letras + 8 caracteres hexadecimales)? Una MAC (B46415E65D24) o el S/N de fábrica
// (LP20250731266) no la tienen.
export const esSerialOlt = (serial) => FORMATO_OLT.test(limpio(serial));

// Verificación del serial que escribe el técnico (instalación y cambio de equipo), para el recuadro verde/rojo y para bloquear
// el pre-finalizar con uno incorrecto. Es correcto si es el PON S/N de la etiqueta (VSOL00E65D25, BTPTDD004F58) o la forma de caja
// con GPON (ver serialParaOlt). "GOPN" no vale: es el error de escribir el GPON al revés.
//   { estado: 'vacio' | 'ok' | 'error', codigo: '' | 'GOPN' | 'MAC' | 'FORMATO', mensaje }
export function evaluarSerialCaja(serial) {
  const texto = limpio(serial);
  if (!texto) return { estado: 'vacio', codigo: '', mensaje: '' };
  if (texto.startsWith('GOPN')) return { estado: 'error', codigo: 'GOPN', mensaje: 'Dice GOPN: debe ser GPON. Revisa el serial de la caja.' };
  if (esSerialOlt(serialParaOlt(texto))) return { estado: 'ok', codigo: '', mensaje: 'Serial correcto.' };
  if (/^[0-9A-F]{12}$/.test(texto)) return { estado: 'error', codigo: 'MAC', mensaje: 'Eso parece la MAC. Escribe el serial de la etiqueta (PON S/N o GPON/SN).' };
  return { estado: 'error', codigo: 'FORMATO', mensaje: 'Revisa el serial: no tiene el formato esperado (ej. VSOL00E65D25 o GPON…).' };
}

// El mensaje de error del serial, o '' si está bien (o vacío: que sea obligatorio lo exige quien lo pide).
export const errorSerialCaja = (serial) => {
  const evaluacion = evaluarSerialCaja(serial);
  return evaluacion.estado === 'error' ? evaluacion.mensaje : '';
};
