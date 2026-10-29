import { useEffect, useState } from 'react';
import { BarChart, Cable, ClipboardCheck, ClipboardList, Coins, History, Home, Landmark, LogOut, Moon, Network, PackageCheck, PanelLeftClose, PanelLeftOpen, ShieldCheck, Sun, TrendingUp, User, Users, Wallet, X } from 'lucide-react';
import { ADMINISTRACION_ACTIVA } from '../constants';

const CLAVE_COLAPSADO = 'sidebar-colapsado';

const leerColapsado = () => { try { return localStorage.getItem(CLAVE_COLAPSADO) === '1'; } catch { return false; } };
const guardarColapsado = (valor) => { try { localStorage.setItem(CLAVE_COLAPSADO, valor ? '1' : '0'); } catch { /* sin almacenamiento: queda solo en esta sesión */ } };

// El menú lateral del administrador: todos los módulos de la app agrupados por tema. En pantallas grandes queda fijo a la izquierda (expandido o compacto, solo íconos, y recuerda
// cuál dejaste); en el celular es un panel que se abre con el botón ☰ del encabezado. Los de la oficina abren su ventana; Finanzas y Ventas abren su pantalla completa; Almacén es la
// misma pantalla de Materiales. "Envíos al inventario" solo sale para quien tiene ese acceso (`veInventario`).
//   acciones: { inicio, modulo(id) }: `inicio` vuelve a la oficina y `modulo(id)` abre el módulo (CIERRE, REPORTES, HISTORIAL, REVISION, ADMINISTRACION, FINANZAS, TASA, TECNICOS, USUARIOS, ALMACEN, INFRAESTRUCTURA, INVENTARIO o PROMOTORA) como página dentro del marco.
//   nombre, rol, isDarkMode, onCambiarTema, onSalir: el pie del menú (quién está conectado, el tema y cerrar sesión).
//   activo: el módulo que está a la vista ('oficina', 'revision', 'finanzas', 'almacen' o 'ventas'); los demás son ventanas que se abren encima.
export default function Sidebar({ acciones, veInventario = false, alertasInventario = 0, pagosPorCobrar = 0, abierto = false, activo = 'oficina', nombre = '', rol = '', isDarkMode = true, onCambiarTema, onSalir, onCerrar }) {
  const [colapsado, setColapsado] = useState(leerColapsado);
  const alternar = () => setColapsado((c) => { guardarColapsado(!c); return !c; });

  // En el celular el panel se cierra con Escape.
  useEffect(() => {
    if (!abierto) return undefined;
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abierto, onCerrar]);

  const grupos = [
    { titulo: 'Operación', items: [
      { id: 'oficina', Icono: Home, nombre: 'Panel principal', accion: acciones.inicio },
      { id: 'cierre', Icono: BarChart, nombre: 'Cierre', accion: () => acciones.modulo('CIERRE') },
      { id: 'reportes', Icono: ClipboardList, nombre: 'Reportes', accion: () => acciones.modulo('REPORTES') },
      { id: 'historial', Icono: History, nombre: 'Historial', accion: () => acciones.modulo('HISTORIAL') },
    ] },
    { titulo: 'Dinero', items: [
      { id: 'revision', Icono: ClipboardCheck, nombre: 'Revisión de órdenes', accion: () => acciones.modulo('REVISION') },
      ...(ADMINISTRACION_ACTIVA ? [{ id: 'administracion', Icono: Landmark, nombre: 'Administración', alertas: pagosPorCobrar, accion: () => acciones.modulo('ADMINISTRACION') }] : []),
      { id: 'finanzas', Icono: Wallet, nombre: 'Finanzas', accion: () => acciones.modulo('FINANZAS') },
      { id: 'tasa', Icono: Coins, nombre: 'Tasa y pagos', accion: () => acciones.modulo('TASA') },
    ] },
    { titulo: 'Equipo', items: [
      { id: 'tecnicos', Icono: Users, nombre: 'Técnicos', accion: () => acciones.modulo('TECNICOS') },
      { id: 'usuarios', Icono: ShieldCheck, nombre: 'Usuarios', accion: () => acciones.modulo('USUARIOS') },
    ] },
    { titulo: 'Inventario y ventas', items: [
      { id: 'almacen', Icono: Cable, nombre: 'Almacén', accion: () => acciones.modulo('ALMACEN') },
      ...(veInventario ? [{ id: 'inventario', Icono: PackageCheck, nombre: 'Envíos al inventario', alertas: alertasInventario, accion: () => acciones.modulo('INVENTARIO') }] : []),
      { id: 'infraestructura', Icono: Network, nombre: 'Infraestructura', accion: () => acciones.modulo('INFRAESTRUCTURA') },
      { id: 'ventas', Icono: TrendingUp, nombre: 'Ventas', accion: () => acciones.modulo('PROMOTORA') },
    ] },
  ];

  const abrir = (fn) => () => { onCerrar(); fn(); };

  return (
    <>
      {abierto && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onCerrar} aria-hidden="true" />}
      <aside
        aria-label="Módulos"
        className={`${abierto ? 'fixed inset-y-0 left-0 z-40 w-64 flex' : 'hidden'} lg:flex lg:sticky lg:top-0 lg:h-screen lg:z-20 lg:shrink-0 lg:transition-[width] lg:duration-200 ${colapsado ? 'lg:w-[4.5rem]' : 'lg:w-60'} flex-col bg-black text-white border-r border-zinc-800 overflow-hidden`}
      >
        <div className={`flex items-center justify-between px-3 h-[62px] shrink-0 border-b-4 border-red-600 ${colapsado ? 'lg:justify-center' : ''}`}>
          <button type="button" onClick={abrir(acciones.inicio)} title="Volver al dashboard principal" className={`font-black uppercase tracking-wide hover:text-red-500 transition-colors ${colapsado ? 'lg:hidden' : ''}`}>
            Asignaciones
          </button>
          <button
            type="button"
            onClick={alternar}
            aria-label={colapsado ? 'Expandir menú' : 'Contraer menú'}
            title={colapsado ? 'Expandir menú' : 'Contraer menú'}
            className="hidden lg:block p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            {colapsado ? <PanelLeftOpen className="w-4 h-4" aria-hidden="true" /> : <PanelLeftClose className="w-4 h-4" aria-hidden="true" />}
          </button>
          <button type="button" onClick={onCerrar} aria-label="Cerrar menú" className="p-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800 lg:hidden"><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>

        <nav className="flex-1 min-h-0 px-2 py-2 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]">
          {grupos.map((g) => (
            <section key={g.titulo} aria-label={g.titulo}>
              <h2 className={`px-3 pt-4 pb-1.5 text-[11px] max-lg:text-xs font-bold text-zinc-400 ${colapsado ? 'lg:hidden' : ''}`}>{g.titulo}</h2>
              {colapsado && <div className="hidden lg:block h-px bg-zinc-800 mx-2 my-3" aria-hidden="true" />}
              <ul className="flex flex-col gap-0.5">
                {g.items.map(({ id, Icono, nombre, alertas, accion }) => {
                  const actual = id === activo;
                  return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={abrir(accion)}
                      title={nombre}
                      aria-current={actual ? 'page' : undefined}
                      className={`relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${colapsado ? 'lg:justify-center lg:px-0' : ''} ${actual ? 'bg-red-600 text-white' : 'text-zinc-200 hover:bg-zinc-800'}`}
                    >
                      <Icono className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <span className={`truncate ${colapsado ? 'lg:hidden' : ''}`}>{nombre}</span>
                      {alertas > 0 && (
                        <span className={`min-w-[1.25rem] text-center rounded-full px-1.5 py-0.5 text-[11px] max-lg:text-xs font-black ${actual ? 'bg-white text-red-600' : 'bg-red-600 text-white'} ${colapsado ? 'lg:absolute lg:top-0.5 lg:right-2 lg:px-1' : 'ml-auto'}`}>{alertas}</span>
                      )}
                    </button>
                  </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <div className={`shrink-0 border-t border-zinc-800 p-3 flex items-center gap-2 ${colapsado ? 'lg:flex-col' : ''}`}>
          <span className={`shrink-0 w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 ${colapsado ? 'lg:hidden' : ''}`} title={nombre}><User className="w-4 h-4" aria-hidden="true" /></span>
          <div className={`min-w-0 flex-1 leading-tight ${colapsado ? 'lg:hidden' : ''}`}>
            <p className="truncate text-sm font-bold text-red-500">{nombre}</p>
            <p className="text-[11px] max-lg:text-xs font-bold text-zinc-400 uppercase tracking-wider">{rol}</p>
          </div>
          <button type="button" onClick={onCambiarTema} aria-label="Cambiar tema" title="Cambiar tema" className={`shrink-0 inline-flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ${colapsado ? 'lg:hidden' : ''}`}>
            {isDarkMode ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
          </button>
          <button type="button" onClick={onSalir} aria-label="Cerrar sesión" title="Cerrar sesión" className="shrink-0 inline-flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

      </aside>
    </>
  );
}
