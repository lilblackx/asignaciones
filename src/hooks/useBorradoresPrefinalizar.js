import { useEffect, useState } from 'react';
import { EVENTO_BORRADORES, limpiarBorradores, ordenesConBorrador } from '../utils/borradorPrefinalizar';

const SIN_BORRADORES = new Set();
const iguales = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// Los ids de las órdenes del técnico que tienen un borrador de Pre-finalizar guardado en este teléfono (para marcarlas en la lista). Se actualiza cuando el formulario guarda o borra, y al volver a la app.
export function useBorradoresPrefinalizar(usuario, activo) {
  const [ids, setIds] = useState(() => new Set());
  useEffect(() => {
    if (!activo || !usuario) return undefined;
    const leer = () => setIds((previos) => { const nuevos = ordenesConBorrador(usuario); return iguales(previos, nuevos) ? previos : nuevos; });
    leer();
    window.addEventListener(EVENTO_BORRADORES, leer);
    window.addEventListener('storage', leer);
    document.addEventListener('visibilitychange', leer);
    return () => {
      window.removeEventListener(EVENTO_BORRADORES, leer);
      window.removeEventListener('storage', leer);
      document.removeEventListener('visibilitychange', leer);
    };
  }, [usuario, activo]);
  return activo ? ids : SIN_BORRADORES;
}

// Borra los borradores de órdenes que ya no están pendientes (pre-finalizadas, devueltas, canceladas, archivadas) y los vencidos. Solo cuando ya llegaron órdenes: con la lista vacía se borraría todo.
export function useLimpiezaDeBorradores(usuario, activo, ordenes, ordenesCargadas) {
  useEffect(() => {
    // Con la lista vacía no se sabe qué órdenes siguen pendientes (la caché se acaba de borrar al vencer la sesión, o no hay conexión): se espera a que lleguen.
    if (activo && usuario && ordenesCargadas && ordenes.length > 0) limpiarBorradores(usuario, ordenes);
  }, [usuario, activo, ordenes, ordenesCargadas]);
}
