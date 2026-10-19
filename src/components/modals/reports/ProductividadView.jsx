import { useMemo } from 'react';
import { formatoTiempo, productividad } from '../../../utils/gestionTecnicos';
import { formatoDuracion } from '../../../utils/logTecnico';
import { useAhora } from '../../../hooks/useAhora';
import { cifrasProductividad } from '../../../utils/modelosReporte';
import Cifras from './Cifras';
import TablaReporte from './TablaReporte';
import AvisoHistorial from './AvisoHistorial';

const decimal = (n) => n.toFixed(2).replace('.', ',');

// Cuánto produce cada técnico en el periodo, comparado con el tiempo que estuvo activo (según el registro de activación).
export default function ProductividadView({ ordenes, eventos, rango, tecnico, getTecnicoColor, historial }) {
  const ahora = useAhora();
  const filas = useMemo(() => productividad(ordenes, eventos, rango, ahora, { tecnico }), [ordenes, eventos, rango, ahora, tecnico]);

  return (
    <div>
      <AvisoHistorial {...historial} />
      <Cifras items={cifrasProductividad(filas)} />
      <TablaReporte
        titulo="Productividad por técnico"
        nota="Las finalizadas por hora activa se calculan con el tiempo registrado entre activar y desactivar al técnico (solo desde el primer movimiento registrado; con menos de 30 min no se calcula)."
        columnas={[{ titulo: 'Técnico' }, { titulo: 'Finalizadas', derecha: true }, { titulo: 'Tiempo activo', derecha: true }, { titulo: 'Por hora activa', derecha: true }, { titulo: 'Atención media', derecha: true }]}
        filas={filas.map((f) => [
          <span key={f.tecnico} className={`inline-block text-[10px] font-bold px-2 py-1 rounded ${getTecnicoColor(f.tecnico)}`}>{f.tecnico}</span>,
          f.finalizadas,
          f.activoMs > 0 ? formatoDuracion(f.activoMs) : '—',
          f.porHora === null ? '—' : decimal(f.porHora),
          f.atencionMedia === null ? '—' : formatoTiempo(f.atencionMedia),
        ])}
        vacio="Sin órdenes finalizadas ni actividad registrada en este periodo."
      />
    </div>
  );
}
