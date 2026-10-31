import { useState } from 'react';
import { AlertCircle, Loader2, Moon, Sun } from 'lucide-react';
import { stripEmojis } from '../utils/sanitizeInput';
import PieVersion from './PieVersion';

// Campos de 48 px (el dedo) y borde que se distingue del fondo en los dos temas (3:1). Con el contorno quitado, el foco se ve por el borde rojo y el aro.
const inputClass = 'w-full h-12 px-3 bg-white dark:bg-zinc-950 border-2 border-zinc-500 text-zinc-900 dark:text-white text-base rounded-md focus:border-red-600 focus-visible:ring-4 focus-visible:ring-red-600/30 outline-none';
const labelClass = 'block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1.5';

export default function LoginScreen({ isDarkMode, setIsDarkMode, loginData, setLoginData, loginError, handleLogin }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verClave, setVerClave] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await handleLogin(e);
    setIsSubmitting(false);
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      {/* En PC son dos mitades: la marca a la izquierda (siempre sobre negro, es el color de la marca) y el formulario a la derecha.
          En celular la marca queda arriba del formulario. */}
      <div className="relative min-h-dvh bg-fondo font-sans flex flex-col lg:flex-row">
        <button
          type="button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          aria-label="Cambiar tema"
          className="absolute top-3 right-3 z-10 w-11 h-11 flex items-center justify-center rounded-md border border-zinc-400 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          {isDarkMode ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
        </button>

        <header className="px-6 pt-20 sm:px-8 lg:w-1/2 lg:flex lg:flex-col lg:justify-between lg:px-16 lg:py-14 lg:bg-black lg:border-r-8 lg:border-red-600">
          <div className="flex items-center gap-4 lg:hidden">
            <img src="/icon-192x192.png" alt="Network Speed" width="64" height="64" className="w-16 h-16 rounded-xl" />
            <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">Network Speed Fibra</p>
          </div>
          <div className="hidden lg:block" aria-hidden="true" />
          {/* Solo PC: el ícono grande de la marca (512 px, con su textura de ondas de fibra) con los bordes difuminados para que se funda con el negro del panel, sin caja. */}
          <div className="hidden lg:block -ml-6">
            <img
              src="/icon-512x512.png"
              alt="Network Speed"
              width="512"
              height="512"
              className="w-[min(36vw,52vh,520px)] h-auto"
              style={{ WebkitMaskImage: 'radial-gradient(closest-side, #000 62%, transparent 100%)', maskImage: 'radial-gradient(closest-side, #000 62%, transparent 100%)' }}
            />
          </div>
          <div>
            <h1 className="mt-6 lg:mt-0 text-3xl sm:text-4xl lg:text-6xl font-black leading-[1.05] tracking-tight text-zinc-950 dark:text-white lg:text-white">
              Control de<br />Asignaciones
            </h1>
            {/* La línea roja del encabezado de la app, gruesa. En PC es el borde entre las dos mitades. */}
            <div className="mt-6 h-1.5 bg-red-600 lg:hidden" aria-hidden="true" />
          </div>
        </header>

        <main className="flex-1 flex flex-col lg:w-1/2 lg:bg-white dark:lg:bg-zinc-900">
          <div className="flex-1 w-full max-w-md mx-auto px-6 pt-8 pb-10 sm:px-8 lg:max-w-sm lg:px-0 lg:pt-0 lg:flex lg:flex-col lg:justify-center">
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-usuario" className={labelClass}>Usuario</label>
                <input
                  id="login-usuario"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-describedby={loginError ? 'login-error' : undefined}
                  className={inputClass}
                  value={loginData.usuario}
                  onChange={e => setLoginData({ ...loginData, usuario: stripEmojis(e.target.value) })}
                />
              </div>
              <div>
                <label htmlFor="login-clave" className={labelClass}>Clave</label>
                <div className="relative">
                  <input
                    id="login-clave"
                    type={verClave ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-describedby={loginError ? 'login-error' : undefined}
                    className={`${inputClass} pr-24`}
                    value={loginData.clave}
                    onChange={e => setLoginData({ ...loginData, clave: stripEmojis(e.target.value) })}
                  />
                  <button
                    type="button"
                    onClick={() => setVerClave(v => !v)}
                    aria-pressed={verClave}
                    className="absolute inset-y-0 right-0 min-w-11 px-4 rounded-r-md text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {verClave ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>
              {loginError && (
                <div id="login-error" role="alert" className="flex items-start gap-2 p-3 rounded-md border-2 border-red-700 bg-red-50 dark:bg-red-950/40 text-sm font-medium text-red-800 dark:text-red-200">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-md bg-red-600 hover:bg-red-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white text-base font-black"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
          <PieVersion />
        </main>
      </div>
    </div>
  );
}
