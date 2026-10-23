import { lazy, Suspense, useState } from 'react';
import { LogOut, Menu, Moon, Plus, Sun } from 'lucide-react';
import { ID_ACCIONES_ENCABEZADO } from './AccionesEncabezado';

const ConfirmModal = lazy(() => import('./modals/ConfirmModal'));

// Encabezado de las pantallas de solo lectura (almacén y promotora): mismo estilo que el de la app, sin menú ni
// acciones de edición. Cerrar sesión pide confirmación, como en el resto de la app.
// `tituloCorto` (opcional): el título para pantallas muy angostas.
// `accion` (opcional): el botón rojo con "+" del encabezado de la app ({ texto, onClick, deshabilitado, ayuda }; `ayuda` es el nombre completo para el tooltip y los lectores); en celular solo el "+".
// `contexto` (opcional): una línea de contexto bajo el título, solo en PC (p. ej. la última actualización).
// Las acciones principales del módulo en PC van en el lugar que deja AccionesEncabezado, a la derecha del título.
// `onAbrirMenu` (opcional): el botón ☰ que abre el menú lateral en el celular (el administrador que está en este módulo dentro del menú lateral).
export default function EncabezadoSimple({ titulo, tituloCorto = null, icono: Icono, nombre, rol, isDarkMode, setIsDarkMode, handleLogout, accion = null, onAbrirMenu = null, contexto = '' }) {
  const [confirmando, setConfirmando] = useState(false);
  // Dentro del menú lateral del administrador (`onAbrirMenu`), su nombre, el tema y cerrar sesión están en el pie de ese menú.
  const enMarco = !!onAbrirMenu;

  return (
    <>
      <header className="bg-black/80 backdrop-blur-md text-white shadow-md sticky top-0 z-10 border-b-2 border-red-600 lg:h-[62px]">
        <div className="px-4 py-2 min-h-[60px] lg:min-h-0 lg:h-full flex justify-between items-center gap-2 max-w-[1400px] mx-auto w-full">
          {onAbrirMenu && (
            <button type="button" onClick={onAbrirMenu} aria-label="Abrir menú" title="Menú" className="shrink-0 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors border border-zinc-700 lg:hidden">
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0 shrink">
            <h1 className={`min-w-0 shrink flex items-center gap-2 text-sm min-[400px]:text-base sm:text-xl font-black tracking-wide${contexto ? ' lg:text-lg lg:leading-tight' : ''}`}>
              {Icono && <Icono className="hidden min-[360px]:block w-5 h-5 shrink-0 text-red-500" aria-hidden="true" />}
              {/* `tituloCorto`: en pantallas de menos de 400 px el título largo no cabe junto a los botones. */}
              <span className="truncate">{tituloCorto ? <><span className="min-[400px]:hidden">{tituloCorto}</span><span className="hidden min-[400px]:inline">{titulo}</span></> : titulo}</span>
            </h1>
            {contexto && <p className="hidden lg:block text-[11px] leading-none mt-0.5 text-zinc-400 truncate">{contexto}</p>}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div id={ID_ACCIONES_ENCABEZADO} className="hidden lg:contents" />
            {!enMarco && <div className="hidden min-[400px]:flex flex-col items-end leading-tight min-w-0">
              <span className="text-xs sm:text-sm font-bold leading-none text-red-500 max-w-[8rem] sm:max-w-[16rem] truncate">{nombre}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{rol}</span>
            </div>}
            {!enMarco && <button onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Cambiar tema" title="Cambiar Tema" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors border border-zinc-700">
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>}
            {accion && (
              <button onClick={accion.onClick} disabled={accion.deshabilitado} aria-label={accion.ayuda || accion.texto} title={accion.ayuda || accion.texto} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600">
                <Plus className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">{accion.texto}</span>
              </button>
            )}
            {!enMarco && (
              <>
                <div className="w-px h-8 bg-zinc-800 hidden sm:block mx-1"></div>
                <button onClick={() => setConfirmando(true)} aria-label="Cerrar sesión" title="Cerrar Sesión" className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg flex items-center transition-colors border border-zinc-700">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {confirmando && (
        <Suspense fallback={null}>
          <ConfirmModal
            color="red"
            title="¿Cerrar Sesión?"
            description="Deberás volver a ingresar tu usuario y clave para continuar."
            confirmLabel="Sí, Salir"
            zIndexClass="z-[70]"
            onCancel={() => setConfirmando(false)}
            onConfirm={handleLogout}
          />
        </Suspense>
      )}
    </>
  );
}
