// El serial que el técnico escribe es el de la caja del equipo; el inventario del almacén guarda el que ve la OLT (el "PON S/N":
// 4 letras del fabricante + 8 caracteres hexadecimales, ej. TPLGBDAA8DE0, VSOL00E65D25, BTPTDD9BA416, HWTC1A2B3C4D).
// Algunas cajas traen ese serial con "GPON" delante (o "GOPN", como lo han anotado), de dos maneras:
//   - En texto: GPONBTPTDD9BA416 (BT-PON) = GPON + BTPTDD9BA416 -> se quita el "GPON".
//   - En hexadecimal (TP-Link): GOPN54504C47BDAA8DE0 = GOPN + 54504C47 ("TPLG" en ASCII hexadecimal) + BDAA8DE0 -> TPLGBDAA8DE0.
//   - En hexadecimal sin GPON (AmericanPon): su etiqueta trae "XPSN:4857544310184360" = 48575443 ("HWTC") + 10184360 -> HWTC10184360 (los últimos 8 son los de la MAC;
//     el S/N de fábrica 2024101705174 y la MAC A24E10184360 no sirven). El campo del técnico quita los ":", así que llega XPSN4857544310184360, o solo los 16 dígitos.
// Las cajas de V-SOL ya traen el PON S/N (VSOL00E65D25) en su etiqueta: no se calcula desde la MAC (no coincide).
// Los equipos TP-Link (MR) siempre empiezan con "TPLG" (el fabricante en hexadecimal es 54504C47): si el técnico escribió "TPL" sin la G
// (TPLBDAA8C10) o con otra letra en su lugar (TPLHBDAA8C10, la H queda pegada a la G en el teclado), se envía con la G (TPLGBDAA8C10).
// Solo se convierte al enviar al almacén (utils/envioInventario); lo que escribió el técnico se guarda y se muestra tal cual.

const FORMATO_CAJA_TEXTO = /^G(?:PO|OP)N([A-Z]{4}[0-9A-F]{8})$/;
const FORMATO_CAJA_HEX = /^(?:G(?:PO|OP)N|XPSN:?)?([0-9A-F]{8})([0-9A-F]{8})$/;
const FORMATO_OLT = /^[A-Z]{4}[0-9A-F]{8}$/;
const FORMATO_TPLINK = /^TPL[A-Z]?([0-9A-F]{8})$/;

const limpio = (serial) => String(serial ?? '').replace(/\s+/g, '').toUpperCase();

function desdeCaja(serial) {
  const texto = limpio(serial);
  const enTexto = FORMATO_CAJA_TEXTO.exec(texto);
  if (enTexto) return enTexto[1];
  const enHex = FORMATO_CAJA_HEX.exec(texto);
  if (!enHex) return texto;
  const fabricante = enHex[1].match(/../g).map((par) => String.fromCharCode(parseInt(par, 16))).join('');
  return /^[A-Z]{4}$/.test(fabricante) ? fabricante + enHex[2] : texto;
}

// El serial como lo ve la OLT. Si no viene en uno de esos formatos de caja, queda como está (salvo el TP-Link sin su G).
export function serialParaOlt(serial) {
  const olt = desdeCaja(serial);
  const tplink = FORMATO_TPLINK.exec(olt);
  return tplink ? `TPLG${tplink[1]}` : olt;
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
  return { estado: 'error', codigo: 'FORMATO', mensaje: 'Revisa el serial: no tiene el formato esperado (ej. VSOL00E65D25, GPON… o el XPSN de AmericanPon).' };
}

// El mensaje de error del serial, o '' si está bien (o vacío: que sea obligatorio lo exige quien lo pide).
export const errorSerialCaja = (serial) => {
  const evaluacion = evaluarSerialCaja(serial);
  return evaluacion.estado === 'error' ? evaluacion.mensaje : '';
};
