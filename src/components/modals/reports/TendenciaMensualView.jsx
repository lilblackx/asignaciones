import { useMemo } from 'react';
import { VENTANAS_MESES, mesesDeLaTendencia, tendenciaMensual } from '../../../utils/tendenciaMensual';
import { etiquetaMes } from '../../../utils/totalesMes';
import { useAhora } from '../../../hooks/useAhora';
import { cifrasTendencia } from '../../../utils/modelosReporte';
import Cifras from './Cifras';
import GraficoColumnas from './GraficoColumnas';
import Segmentado from '../../Segmentado';
import Aviso from '../../Aviso';

// Colores de las series: rojo de marca y gris cálido (la misma paleta de los PDF). Cada tipo de trabajo conserva el suyo en todos los gráficos.
const INSTALACIONES = { nombre: 'Instalaciones', color: 'bg-[#dc2626] dark:bg-[#ef4444]' };
const AVERIAS_LOS = { nombre: 'Averías LOS', color: 'bg-[#57534e] dark:bg-[#d6d3d1]' };

// Mes contra mes: instalaciones y averías LOS finalizadas y canceladas. Es del negocio completo, así que no usa el periodo ni el técnico de arriba.
export default function TendenciaMensualView({ contadores, cargando, error, tickets, ventana, onVentana }) {
  const ahora = useAhora();
  const filas = useMemo(() => tendenciaMensual(contadores, tickets, mesesDeLaTendencia(contadores, ahora, ventana), ahora), [contadores, tickets, ahora, ventana]);

  const actual = filas[filas.length - 1];

  return (
    <div>
      {error && <Aviso nivel="error" compact className="mb-4">No se pudieron cargar los totales. Intenta actualizar.</Aviso>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-etiqueta font-bold text-muted-foreground">Meses a mostrar</span>
        <Segmentado grande ariaLabel="Meses a mostrar" opciones={VENTANAS_MESES.map((n) => ({ id: n, etiqueta: String(n) }))} valor={ventana} onCambiar={onVentana} />
        <span className="text-etiqueta text-muted-foreground">{cargando ? 'Cargando...' : `Mes en curso: ${etiquetaMes(actual.mes)}`}</span>
      </div>

      <Cifras items={cifrasTendencia(filas)} />

      {filas.length === 1 && (
        <p className="text-xs text-muted-foreground bg-sunken border border-border rounded-campo px-3 py-2 mb-4">
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
      <p className="text-etiqueta text-muted-foreground">Cuenta instalaciones y averías de tipo LOS (las demás averías no entran en estos totales). * Mes en curso: incluye lo de hoy que todavía no se cierra, pero está incompleto y no es comparable con un mes terminado.</p>
    </div>
  );
}
