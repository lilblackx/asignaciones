import { useMemo } from 'react';
import { formatoTiempo } from '../../../utils/gestionTecnicos';
import { useAhora } from '../../../hooks/useAhora';
import {
  NOTA_HORAS, TRAMOS_OFICINA, TRAMOS_TECNICO, cifrasDeTramos, colasDeLaOficina, columnasPorTecnico, columnasPorTipo, columnasTramo, esperasDelCiclo, filaPorTipo, filaTramo, tiempoOGuion,
} from '../../../utils/esperasCiclo';
import Cifras from './Cifras';
import TablaReporte from './TablaReporte';
import AvisoHistorial from './AvisoHistorial';

function ColaDeEspera({ titulo, nota, cola, vacio }) {
  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{titulo} <span className="text-zinc-500 font-black">({cola.total})</span></h3>
      <p className="text-[11px] text-zinc-500 mt-1">{nota}</p>
      {cola.lista.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6">{vacio}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {cola.lista.map(({ orden, esperaMs }) => (
            <li key={orden.id ?? orden.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs">
              <span className="font-black text-red-600 dark:text-red-400">{orden.codigo}</span>
              <span className="font-bold truncate max-w-[14rem]">{orden.nombre}</span>
              <span className="text-zinc-500">{orden.tipoTrabajo}</span>
              <span className="text-zinc-500">{orden.tecnico || 'Sin técnico'}</span>
              <span className="ml-auto font-black text-zinc-800 dark:text-zinc-100">{formatoTiempo(esperaMs)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const Encabezado = ({ titulo, detalle }) => (
  <div className="mt-6 mb-3 first:mt-0">
    <h2 className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200">{titulo}</h2>
    <p className="text-[11px] text-zinc-500">{detalle}</p>
  </div>
);

// En cuánto tiempo se mueve cada tramo de una orden y de quién es la espera: la oficina (asignar técnico, aprobar) y el técnico (salir, viaje, trabajo en el sitio).
export default function EsperasCicloView({ ordenes, rango, tecnico, getTecnicoColor, historial }) {
  const ahora = useAhora();
  const esperas = useMemo(() => esperasDelCiclo(ordenes, rango, { tecnico }), [ordenes, rango, tecnico]);
  const colas = useMemo(() => colasDeLaOficina(ordenes, ahora, { tecnico }), [ordenes, ahora, tecnico]);
  const tramosDe = (quien) => esperas.tramos.filter((t) => t.quien === quien);

  return (
    <div>
      <AvisoHistorial {...historial} />
      <Cifras items={[
        { etiqueta: 'Órdenes finalizadas', valor: esperas.finalizadas, detalle: 'en el periodo' },
        { etiqueta: 'Con horas registradas', valor: esperas.conHoras, detalle: 'miden al menos un tramo' },
      ]} />
      <p className="text-[11px] text-zinc-500 -mt-1 mb-2">{NOTA_HORAS}</p>

      <Encabezado titulo="Oficina" detalle="Cuánto tarda la oficina en asignar el técnico y en aprobar lo que el técnico pre-finaliza." />
      <Cifras items={cifrasDeTramos(esperas, 'OFICINA')} />
      <TablaReporte
        titulo="Tramos de la oficina"
        nota={TRAMOS_OFICINA.map((t) => `${t.nombre}: ${t.detalle}`).join(' ')}
        columnas={columnasTramo('Tramo')}
        filas={tramosDe('OFICINA').map(filaTramo)}
        vacio="Sin órdenes en este periodo."
      />
      <TablaReporte titulo="Por tipo de trabajo" columnas={columnasPorTipo()} filas={esperas.porTipo.map(filaPorTipo)} vacio="Ninguna orden con horas de la oficina en este periodo." />
      <ColaDeEspera titulo="Sin técnico ahora" nota="Órdenes pendientes que aún no tienen técnico, la más vieja primero." cola={colas.sinTecnico} vacio="Todas las órdenes pendientes tienen técnico." />
      <ColaDeEspera titulo="Pre-finalizadas por aprobar" nota="Esperan la aprobación de la oficina, la más vieja primero." cola={colas.porAprobar} vacio="No hay órdenes por aprobar." />

      <Encabezado titulo="Técnico" detalle="Cuánto tarda el técnico en salir hacia la orden, en llegar y en terminar el trabajo." />
      <Cifras items={cifrasDeTramos(esperas, 'TÉCNICO')} />
      <TablaReporte
        titulo="Tramos del técnico"
        nota={TRAMOS_TECNICO.map((t) => `${t.nombre}: ${t.detalle}`).join(' ')}
        columnas={columnasTramo('Tramo')}
        filas={tramosDe('TÉCNICO').map(filaTramo)}
        vacio="Sin órdenes en este periodo."
      />
      <TablaReporte
        titulo="Por técnico (tiempo promedio)"
        columnas={columnasPorTecnico()}
        filas={esperas.porTecnico.map((f) => [
          <span key={f.nombre} className={`inline-block text-[10px] font-bold px-2 py-1 rounded ${getTecnicoColor(f.nombre)}`}>{f.nombre}</span>,
          String(f.cantidad),
          ...TRAMOS_TECNICO.map((t) => tiempoOGuion(f[t.id])),
        ])}
        vacio="Ninguna orden con horas del técnico en este periodo."
      />
    </div>
  );
}
