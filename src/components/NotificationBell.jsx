import { useEffect, useRef } from 'react';
import { contarPendientes } from '../hooks/useInsigniaApp';
import { Bell, CalendarCheck, CheckCheck, ChevronRight, Clock, Trash2, UserCog, Wrench, X } from 'lucide-react';

function tiempoRelativo(timestamp) {
  const diffMs = Date.now() - timestamp;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'justo ahora';
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

function iconoPara(type) {
  if (type === 'prefinalizado') return <Clock className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />;
  if (type === 'tecnicoStatus') return <UserCog className="w-4 h-4 text-purple-500 shrink-0" aria-hidden="true" />;
  if (type === 'aprobado') return <CheckCheck className="w-4 h-4 text-blue-500 shrink-0" aria-hidden="true" />;
  if (type === 'cierreAutomatico') return <CalendarCheck className="w-4 h-4 text-sky-500 shrink-0" aria-hidden="true" />;
  if (type === 'nuevaAsignacion') return <Wrench className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />;
  return <Bell className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />;
}

export default function NotificationBell({ notifications, unreadCount, isOpen, setIsOpen, dismissNotification, clearAll, preFinalizadoCount = 0, onOpenPreFinalizados }) {
  const ref = useRef(null);
  const hayPendientes = preFinalizadoCount > 0;
  // El icono no cambia de color: solo muestra un contador (el mismo que lleva la
  // insignia de la app instalada).
  const contador = contarPendientes(unreadCount, preFinalizadoCount);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  const handleToggle = () => setIsOpen(!isOpen);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={handleToggle}
        aria-label={`Notificaciones${contador > 0 ? ` (${contador} pendientes)` : ''}`}
        aria-expanded={isOpen}
        title="Notificaciones"
        className="relative p-2 rounded-lg transition-colors border bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {contador > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center leading-none">
            {contador > 9 ? '9+' : contador}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 max-w-none sm:w-80 sm:max-w-[90vw] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-20">
          <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-black text-white uppercase tracking-wide">Notificaciones</span>
            {notifications.length > 0 && (
              <button onClick={clearAll} aria-label="Borrar todas las notificaciones" title="Borrar todas" className="text-zinc-400 hover:text-red-400 transition-colors p-1 rounded hover:bg-zinc-800">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {hayPendientes && (
            <button
              onClick={() => { onOpenPreFinalizados?.(); setIsOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 border-b border-amber-500/30 transition-colors text-left"
            >
              <Clock className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
              <span className="text-xs font-bold text-amber-400 flex-1">
                {preFinalizadoCount} orden{preFinalizadoCount === 1 ? '' : 'es'} esperando aprobación
              </span>
              <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
            </button>
          )}

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                <CheckCheck className="w-5 h-5 text-zinc-600" aria-hidden="true" />
                Sin notificaciones todavía.
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => dismissNotification(n.id)}
                  title="Click para marcar como leída y quitar"
                  className={`w-full text-left px-4 py-3 border-t border-zinc-800 first:border-t-0 flex items-start gap-2.5 group hover:bg-zinc-800 transition-colors ${n.read ? '' : 'bg-zinc-800/60'}`}
                >
                  {iconoPara(n.type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-200 leading-snug">{n.text}</p>
                    <span className="text-[10px] text-zinc-500 font-medium">{tiempoRelativo(n.timestamp)}</span>
                  </div>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1 group-hover:hidden" aria-hidden="true" />}
                  <X className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5 hidden group-hover:block" aria-hidden="true" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
