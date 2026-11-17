// El técnico en las listas, tablas y reportes: sus iniciales en un círculo con el color que se le asignó en Técnicos (`getTecnicoColor` da fondo, texto y borde
// para claro y oscuro) y el nombre al lado en texto neutro. El círculo siempre mide lo mismo; el nombre largo baja a una segunda línea en vez de cortarse.
const iniciales = (nombre = '') => nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const legible = (nombre = '') => nombre.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, e, l) => e + l.toUpperCase());

// "Reinel Bravo" -> "Reinel B.": el nombre y la inicial del apellido, para las columnas angostas (el nombre completo queda en el título y en el texto para lectores de pantalla).
const corto = (nombre = '') => {
  const p = legible(nombre).split(' ').filter(Boolean);
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || '';
};

// `corto`: en las columnas angostas de las tablas.
export default function NombreTecnico({ nombre, getTecnicoColor, className = '', corto: abreviar = false }) {
  return (
    <span className={`inline-flex items-center gap-2 min-w-0 max-w-full ${className}`} title={nombre}>
      <span aria-hidden="true" className={`shrink-0 w-7 h-7 max-lg:w-8 max-lg:h-8 rounded-full border inline-flex items-center justify-center text-[11px] max-lg:text-xs font-black leading-none ${getTecnicoColor(nombre)}`}>{iniciales(nombre)}</span>
      <span className="min-w-0 break-words text-left text-xs font-bold leading-tight text-foreground" aria-label={abreviar ? legible(nombre) : undefined}>{abreviar ? corto(nombre) : legible(nombre)}</span>
    </span>
  );
}
