// El nombre de un técnico para mostrarlo: las iniciales para el círculo y el nombre en mayúscula inicial (en la base va en mayúsculas).
export const iniciales = (nombre = '') => nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const legible = (nombre = '') => nombre.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, e, l) => e + l.toUpperCase());
// "Reinel Bravo" -> "Reinel B.": el nombre y la inicial del apellido, para las columnas angostas.
export const nombreCorto = (nombre = '') => {
  const p = legible(nombre).split(' ').filter(Boolean);
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || '';
};
