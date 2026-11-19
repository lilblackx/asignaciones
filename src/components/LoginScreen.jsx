import { useState } from 'react';
import { AlertCircle, Loader2, Moon, Sun } from 'lucide-react';
import { stripEmojis } from '../utils/sanitizeInput';
import PieVersion from './PieVersion';
import { logosDeTemporada } from '../utils/temporada';
import { CAMPO_LOGIN } from './estilos';

// Campos de 48 px (el dedo) y borde que se distingue del fondo en los dos temas (3:1). Con el contorno quitado, el foco se ve por el borde rojo y el aro.
const labelClass = 'block text-sm font-bold text-foreground mb-1.5';

export default function LoginScreen({ isDarkMode, setIsDarkMode, loginData, setLoginData, loginError, handleLogin }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logos = logosDeTemporada();
  const [verClave, setVerClave] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await handleLogin(e);
    setIsSubmitting(false);
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      {/* En PC son dos mitades sueltas sobre el fondo cálido: la marca a la izquierda (una tarjeta negra, el color de la marca) y el formulario a la derecha, en su propia tarjeta.
          En celular la marca queda arriba del formulario. */}
      <div className="relative min-h-dvh bg-background font-sans flex flex-col lg:flex-row lg:gap-4 lg:p-4">
        <button
          type="button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          aria-label="Cambiar tema"
          className="absolute top-3 right-3 z-10 w-11 h-11 flex items-center justify-center rounded-boton border border-input text-foreground hover:bg-accent"
        >
          {isDarkMode ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
        </button>

        <header className={`px-6 pt-20 sm:px-8 lg:w-1/2 lg:flex lg:flex-col lg:justify-center lg:gap-12 lg:px-14 lg:py-12 lg:bg-black ${logos.login512Transparente ? 'lg:bg-[radial-gradient(ellipse_65%_45%_at_50%_34%,rgba(220,38,38,0.20),transparent_72%)]' : ''} lg:rounded-card lg:overflow-hidden dark:lg:border dark:lg:border-border`}>
          <div className="flex items-center gap-4 lg:hidden">
            <img src={logos.login192} alt="Network Speed" width="64" height="64" className="w-16 h-16 rounded-campo" />
            <p className="text-base font-bold text-foreground">Network Speed Fibra</p>
          </div>
          {/* Solo PC: el ícono grande de la marca (512 px, con su textura de ondas de fibra) con los bordes difuminados para que se funda con el negro del panel, sin caja. */}
          <div className="hidden lg:block lg:mx-auto">
            <img
              src={logos.login512}
              alt="Network Speed"
              width={logos.login512Ancho}
              height={logos.login512Alto}
              loading="lazy"
              className={`h-auto ${logos.login512Transparente ? 'w-[min(34vw,62vh,560px)]' : 'w-[min(36vw,52vh,520px)]'}`}
              style={logos.login512Difuminado ? { WebkitMaskImage: 'radial-gradient(closest-side, #000 62%, transparent 100%)', maskImage: 'radial-gradient(closest-side, #000 62%, transparent 100%)' } : undefined}
            />
          </div>
          <div>
            <h1 className="mt-6 lg:mt-0 text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight text-foreground lg:text-white">
              Control de<br />Asignaciones
            </h1>
            {/* La línea roja corta de la marca, bajo el título. */}
            <div className="mt-6 lg:mt-5 h-1.5 w-16 rounded-full bg-primary" aria-hidden="true" />
          </div>
        </header>

        <main className="flex-1 flex flex-col lg:w-1/2">
          <div className="flex-1 w-full max-w-md mx-auto px-6 pt-8 pb-10 sm:px-8 lg:max-w-sm lg:px-0 lg:pt-0 lg:pb-0 lg:flex lg:flex-col lg:justify-center">
            <form onSubmit={onSubmit} className="space-y-5 bg-card rounded-card shadow-card p-5 lg:p-8">
              <h2 className="text-xl font-black text-foreground">Iniciar sesión</h2>
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
                  className={CAMPO_LOGIN}
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
                    className={`${CAMPO_LOGIN} pr-24`}
                    value={loginData.clave}
                    onChange={e => setLoginData({ ...loginData, clave: stripEmojis(e.target.value) })}
                  />
                  <button
                    type="button"
                    onClick={() => setVerClave(v => !v)}
                    aria-pressed={verClave}
                    className="absolute inset-y-0 right-0 min-w-11 px-4 rounded-r-md text-sm font-bold text-foreground hover:bg-accent"
                  >
                    {verClave ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>
              {loginError && (
                <div id="login-error" role="alert" className="flex items-start gap-2 p-3 rounded-campo border-2 border-destructive bg-destructive/10 text-sm font-medium text-foreground">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" /> {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 max-lg:h-14 flex items-center justify-center gap-2 rounded-boton shadow-boton bg-primary hover:bg-primary-hover disabled:bg-muted-foreground disabled:text-background disabled:cursor-not-allowed text-primary-foreground text-base font-black"
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
