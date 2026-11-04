// El aviso y el botón estándar para leer los cierres más antiguos. Es el único sitio donde se redacta: el historial, las búsquedas y todos los reportes lo usan.
// Se ve siempre igual, en PC y en celular: texto centrado y debajo el botón "Cargar cierres anteriores". Cada tanda cuesta lecturas de Firestore,
// así que nada la pide sola: siempre es un botón con nombre claro, nunca un enlace suelto dentro de una frase.
//   variante (solo cambia la frase, no el aspecto):
//     'lista' / 'vacio' / 'busqueda'  donde se buscan órdenes: al final de la lista, cuando no sale nada o sobre los resultados.
//     'cierres'                       al final de una lista de cierres (días), donde no se busca una orden.
//     'reporte'                       arriba de un reporte, de las estadísticas, de Finanzas o de Revisión de pagos: lo que se ve solo cuenta los cierres ya cargados.
//   hayMas / cargando / onCargar: los mismos datos que dan los hooks de reportes (hasMoreReports / isLoadingReports / onLoadMoreReports).
const BUSCAR = '¿No encuentras la orden que buscas? Aún hay cierres más antiguos sin cargar.';
const TEXTOS = {
  lista: BUSCAR,
  vacio: BUSCAR,
  busqueda: BUSCAR,
  cierres: 'Aún hay cierres más antiguos sin cargar.',
  reporte: 'Solo se cuentan los cierres ya cargados (los más recientes). Aún hay cierres más antiguos sin cargar.',
};

export function BotonCargarAnteriores({ cargando, onCargar }) {
  return (
    <button type="button" onClick={onCargar} disabled={cargando} className="shrink-0 px-5 py-2.5 bg-white dark:bg-zinc-900 border-2 border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
      {cargando ? 'Cargando...' : 'Cargar cierres anteriores'}
    </button>
  );
}

export default function AvisoCargarAnteriores({ hayMas, cargando, onCargar, variante = 'reporte', className = '' }) {
  if (!hayMas) return null;
  return (
    <div role="status" className={`flex flex-col items-center gap-3 py-4 px-4 text-center text-sm text-zinc-600 dark:text-zinc-400 ${className}`}>
      <p className="max-w-md">{TEXTOS[variante] || TEXTOS.reporte}</p>
      <BotonCargarAnteriores cargando={cargando} onCargar={onCargar} />
    </div>
  );
}
