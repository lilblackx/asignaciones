import { AlertTriangle, Loader2 } from 'lucide-react';

export default function LoadingScreen({ isDarkMode, connectionError }) {
  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-center transition-colors duration-200">
        {connectionError ? (
          <>
            <AlertTriangle className="w-12 h-12 text-red-600 mb-4" />
            <h2 className="text-zinc-700 dark:text-zinc-300 font-bold mb-1">No se pudo conectar</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4 max-w-xs">Revisa tu conexión a internet e intenta de nuevo.</p>
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-md">Reintentar</button>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
            <h2 className="text-zinc-700 dark:text-zinc-300 font-bold">Conectando a la nube...</h2>
          </>
        )}
      </div>
    </div>
  );
}
