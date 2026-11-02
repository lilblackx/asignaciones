// Cuánto dura la sesión desde que la persona escribió su clave por última vez: 24 horas para todos, y 7 días para los técnicos (están en campo
// y no manejan datos sensibles). Pasado ese tiempo hay que volver a iniciar sesión.
// Lo exigen tres lugares, con los mismos números: la app (cierra la sesión sola, con un aviso), las reglas de Firestore (rechazan todo con un
// inicio de sesión más viejo: `sesionVigente()` en firestore.rules) y el Worker. Las reglas y el Worker dan 10 minutos más de margen
// para que la app sea siempre la que cierre primero y la persona vea el aviso, no una cadena de errores.
export const SESION_MAX_MS = 24 * 60 * 60 * 1000;
export const SESION_TECNICO_MAX_MS = 7 * 24 * 60 * 60 * 1000;
export const MARGEN_SERVIDOR_MS = 10 * 60 * 1000;

const ROL_TECNICO = 'TECNICO';

// La duración que le toca a cada rol. Sin rol conocido (todavía no se leyó el perfil) se usa la más corta.
export const duracionDeSesion = (rol) => (rol === ROL_TECNICO ? SESION_TECNICO_MAX_MS : SESION_MAX_MS);

// Cuándo vence la sesión (ms) a partir de la hora de inicio de sesión (el `authTime` del token: texto de fecha o milisegundos).
export function vencimientoDeSesion(authTime, rol) {
  const inicio = typeof authTime === 'number' ? authTime : Date.parse(authTime);
  return Number.isFinite(inicio) ? inicio + duracionDeSesion(rol) : null;
}

// ¿Ya venció? Sin hora de inicio conocida no se puede afirmar que venció: lo decide el servidor.
export function sesionVencida(authTime, rol, ahora = Date.now()) {
  const vence = vencimientoDeSesion(authTime, rol);
  return vence !== null && ahora >= vence;
}

// Cuántos ms faltan para que venza (0 si ya venció); null si no se conoce la hora de inicio.
export function msParaVencer(authTime, rol, ahora = Date.now()) {
  const vence = vencimientoDeSesion(authTime, rol);
  return vence === null ? null : Math.max(0, vence - ahora);
}

// Para el Worker: `auth_time` viene en segundos dentro del token. Sin él se rechaza (un token de Firebase siempre lo trae).
export function inicioDeSesionVigente(authTimeSegundos, rol, ahora = Date.now()) {
  return Number.isFinite(authTimeSegundos) && authTimeSegundos * 1000 + duracionDeSesion(rol) + MARGEN_SERVIDOR_MS > ahora;
}

export const MENSAJE_SESION_VENCIDA = 'Tu sesión venció. Inicia sesión de nuevo.';
