import { useMemo } from 'react';
import { VENTANAS_MESES, mesesDeLaTendencia, tendenciaMensual } from '../../../utils/tendenciaMensual';
import { etiquetaMes } from '../../../utils/totalesMes';
import { useAhora } from '../../../hooks/useAhora';
import { cifrasTendencia } from '../../../utils/modelosReporte';
import Cifras from './Cifras';
import GraficoColumnas from './GraficoColumnas';

// Colores de las series (azul y naranja de la paleta de dataviz, con su paso para modo oscuro). Cada tipo de trabajo conserva el suyo en todos los gráficos.
const INSTALACIONES = { nombre: 'Instalaciones', color: 'bg-[#2a78d6] dark:bg-[#3987e5]' };
const AVERIAS_LOS = { nombre: 'Averías LOS', color: 'bg-[#eb6834] dark:bg-[#d95926]' };

// Mes contra mes: instalaciones y averías LOS finalizadas y canceladas. Es del negocio completo, así que no usa el periodo ni el técnico de arriba.
export default function TendenciaMensualView({ contadores, cargando, error, tickets, ventana, onVentana }) {
  const ahora = useAhora();
  const filas = useMemo(() => tendenciaMensual(contadores, tickets, mesesDeLaTendencia(contadores, ahora, ventana), ahora), [contadores, tickets, ahora, ventana]);

  const actual = filas[filas.length - 1];

  return (
    <div>
      {error && <p className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4">No se pudieron cargar los totales. Intenta actualizar.</p>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-500">Meses a mostrar</span>
        <div role="group" aria-label="Meses a mostrar" className="flex rounded-lg border border-zinc-400 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
          {VENTANAS_MESES.map((n) => (
            <button key={n} type="button" aria-pressed={ventana === n} onClick={() => onVentana(n)} className={`px-3 py-1.5 text-xs font-bold transition-colors ${ventana === n ? 'bg-red-600 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>{n}</button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-600 dark:text-zinc-500">{cargando ? 'Cargando...' : `Mes en curso: ${etiquetaMes(actual.mes)}`}</span>
      </div>

      <Cifras items={cifrasTendencia(filas)} />

      {filas.length === 1 && (
        <p className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 mb-4">
          Por ahora solo hay datos de {etiquetaMes(actual.mes)}. La comparación aparece sola a medida que se cierren más meses.
        </p>
      )}

      <GraficoColumnas
        titulo="Finalizadas por mes"
        subtitulo="Instalaciones y averías LOS terminadas"
        series={[INSTALACIONES, AVERIAS_LOS]}
        meses={filas.map((f) => ({ mes: f.mes, etiqueta: f.etiqueta, enCurso: f.enCurso, valores: [f.instalaciones.finalizadas, f.los.finalizadas] }))}
      />
      <GraficoColumnas
        titulo="Canceladas por mes"
        subtitulo="Instalaciones y averías LOS canceladas"
        series={[INSTALACIONES, AVERIAS_LOS]}
        meses={filas.map((f) => ({ mes: f.mes, etiqueta: f.etiqueta, enCurso: f.enCurso, valores: [f.instalaciones.canceladas, f.los.canceladas] }))}
      />
      <p className="text-[11px] text-zinc-600 dark:text-zinc-500">Cuenta instalaciones y averías de tipo LOS (las demás averías no entran en estos totales). * Mes en curso: incluye lo de hoy que todavía no se cierra, pero está incompleto y no es comparable con un mes terminado.</p>
    </div>
  );
}
