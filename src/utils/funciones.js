// Funciones que el ADMIN enciende o apaga desde el módulo Configuración. Se guardan en config/funciones (un solo documento, que leen
// todos los usuarios activos y escribe el ADMIN, ver firestore.rules). Toda función nace APAGADA: sin el documento, o sin su campo,
// está desactivada, y solo `true` la enciende.
//
//   rutasActivas  la "Ruta del día" de los técnicos (ver utils/rutaDelDia.js): el botón y la hoja con sus paradas.

export const FUNCIONES = {
  RUTAS: 'rutasActivas',
};

// Lo que dice el documento (o nada, si no existe) como un objeto con todas las funciones en true o false.
export function leerFunciones(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  return { rutasActivas: d[FUNCIONES.RUTAS] === true };
}

// Los campos que se escriben al cambiar una función: el valor, quién lo cambió y cuándo.
export function cambioDeFuncion(clave, valor, usuario, ahora = Date.now()) {
  if (!Object.values(FUNCIONES).includes(clave)) throw new Error(`Función desconocida: ${clave}`);
  return { [clave]: valor === true, actualizadoPor: String(usuario || '').slice(0, 80), actualizadoEn: ahora };
}
