import { ListChecks, X } from 'lucide-react';
import Modal from '../../Modal';
import TablaReporte from './TablaReporte';

// El detalle de las órdenes que forman una cifra o una fila de un reporte (por ejemplo, las no realizadas o las que usaron un material).
//   titulo, subtitulo: lo que se muestra arriba; columnas y filas: la tabla (ver TablaReporte)
export default function DetalleOrdenesModal({ titulo, subtitulo, columnas, filas, vacio = 'Ninguna orden en este periodo.', onClose }) {
  return (
    <Modal onClose={onClose} zIndexClass="z-[70]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-zinc-300 dark:border-zinc-800 flex flex-col">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex justify-between items-center shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white flex items-center gap-2"><ListChecks className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" /> <span className="truncate">{titulo}</span></h2>
            {subtitulo && <p className="text-[11px] max-lg:text-xs font-medium text-red-400">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 overflow-y-auto bg-fondo">
          <TablaReporte titulo={`${filas.length} ${filas.length === 1 ? 'orden' : 'órdenes'}`} columnas={columnas} filas={filas} vacio={vacio} />
        </div>
      </div>
    </Modal>
  );
}
