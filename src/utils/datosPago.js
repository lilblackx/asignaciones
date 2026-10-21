// Los datos que Finanzas registra al pagar a un técnico o al darle un adelanto: moneda, forma de pago, referencia, fecha y hora. Funciones puras (las usan la
// ventana de pago, el adelanto y las pruebas). La hora es la de Caracas, como en el resto de la app.
import { esFechaValida } from './registroVnTa.js';

export const MONEDA_BS = 'BS';
export const MONEDA_USD = 'USD';
export const MONEDAS = [{ id: MONEDA_BS, nombre: 'Bolívares (Bs)' }, { id: MONEDA_USD, nombre: 'Dólares ($)' }];
export const etiquetaMoneda = (moneda) => (moneda === MONEDA_BS ? 'Bs' : moneda === MONEDA_USD ? '$' : '');

// Las formas con que se le paga al técnico, según la moneda (un adelanto es siempre en dólares).
export const FORMAS_PAGO_TECNICO = {
  [MONEDA_BS]: ['Pago móvil', 'Transferencia', 'Efectivo'],
  [MONEDA_USD]: ['Zelle', 'Pago móvil', 'Transferencia', 'Efectivo', 'Otro'],
};
export const formasDeMoneda = (moneda) => FORMAS_PAGO_TECNICO[moneda] || [];
// El efectivo no tiene referencia; todo lo demás sí.
export const exigeReferencia = (forma) => forma !== 'Efectivo';

// El banco desde el que se hizo el pago: se escribe (con estas sugerencias, que son las más comunes) y es obligatorio salvo en efectivo y en "Otro".
export const BANCOS_SUGERIDOS = [
  'Banesco', 'Mercantil', 'Banco de Venezuela', 'Banco Nacional de Crédito (BNC)', 'BBVA Provincial', 'Bancaribe', 'Banco del Tesoro', 'Bancamiga', 'Banplus',
  'Banco Exterior', 'Banco Occidental de Descuento (BOD)', 'Banco Venezolano de Crédito', 'Banco Activo', 'Bank of America', 'Chase', 'Wells Fargo', 'Zinli', 'Binance',
];
export const exigeBanco = (forma) => ['Pago móvil', 'Transferencia', 'Zelle'].includes(forma);
export const MAX_BANCO = 40;
export const MAX_REFERENCIA = 40;
export const MAX_NOTA = 300;
export const MAX_ADELANTO = 100000;
// Una hora de diferencia hacia adelante se tolera por el reloj del equipo; más que eso es una fecha futura.
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

const limpiar = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

// "2026-10-21" + "15:45" -> marca de tiempo (ms) de esa hora en Caracas, o null si no es una fecha y hora válidas.
export function marcaDeFechaHora(fecha, hora) {
  if (!esFechaValida(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora || ''))) return null;
  const marca = Date.parse(`${fecha}T${hora}:00-04:00`);
  return Number.isFinite(marca) ? marca : null;
}

// "2026-10-21" y "15:45" de una marca de tiempo, en hora de Caracas (para llenar el formulario con el momento actual).
export function fechaHoraDeMarca(marca) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(marca)).map((p) => [p.type, p.value]));
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

// Moneda, forma, referencia, fecha y hora -> { valor: { moneda, forma, referencia, pagadoEn } } o { error, campo }.
export function parseDatosPago({ moneda, forma, banco, referencia, fecha, hora } = {}, { ahora = Date.now() } = {}) {
  if (moneda !== MONEDA_BS && moneda !== MONEDA_USD) return { error: 'Elige la moneda del pago.', campo: 'moneda' };
  if (!formasDeMoneda(moneda).includes(forma)) return { error: 'Elige la forma de pago.', campo: 'forma' };
  const bancoLimpio = limpiar(banco);
  if (bancoLimpio.length > MAX_BANCO) return { error: `El nombre del banco es demasiado largo (máximo ${MAX_BANCO} caracteres).`, campo: 'banco' };
  if (exigeBanco(forma) && !bancoLimpio) return { error: 'Escribe el banco desde el que se pagó.', campo: 'banco' };
  const ref = limpiar(referencia);
  if (ref.length > MAX_REFERENCIA) return { error: `La referencia es demasiado larga (máximo ${MAX_REFERENCIA} caracteres).`, campo: 'referencia' };
  if (exigeReferencia(forma) && !ref) return { error: 'Escribe la referencia del pago.', campo: 'referencia' };
  const pagadoEn = marcaDeFechaHora(fecha, hora);
  if (pagadoEn === null) return { error: 'Escribe la fecha y la hora del pago.', campo: 'fecha' };
  if (pagadoEn > ahora + TOLERANCIA_FUTURO_MS) return { error: 'La fecha y la hora del pago no pueden ser futuras.', campo: 'fecha' };
  // En efectivo no hay banco: si se había escrito uno antes de cambiar la forma, no se guarda.
  return { valor: { moneda, forma, banco: forma === 'Efectivo' ? '' : bancoLimpio, referencia: ref, pagadoEn } };
}

// "50" / "50,5" / "50.50" -> dólares (más de 0, hasta MAX_ADELANTO, dos decimales) o { error }.
export function parseMontoAdelanto(texto) {
  const limpio = String(texto ?? '').trim().replace(',', '.');
  if (limpio === '') return { error: 'Escribe el monto del adelanto.' };
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(limpio)) return { error: 'Escribe solo números, con hasta 2 decimales. Ejemplo: 50 o 50,50' };
  const valor = Number(limpio);
  if (valor <= 0) return { error: 'El adelanto debe ser mayor a 0.' };
  if (valor > MAX_ADELANTO) return { error: `El monto no puede pasar de ${MAX_ADELANTO}.` };
  return { valor };
}

// Un adelanto: monto en dólares + forma, referencia, fecha y hora (siempre en dólares) + nota opcional -> { valor } o { error, campo }.
export function parseAdelanto({ monto, forma, banco, referencia, fecha, hora, nota } = {}, { ahora = Date.now() } = {}) {
  const m = parseMontoAdelanto(monto);
  if (m.error) return { error: m.error, campo: 'monto' };
  const datos = parseDatosPago({ moneda: MONEDA_USD, forma, banco, referencia, fecha, hora }, { ahora });
  if (datos.error) return datos;
  const notaLimpia = limpiar(nota);
  if (notaLimpia.length > MAX_NOTA) return { error: `La nota es demasiado larga (máximo ${MAX_NOTA} caracteres).`, campo: 'nota' };
  return { valor: { monto: m.valor, forma: datos.valor.forma, banco: datos.valor.banco, referencia: datos.valor.referencia, pagadoEn: datos.valor.pagadoEn, nota: notaLimpia } };
}
