import { AlarmClock, CalendarClock, ClipboardCopy, FileText } from 'lucide-react';
import { promotoraDeOrden } from '../utils/whatsapp';
import { ESTILO_ESTADO_PROMOTORA_SOLIDO } from './estilosInstalacion';
import { atrasoOrden, esAveriaLos, fechaCorta, fechaOrden, textoPlantillaFinal } from '../utils/estadoInstalacion';
import { formatearCedula } from '../utils/cedula';
import { getTipoTrabajoEstilo } from '../utils/ticketDisplay';

// Una orden vista por ventas o por la promotora: quién es el cliente, dónde, y en qué va. Solo lectura. En las finalizadas,
// "Ver plantilla" (`onVerPlantilla`) abre la plantilla final ya llena por el técnico, para leerla y copiarla.
// Usa el lenguaje de la oficina: cabecera negra como la tabla y los modales, etiquetas de formulario en mayúsculas, estados sólidos
// (ver estilosInstalacion) y la etiqueta de tipo de la tabla (ticketDisplay); esquinas secas y sin sombra, sin íconos delante de los datos.

const fecha = (ms) => (ms ? new Date(ms).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const ETIQUETA = 'text-[10px] font-semibold uppercase tracking-wide text-zinc-500';
const VALOR = 'text-sm text-zinc-900 dark:text-zinc-100 mt-0.5 break-words';
const BOTON = 'inline-flex items-center gap-1 text-[11px] font-bold rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors';

export default function TarjetaInstalacion({ orden, onVerPlantilla, onCopiarPlantilla, mostrarTipo = false, ahora }) {
  const { vista } = orden;
  const esLos = esAveriaLos(orden);
  const tipo = getTipoTrabajoEstilo(esLos ? 'AVERÍA' : 'INSTALACIÓN');
  const atraso = atrasoOrden(orden, ahora);
  const cerrada = orden.origen === 'historial' || orden.estado === 'FINALIZADO' || orden.estado === 'CANCELADO';
  const cuando = fechaOrden(orden);
  const conPlantilla = Boolean(onVerPlantilla && vista.clave === 'INSTALADA' && textoPlantillaFinal(orden));
  const cedula = formatearCedula(orden.cedula, orden.tipoDocumento);
  const promotor = promotoraDeOrden(orden);
  const programada = vista.clave === 'PROGRAMADA' ? fechaCorta(orden.fechaProgramada) : '';

  return (
    <li className="h-full flex flex-col min-w-0 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="bg-black px-3 py-2 flex items-center gap-2">
        <span className="text-lg font-black text-white tabular-nums leading-none">{orden.codigo || 'S/C'}</span>
        {mostrarTipo && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${tipo.badge}`}>{esLos ? 'LOS' : 'INSTALACIÓN'}</span>}
        <span className={`ml-auto shrink-0 text-[10px] font-black uppercase tracking-wide rounded px-2 py-1 leading-none ${ESTILO_ESTADO_PROMOTORA_SOLIDO[vista.clave]}`}>{vista.etiqueta}</span>
      </div>

      {atraso && (
        <div className={`w-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide ${atraso.nivel === 'urgente' ? 'bg-red-600 text-white' : 'bg-amber-400 text-black'}`}>
          <AlarmClock className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>{atraso.que} · {atraso.dias === 1 ? '1 día' : `${atraso.dias} días`}</span>
        </div>
      )}

      {programada && (
        <div className="w-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
          <CalendarClock className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>Programada para el {programada}</span>
        </div>
      )}

      <div className="p-3 flex-1 flex flex-col gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-zinc-900 dark:text-white leading-tight break-words">{orden.nombre || 'Sin nombre'}</h3>
          {cedula && <p className="text-xs tabular-nums text-zinc-500 mt-0.5">{cedula}</p>}
        </div>

        <div>
          <p className={ETIQUETA}>Dirección</p>
          <p className={`${VALOR} line-clamp-2`}>{orden.direccion || '—'}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-auto">
          <div className="min-w-0">
            <p className={ETIQUETA}>Promotor</p>
            <p className={VALOR}>{promotor || '—'}</p>
          </div>
          <div className="min-w-0">
            <p className={ETIQUETA}>Técnico</p>
            {orden.tecnico
              ? <p className={VALOR}>{orden.tecnico}</p>
              : programada
                ? <p className="mt-0.5 text-xs font-black uppercase text-zinc-500">Por asignar</p>
                : <p className="mt-0.5 text-xs font-black uppercase text-amber-600 dark:text-amber-400">Sin técnico</p>}
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 min-h-11 flex items-center justify-between gap-2">
        <span className={`${ETIQUETA} tabular-nums`}>{cuando ? `${cerrada ? 'Cerrada' : 'Creada'} ${fecha(cuando)}` : ''}</span>
        {conPlantilla && (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onVerPlantilla(orden)} className={BOTON}>
              <FileText className="w-3 h-3" aria-hidden="true" /> Ver plantilla
            </button>
            {onCopiarPlantilla && (
              <button type="button" onClick={() => onCopiarPlantilla(orden)} aria-label={`Copiar la plantilla de ${orden.codigo || 'la orden'}`} title="Copiar plantilla" className={BOTON}>
                <ClipboardCopy className="w-3 h-3" aria-hidden="true" /> Copiar
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
