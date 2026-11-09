// El aviso de "alguien está revisando esta orden" (ver hooks/useBloqueosOrden) cuesta una escritura, una lectura del perfil en las reglas y una lectura en cada pestaña de la oficina que escucha los
// avisos, cada vez que se renueva. Estos son los tiempos y la regla de cuándo hace falta renovarlo. Las reglas de Firestore piden que un aviso no venza a más de 10 minutos.
export const DURACION_AVISO_MS = 4 * 60000;
// Se renueva a menos de la mitad de su vida, para que no venza aunque una renovación llegue tarde.
export const RENOVAR_CADA_MS = 100000;
// Una persona que no toca nada durante tanto tiempo ya no está revisando: se deja de renovar (el aviso vence solo) y se vuelve a dejar apenas haga algo.
export const INACTIVO_DESPUES_DE_MS = 5 * 60000;
// Una pestaña oculta deja de escuchar los avisos de los demás después de este tiempo: no los necesita y cada renovación ajena le costaría una lectura. Al volver a verse se vuelve a escuchar.
export const OCULTA_SIN_ESCUCHAR_DESPUES_DE_MS = 2 * 60000;

// ¿Hay que renovar el aviso ahora? Solo si la pestaña se ve y la persona hizo algo hace poco. `ultimaActividad` y `ahora` en milisegundos.
export const debeRenovar = ({ visible, ultimaActividad, ahora }) => Boolean(visible) && ahora - ultimaActividad < INACTIVO_DESPUES_DE_MS;
