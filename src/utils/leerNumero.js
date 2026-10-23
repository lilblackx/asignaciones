// Lee el valor de una cifra de los reportes para contarlo desde 0 (ver components/NumeroContado). Entiende enteros y decimales como los escribe la app
// ("1.234", "116,50 $", "45%", "3 h") y devuelve null para lo que no es un número simple (horas "4:51:00", fechas, textos), que se muestra tal cual.
// "1.234,50 $" -> { numero: 1234.5, decimales: 2, sufijo: ' $' }
export function leerNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? { numero: valor, decimales: Number.isInteger(valor) ? 0 : 2, sufijo: '' } : null;
  const coincide = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?([\s%$A-Za-zÀ-ÿ].*)?$/.exec(String(valor ?? ''));
  if (!coincide) return null;
  return { numero: Number(`${coincide[1].replace(/\./g, '')}.${coincide[2] ?? '0'}`), decimales: (coincide[2] ?? '').length, sufijo: coincide[3] ?? '' };
}
