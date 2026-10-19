import { lazy, Suspense, useState } from 'react';
import { LogOut, Moon, Plus, Sun } from 'lucide-react';

const ConfirmModal = lazy(() => import('./modals/ConfirmModal'));

// Encabezado de las pantallas de solo lectura (almacén y promotora): mismo estilo que el de la app, sin menú ni
// acciones de edición. Cerrar sesión pide confirmación, como en el resto de la app.
// `tituloCorto` (opcional): el título para pantallas muy angostas.
// `accion` (opcional): el botón rojo con "+" del encabezado de la app ({ texto, onClick, deshabilitado, ayuda }; `ayuda` es el nombre completo para el tooltip y los lectores); en celular solo el "+".
export default function EncabezadoSimple({ titulo, tituloCorto = null, icono: Icono, nombre, rol, isDarkMode, setIsDarkMode, handleLogout, accion = null }) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <header className="bg-black text-white shadow-md sticky top-0 z-10 border-b-2 border-red-600">
        <div className="px-4 py-3 flex justify-between items-center gap-2 max-w-[1400px] mx-auto w-full">
          <h1 className="min-w-0 shrink flex items-center gap-2 text-sm min-[400px]:text-base sm:text-xl font-black tracking-wide uppercase">
            {Icono && <Icono className="hidden min-[360px]:block w-5 h-5 shrink-0 text-red-500" aria-hidden="true" />}
            {/* `tituloCorto`: en pantallas de menos de 400 px el título largo no cabe junto a los botones. */}
            <span className="truncate">{tituloCorto ? <><span className="min-[400px]:hidden">{tituloCorto}</span><span className="hidden min-[400px]:inline">{titulo}</span></> : titulo}</span>
          </h1>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="hidden min-[400px]:flex flex-col items-end leading-tight min-w-0">
              <span className="text-xs sm:text-sm font-bold leading-none text-red-500 max-w-[8rem] sm:max-w-[16rem] truncate">{nombre}</span>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{rol}</span>
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Cambiar tema" title="Cambiar Tema" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors border border-zinc-700">
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {accion && (
              <button onClick={accion.onClick} disabled={accion.deshabilitado} aria-label={accion.ayuda || accion.texto} title={accion.ayuda || accion.texto} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600">
                <Plus className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">{accion.texto}</span>
              </button>
            )}
            <div className="w-px h-8 bg-zinc-800 hidden sm:block mx-1"></div>
            <button onClick={() => setConfirmando(true)} aria-label="Cerrar sesión" title="Cerrar Sesión" className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg flex items-center transition-colors border border-zinc-700">
              <LogOut className="w-4 h-4" />
            </button>
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
