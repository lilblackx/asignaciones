import { useEffect, useRef } from 'react';
import { contarPendientes } from '../hooks/useInsigniaApp';
import { usePresencia } from '../hooks/usePresencia';
import NumeroPulso from './NumeroPulso';
import { NIVELES } from './nivelesAviso';
import { Ban, Banknote, Bell, CalendarCheck, Car, CheckCheck, ChevronRight, Clock, Flag, HandCoins, HardHat, Landmark, MapPin, Star, Trash2, Undo2, UserCog, UserMinus, Wrench, X } from 'lucide-react';

function tiempoRelativo(timestamp) {
  const diffMs = Date.now() - timestamp;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'justo ahora';
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

// Cada tipo de aviso: su ícono y el nivel (el tono) con el que se pinta en un círculo suave, como los avisos de la app: atención (ámbar), info (azul), éxito (verde) o error (rojo).
const TIPOS = {
  prefinalizado: { Icono: Clock, nivel: 'atencion' },
  nuevaVenta: { Icono: Star, nivel: 'atencion', relleno: true },
  tecnicoStatus: { Icono: UserCog, nivel: 'info' },
  aprobado: { Icono: CheckCheck, nivel: 'info' },
  prioridad: { Icono: Flag, nivel: 'error', relleno: true },
  devuelto: { Icono: Undo2, nivel: 'error' },
  encamino: { Icono: Car, nivel: 'info' },
  llegada: { Icono: MapPin, nivel: 'exito' },
  pagoCliente: { Icono: Landmark, nivel: 'exito' },
  pagoTecnico: { Icono: Banknote, nivel: 'exito' },
  ajusteTecnico: { Icono: HandCoins, nivel: 'atencion' },
  descuentoTecnico: { Icono: HandCoins, nivel: 'atencion' },
  adelantoTecnico: { Icono: HandCoins, nivel: 'info' },
  consultaCobro: { Icono: Banknote, nivel: 'atencion' },
  respuestaCobro: { Icono: Banknote, nivel: 'info' },
  infraestructura: { Icono: HardHat, nivel: 'atencion' },
  cancelada: { Icono: Ban, nivel: 'error' },
  desasignada: { Icono: UserMinus, nivel: 'error' },
  cierreAutomatico: { Icono: CalendarCheck, nivel: 'info' },
  nuevaAsignacion: { Icono: Wrench, nivel: 'exito' },
};

function iconoPara(type) {
  const t = TIPOS[type];
  if (!t) return <span className="shrink-0 w-8 h-8 rounded-full bg-secondary text-muted-foreground inline-flex items-center justify-center" aria-hidden="true"><Bell className="w-4 h-4" /></span>;
  const { Icono, nivel, relleno } = t;
  return (
    <span className={`shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center ${NIVELES[nivel].tile}`} aria-hidden="true">
      <Icono className={`w-4 h-4 ${relleno ? 'fill-current' : ''}`} />
    </span>
  );
}

export default function NotificationBell({ notifications, unreadCount, isOpen, setIsOpen, dismissNotification, clearAll, preFinalizadoCount = 0, onOpenPreFinalizados, onOpenNotification }) {
  const ref = useRef(null);
  const { montado, saliendo } = usePresencia(isOpen, 120);
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
        className="relative inline-flex items-center justify-center p-2 max-lg:min-w-12 max-lg:min-h-12 rounded-boton transition-colors border bg-card hover:bg-secondary text-foreground border-transparent shadow-card"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {contador > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[11px] max-lg:text-xs font-black rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center leading-none">
            <NumeroPulso valor={contador > 9 ? '9+' : contador} />
          </span>
        )}
      </button>

      {montado && (
        <div className={`fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 max-w-none sm:w-96 sm:max-w-[92vw] bg-card border border-border rounded-card shadow-2xl overflow-hidden z-20 ${saliendo ? 'animate-menu-salida pointer-events-none' : 'animate-menu-entrada'}`}>
          <div className="px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-black text-foreground">Notificaciones</span>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                aria-label="Borrar todas las notificaciones"
                title="Borrar todas"
                className="relative inline-flex items-center gap-1.5 px-3 h-8 rounded-boton border border-input text-xs font-bold text-foreground hover:bg-secondary transition-colors max-lg:after:absolute max-lg:after:-inset-x-1 max-lg:after:-inset-y-2"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Borrar todas
              </button>
            )}
          </div>

          {hayPendientes && (
            <div className="px-2 pb-1">
              <button
                onClick={() => { onOpenPreFinalizados?.(); setIsOpen(false); }}
                className="w-full min-h-11 flex items-center gap-2.5 px-3 py-2 rounded-campo border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors text-left"
              >
                <Clock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden="true" />
                <span className="text-sm font-black text-amber-900 dark:text-amber-200 flex-1">
                  {preFinalizadoCount} orden{preFinalizadoCount === 1 ? '' : 'es'} esperando aprobación
                </span>
                <ChevronRight className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto px-2 pb-2">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center flex flex-col items-center gap-2">
                <span className="w-10 h-10 rounded-full bg-secondary text-muted-foreground inline-flex items-center justify-center" aria-hidden="true"><CheckCheck className="w-5 h-5" /></span>
                <p className="text-sm font-bold text-foreground">{hayPendientes ? 'Sin avisos nuevos' : 'Estás al día'}</p>
                <p className="text-xs text-muted-foreground">{hayPendientes ? 'Lo que espera aprobación está arriba.' : 'No hay notificaciones todavía.'}</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {notifications.map(n => (
                  // La fila son dos botones hermanos: el texto lleva a la orden y quita el aviso; la X solo lo quita (una X dentro del botón de la fila también lo activaba).
                  <li key={n.id} className={`flex items-stretch rounded-campo hover:bg-secondary transition-colors ${n.read ? '' : 'bg-secondary/60'}`}>
                    <button
                      type="button"
                      onClick={() => { dismissNotification(n.id); setIsOpen(false); onOpenNotification?.(n); }}
                      title="Click para ir a la orden y quitar la notificación"
                      className="min-w-0 flex-1 text-left pl-2.5 pr-1 py-2.5 flex items-start gap-3 rounded-campo focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
                    >
                      {iconoPara(n.type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground leading-snug">{n.text}</p>
                        <span className="text-xs text-muted-foreground font-medium">{tiempoRelativo(n.timestamp)}</span>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-500 shrink-0 mt-2" aria-label="Sin leer" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissNotification(n.id)}
                      aria-label="Quitar esta notificación"
                      title="Quitar sin abrir la orden"
                      className="shrink-0 px-2.5 max-lg:min-w-11 flex items-center justify-center rounded-campo text-muted-foreground hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
