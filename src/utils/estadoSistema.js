// Lo que muestra "Estado del sistema" en Configuración (solo ADMIN): comprobaciones de solo lectura que salen de datos que la app ya tiene o de una petición
// al hosting (ver hooks/useEstadoSistema.js); no leen nada de Firestore. La tasa del dólar se ve en su módulo, el consumo de Firestore en Estaciones y los envíos
// al inventario en su módulo: aquí no se repiten. Funciones puras: las usan la pantalla y scripts/test-estado-sistema.mjs.

export const NIVEL = { BIEN: 'bien', AVISO: 'aviso', INFO: 'info' };

// ¿Esta pantalla tiene la versión publicada? `delServidor`: el campo `v` de /version.json; `propia`: la compilación de esta página (__APP_BUILD__).
export function estadoDeVersion(delServidor, propia, { actualizacionLista = false } = {}) {
  if (actualizacionLista) return { nivel: NIVEL.AVISO, texto: 'Hay una versión nueva lista: recarga para usarla.' };
  if (typeof delServidor !== 'string' || !delServidor) return { nivel: NIVEL.INFO, texto: 'No se pudo comprobar si hay una versión nueva.' };
  if (delServidor === propia) return { nivel: NIVEL.BIEN, texto: 'Esta pantalla tiene la última versión publicada.' };
  return { nivel: NIVEL.AVISO, texto: 'Hay una versión nueva publicada: recarga para usarla.' };
}

// Las escrituras que la app hace sola (lib/escrituraAutomatica.js): normales, pausadas por el interruptor remoto de config/app (el de Configuración), o detenidas
// en esta sesión por demasiados fallos. `pausadas` null: todavía no se leyó el interruptor.
export function estadoDeAutomaticas({ pausadas = false, cortacircuitos = false } = {}) {
  if (pausadas === null) return { nivel: NIVEL.INFO, texto: 'Leyendo el interruptor remoto…', detalle: '' };
  if (pausadas) return { nivel: NIVEL.AVISO, texto: 'Pausadas para todos con el interruptor remoto.', detalle: 'Si ya no hace falta, desmarca el interruptor para que la app vuelva a limpiar y completar datos sola.' };
  if (cortacircuitos) return { nivel: NIVEL.AVISO, texto: 'Esta sesión las detuvo por demasiados fallos seguidos.', detalle: 'Recarga la app; si se repite, revisa Estaciones.' };
  return { nivel: NIVEL.BIEN, texto: 'Funcionando con normalidad.', detalle: '' };
}
