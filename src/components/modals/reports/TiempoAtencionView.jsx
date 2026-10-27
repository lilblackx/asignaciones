import { useMemo } from 'react';
import NombreTecnico from '../../NombreTecnico';
import { META_HORAS, formatoTiempo, pendientesMasAntiguas, textoPorcentaje, tiempoDeAtencion } from '../../../utils/gestionTecnicos';
import { useAhora } from '../../../hooks/useAhora';
import { cifrasTiempoAtencion } from '../../../utils/modelosReporte';
import Cifras from './Cifras';
import TablaReporte from './TablaReporte';
import AvisoHistorial from './AvisoHistorial';

// Cuánto tardan en resolverse las órdenes: promedio, mediana y cumplimiento de una meta, por tipo de trabajo y por técnico, más las pendientes más viejas.
export default function TiempoAtencionView({ ordenes, rango, tecnico, metaHoras, onMeta, getTecnicoColor, historial }) {
  const ahora = useAhora();
  const metaMs = metaHoras * 3600000;
  const atencion = useMemo(() => tiempoDeAtencion(ordenes, rango, { tecnico, metaMs }), [ordenes, rango, tecnico, metaMs]);
  const pendientes = useMemo(() => pendientesMasAntiguas(ordenes, ahora, { tecnico }), [ordenes, ahora, tecnico]);

  const filaEstadistica = (f) => [f.nombre, f.cantidad, formatoTiempo(f.promedio), formatoTiempo(f.mediana), formatoTiempo(f.maximo), textoPorcentaje(f.pctMeta)];
  const columnas = (primera) => [{ titulo: primera }, { titulo: 'Finalizadas', derecha: true }, { titulo: 'Promedio', derecha: true }, { titulo: 'Mediana', derecha: true }, { titulo: 'Más lenta', derecha: true }, { titulo: `En ${metaHoras} h o menos`, derecha: true }];

  return (
    <div>
      <AvisoHistorial {...historial} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400">Meta de atención</span>
        <div role="group" aria-label="Meta de atención" className="flex rounded-lg border border-zinc-400 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
          {META_HORAS.map((h) => (
            <button key={h} type="button" aria-pressed={metaHoras === h} onClick={() => onMeta(h)} className={`px-3 py-1.5 text-xs font-bold transition-colors ${metaHoras === h ? 'bg-red-600 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              {h < 72 ? `${h} h` : `${h / 24} días`}
            </button>
          ))}
        </div>
      </div>

      <Cifras items={cifrasTiempoAtencion(atencion, metaHoras)} />

      <TablaReporte
        titulo="Por tipo de trabajo"
        nota="El tiempo corre desde que se crea la orden (o desde su fecha programada, si es posterior) hasta que se finaliza."
        columnas={columnas('Tipo')}
        filas={atencion.porTipo.map(filaEstadistica)}
        vacio="Ninguna orden finalizada en este periodo."
      />
      <TablaReporte
        titulo="Por técnico"
        columnas={columnas('Técnico')}
        filas={atencion.porTecnico.map((f) => [<NombreTecnico key={f.nombre} nombre={f.nombre} getTecnicoColor={getTecnicoColor} />, ...filaEstadistica(f).slice(1)])}
        vacio="Ninguna orden finalizada en este periodo."
      />

      <section className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Pendientes más antiguas</h3>
        <p className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 mt-1">Órdenes abiertas hoy que llevan más tiempo esperando (no depende del periodo; no incluye las programadas para más adelante).</p>
        {pendientes.length === 0 ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 text-center py-6">No hay órdenes pendientes.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {pendientes.map(({ orden, esperaMs }) => (
              <li key={orden.id ?? orden.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs">
                <span className="font-black text-red-600 dark:text-red-400">{orden.codigo}</span>
                <span className="font-bold truncate max-w-[14rem]">{orden.nombre}</span>
                <span className="text-zinc-600 dark:text-zinc-400">{orden.tipoTrabajo}{orden.estado === 'PRE-FINALIZADO' ? ' · por aprobar' : ''}</span>
                <span className="text-zinc-600 dark:text-zinc-400">{orden.tecnico || 'Sin técnico'}</span>
                <span className="ml-auto font-black text-zinc-800 dark:text-zinc-100">{formatoTiempo(esperaMs)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
