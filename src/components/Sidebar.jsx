import { useEffect, useRef, useState } from 'react';
import { BarChart, Cable, ChevronsLeft, ChevronsRight, ClipboardCheck, ClipboardList, Coins, History, Home, Landmark, LocateFixed, LogOut, MonitorSmartphone, Moon, Network, PackageCheck, Settings, ShieldCheck, Sun, TrendingUp, Users, Wallet, X } from 'lucide-react';
import { ADMINISTRACION_ACTIVA } from '../constants';
import { logosDeTemporada } from '../utils/temporada';

const CLAVE_COLAPSADO = 'sidebar-colapsado';
// Los botones del pie (tema y cerrar sesión): cuadrados redondeados con su propio fondo y borde, no iconos sueltos.
const BOTON_PIE = 'shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-boton bg-card text-muted-foreground hover:text-foreground hover:bg-accent shadow-card transition-colors';

const leerColapsado = () => { try { return localStorage.getItem(CLAVE_COLAPSADO) === '1'; } catch { return false; } };
const guardarColapsado = (valor) => { try { localStorage.setItem(CLAVE_COLAPSADO, valor ? '1' : '0'); } catch { /* sin almacenamiento: queda solo en esta sesión */ } };

// El menú lateral del administrador: todos los módulos de la app agrupados por tema. En pantallas grandes queda fijo a la izquierda (expandido o compacto, solo íconos, y recuerda
// cuál dejaste); en el celular es un panel que se abre con el botón ☰ del encabezado. Los de la oficina abren su ventana; Finanzas y Ventas abren su pantalla completa; Almacén es la
// misma pantalla de Materiales. "Envíos al inventario" solo sale para quien tiene ese acceso (`veInventario`).
//   acciones: { inicio, modulo(id) }: `inicio` vuelve a la oficina y `modulo(id)` abre el módulo (CIERRE, REPORTES, HISTORIAL, REVISION, ADMINISTRACION, FINANZAS, TASA, TECNICOS, USUARIOS, ALMACEN, INFRAESTRUCTURA, INVENTARIO o PROMOTORA) como página dentro del marco.
//   nombre, rol, isDarkMode, onCambiarTema, onSalir: el pie del menú (quién está conectado, el tema y cerrar sesión).
//   activo: el módulo que está a la vista ('oficina', 'revision', 'finanzas', 'almacen' o 'ventas'); los demás son ventanas que se abren encima.
export default function Sidebar({ acciones, veInventario = false, veEstaciones = false, veUbicacion = false, alertasInventario = 0, abierto = false, activo = 'oficina', nombre = '', rol = '', isDarkMode = true, onCambiarTema, onSalir, onCerrar }) {
  const [colapsado, setColapsado] = useState(leerColapsado);
  // El logo de Navidad solo en el menú (y en el login), por fechas; el ícono de la app instalada no cambia (ver utils/temporada).
  const logos = logosDeTemporada();
  // Si la lista de módulos no cabe, un degradado sobre el pie avisa de que sigue hacia abajo (se quita al llegar al final).
  const listaRef = useRef(null);
  const [masAbajo, setMasAbajo] = useState(false);
  const medirLista = () => { const e = listaRef.current; if (e) setMasAbajo(e.scrollHeight - e.scrollTop - e.clientHeight > 4); };
  useEffect(() => {
    const e = listaRef.current;
    if (!e || typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(() => medirLista());
    obs.observe(e);
    if (e.firstElementChild) obs.observe(e.firstElementChild);
    return () => obs.disconnect();
  }, [colapsado, abierto, veInventario, veEstaciones, veUbicacion]);

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
      ...(ADMINISTRACION_ACTIVA ? [{ id: 'administracion', Icono: Landmark, nombre: 'Administración', accion: () => acciones.modulo('ADMINISTRACION') }] : []),
      { id: 'finanzas', Icono: Wallet, nombre: 'Finanzas', accion: () => acciones.modulo('FINANZAS') },
      { id: 'tasa', Icono: Coins, nombre: 'Tasa y pagos', accion: () => acciones.modulo('TASA') },
    ] },
    { titulo: 'Equipo', items: [
      { id: 'tecnicos', Icono: Users, nombre: 'Técnicos', accion: () => acciones.modulo('TECNICOS') },
      { id: 'usuarios', Icono: ShieldCheck, nombre: 'Usuarios', accion: () => acciones.modulo('USUARIOS') },
      ...(veUbicacion ? [{ id: 'ubicacion', Icono: LocateFixed, nombre: 'Ubicación', accion: () => acciones.modulo('UBICACION') }] : []),
      ...(veEstaciones ? [{ id: 'estaciones', Icono: MonitorSmartphone, nombre: 'Estaciones', accion: () => acciones.modulo('ESTACIONES') }] : []),
    ] },
    { titulo: 'Inventario y ventas', items: [
      { id: 'almacen', Icono: Cable, nombre: 'Almacén', accion: () => acciones.modulo('ALMACEN') },
      ...(veInventario ? [{ id: 'inventario', Icono: PackageCheck, nombre: 'Envíos al inventario', alertas: alertasInventario, accion: () => acciones.modulo('INVENTARIO') }] : []),
      { id: 'infraestructura', Icono: Network, nombre: 'Infraestructura', accion: () => acciones.modulo('INFRAESTRUCTURA') },
      { id: 'ventas', Icono: TrendingUp, nombre: 'Ventas', accion: () => acciones.modulo('PROMOTORA') },
    ] },
    { titulo: 'Sistema', items: [
      { id: 'configuracion', Icono: Settings, nombre: 'Configuración', accion: () => acciones.modulo('CONFIGURACION') },
    ] },
  ];

  const abrir = (fn) => () => { onCerrar(); fn(); };

  return (
    <>
      {abierto && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onCerrar} aria-hidden="true" />}
      <aside
        aria-label="Módulos"
        className={`${abierto ? 'fixed inset-y-0 left-0 z-40 w-64 flex' : 'hidden'} lg:flex lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:m-4 lg:rounded-card lg:z-20 lg:shrink-0 lg:transition-[width] lg:duration-200 ${colapsado ? 'lg:w-[4.5rem]' : 'lg:w-60'} flex-col bg-card max-lg:rounded-r-card shadow-card max-lg:overflow-hidden text-foreground overflow-hidden`}
      >
        <div className={`flex items-center justify-between gap-2 px-3 h-16 shrink-0 border-b border-border text-foreground ${colapsado ? 'lg:flex-col lg:justify-center lg:h-auto lg:gap-1 lg:px-2 lg:pt-4 lg:pb-3' : ''}`}>
          <button type="button" onClick={abrir(acciones.inicio)} title="Volver al dashboard principal" aria-label="Network Speed: volver al dashboard principal" className="flex items-center min-w-0 rounded-boton hover:opacity-80 transition-opacity">
            <span className="flex items-center gap-2.5 min-w-0"><img src={logos.login192} alt="" width="40" height="40" className="w-10 h-10 rounded-campo shrink-0" /><span className={`min-w-0 text-left leading-tight ${colapsado ? 'lg:hidden' : ''}`}><span className="block text-sm font-black text-foreground truncate">Network Speed</span><span className="block text-xs text-muted-foreground truncate">Asignaciones</span></span></span>
          </button>
          <button
            type="button"
            onClick={alternar}
            aria-label={colapsado ? 'Expandir menú' : 'Contraer menú'}
            title={colapsado ? 'Expandir menú' : 'Contraer menú'}
            className="hidden lg:flex shrink-0 items-center justify-center w-7 h-7 rounded-boton text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {colapsado ? <ChevronsRight className="w-4 h-4" aria-hidden="true" /> : <ChevronsLeft className="w-4 h-4" aria-hidden="true" />}
          </button>
          <button type="button" onClick={onCerrar} aria-label="Cerrar menú" className="relative flex items-center justify-center p-1.5 rounded-boton after:absolute after:-inset-2 text-muted-foreground hover:bg-accent lg:hidden"><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>

        <div className="relative flex-1 min-h-0 flex flex-col">
        <nav ref={listaRef} onScroll={medirLista} className="flex-1 min-h-0 px-2 py-2 overflow-y-auto overflow-x-hidden lista-menu">
          {grupos.map((g) => (
            <section key={g.titulo} aria-label={g.titulo}>
              <h2 className={`px-3 pt-3 pb-1 text-[11px] max-lg:text-xs font-bold text-muted-foreground ${colapsado ? 'lg:hidden' : ''}`}>{g.titulo}</h2>
              {colapsado && <div className="hidden lg:block h-px bg-zinc-300 dark:bg-zinc-800 mx-2 my-3" aria-hidden="true" />}
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
                      className={`relative w-full flex items-center gap-3 rounded-boton px-3 py-1.5 max-lg:py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${colapsado ? 'lg:justify-center lg:px-0' : ''} ${actual ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200 font-black' : 'text-foreground hover:bg-secondary'}`}
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
        <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent transition-opacity duration-200 ${masAbajo ? 'opacity-100' : 'opacity-0'}`} />
        </div>

        {/* El pie es una tarjeta redondeada que flota dentro del menú (como las demás tarjetas de la app), no una franja recta. */}
        <div className="shrink-0 p-2">
          <div className={`rounded-campo border border-border bg-secondary p-2 flex items-center gap-2 ${colapsado ? 'lg:flex-col lg:p-1.5' : ''}`}>
            <div className={`min-w-0 flex-1 leading-tight ${colapsado ? 'lg:hidden' : ''}`}>
              <p className="truncate text-sm font-bold text-foreground">{nombre}</p>
              <p className="flex items-center gap-1.5 text-[11px] max-lg:text-xs font-bold text-muted-foreground uppercase tracking-wider" title={`${nombre} · conectado`}><span className="w-2 h-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />{rol}</p>
            </div>
            <button type="button" onClick={onCambiarTema} aria-label="Cambiar tema" title="Cambiar tema" className={BOTON_PIE}>
              {isDarkMode ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
            </button>
            <button type="button" onClick={onSalir} aria-label="Cerrar sesión" title="Cerrar sesión" className={BOTON_PIE}>
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

      </aside>
    </>
  );
}
