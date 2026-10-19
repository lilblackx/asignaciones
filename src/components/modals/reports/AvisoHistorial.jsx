// Avisa que el reporte solo cuenta los cierres ya cargados (los más recientes) y deja cargar los anteriores.
export default function AvisoHistorial({ hasMoreReports, isLoadingReports, onLoadMoreReports }) {
  if (!hasMoreReports) return null;
  return (
    <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4">
      Este reporte solo cuenta el historial ya cargado (los cierres más recientes). Hay cierres más antiguos sin cargar —{' '}
      <button onClick={onLoadMoreReports} disabled={isLoadingReports} className="font-bold underline disabled:opacity-50">
        {isLoadingReports ? 'cargando...' : 'cargar más'}
      </button>{' '}
      para incluirlos.
    </div>
  );
}
