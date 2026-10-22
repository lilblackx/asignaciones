import { Cable, RefreshCw } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useTema } from '../hooks/useTema';
import { useAhora } from '../hooks/useAhora';
import { useDatosAlmacen } from '../hooks/useDatosAlmacen';
import { tiempoTranscurrido } from '../utils/enCamino';
import Toast from './Toast';
import EncabezadoSimple from './EncabezadoSimple';
import PieVersion from './PieVersion';
import Boton from './Boton';
import AccionesEncabezado from './AccionesEncabezado';
import MaterialesModal from './modals/MaterialesModal';

// Pantalla del ALMACÉN: el módulo de Materiales tal como lo ve el admin, a pantalla completa y solo para mirar y contar.
export default function AlmacenApp({ auth }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout } = auth;
  const [isDarkMode, setIsDarkMode] = useTema(currentUser);
  const { toastMsg, setToastMsg } = useToast();
  const ahora = useAhora();
  // Sin listeners en vivo, para gastar pocas lecturas de Firestore: se lee al abrir y al tocar "Actualizar".
  const { tickets, technicians, reports, cargado, error, actualizadoEn, actualizando, actualizar, hayMasReportes, cargandoReportes, cargarReportesAnteriores } = useDatosAlmacen(firebaseUser);

  const botonActualizar = (
    <Boton icono={RefreshCw} girando={actualizando} onClick={actualizar} disabled={actualizando} className="shrink-0">
      {actualizando ? 'Actualizando...' : 'Actualizar'}
    </Boton>
  );

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-fondo text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />
        <EncabezadoSimple contexto={cargado ? (error ? 'No se pudo actualizar.' : `Actualizado ${tiempoTranscurrido(actualizadoEn, ahora)}.`) : ''} titulo="Almacén" icono={Cable} nombre={currentUserName || currentUser} rol={role} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} />

        <main className="flex-1 w-full">
          {cargado && (
            <AccionesEncabezado
              className="px-4 sm:px-6 pt-3 flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400"
              encabezado={botonActualizar}
            >
              <span>{error ? 'No se pudo actualizar.' : `Actualizado ${tiempoTranscurrido(actualizadoEn, ahora)}.`}</span>
              {botonActualizar}
            </AccionesEncabezado>
          )}
          {error && !actualizadoEn ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar los datos. Revisa tu conexión e intenta de nuevo.</p>
          ) : !cargado ? (
            <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-10">Cargando materiales...</p>
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
        <PieVersion />
      </div>
    </div>
  );
}
