import { useEffect, useRef, useState } from 'react';
import { BarChart, ClipboardList, History, Landmark, LogOut, Menu, MoreVertical, Moon, PackageCheck, Plus, Sun } from 'lucide-react';
import { ROLES } from '../constants';
import NotificationBell from './NotificationBell';

export default function Header({
  currentUser,
  currentUserName,
  role,
  canEditTickets,
  isDarkMode,
  setIsDarkMode,
  onOpenReports,
  onOpenReportes,
  onOpenHistory,
  veInventario = false,
  alertasInventario = 0,
  onOpenInventario,
  onOpenFormasPago,
  onOpenCreate,
  onOpenSidebar,
  canCerrar,
  handleLogout,
  preFinalizadoCount = 0,
  onOpenPreFinalizados,
  onOpenNotification,
  onGoHome,
  notifications
}) {
  const isAdmin = role === ROLES.ADMIN;
  const isTecnico = role === ROLES.TECNICO;
  const showMenu = !isAdmin && (canCerrar || veInventario);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const runAndClose = (fn) => () => {
    fn();
    setMenuOpen(false);
  };

  return (
    <header className="bg-black/80 backdrop-blur-md text-white shadow-md sticky top-0 z-10 border-b-4 border-red-600 lg:h-[62px]">
      <div className="px-4 py-2 min-h-[60px] lg:min-h-0 lg:h-full flex justify-between items-center max-w-[1400px] mx-auto w-full">
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={onOpenSidebar} aria-label="Abrir menú" title="Menú" className="relative inline-flex items-center justify-center min-w-11 min-h-11 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors border border-zinc-700 lg:hidden">
              <Menu className="w-4 h-4" aria-hidden="true" />
              {veInventario && alertasInventario > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-600 border-2 border-black" aria-hidden="true" />}
            </button>
          )}
          <h1 className={`text-sm min-[400px]:text-base sm:text-xl font-black tracking-wide ${isAdmin ? 'lg:hidden' : ''}`}>
            <button
              type="button"
              onClick={onGoHome}
              title="Volver al dashboard principal"
              className="uppercase max-lg:inline-flex max-lg:items-center max-lg:min-h-11 hover:text-red-500 focus-visible:text-red-500 transition-colors"
            >
              ASIGNACIONES
            </button>
          </h1>
          {/* El administrador en PC no ve "ASIGNACIONES" (está en el menú lateral): el encabezado lleva el nombre de la pantalla, como los demás módulos. */}
          {isAdmin && (
            <h1 className="hidden lg:flex items-center gap-2 text-2xl font-black tracking-tight min-w-0">
              <span className="truncate">Panel principal</span>
            </h1>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-3">
          {/* El administrador tiene su nombre, el tema y cerrar sesión en el pie del menú lateral. */}
          {!isAdmin && (
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-bold leading-none text-red-500">{currentUserName || currentUser}</span>
              <span className="text-[11px] max-lg:text-xs font-bold text-zinc-400 uppercase tracking-wider">{role}</span>
            </div>
          )}

          {!isAdmin && (
            <button onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Cambiar tema" title="Cambiar Tema" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

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

          {/* El técnico no ve el menú de ADMIN: las formas de pago para pasarle al
              cliente (con botones para copiar cada dato) van en su propio botón. */}
          {isTecnico && onOpenFormasPago && (
            <button
              onClick={onOpenFormasPago}
              aria-label="Formas de pago"
              title="Formas de pago"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors border border-zinc-700 flex items-center gap-1.5 text-sm font-bold"
            >
              <Landmark className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">Pagos</span>
            </button>
          )}

          {/* Un solo menú desplegable (mismo en mobile y desktop) para no saturar
              la barra de íconos sueltos: Cierre, Reportes e Historial de quien puede cerrar. El administrador
              tiene todo en el menú lateral. */}
          {showMenu && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Más acciones"
                aria-expanded={menuOpen}
                title="Más acciones"
                className="relative p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors border border-zinc-700"
              >
                <MoreVertical className="w-4 h-4" />
                {veInventario && alertasInventario > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-600 border-2 border-black" aria-hidden="true" />}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-20">
                  {canCerrar && (
                    <>
                      <button onClick={runAndClose(onOpenReports)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-colors">
                        <BarChart className="w-4 h-4"aria-hidden="true" /> Cierre
                      </button>
                      <button onClick={runAndClose(onOpenReportes)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-colors border-t border-zinc-800">
                        <ClipboardList className="w-4 h-4" aria-hidden="true" /> Reportes
                      </button>
                      <button onClick={runAndClose(onOpenHistory)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-colors border-t border-zinc-800">
                        <History className="w-4 h-4"aria-hidden="true" /> Historial
                      </button>
                    </>
                  )}
                  {veInventario && (
                    <button onClick={runAndClose(onOpenInventario)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-colors border-t border-zinc-800">
                      <PackageCheck className="w-4 h-4" aria-hidden="true" /> Envíos al inventario
                      {alertasInventario > 0 && <span className="ml-auto min-w-[1.25rem] text-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] max-lg:text-xs font-black">{alertasInventario}</span>}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {canEditTickets && (
            <button onClick={onOpenCreate} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 max-lg:min-w-11 max-lg:min-h-11 max-lg:justify-center rounded-lg flex items-center gap-1 text-sm font-bold transition-colors">
              <Plus className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">Nuevo</span>
            </button>
          )}

          {!isAdmin && (
            <>
              <div className="w-px h-8 bg-zinc-800 hidden sm:block mx-1"></div>

              <button onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar Sesión" className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg flex items-center transition-colors border border-zinc-700">
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
