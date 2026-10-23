import { Download } from 'lucide-react';
import Boton from './Boton';
import { BOTON_BARRA, BOTON_BARRA_NORMAL } from './estilos';

// El aspecto de todos los botones de exportar de la app, para que se vean igual en cualquier módulo (es un botón secundario con el icono de descarga).
//   `grande`: la medida de los botones que van junto a una barra de búsqueda (la misma de Filtros); sin ella, la de los botones de las demás barras.
// `etiqueta`: el texto del botón (sin él, queda solo el icono); `etiquetaSoloPc`: en el celular se oculta el texto y queda el icono.
export default function BotonExportar({ onClick, disabled, title, ariaLabel, etiqueta, etiquetaSoloPc = false, grande = false, className = '' }) {
  const contenido = etiqueta && <span className={etiquetaSoloPc ? 'hidden sm:inline' : ''}>{etiqueta}</span>;
  const nombre = ariaLabel || (etiqueta ? undefined : title);
  if (grande) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={nombre} className={`${BOTON_BARRA} ${BOTON_BARRA_NORMAL} ${className}`}>
        <Download className="w-4 h-4" aria-hidden="true" />{contenido}
      </button>
    );
  }
  return (
    <Boton icono={Download} onClick={onClick} disabled={disabled} title={title} aria-label={nombre} className={`shrink-0 ${className}`}>{contenido}</Boton>
  );
}
