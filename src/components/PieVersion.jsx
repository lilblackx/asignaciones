// El pie discreto de la app: el nombre, la versión (package.json) y la fecha de la compilación, para saber a simple vista si la pantalla tiene lo último que se desplegó. Al pasar el cursor o mantener
// pulsado se ve el detalle completo (versión, fecha y commit). `texto`: el nombre que va antes de la versión (por defecto "Asignaciones").
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DETALLE = `Versión ${__APP_VERSION__} · compilada el ${__APP_COMPILACION__}${__APP_COMMIT__ ? ` · ${__APP_COMMIT__}` : ''}`;

// "2026-11-18" -> "18 nov 2026" (vacío si la fecha no tiene esa forma).
const fechaCorta = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : '';
};
const COMPILADA = fechaCorta(__APP_COMPILACION__);

export default function PieVersion({ className = '', texto = '' }) {
  return (
    <p title={DETALLE} className={`h-8 flex items-center justify-center gap-1.5 text-etiqueta font-medium text-muted-foreground select-none ${className}`}>
      <span>{texto || 'Asignaciones'}</span>
      <span aria-hidden="true">·</span>
      <span>v{__APP_VERSION__}</span>
      {COMPILADA && <><span aria-hidden="true">·</span><span>{COMPILADA}</span></>}
    </p>
  );
}
