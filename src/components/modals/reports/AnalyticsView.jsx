import { useMemo, useState } from 'react';
import { Award, MapPinned, Repeat } from 'lucide-react';
import { estadisticasOperativas } from '../../../utils/estadisticasOperativas';
import { cifrasEstadisticas } from '../../../utils/modelosReporte';
import Cifras from './Cifras';

// Los grupos de trabajo (ver utils/tiposDeTrabajo): suman exactamente el total. "Otros" solo sale si hay órdenes de un tipo que no está en ningún grupo.
const TIPOS_PRODUCTIVIDAD = [['TODO', 'Todo'], ['INSTALACION', 'Instalaciones'], ['AVERIA', 'Averías'], ['VISITA', 'Visitas'], ['OTRO', 'Otros']];
const NOMBRE_DEL_TIPO = { INSTALACION: 'instalaciones', AVERIA: 'averías', VISITA: 'visitas', OTRO: 'otras' };

export default function AnalyticsView({ ordenes, rango, tecnico, getTecnicoColor, hasMoreReports, isLoadingReports, onLoadMoreReports }) {
  const estadisticas = useMemo(() => estadisticasOperativas(ordenes, rango, tecnico), [ordenes, rango, tecnico]);
  const { porTecnicoTipo, totalesPorTipo, porNap, reincidentes } = estadisticas;
  const pestañas = TIPOS_PRODUCTIVIDAD.filter(([clave]) => clave !== 'OTRO' || totalesPorTipo.OTRO > 0);
  // Productividad: todo junto o solo instalaciones o solo averías.
  const [tipoProductividad, setTipoProductividad] = useState('TODO');
  const porTecnico = porTecnicoTipo[tipoProductividad];

  const maxTecnico = porTecnico[0]?.count || 1;
  const maxNap = porNap[0]?.count || 1;

  return (
    <div>
    <Cifras items={cifrasEstadisticas(estadisticas)} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {hasMoreReports && (
        <div className="lg:col-span-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Estas estadísticas solo cuentan el historial ya cargado (los cierres más recientes). Hay reportes más antiguos sin cargar —{' '}
          <button onClick={onLoadMoreReports} disabled={isLoadingReports} className="font-bold underline disabled:opacity-50">
            {isLoadingReports ? 'cargando...' : 'cargar más'}
          </button>{' '}
          para incluirlos.
        </div>
      )}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" /> Productividad por Técnico
          </h3>
          <div role="group" aria-label="Tipo de trabajo" className="flex gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
            {pestañas.map(([clave, texto]) => (
              <button
                key={clave}
                type="button"
                aria-pressed={tipoProductividad === clave}
                onClick={() => setTipoProductividad(clave)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${tipoProductividad === clave ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
        {porTecnico.length === 0 ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-500 text-center py-6">{tipoProductividad === 'TODO' ? 'Aún no hay órdenes finalizadas.' : `Aún no hay ${NOMBRE_DEL_TIPO[tipoProductividad]} finalizadas.`}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {porTecnico.map(({ name, count }) => (
              <div key={name} className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded w-24 shrink-0 truncate text-center ${getTecnicoColor(name)}`}>{name}</span>
                <div className="flex-1 h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${(count / maxTecnico) * 100}%` }} />
                </div>
                <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-4">
          <MapPinned className="w-4 h-4 text-blue-500" /> Fallas más Frecuentes por NAP
        </h3>
        {porNap.length === 0 ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-500 text-center py-6">Sin datos de NAP registrados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {porNap.map(({ nap, count }) => (
              <div key={nap} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 w-28 shrink-0 truncate" title={nap}>{nap}</span>
                <div className="flex-1 h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${(count / maxNap) * 100}%` }} />
                </div>
                <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-5 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-4">
          <Repeat className="w-4 h-4 text-red-500" /> Clientes Reincidentes
        </h3>
        {reincidentes.length === 0 ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-500 text-center py-6">Ningún cliente tiene más de una orden registrada.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {reincidentes.map(({ cedula, nombre, count }) => (
              <div key={cedula} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{nombre}</div>
                  <div className="text-[10px] text-zinc-600 dark:text-zinc-500">C.I: {cedula}</div>
                </div>
                <span className="text-xs font-black bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded shrink-0 ml-2">{count} órdenes</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
