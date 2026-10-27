// El técnico como texto, sin chip, círculo ni color: el nombre ya lo identifica. `getTecnicoColor` se sigue recibiendo para no tocar a quien lo llama.
// eslint-disable-next-line no-unused-vars
export default function NombreTecnico({ nombre, getTecnicoColor, className = '' }) {
  return (
    <span className={`inline-block min-w-0 truncate text-[11px] max-lg:text-xs font-bold text-zinc-900 dark:text-zinc-100 ${className}`}>
      {nombre}
    </span>
  );
}
