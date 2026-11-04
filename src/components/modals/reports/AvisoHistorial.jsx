import AvisoCargarAnteriores from '../../AvisoCargarAnteriores';

// Avisa que el reporte solo cuenta los cierres ya cargados (los más recientes) y deja cargar los anteriores. El texto y el botón son los estándar (AvisoCargarAnteriores).
export default function AvisoHistorial({ hasMoreReports, isLoadingReports, onLoadMoreReports }) {
  return <AvisoCargarAnteriores variante="reporte" hayMas={hasMoreReports} cargando={isLoadingReports} onCargar={onLoadMoreReports} className="mb-4" />;
}
