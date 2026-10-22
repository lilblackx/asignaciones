import { AlarmClock, CalendarClock, ClipboardCopy, FileText } from 'lucide-react';
import { promotoraDeOrden } from '../utils/whatsapp';
import { ESTILO_ESTADO_PROMOTORA_SOLIDO } from './estilosInstalacion';
import { atrasoOrden, esAveriaLos, fechaCorta, fechaOrden, textoPlantillaFinal } from '../utils/estadoInstalacion';
import { formatearCedula } from '../utils/cedula';
import { motivoCancelacion } from '../utils/cancelacion';
import { getTipoTrabajoEstilo } from '../utils/ticketDisplay';

// Las mismas órdenes que las tarjetas (TarjetaInstalacion), en modo lista: una fila por orden, más compacta, para ver muchas de un vistazo.
// En pantallas anchas es una tabla; en el celular, filas apiladas con lo esencial. Solo lectura; "Ver plantilla" y "Copiar" como en la tarjeta.

const fecha = (ms) => (ms ? new Date(ms).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const BOTON = 'inline-flex items-center gap-1 text-[11px] font-bold rounded border border-zinc-400 dark:border-zinc-700 px-2 py-1 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap';
const ENCABEZADOS = ['Código', 'Cliente', 'Dirección', 'Promotor', 'Técnico', 'Estado', 'Fecha', ''];

// Lo que cada fila necesita de una orden, calculado una vez.
function datos(orden, onVerPlantilla, ahora) {
  const { vista } = orden;
  const esLos = esAveriaLos(orden);
  const programada = vista.clave === 'PROGRAMADA' ? fechaCorta(orden.fechaProgramada) : '';
  const cerrada = orden.origen === 'historial' || orden.estado === 'FINALIZADO' || orden.estado === 'CANCELADO';
  const cuando = fechaOrden(orden);
  return {
    vista,
    esLos,
    tipo: getTipoTrabajoEstilo(esLos ? 'AVERÍA' : 'INSTALACIÓN'),
    atraso: atrasoOrden(orden, ahora),
    programada,
    motivo: vista.clave === 'CANCELADA' ? motivoCancelacion(orden) : '',
    cedula: formatearCedula(orden.cedula, orden.tipoDocumento),
    promotor: promotoraDeOrden(orden),
    conPlantilla: Boolean(onVerPlantilla && vista.clave === 'INSTALADA' && textoPlantillaFinal(orden)),
    cuando: cuando ? `${cerrada ? 'Cerrada' : 'Creada'} ${fecha(cuando)}` : '',
  };
}

function Tecnico({ orden, programada }) {
  if (orden.tecnico) return <span>{orden.tecnico}</span>;
  if (programada) return <span className="text-xs font-black uppercase text-zinc-600 dark:text-zinc-500">Por asignar</span>;
  return <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-400">Sin técnico</span>;
}

function Avisos({ d }) {
  return (
    <>
      {d.atraso && (
        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${d.atraso.nivel === 'urgente' ? 'bg-red-600 text-white' : 'bg-amber-400 text-black'}`}>
          <AlarmClock className="w-3 h-3 shrink-0" aria-hidden="true" />
          {d.atraso.que} · {d.atraso.dias === 1 ? '1 día' : `${d.atraso.dias} días`}
        </span>
      )}
      {d.programada && (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
          <CalendarClock className="w-3 h-3 shrink-0" aria-hidden="true" />
          Programada {d.programada}
        </span>
      )}
    </>
  );
}

function Plantilla({ orden, d, onVerPlantilla, onCopiarPlantilla }) {
  if (!d.conPlantilla) return null;
  return (
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
  );
}

export default function ListaInstalaciones({ ordenes, onVerPlantilla, onCopiarPlantilla, mostrarTipo = false, ahora, className = '' }) {
  const filas = ordenes.map((o) => ({ orden: o, d: datos(o, onVerPlantilla, ahora) }));

  return (
    <div className={className}>
      {/* Celular: filas apiladas. */}
      <ul className="md:hidden rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
        {filas.map(({ orden, d }) => (
          <li key={orden.id} className="px-3 py-2.5 space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-zinc-900 dark:text-white tabular-nums">{orden.codigo || 'S/C'}</span>
              {mostrarTipo && <span className={`text-[10px] font-black px-1.5 py-0.5 leading-none rounded ${d.tipo.badge}`}>{d.esLos ? 'LOS' : 'INSTALACIÓN'}</span>}
              <span className={`ml-auto shrink-0 text-[10px] font-black uppercase tracking-wide rounded px-2 py-1 leading-none ${ESTILO_ESTADO_PROMOTORA_SOLIDO[d.vista.clave]}`}>{d.vista.etiqueta}</span>
            </div>
            <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight break-words">{orden.nombre || 'Sin nombre'}{d.cedula && <span className="font-normal text-xs tabular-nums text-zinc-600 dark:text-zinc-500"> · {d.cedula}</span>}</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1">{orden.direccion || '—'}</p>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 break-words">
              {d.promotor || '—'} · <Tecnico orden={orden} programada={d.programada} />
              {d.cuando && <span className="text-zinc-500"> · {d.cuando}</span>}
            </p>
            {(d.atraso || d.programada) && <div className="flex flex-wrap gap-1.5"><Avisos d={d} /></div>}
            {d.motivo && <p className="text-[11px] leading-snug text-red-800 dark:text-red-300 break-words"><span className="font-black uppercase">Motivo:</span> {d.motivo}</p>}
            {d.conPlantilla && <Plantilla orden={orden} d={d} onVerPlantilla={onVerPlantilla} onCopiarPlantilla={onCopiarPlantilla} />}
          </li>
        ))}
      </ul>

      {/* Pantallas anchas: tabla. */}
      <div className="hidden md:block rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-black text-[11px] uppercase tracking-wide text-zinc-300">
            <tr>
              {ENCABEZADOS.map((c, i) => <th key={c || i} scope="col" className="px-3 py-2.5 font-bold">{c || <span className="sr-only">Plantilla</span>}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filas.map(({ orden, d }) => (
              <tr key={orden.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="font-black tabular-nums">{orden.codigo || 'S/C'}</span>
                  {mostrarTipo && <span className={`block mt-1 w-fit text-[10px] font-black px-1.5 py-0.5 leading-none rounded ${d.tipo.badge}`}>{d.esLos ? 'LOS' : 'INSTALACIÓN'}</span>}
                </td>
                <td className="px-3 py-2.5 min-w-[11rem]">
                  <p className="font-bold leading-tight break-words">{orden.nombre || 'Sin nombre'}</p>
                  {d.cedula && <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-500 mt-0.5">{d.cedula}</p>}
                  {d.motivo && <p className="mt-1 text-[11px] leading-snug text-red-800 dark:text-red-300 break-words"><span className="font-black uppercase">Motivo:</span> {d.motivo}</p>}
                </td>
                <td className="px-3 py-2.5 min-w-[12rem] text-zinc-700 dark:text-zinc-300"><span className="line-clamp-2">{orden.direccion || '—'}</span></td>
                <td className="px-3 py-2.5 min-w-[7rem]">{d.promotor || '—'}</td>
                <td className="px-3 py-2.5 min-w-[7rem]"><Tecnico orden={orden} programada={d.programada} /></td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block text-[10px] font-black uppercase tracking-wide rounded px-2 py-1 leading-none ${ESTILO_ESTADO_PROMOTORA_SOLIDO[d.vista.clave]}`}>{d.vista.etiqueta}</span>
                  {(d.atraso || d.programada) && <div className="mt-1.5 flex flex-col items-start gap-1"><Avisos d={d} /></div>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{d.cuando}</td>
                <td className="px-3 py-2.5"><Plantilla orden={orden} d={d} onVerPlantilla={onVerPlantilla} onCopiarPlantilla={onCopiarPlantilla} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
