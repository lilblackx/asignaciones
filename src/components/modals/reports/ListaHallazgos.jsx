import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import DetalleOrdenesModal from './DetalleOrdenesModal';

// Los puntos de atención de un reporte: alertas en ámbar y lo que va bien en verde. Cada línea lleva icono y texto, nunca solo color.
// Un punto con `ordenes` ([{ orden, dato }], con `datoTitulo` como título de la columna del dato) se pulsa y muestra las órdenes que lo forman.
const columnas = (datoTitulo) => [{ titulo: 'Código' }, { titulo: 'Cliente' }, { titulo: 'Técnico' }, { titulo: 'Trabajo' }, { titulo: 'Estado' }, { titulo: datoTitulo || 'Dato' }];
const filaDe = ({ orden, dato }) => [orden.codigo || 'S/C', orden.nombre || '', orden.tecnico || 'SIN ASIGNAR', orden.tipoTrabajo || '', orden.estado || '', dato ?? ''];

export default function ListaHallazgos({ titulo = 'Puntos de atención', items }) {
  const [abierto, setAbierto] = useState(null);
  if (items.length === 0) return null;
  const detalle = abierto === null ? null : items[abierto];
  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">{titulo}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => {
          const alerta = item.nivel === 'aviso';
          const Icono = alerta ? AlertTriangle : CheckCircle2;
          const color = alerta ? 'bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-900/50' : 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-900/50';
          const contenido = (
            <>
              <Icono className={`w-4 h-4 shrink-0 mt-px ${alerta ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} aria-hidden="true" />
              <span className="flex-1 min-w-0 text-zinc-800 dark:text-zinc-200"><span className="font-bold">{alerta ? 'Atención: ' : 'Bien: '}</span>{item.texto}</span>
              {item.ordenes?.length > 0 && <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-300">{item.ordenes.length} {item.ordenes.length === 1 ? 'orden' : 'órdenes'}<ChevronRight className="w-3.5 h-3.5" aria-hidden="true" /></span>}
            </>
          );
          return (
            <li key={i}>
              {item.ordenes?.length > 0 ? (
                <button type="button" onClick={() => setAbierto(i)} aria-label={`${item.texto} Ver las ${item.ordenes.length} órdenes`} className={`w-full text-left flex items-start gap-2.5 rounded-lg px-3 py-2 text-xs leading-snug transition-colors hover:brightness-95 dark:hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 ${color}`}>{contenido}</button>
              ) : (
                <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-xs leading-snug ${color}`}>{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>
      {detalle && (
        <DetalleOrdenesModal
          titulo="Órdenes de este punto de atención"
          subtitulo={detalle.texto}
          columnas={columnas(detalle.datoTitulo)}
          filas={detalle.ordenes.map(filaDe)}
          onClose={() => setAbierto(null)}
        />
      )}
    </section>
  );
}
