import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_NOTIFICATIONS = 50;
const STORAGE_PREFIX = 'asignaciones:notifications:';

function loadFromStorage(username) {
  if (!username) return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + username);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(username, notifications) {
  if (!username) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + username, JSON.stringify(notifications));
  } catch {
    // Storage lleno o bloqueado (modo privado, etc.): se pierde la persistencia, no la app.
  }
}

// Historial de notificaciones, persistido en localStorage por usuario — así
// sobrevive a un reload (común en mobile: el navegador recarga la pestaña sola
// al volver de segundo plano). El toast (useToast) avisa en el momento; esto
// es el registro para revisar después lo que ya pasó, aunque no lo hayan visto.
export function useNotifications(currentUser) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const loadedForUser = useRef(null);

  // currentUser llega después del primer render (recién resuelve el login), así
  // que la carga desde localStorage pasa en un efecto, no en el estado inicial.
  useEffect(() => {
    if (!currentUser || loadedForUser.current === currentUser) return;
    loadedForUser.current = currentUser;
    setNotifications(loadFromStorage(currentUser));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    saveToStorage(currentUser, notifications);
  }, [currentUser, notifications]);

  const addNotification = useCallback((notif) => {
    setNotifications(prev => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, read: false, timestamp: Date.now(), ...notif },
      ...prev
    ].slice(0, MAX_NOTIFICATIONS));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Click en una notificación puntual: se marca leída y se saca de la lista.
  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, isOpen, setIsOpen, addNotification, markAllRead, dismissNotification, clearAll };
}
