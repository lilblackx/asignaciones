import { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Moon, Sun, User } from 'lucide-react';
import { stripEmojis } from '../utils/sanitizeInput';

const inputClass = 'w-full h-12 bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white pl-11 rounded-xl focus:border-red-600 focus:ring-4 focus:ring-red-600/15 outline-none transition-colors';

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
      <div className="relative min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans transition-colors duration-200 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-red-600/15 to-transparent dark:from-red-600/25" aria-hidden="true" />
        <div className="absolute top-4 right-4 z-10">
          <button onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Cambiar tema" className="p-2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full border border-zinc-300 dark:border-zinc-800 overflow-hidden transition-colors duration-200">
          <div className="bg-black px-6 pt-7 pb-5 border-b-2 border-red-600 text-center">
            <img src="/icon-192x192.png" alt="Network Speed" width="88" height="88" className="mx-auto w-22 h-22 rounded-2xl ring-1 ring-white/10 shadow-lg shadow-red-600/20" />
            <h1 className="mt-4 text-xl font-black text-white uppercase tracking-wide">Control de Asignaciones</h1>
            <p className="mt-1 text-zinc-400 text-sm">Ingrese su usuario y clave para continuar.</p>
          </div>

          <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-5">
            <div>
              <label htmlFor="login-usuario" className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Usuario</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" aria-hidden="true" />
                <input id="login-usuario" type="text" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`${inputClass} pr-4`} value={loginData.usuario} onChange={e => setLoginData({ ...loginData, usuario: stripEmojis(e.target.value) })} />
              </div>
            </div>
            <div>
              <label htmlFor="login-clave" className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Clave de Acceso</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" aria-hidden="true" />
                <input id="login-clave" type={verClave ? 'text' : 'password'} required autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`${inputClass} pr-12`} value={loginData.clave} onChange={e => setLoginData({ ...loginData, clave: stripEmojis(e.target.value) })} placeholder="******" />
                <button type="button" onClick={() => setVerClave(v => !v)} aria-label={verClave ? 'Ocultar clave' : 'Mostrar clave'} aria-pressed={verClave} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                  {verClave ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                </button>
              </div>
            </div>
            {loginError && (
              <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3 rounded-xl border border-red-300 dark:border-red-500/40 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" /> {loginError}
              </div>
            )}
            <button type="submit" disabled={isSubmitting} className={`w-full h-12 flex items-center justify-center gap-2 text-white font-bold rounded-xl shadow-md transition-colors ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'Ingresando...' : 'Ingresar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
