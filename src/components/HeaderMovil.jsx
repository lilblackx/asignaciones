import { useEffect, useRef, useState } from 'react';
import { BarChart, ClipboardList, History, Landmark, LogOut, Menu, Moon, PackageCheck, Plus, Sun } from 'lucide-react';
import { ROLES } from '../constants';
import { logosDeTemporada } from '../utils/temporada';
import NotificationBell from './NotificationBell';

// El encabezado del celular (estilo D): sin barra negra. A la izquierda el logo y un saludo con el rol, a la derecha la campana, "Nuevo" (oficina) y
// la persona: un círculo con sus iniciales que abre el menú con el tema, las formas de pago, los módulos del menú y cerrar sesión.
// El administrador no lleva ese círculo: tiene todo eso en el menú lateral. En PC se usa el Header de siempre.
const ETIQUETA_ROL = { ADMIN: 'Administrador', USUARIO: 'Oficina', TECNICO: 'Técnico', ALMACEN: 'Almacén', PROMOTORA: 'Promotora', FINANZAS: 'Finanzas', INFRAESTRUCTURA: 'Infraestructura', ADMINISTRACION: 'Administración' };

const primerNombre = (nombre) => {
  const palabra = String(nombre || '').trim().split(/\s+/)[0] || '';
  return palabra ? palabra[0].toUpperCase() + palabra.slice(1).toLowerCase() : '';
};
const iniciales = (nombre) => String(nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';

const ITEM = 'w-full flex items-center gap-3 px-4 min-h-12 text-sm font-bold text-foreground hover:bg-secondary transition-colors';

export default function HeaderMovil({
  currentUser, currentUserName, role, canEditTickets, isDarkMode, setIsDarkMode,
  onOpenReports, onOpenReportes, onOpenHistory, veInventario = false, alertasInventario = 0, onOpenInventario, onOpenFormasPago,
  onOpenCreate, onOpenSidebar, canCerrar, handleLogout, preFinalizadoCount = 0, onOpenPreFinalizados, onOpenNotification, onGoHome, notifications,
}) {
  const isAdmin = role === ROLES.ADMIN;
  const isTecnico = role === ROLES.TECNICO;
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const logo = logosDeTemporada().login192;
  const nombre = currentUserName || currentUser;

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  const y = (fn) => () => { setAbierto(false); fn(); };

  return (
    <header className="lg:hidden sticky top-0 z-10 bg-background px-4 pt-3 pb-3 flex items-center gap-3">
      {isAdmin && (
        <button onClick={onOpenSidebar} aria-label="Abrir menú" className="relative shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-boton bg-card text-foreground shadow-card">
          <Menu className="w-5 h-5" aria-hidden="true" />
          {veInventario && alertasInventario > 0 && <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-primary border-2 border-card" aria-hidden="true" />}
        </button>
      )}
      <button type="button" onClick={onGoHome} aria-label="Volver al inicio" className="flex items-center gap-3 min-w-0 flex-1 text-left">
        {!isAdmin && <img src={logo} alt="" width="44" height="44" className="w-11 h-11 rounded-card shrink-0" />}
        <span className="min-w-0 leading-tight">
          <span className="block text-base font-black text-foreground truncate">{isAdmin ? 'Asignaciones' : `Hola, ${primerNombre(nombre)}`}</span>
          <span className="block text-xs font-bold text-muted-foreground truncate">{isAdmin ? primerNombre(nombre) : (ETIQUETA_ROL[role] || role)}</span>
        </span>
      </button>

      {(canEditTickets || isTecnico) && notifications && (
        <NotificationBell
          notifications={notifications.notifications}
          unreadCount={notifications.unreadCount}
          isOpen={notifications.isOpen}
          setIsOpen={notifications.setIsOpen}
          dismissNotification={notifications.dismissNotification}
          clearAll={notifications.clearAll}
          preFinalizadoCount={canEditTickets ? preFinalizadoCount : 0}
          onOpenPreFinalizados={canEditTickets ? onOpenPreFinalizados : undefined}
          onOpenNotification={onOpenNotification}
        />
      )}

      {canEditTickets && (
        <button onClick={onOpenCreate} aria-label="Nueva orden" className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-boton bg-primary hover:bg-primary-hover text-primary-foreground shadow-boton transition-colors">
          <Plus className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {!isAdmin && (
        <div className="relative shrink-0" ref={ref}>
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            aria-label="Mi cuenta y más acciones"
            aria-expanded={abierto}
            className="relative inline-flex items-center justify-center w-12 h-12 rounded-boton bg-foreground text-background text-sm font-black"
          >
            {iniciales(nombre)}
            {veInventario && alertasInventario > 0 && <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-primary border-2 border-background" aria-hidden="true" />}
          </button>
          {abierto && (
            <div className="absolute right-0 mt-2 w-64 bg-card rounded-card shadow-card border border-border overflow-hidden z-20 py-1.5">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className={ITEM}>
                {isDarkMode ? <Sun className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> : <Moon className="w-5 h-5 text-muted-foreground" aria-hidden="true" />}
                {isDarkMode ? 'Tema claro' : 'Tema oscuro'}
              </button>
              {isTecnico && onOpenFormasPago && (
                <button onClick={y(onOpenFormasPago)} className={ITEM}><Landmark className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Formas de pago</button>
              )}
              {canCerrar && (
                <>
                  <button onClick={y(onOpenReports)} className={ITEM}><BarChart className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Cierre</button>
                  <button onClick={y(onOpenReportes)} className={ITEM}><ClipboardList className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Reportes</button>
                  <button onClick={y(onOpenHistory)} className={ITEM}><History className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Historial</button>
                </>
              )}
              {veInventario && (
                <button onClick={y(onOpenInventario)} className={ITEM}>
                  <PackageCheck className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Envíos al inventario
                  {alertasInventario > 0 && <span className="ml-auto min-w-[1.25rem] text-center rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-xs font-black">{alertasInventario}</span>}
                </button>
              )}
              <div className="my-1 border-t border-border" />
              <button onClick={y(handleLogout)} className={`${ITEM} text-destructive`}><LogOut className="w-5 h-5" aria-hidden="true" /> Cerrar sesión</button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
