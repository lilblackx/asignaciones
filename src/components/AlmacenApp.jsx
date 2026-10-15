import { useState } from 'react';
import { Cable, RefreshCw } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useAhora } from '../hooks/useAhora';
import { useDatosAlmacen } from '../hooks/useDatosAlmacen';
import { tiempoTranscurrido } from '../utils/enCamino';
import Toast from './Toast';
import EncabezadoSimple from './EncabezadoSimple';
import MaterialesModal from './modals/MaterialesModal';

// Pantalla del ALMACÉN: el módulo de Materiales tal como lo ve el admin, a pantalla completa y solo para mirar y contar.
export default function AlmacenApp({ auth }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout } = auth;
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { toastMsg, setToastMsg } = useToast();
  const ahora = useAhora();
  // Sin listeners en vivo, para gastar pocas lecturas de Firestore: se lee al abrir y al tocar "Actualizar".
  const { tickets, technicians, reports, cargado, error, actualizadoEn, actualizando, actualizar, hayMasReportes, cargandoReportes, cargarReportesAnteriores } = useDatosAlmacen(firebaseUser);

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />
        <EncabezadoSimple titulo="Almacén" icono={Cable} nombre={currentUserName || currentUser} rol={role} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} />

        <main className="p-3 sm:p-4 flex-1 w-full">
          {cargado && (
            <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span>{error ? 'No se pudo actualizar.' : `Actualizado ${tiempoTranscurrido(actualizadoEn, ahora)}.`}</span>
              <button
                type="button"
                onClick={actualizar}
                disabled={actualizando}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-bold text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-500 disabled:opacity-60 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${actualizando ? 'animate-spin' : ''}`} aria-hidden="true" /> {actualizando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          )}
          {error && !actualizadoEn ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar los datos. Revisa tu conexión e intenta de nuevo.</p>
          ) : !cargado ? (
            <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-10">Cargando materiales...</p>
          ) : (
            <MaterialesModal
              enPagina
              tickets={tickets}
              reports={reports}
              technicians={technicians}
              hasMoreReports={hayMasReportes}
              isLoadingReports={cargandoReportes}
              onLoadMore={cargarReportesAnteriores}
            />
          )}
        </main>
      </div>
    </div>
  );
}
