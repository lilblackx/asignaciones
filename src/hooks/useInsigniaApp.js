import { useEffect } from 'react';

// Lo que hay por atender: notificaciones sin leer u órdenes esperando aprobación
// (el mayor de los dos, porque una orden pre-finalizada genera ambas cosas).
export const contarPendientes = (sinLeer, porAprobar) => Math.max(sinLeer, porAprobar);

// Insignia con el contador sobre el icono de la app instalada (PWA), igual que la
// campana. Badging API: Chrome, Edge y Brave en escritorio y Android. Donde no
// existe (o la app no está instalada) simplemente no hace nada. Con 0 la quita.
export function useInsigniaApp(contador) {
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const aplicar = contador > 0 ? navigator.setAppBadge(contador) : navigator.clearAppBadge();
    aplicar?.catch(() => {});
  }, [contador]);
}
