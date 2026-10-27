import { useMemo } from 'react';
import NombreTecnico from '../../NombreTecnico';
import { resumenEjecutivo } from '../../../utils/resumenEjecutivo';
import { formatoTiempo, textoPorcentaje } from '../../../utils/gestionTecnicos';
import { useAhora } from '../../../hooks/useAhora';
import { CifrasDestacadas, CifrasLista } from './Cifras';
import ListaHallazgos from './ListaHallazgos';
import GraficoColumnas from './GraficoColumnas';
import TablaReporte from './TablaReporte';
import AvisoHistorial from './AvisoHistorial';

const DESTACADAS = ['Órdenes finalizadas', 'Tiempo promedio de atención', 'Pendientes de más de 3 días'];
const decimal = (n) => n.toFixed(2).replace('.', ',');
const INSTALACIONES = { nombre: 'Instalaciones', color: 'bg-[#2a78d6] dark:bg-[#3987e5]' };
const AVERIAS_LOS = { nombre: 'Averías LOS', color: 'bg-[#eb6834] dark:bg-[#d95926]' };

// Lo esencial de todos los reportes en una sola vista, con los puntos de atención arriba.
export default function ResumenEjecutivoView({ ordenes, eventos, contadores, tickets, rango, tecnico, getTecnicoColor, historial }) {
  const ahora = useAhora();
  const r = useMemo(() => resumenEjecutivo({ ordenes, eventos, contadores, tickets, rango, tecnico, ahora }), [ordenes, eventos, contadores, tickets, rango, tecnico, ahora]);
  // Tres cifras grandes (las que más se miran) y el resto en lista, en vez de ocho tarjetas del mismo peso.
  const todas = [...r.cifras, ...r.cifrasMes];
  const grandes = DESTACADAS.map((n) => todas.find((c) => c.etiqueta.startsWith(n))).filter(Boolean);
  const resto = todas.filter((c) => !grandes.includes(c));

  return (
    <div>
      <AvisoHistorial {...historial} />
      <CifrasDestacadas items={grandes} />
      <CifrasLista items={resto} />
      <ListaHallazgos items={r.hallazgos} />
      <GraficoColumnas
        titulo="Finalizadas por mes"
        subtitulo="Instalaciones y averías LOS terminadas (todo el negocio)"
        series={[INSTALACIONES, AVERIAS_LOS]}
        meses={r.filasMes.map((f) => ({ mes: f.mes, etiqueta: f.etiqueta, enCurso: f.enCurso, valores: [f.instalaciones.finalizadas, f.los.finalizadas] }))}
      />
      <TablaReporte
        titulo="Comparativo por técnico"
        nota="Del periodo elegido. Reincidencia, señal débil y devueltas: menos es mejor."
        columnas={[{ titulo: 'Técnico' }, { titulo: 'Finalizadas', derecha: true }, { titulo: 'Atención media', derecha: true }, { titulo: 'Por hora activa', derecha: true }, { titulo: 'Reincidencia', derecha: true }, { titulo: 'Señal débil', derecha: true }, { titulo: 'Devueltas', derecha: true }]}
        filas={r.tecnicos.map((f) => [
          <NombreTecnico key={f.tecnico} nombre={f.tecnico} getTecnicoColor={getTecnicoColor} />,
          f.finalizadas,
          f.atencionMedia === null ? '-' : formatoTiempo(f.atencionMedia),
          f.porHora === null ? '-' : decimal(f.porHora),
          textoPorcentaje(f.pctReincidencia),
          textoPorcentaje(f.pctDebil),
          textoPorcentaje(f.pctDevueltas),
        ])}
        vacio="Sin órdenes finalizadas ni actividad en este periodo."
      />
    </div>
  );
}
