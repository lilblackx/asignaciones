// El técnico como tarjeta con el color que se le asignó en Técnicos (`getTecnicoColor` da fondo, texto y borde para claro y oscuro).
export default function NombreTecnico({ nombre, getTecnicoColor, className = '' }) {
  return (
    <span className={`inline-block min-w-0 max-w-full text-center px-2 py-1.5 text-[11px] max-lg:text-xs font-bold rounded leading-tight ${getTecnicoColor(nombre)} ${className}`}>
      {nombre}
    </span>
  );
}
