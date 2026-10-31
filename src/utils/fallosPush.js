// Qué decirle a quien no quedó registrado para recibir avisos con la app cerrada (hooks/usePushToken, components/AvisoNotificaciones).
// El caso más común en PC es Brave: da el permiso de notificaciones del sitio ("Permitir"), pero trae apagado el servicio de Google que usa Firebase
// para enviar los avisos ("Usar los servicios de Google para la mensajería push"), así que registrarse falla en silencio y nada llega. Son dos
// ajustes distintos: tener las notificaciones permitidas para el sitio no basta.

// Códigos con que falla el registro cuando el navegador no tiene el servicio de push de Google activo o no puede usarlo.
const CODIGOS_SERVICIO_PUSH = ['AbortError', 'messaging/token-subscribe-failed', 'messaging/failed-service-worker-registration', 'NotSupportedError'];

// { titulo, pasos: [texto], detalle } o null si no hace falta una explicación aparte (se muestra el aviso general).
export function explicarFalloPush({ brave = false, detalle = '' } = {}) {
  const codigo = String(detalle || '');
  if (brave) {
    return {
      titulo: 'Brave no está dejando registrar este navegador para recibir avisos.',
      pasos: [
        'Escribe brave://settings/privacy en la barra de direcciones y presiona Enter.',
        'Activa "Usar los servicios de Google para la mensajería push".',
        'Cierra Brave por completo y vuelve a abrirlo (no basta con recargar la página).',
        'Entra a la app y pulsa "Reintentar".',
      ],
      detalle: codigo,
    };
  }
  if (CODIGOS_SERVICIO_PUSH.includes(codigo)) {
    return {
      titulo: 'El navegador no pudo conectarse al servicio de avisos de Google.',
      pasos: ['Revisa que tengas internet y que el navegador esté actualizado.', 'Cierra el navegador por completo, ábrelo de nuevo y pulsa "Reintentar".'],
      detalle: codigo,
    };
  }
  return null;
}

// ¿Es Brave? Brave se hace pasar por Chrome: solo lo delata navigator.brave (asíncrono). Sin eso, false.
export async function esBrave() {
  try { return Boolean(await navigator.brave?.isBrave?.()); } catch { return false; }
}
