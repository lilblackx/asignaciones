import { RefreshCw } from 'lucide-react';
import { useAhora } from '../hooks/useAhora';
import { useHistorialOrdenes } from '../hooks/useHistorialOrdenes';
import { useTechnicians } from '../hooks/useTechnicians';
import { useTasaBcv } from '../hooks/useTasaBcv';
import { monedaDe } from '../utils/cobro';
import { tiempoTranscurrido } from '../utils/enCamino';
import { generarMensajeDesdePlantilla, generarMensajeWhatsApp, generarMensajeWhatsAppInstalacion, ordenSinPlantilla, tipoUsaPlantillaPromotora } from '../utils/whatsapp';
import Boton from './Boton';
import OrdersHistoryModal from './modals/OrdersHistoryModal';

// El historial como página: ocupa lo que queda de la pantalla bajo el encabezado y las franjas de arriba (la pantalla de Infraestructura es una columna de alto fijo mientras se ve).
const CLASE_PAGINA = 'w-full flex-1 min-h-0 overflow-y-auto bg-fondo flex flex-col border-t border-zinc-300 dark:border-zinc-800';

// El historial de órdenes de INFRAESTRUCTURA con permiso: el mismo que ve el administrador (todas las órdenes, vivas y archivadas en cierres), solo para mirar.
// Quien la pinta lo monta la primera vez que se abre la pestaña (ahí se leen los datos) y lo deja montado, oculto (`visible`), al cambiar de pestaña.
// `copiar(texto, mensaje)` copia y avisa con el toast.
export default function HistorialInfra({ auth, visible, copiar, setToastMsg }) {
  const { firebaseUser, currentUser, role } = auth;
  const ahora = useAhora();
  const { tickets, reports, cargado, error, actualizadoEn, actualizando, actualizar, hayMasReportes, cargandoReportes, cargarReportesAnteriores } = useHistorialOrdenes(firebaseUser, true);
  // Solo para dar el color de cada técnico y la tasa de las plantillas de cobro.
  const { getTecnicoColor } = useTechnicians(firebaseUser, setToastMsg, role, null, currentUser);
  const { config: tasaConfig } = useTasaBcv(firebaseUser);

  // La plantilla de cualquier orden, tal como se copia desde la lista de la oficina. En las que no salen de la plantilla de la promotora, el monto en Bs
  // es el del cobro ya registrado en la orden, no el de la tasa de hoy. Vacía si la orden no tiene plantilla. "Creada por" sale con el usuario (no se leen los perfiles).
  const plantillaDe = (ticket) => {
    if (ordenSinPlantilla(ticket)) return '';
    if (ticket.tipoTrabajo?.toUpperCase().includes('INSTAL')) return generarMensajeWhatsAppInstalacion(ticket);
    if (tipoUsaPlantillaPromotora(ticket.tipoTrabajo) && ticket.plantillaOriginal?.trim()) return generarMensajeDesdePlantilla(ticket);
    return generarMensajeWhatsApp(ticket, tasaConfig, ticket.cobroBs || null, monedaDe(ticket));
  };

  return (
    <div className={visible ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
      <div className="px-4 sm:px-6 pb-3 flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400 max-w-[1400px] mx-auto w-full shrink-0">
        <span aria-live="polite">{!cargado ? '' : error ? 'No se pudo actualizar.' : `Actualizado ${tiempoTranscurrido(actualizadoEn, ahora)}.`}</span>
        <Boton variante="secundario" tamano="normal" icono={RefreshCw} girando={actualizando} onClick={actualizar} disabled={actualizando}>
          {actualizando ? 'Actualizando...' : 'Actualizar'}
        </Boton>
      </div>
      {!cargado ? (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-10">Cargando el historial...</p>
      ) : error && !actualizadoEn ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center py-10">No se pudo cargar el historial. Revisa tu conexión e intenta de nuevo.</p>
      ) : (
        <OrdersHistoryModal
          enPagina
          clasePagina={CLASE_PAGINA}
          tickets={tickets}
          reports={reports}
          hasMoreReports={hayMasReportes}
          isLoadingReports={cargandoReportes}
          onLoadMoreReports={cargarReportesAnteriores}
          getTecnicoColor={getTecnicoColor}
          puedeVerPlantilla
          plantillaDe={plantillaDe}
          onCopy={copiar}
          onClose={() => {}}
        />
      )}
    </div>
  );
}
