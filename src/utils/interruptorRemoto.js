// El interruptor remoto de emergencia que el ADMIN maneja en Configuración: `pausarAutomaticas` en config/app. Con él en true ninguna sesión abierta hace
// escrituras automáticas (limpiar avisos vencidos, completar datos, numerar...: ver lib/escrituraAutomatica.js); las sesiones lo aplican en segundos (hooks/useControlRemoto.js).
// Es el mismo campo que cambia scripts/control-remoto.mjs (--pausar y --reanudar). Sin el documento, o sin el campo, está apagado: solo `true` pausa.

export const CAMPO_PAUSA = 'pausarAutomaticas';

// Lo que dice el documento (o nada, si no existe).
export function leerInterruptor(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  return {
    pausarAutomaticas: d[CAMPO_PAUSA] === true,
    actualizadoPor: typeof d.actualizadoPor === 'string' ? d.actualizadoPor : '',
    actualizadoEn: Number.isFinite(d.actualizadoEn) ? d.actualizadoEn : 0,
  };
}

// Los campos que se escriben al cambiarlo: el valor, quién lo cambió y cuándo (se escriben con merge: lo demás de config/app no se toca).
export function cambioDePausa(valor, usuario, ahora = Date.now()) {
  return { [CAMPO_PAUSA]: valor === true, actualizadoPor: String(usuario || '').slice(0, 80), actualizadoEn: ahora };
}
