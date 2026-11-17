import { iniciales, legible, nombreCorto } from '../utils/nombreTecnico';

// El técnico en las listas, tablas y reportes: sus iniciales en un círculo con el color que se le asignó en Técnicos (`getTecnicoColor` da fondo, texto y borde
// para claro y oscuro) y el nombre al lado en texto neutro. El círculo siempre mide lo mismo; el nombre largo baja a una segunda línea en vez de cortarse.
// `corto`: en las columnas angostas de las tablas.
export default function NombreTecnico({ nombre, getTecnicoColor, className = '', corto: abreviar = false }) {
  return (
    <span className={`inline-flex items-center gap-2 min-w-0 max-w-full ${className}`} title={nombre}>
      <span aria-hidden="true" className={`shrink-0 w-7 h-7 max-lg:w-8 max-lg:h-8 rounded-full border inline-flex items-center justify-center text-[11px] max-lg:text-xs font-black leading-none ${getTecnicoColor(nombre)}`}>{iniciales(nombre)}</span>
      <span className="min-w-0 break-words text-left text-xs font-bold leading-tight text-foreground" aria-label={abreviar ? legible(nombre) : undefined}>{abreviar ? nombreCorto(nombre) : legible(nombre)}</span>
    </span>
  );
}
