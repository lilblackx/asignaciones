import { useMemo } from 'react';
import { VENTANA_REINCIDENCIA_DIAS, calidad, textoPorcentaje } from '../../../utils/gestionTecnicos';
import { cifrasCalidad } from '../../../utils/modelosReporte';
import Cifras from './Cifras';
import TablaReporte from './TablaReporte';
import AvisoHistorial from './AvisoHistorial';

const fecha = (ms) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ms));

// Qué tan bien quedan los trabajos: clientes que vuelven con una avería, señal débil al cerrar y órdenes que la oficina devolvió al técnico.
export default function CalidadView({ ordenes, rango, tecnico, getTecnicoColor, historial }) {
  const cal = useMemo(() => calidad(ordenes, rango, { tecnico }), [ordenes, rango, tecnico]);

  return (
    <div>
      <AvisoHistorial {...historial} />
      <Cifras items={cifrasCalidad(cal)} />
      <TablaReporte
        titulo="Calidad por técnico"
        nota={`Reincidencia: el mismo cliente abre una avería dentro de ${VENTANA_REINCIDENCIA_DIAS} días después de finalizar la orden (las más recientes aún pueden reincidir). Menos es mejor en las tres columnas.`}
        columnas={[{ titulo: 'Técnico' }, { titulo: 'Finalizadas', derecha: true }, { titulo: 'Reincidencia', derecha: true }, { titulo: 'Señal débil', derecha: true }, { titulo: 'Devueltas', derecha: true }]}
        filas={cal.filas.map((f) => [
          <span key={f.tecnico} className={`inline-block text-[10px] font-bold px-2 py-1 rounded ${getTecnicoColor(f.tecnico)}`}>{f.tecnico}</span>,
          f.finalizadas,
          `${textoPorcentaje(f.pctReincidencia)} (${f.reincidieron})`,
          f.conPotencia ? `${textoPorcentaje(f.pctDebil)} (${f.debiles}/${f.conPotencia})` : '—',
          `${textoPorcentaje(f.pctDevueltas)} (${f.devueltas})`,
        ])}
        vacio="Ninguna orden finalizada en este periodo."
      />
      <TablaReporte
        titulo="Clientes que reincidieron"
        columnas={[{ titulo: 'Técnico' }, { titulo: 'Cliente' }, { titulo: 'Orden' }, { titulo: 'Finalizada' }, { titulo: 'Nueva avería' }, { titulo: 'Después', derecha: true }]}
        filas={cal.reincidencias.map((r) => [
          <span key={r.codigo} className={`inline-block text-[10px] font-bold px-2 py-1 rounded ${getTecnicoColor(r.tecnico)}`}>{r.tecnico}</span>,
          r.cliente,
          r.codigo,
          fecha(r.finalizadoEn),
          r.siguiente,
          r.dias === 0 ? 'mismo día' : `${r.dias} d`,
        ])}
        vacio="Ningún cliente reincidió."
      />
    </div>
  );
}
