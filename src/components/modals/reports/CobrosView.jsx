import { useMemo } from 'react';
import { NOTA_COBROS, cifrasCobros, columnasDesglose, columnasMonto, columnasResultado, filaDesglose, filasMonto, filasResultado, resumenCobros } from '../../../utils/cobrosReporte';
import Cifras from './Cifras';
import TablaReporte from './TablaReporte';
import AvisoHistorial from './AvisoHistorial';

// Cuántas órdenes se cobraron, se exoneraron o quedaron sin cobro registrado, con su porcentaje, por concepto (tipo de visita) y por técnico.
export default function CobrosView({ ordenes, rango, tecnico, getTecnicoColor, historial }) {
  const resumen = useMemo(() => resumenCobros(ordenes, rango, { tecnico }), [ordenes, rango, tecnico]);

  return (
    <div>
      <AvisoHistorial {...historial} />
      <Cifras items={cifrasCobros(resumen)} />
      <p className="text-[11px] text-zinc-500 -mt-1 mb-4">{NOTA_COBROS}</p>

      <TablaReporte titulo="Resultado del cobro" columnas={columnasResultado()} filas={filasResultado(resumen)} vacio="Ninguna orden con cobro en este periodo." />
      <TablaReporte titulo="Monto cobrado" nota="Suma de las órdenes cobradas, separada por moneda." columnas={columnasMonto()} filas={filasMonto(resumen)} />
      <TablaReporte titulo="Por concepto (tipo de visita)" columnas={columnasDesglose('Concepto')} filas={resumen.porConcepto.map(filaDesglose)} vacio="Ninguna orden con cobro en este periodo." />
      <TablaReporte
        titulo="Por técnico"
        columnas={columnasDesglose('Técnico')}
        filas={resumen.porTecnico.map((f) => [<span key={f.nombre} className={`inline-block text-[10px] font-bold px-2 py-1 rounded ${getTecnicoColor(f.nombre)}`}>{f.nombre}</span>, ...filaDesglose(f).slice(1)])}
        vacio="Ninguna orden con cobro en este periodo."
      />
    </div>
  );
}
