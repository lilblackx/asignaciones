// Traduce el error de Firestore/red a un texto que el usuario pueda entender.
export function mensajeDeError(err) {
  const code = String(err?.code || '');
  if (code.includes('permission-denied')) return 'No tienes permiso para hacer esto.';
  if (code.includes('unauthenticated')) return 'Tu sesión venció. Vuelve a iniciar sesión.';
  const sinRed = code.includes('unavailable') || code.includes('network') || code.includes('deadline-exceeded')
    || (typeof navigator !== 'undefined' && navigator.onLine === false);
  if (sinRed) return 'Sin conexión con el servidor. Revisa tu internet.';
  return 'Ocurrió un error inesperado.';
}

// Envuelve una acción del usuario (guardar, marcar, eliminar...) para que un
// fallo no deje la pantalla trabada ni pase en silencio: avisa con el motivo y
// ofrece "Reintentar", que vuelve a correr la acción completa con los mismos
// datos. Devuelve false al fallar; si la acción abre/cierra modales después de
// guardar, ese código no llega a ejecutarse y el formulario sigue abierto.
export function crearConAviso(setToastMsg) {
  return function conAviso(accion, textoFallo) {
    const envuelta = async (...args) => {
      try {
        return await accion(...args);
      } catch (err) {
        console.error(textoFallo, err);
        setToastMsg({
          type: 'error',
          text: `${textoFallo} ${mensajeDeError(err)}`,
          duration: 12000,
          action: { label: 'Reintentar', onClick: () => envuelta(...args) },
        });
        return false;
      }
    };
    return envuelta;
  };
}
