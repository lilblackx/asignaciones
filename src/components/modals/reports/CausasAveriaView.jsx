import { useMemo } from 'react';
import { causasDeAveria, CLIENTES_NAP_SOSPECHOSA } from '../../../utils/causasAveria';
import { cifrasCausas, tablasCausas, textoNapSospechosa } from '../../../utils/modelosReporte';
import Cifras from './Cifras';
import ListaHallazgos from './ListaHallazgos';
import BarrasReporte from './BarrasReporte';
import TablaReporte from './TablaReporte';
import AvisoHistorial from './AvisoHistorial';

// Qué fallas se reportan, cuánto tardan en resolverse y en qué NAPs se concentran.
export default function CausasAveriaView({ ordenes, rango, tecnico, historial }) {
  const causas = useMemo(() => causasDeAveria(ordenes, rango, { tecnico }), [ordenes, rango, tecnico]);
  const tablas = useMemo(() => tablasCausas(causas), [causas]);

  return (
    <div>
      <AvisoHistorial {...historial} />
      <Cifras items={cifrasCausas(causas)} />
      <ListaHallazgos items={causas.napsSospechosas.map((n) => ({ nivel: 'aviso', texto: textoNapSospechosa(n), ordenes: n.ordenes, datoTitulo: 'Falla' }))} />
      <BarrasReporte
        titulo="Averías por tipo de falla"
        subtitulo="Cada avería cuenta en el día en que se reportó"
        filas={causas.porFalla.slice(0, 10).map((f) => ({ etiqueta: f.nombre, valor: f.total, texto: `${f.total} (${f.pct}%)` }))}
      />
      <TablaReporte titulo="Detalle por falla" {...tablas.porFalla} vacio="Ninguna avería reportada en este periodo." />
      <TablaReporte
        titulo="Evolución mensual de las fallas más frecuentes"
        nota="Averías reportadas cada mes (todo el historial cargado, sin importar el periodo elegido)."
        {...tablas.evolucion}
        vacio="Sin averías en el historial cargado."
      />
      <TablaReporte
        titulo="NAPs con más averías"
        nota={`Una NAP con averías de ${CLIENTES_NAP_SOSPECHOSA} o más clientes distintos apunta a un problema de la NAP, no de cada cliente.`}
        {...tablas.porNap}
        vacio="Ninguna avería tiene NAP registrada."
      />
    </div>
  );
}
