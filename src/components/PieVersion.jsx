// El pie discreto de la app: el nombre y la versión (package.json). Al pasar el cursor o mantener pulsado se ve de qué compilación es (fecha y commit).
const DETALLE = `Versión ${__APP_VERSION__} · compilada el ${__APP_COMPILACION__}${__APP_COMMIT__ ? ` · ${__APP_COMMIT__}` : ''}`;

export default function PieVersion({ className = '' }) {
  return (
    <p title={DETALLE} className={`h-10 flex items-center justify-center text-[11px] font-medium text-zinc-600 dark:text-zinc-500 select-none ${className}`}>
      Asignaciones · v{__APP_VERSION__}
    </p>
  );
}
