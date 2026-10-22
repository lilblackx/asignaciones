import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

// El lugar del encabezado (EncabezadoSimple) donde un módulo pone sus acciones principales en PC (lg: 1024 px o más).
export const ID_ACCIONES_ENCABEZADO = 'acciones-encabezado';

// El lugar en el DOM: el encabezado se pinta en el mismo render pero después de quien lo busca, así que se lee otra vez al terminar de pintar.
const sinSuscripcion = () => () => {};
const buscarDestino = () => document.getElementById(ID_ACCIONES_ENCABEZADO);

// Las acciones principales de un módulo (Actualizar, Exportar, Ejecutar cierre...): en PC salen en el encabezado, a la derecha del título, y en
// pantallas angostas se quedan donde estaban en la pantalla, porque el encabezado del celular no tiene sitio para ellas.
//   encabezado: lo que se pinta en el encabezado (solo PC).
//   children (opcional): la versión de la pantalla, que en PC se oculta para no repetir el botón; con `className` para su lugar.
export default function AccionesEncabezado({ encabezado, children = null, className = '' }) {
  const destino = useSyncExternalStore(sinSuscripcion, buscarDestino, () => null);
  return (
    <>
      {children && <div className={`lg:hidden ${className}`}>{children}</div>}
      {destino && createPortal(encabezado, destino)}
    </>
  );
}
