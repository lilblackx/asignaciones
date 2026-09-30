import { useEffect, useRef, useState } from 'react';
import { BarChart, Coins, History, LogOut, MoreVertical, Moon, Plus, ShieldCheck, Sun, Users } from 'lucide-react';
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
  onOpenHistory,
  onOpenTechnicians,
  onOpenUsers,
  onOpenTasa,
  onOpenCreate,
  canCerrar,
  handleLogout,
  preFinalizadoCount = 0,
  onOpenPreFinalizados,
  onGoHome,
  notifications
}) {
  const isAdmin = role === ROLES.ADMIN;
  const isTecnico = role === ROLES.TECNICO;
  const showMenu = isAdmin || canCerrar;
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
    <header className="bg-black text-white shadow-md sticky top-0 z-10 border-b-2 border-red-600">
      <div className="px-4 py-3 flex justify-between items-center max-w-[1400px] mx-auto w-full">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-xl font-black tracking-wide">
            <button
              type="button"
              onClick={onGoHome}
              title="Volver al dashboard principal"
              className="uppercase hover:text-red-500 focus-visible:text-red-500 transition-colors"
            >
              ASIGNACIONES
            </button>
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-bold leading-none text-red-500">{currentUserName || currentUser}</span>
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{role}</span>
          </div>

          <button onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Cambiar tema" title="Cambiar Tema" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
            />
          )}

          {/* Un solo menú desplegable (mismo en mobile y desktop) para no saturar
              la barra de íconos sueltos: Reportes + herramientas de ADMIN. */}
          {showMenu && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Más acciones"
                aria-expanded={menuOpen}
                title="Más acciones"
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors border border-zinc-700"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-20">
                  <button onClick={runAndClose(onOpenReports)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-colors">
                    <BarChart className="w-4 h-4"aria-hidden="true" /> Reportes
                  </button>
                  <button onClick={runAndClose(onOpenHistory)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-colors border-t border-zinc-800">
                    <History className="w-4 h-4"aria-hidden="true" /> Historial
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={runAndClose(onOpenTechnicians)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-colors border-t border-zinc-800">
                        <Users className="w-4 h-4" aria-hidden="true" /> Técnicos
                      </button>
                      <button onClick={runAndClose(onOpenUsers)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-colors border-t border-zinc-800">
                        <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Usuarios
                      </button>
                      <button onClick={runAndClose(onOpenTasa)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-colors border-t border-zinc-800">
                        <Coins className="w-4 h-4"aria-hidden="true" /> Tasa
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {canEditTickets && (
            <button onClick={onOpenCreate} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-bold transition-colors">
              <Plus className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">Nuevo</span>
            </button>
          )}

          <div className="w-px h-8 bg-zinc-800 hidden sm:block mx-1"></div>

          <button onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar Sesión" className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg flex items-center transition-colors border border-zinc-700">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
