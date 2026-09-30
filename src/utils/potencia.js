// Rango de potencia óptica recibida en la ONU (GPON). Por debajo del mínimo la
// señal es débil (fibra sucia, curva, atenuación); por encima del máximo puede
// saturar el receptor. Son los valores típicos de ONU clase B+; ajustar aquí si
// el equipo usado maneja otro rango.
export const POTENCIA_MIN_DBM = -27;
export const POTENCIA_MAX_DBM = -8;
const POTENCIA_LIMITE_DBM = -40;

// Texto escrito por el técnico -> número. Acepta coma o punto decimal y tolera
// que omita el signo: la potencia recibida en GPON siempre es negativa, así que
// "19.5" se guarda como -19.5.
export function parsePotencia(raw) {
  const txt = String(raw ?? '').trim().replace(',', '.');
  if (txt === '') return { vacio: true };
  if (!/^-?\d{1,2}(\.\d{1,2})?$/.test(txt)) return { error: 'Formato inválido. Ejemplo: -19.5' };
  const valor = -Math.abs(parseFloat(txt));
  if (valor < POTENCIA_LIMITE_DBM) return { error: `La potencia debe estar entre 0 y ${POTENCIA_LIMITE_DBM} dBm.` };
  return { valor };
}

export function evaluarPotencia(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const v = Number(valor);
  if (Number.isNaN(v)) return null;
  if (v < POTENCIA_MIN_DBM) return { nivel: 'baja', texto: `Señal débil (menor a ${POTENCIA_MIN_DBM} dBm)`, clase: 'text-red-600 dark:text-red-400' };
  if (v > POTENCIA_MAX_DBM) return { nivel: 'alta', texto: `Señal muy alta (mayor a ${POTENCIA_MAX_DBM} dBm, puede saturar la ONU)`, clase: 'text-amber-600 dark:text-amber-400' };
  return { nivel: 'ok', texto: `Dentro del rango normal (${POTENCIA_MAX_DBM} a ${POTENCIA_MIN_DBM} dBm)`, clase: 'text-emerald-600 dark:text-emerald-400' };
}
