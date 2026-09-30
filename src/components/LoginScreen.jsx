import { useState } from 'react';
import { AlertCircle, Lock, Moon, Sun } from 'lucide-react';
import { stripEmojis } from '../utils/sanitizeInput';

export default function LoginScreen({ isDarkMode, setIsDarkMode, loginData, setLoginData, loginError, handleLogin }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await handleLogin(e);
    setIsSubmitting(false);
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans transition-colors duration-200">
        <div className="absolute top-4 right-4">
          <button onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Cambiar tema" className="p-2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl shadow-xl max-w-md w-full border border-zinc-300 dark:border-zinc-800 transition-colors duration-200">
          <div className="flex justify-center mb-6">
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
              <Lock className="w-10 h-10 text-red-600 dark:text-red-500" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-center text-zinc-900 dark:text-white mb-2">Control de Asignaciones</h2>
          <p className="text-center text-zinc-500 dark:text-zinc-400 text-sm mb-6">Ingrese su usuario y clave para continuar.</p>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-usuario" className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Usuario</label>
              <input id="login-usuario" type="text" required autoComplete="username" className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white px-4 py-3 rounded-xl focus:ring-0 focus:border-red-600 outline-none transition-colors" value={loginData.usuario} onChange={e => setLoginData({ ...loginData, usuario: stripEmojis(e.target.value) })} />
            </div>
            <div>
              <label htmlFor="login-clave" className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Clave de Acceso</label>
              <input id="login-clave" type="password" required autoComplete="current-password" className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white px-4 py-3 rounded-xl focus:ring-0 focus:border-red-600 outline-none transition-colors" value={loginData.clave} onChange={e => setLoginData({ ...loginData, clave: stripEmojis(e.target.value) })} placeholder="******" />
            </div>
            {loginError && (
              <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" /> {loginError}
              </div>
            )}
            <button type="submit" disabled={isSubmitting} className={`w-full text-white font-bold py-3 rounded-xl shadow-md transition-colors ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{isSubmitting ? 'Ingresando...' : 'Ingresar al Sistema'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
