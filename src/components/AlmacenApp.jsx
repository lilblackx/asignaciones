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
import { BOTON_ENCABEZADO } from './estilos';
import Cargando from './Cargando';

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

  // En el encabezado de la pantalla (PC), el mismo botón que usan los demás módulos.
  const botonActualizarEncabezado = (
    <button type="button" onClick={actualizar} disabled={actualizando} className={BOTON_ENCABEZADO}>
      <RefreshCw className={`w-4 h-4 ${actualizando ? 'animate-spin' : ''}`} aria-hidden="true" /> {actualizando ? 'Actualizando...' : 'Actualizar'}
    </button>
  );

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-dvh bg-fondo text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />
        <EncabezadoSimple contexto={cargado ? (error ? 'No se pudo actualizar.' : `Actualizado ${tiempoTranscurrido(actualizadoEn, ahora)}.`) : ''} titulo="Almacén" icono={Cable} nombre={currentUserName || currentUser} rol={role} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} />

        <main className="flex-1 w-full">
          {cargado && (
            <AccionesEncabezado
              className="px-4 sm:px-6 pt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"
              encabezado={botonActualizarEncabezado}
            >
              <span>{error ? 'No se pudo actualizar.' : `Actualizado ${tiempoTranscurrido(actualizadoEn, ahora)}.`}</span>
              {botonActualizar}
            </AccionesEncabezado>
          )}
          {error && !actualizadoEn ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400 text-center py-10">No se pudieron cargar los datos. Revisa tu conexión e intenta de nuevo.</p>
          ) : !cargado ? (
            <Cargando texto="Cargando materiales..." />
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
