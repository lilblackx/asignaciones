import { Component } from 'react';
import { AlertTriangle, ClipboardCopy, RefreshCw } from 'lucide-react';
import { medidor } from '../lib/medidorFirestore.js';

// Atrapa los errores al pintar la app. Sin esto, un fallo en cualquier componente deja la pantalla en blanco y quien está en campo
// no tiene cómo salir salvo cerrar la app. No atrapa errores de eventos ni de código asíncrono: esos siguen yendo a la consola.

// Tras un despliegue, una pantalla que se carga por pedido puede pedir un archivo que ya no existe: no es un error de la app, es una versión vieja.
const ES_VERSION_VIEJA = /dynamically imported module|Importing a module script failed|Loading chunk|Failed to fetch dynamically/i;
const CLAVE_RECARGA = 'asignaciones:recarga-automatica';

// Recarga sola una vez (no en bucle) cuando el fallo es de una versión vieja.
function recargarSiVersionVieja(error) {
  if (!ES_VERSION_VIEJA.test(String(error?.message || error))) return false;
  try {
    if (sessionStorage.getItem(CLAVE_RECARGA)) return false;
    sessionStorage.setItem(CLAVE_RECARGA, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// El texto que se manda por WhatsApp para que se pueda diagnosticar sin tener el teléfono delante.
function detalleDelError(error) {
  const pila = String(error?.stack || '').split('\n').slice(0, 6).join('\n');
  return [
    `Error: ${error?.message || error}`,
    `Versión: ${typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'desarrollo'}`,
    `Fecha: ${new Date().toISOString()}`,
    `Pantalla: ${window.location.pathname}`,
    `Navegador: ${navigator.userAgent}`,
    pila && `\n${pila}`,
  ].filter(Boolean).join('\n');
}

export default class ErrorBoundary extends Component {
  state = { error: null, copiado: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error al pintar la app:', error, info?.componentStack);
    // React no manda los errores que atrapa un ErrorBoundary a window.onerror: se cuentan aquí para que salgan en Estaciones (último error de ese equipo).
    medidor.errorApp(error?.message || String(error), Date.now());
    recargarSiVersionVieja(error);
  }

  copiar = async () => {
    try {
      await navigator.clipboard.writeText(detalleDelError(this.state.error));
      this.setState({ copiado: true });
    } catch {
      // Sin permiso para copiar: el detalle se muestra abajo para que se pueda seleccionar a mano.
      this.setState({ copiado: 'manual' });
    }
  };

  recargar = () => {
    try { sessionStorage.removeItem(CLAVE_RECARGA); } catch { /* sin almacenamiento: se recarga igual */ }
    window.location.reload();
  };

  render() {
    const { error, copiado } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="min-h-dvh bg-fondo flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="bg-black px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h1 className="text-sm font-black uppercase tracking-wide text-white">Algo salió mal</h1>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              La pantalla no se pudo mostrar. Recarga la app para seguir; lo que ya estaba guardado no se pierde.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={this.recargar} className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 hover:bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition-colors">
                <RefreshCw className="w-4 h-4" aria-hidden="true" /> Recargar
              </button>
              <button type="button" onClick={this.copiar} className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-400 dark:border-zinc-700 px-4 py-2.5 text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <ClipboardCopy className="w-4 h-4" aria-hidden="true" /> {copiado === true ? 'Detalle copiado' : 'Copiar detalle del error'}
              </button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Si se repite, envía el detalle por WhatsApp a quien administra la app.</p>
            {copiado === 'manual' && (
              <pre className="max-h-40 overflow-auto rounded border border-zinc-300 dark:border-zinc-700 p-2 text-[11px] leading-snug whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-300">{detalleDelError(error)}</pre>
            )}
          </div>
        </div>
      </div>
    );
  }
}
