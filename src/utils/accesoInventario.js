// Quién ve y gestiona los envíos al inventario del otro sistema (el módulo "Envíos al inventario", sus alertas y los avisos
// push). Se define por nombre de usuario de la app y lo hacen cumplir las reglas de Firestore (telecomEnvios), el Worker
// (avisos y reintentos) y la pantalla (entrada del menú): mantener sincronizados esta lista, la función veInventario de
// firestore.rules y el Worker; lo comprueba `npm run test:inventario`.
export const USUARIOS_INVENTARIO = ['lfernandez'];

export const veEnviosInventario = (username) => USUARIOS_INVENTARIO.includes(String(username ?? '').trim().toLowerCase());
