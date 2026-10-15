import { Clock, FileText, Megaphone, MapPin, User } from 'lucide-react';
import { promotoraDeOrden } from '../utils/whatsapp';
import { ESTILO_ESTADO_PROMOTORA } from './estilosInstalacion';
import { esAveriaLos, textoPlantillaFinal } from '../utils/estadoInstalacion';

const fecha = (ms) => (ms ? new Date(ms).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

// Una instalación vista por la promotora: quién es el cliente, dónde, y en qué va. Solo lectura. En las finalizadas,
// "Ver plantilla" (`onVerPlantilla`) abre la plantilla final ya llena por el técnico, para leerla y copiarla.
export default function TarjetaInstalacion({ orden, onVerPlantilla, mostrarTipo = false }) {
  const { vista } = orden;
  const cerrada = orden.origen === 'historial' || orden.estado === 'FINALIZADO' || orden.estado === 'CANCELADO';
  const cuando = cerrada ? (orden.finalizadoEn || orden.archivadoEn) : orden.createdAt;
  // En la fila de tarjetas todas miden lo mismo: lo que sobra va arriba del botón (o del pie si no hay botón), así los
  // botones de "Ver plantilla" quedan alineados aunque la dirección de una ocupe más líneas.
  const conPlantilla = Boolean(onVerPlantilla && vista.clave === 'INSTALADA' && textoPlantillaFinal(orden));
  const cedula = orden.cedula ? `${orden.tipoDocumento || 'V'}-${orden.cedula}` : '';

  return (
    <li className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-black tracking-wide text-zinc-500 dark:text-zinc-400">
            {orden.codigo || 'S/C'}
            {mostrarTipo && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${esAveriaLos(orden) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>{esAveriaLos(orden) ? 'LOS' : 'INSTALACIÓN'}</span>}
          </p>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white break-words">{orden.nombre || 'Sin nombre'}</h3>
          {cedula && <p className="text-xs text-zinc-500 dark:text-zinc-400">{cedula}</p>}
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-md text-center leading-tight max-w-[9rem] ${ESTILO_ESTADO_PROMOTORA[vista.clave]}`}>{vista.etiqueta}</span>
      </div>

      {orden.direccion && (
        <p className="text-xs text-zinc-600 dark:text-zinc-300 flex items-start gap-1.5 break-words">
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-px text-zinc-400" aria-hidden="true" /> <span className="line-clamp-2">{orden.direccion}</span>
        </p>
      )}

      {promotoraDeOrden(orden) && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 min-w-0 break-words">
          <Megaphone className="w-3 h-3 shrink-0" aria-hidden="true" /> Promotor: <span className="font-bold text-zinc-700 dark:text-zinc-300">{promotoraDeOrden(orden)}</span>
        </p>
      )}

      {conPlantilla && (
        <button
          type="button"
          onClick={() => onVerPlantilla(orden)}
          className="mt-auto w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-red-600 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Ver plantilla
        </button>
      )}

      <div className={`${conPlantilla ? '' : 'mt-auto'} pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400`}>
        <span className="flex items-center gap-1 min-w-0 break-words">
          <User className="w-3 h-3 shrink-0" aria-hidden="true" /> {vista.detalle || 'Sin técnico'}
        </span>
        {cuando && <span className="flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" aria-hidden="true" /> {cerrada ? 'Cerrada' : 'Creada'} {fecha(cuando)}</span>}
      </div>
    </li>
  );
}
