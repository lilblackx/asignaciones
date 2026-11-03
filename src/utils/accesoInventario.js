// Quién ve y gestiona los envíos al inventario del otro sistema (el módulo "Envíos al inventario", sus alertas y los avisos
// push): todo usuario con rol ADMIN, más los usuarios de la lista (por nombre de usuario de la app). Lo hacen cumplir las
// reglas de Firestore (telecomEnvios), el Worker (avisos y reintentos) y la pantalla (entrada del menú): mantener sincronizados
// esta regla, la función veInventario de firestore.rules y el Worker; lo comprueba `npm run test:inventario`.
// OJO: la lista sigue mandando en una cosa: elegir con qué nombre conoce el inventario a cada técnico ("Nombre en el
// inventario", en Técnicos) es solo de ella (vinculaTecnicosInventario / función vinculaInventario de las reglas).
export const USUARIOS_INVENTARIO = ['lfernandez'];

const enLista = (username) => USUARIOS_INVENTARIO.includes(String(username ?? '').trim().toLowerCase());

// `rol`: el rol del usuario (ROLES.ADMIN = 'ADMIN'). Sin él solo cuenta la lista.
export const veEnviosInventario = (username, rol) => rol === 'ADMIN' || enLista(username);

// Quien puede elegir el nombre de cada técnico en el inventario: solo la lista, no cualquier ADMIN.
export const vinculaTecnicosInventario = enLista;
