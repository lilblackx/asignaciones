import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { HOJAS, MATERIALES, armarHoja, columnasDetalleMaterial, columnasMaterialesVisitas, columnasNoRealizadas, filaDetalleMaterial, filaDetalleOrden, filaNoRealizada, ordenesConMaterial, ordenesDeCifra, columnasDetalleOrdenes } from '../../../utils/reporteMensual';
import Cifras from './Cifras';
import TablaReporte from './TablaReporte';
import AvisoHistorial from './AvisoHistorial';
import VnTaView from './VnTaView';
import DetalleOrdenesModal from './DetalleOrdenesModal';

// Registro de estadísticas: lo que el departamento lleva en su hoja de cálculo, armado desde las órdenes. Una pestaña por hoja (visitas técnicas,
// averías e instalaciones), cada una con sus cifras, el cuadro de estadística, los materiales y la lista de cada orden.
// `vnta`: lo que necesita la hoja de VN y TA, que se llena a mano (useRegistroVnTa + tecnicos, hoy, puedeBorrar).
// `onDetalleAbierto(abierto)`: avisa si hay un detalle abierto encima, para que Escape cierre solo el detalle y no también la ventana de Reportes.
export default function RegistroEstadisticasView({ ordenes, rango, tecnico, historial, vnta, onDetalleAbierto }) {
  const [hojaId, setHojaId] = useState(HOJAS[0].id);
  // El detalle abierto: { tipo: 'NR' } (no realizadas) o { tipo: 'MATERIAL', material } (órdenes donde se usó un material); null = cerrado.
  const [detalle, setDetalle] = useState(null);
  useEffect(() => {
    onDetalleAbierto?.(Boolean(detalle));
    return () => onDetalleAbierto?.(false);
  }, [detalle, onDetalleAbierto]);
  const manual = HOJAS.find((h) => h.id === hojaId)?.manual;
  const hoja = useMemo(() => (manual ? null : armarHoja(hojaId, ordenes, rango, { tecnico })), [manual, hojaId, ordenes, rango, tecnico]);

  return (
    <div>
      <AvisoHistorial {...historial} />
      <div role="tablist" aria-label="Hoja del registro" className="inline-flex flex-wrap rounded-lg border border-zinc-400 dark:border-zinc-700 overflow-hidden mb-4">
        {HOJAS.map(({ id, nombre }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={hojaId === id}
            onClick={() => { setHojaId(id); setDetalle(null); }}
            className={`px-4 py-2 text-xs font-bold transition-colors ${hojaId === id ? 'bg-red-600 text-white' : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            {nombre}
          </button>
        ))}
      </div>

      <div key={hojaId} className="lg:animate-fade-in">
      {manual ? <VnTaView {...vnta} tecnico={tecnico} /> : (
      <>
      <Cifras items={hoja.cifras.map((c) => (c.id ? { ...c, detalle: c.detalle ? `${c.detalle} · ver detalle` : 'ver detalle', onClick: () => setDetalle({ tipo: 'CIFRA', id: c.id }) } : c))} />
      <p className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 -mt-1 mb-4">{hoja.nota}</p>
      {hoja.aviso && <p role="status" className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4">{hoja.aviso}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4">
        <TablaReporte titulo={hoja.tituloEstadistica} columnas={hoja.columnasEstadistica} filas={hoja.filasEstadistica} />
        <TablaReporte
          titulo={`Materiales de ${hoja.singular}`}
          nota="Solo lo finalizado: equipos, conectores por color y metros de drop. Pulsa un equipo (SM, MTV, MR, MRTV) para ver las órdenes donde se usó."
          columnas={columnasMaterialesVisitas()}
          filas={MATERIALES.map(({ id, nombre, equipo }) => {
            const cantidad = hoja.estadistica.materiales[id];
            // Los equipos siempre se pueden abrir (a veces piden saber en qué órdenes se usaron, aunque sea ninguna); los conectores y el drop, solo si se usaron.
            return [
              equipo || cantidad > 0 ? (
                <button key={id} type="button" onClick={() => setDetalle({ tipo: 'MATERIAL', material: id })} aria-label={`Ver las órdenes donde se usó ${nombre}`} className="inline-flex items-center gap-1.5 text-left font-bold hover:text-red-600 dark:hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 rounded">
                  {nombre} <ChevronRight className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                </button>
              ) : nombre,
              String(cantidad),
            ];
          })}
        />
      </div>

      <TablaReporte
        titulo={`Hoja de ${hoja.singular} (${hoja.lista.length})`}
        nota="Una fila por orden, con las mismas columnas de la hoja de cálculo. Desliza hacia el lado para ver todas."
        columnas={hoja.columnasLista}
        filas={hoja.lista.map((t, i) => hoja.filaLista(t, i + 1))}
        vacio="Ninguna orden en este periodo."
      />
      </>
      )}
      </div>
      {detalle?.tipo === 'CIFRA' && hoja && (() => {
        const cifra = hoja.cifras.find((c) => c.id === detalle.id);
        const ordenes = ordenesDeCifra(hoja.hoja, detalle.id, hoja.lista);
        const esNr = detalle.id === 'NR';
        return (
          <DetalleOrdenesModal
            titulo={`${cifra.etiqueta.toUpperCase()} · ${hoja.nombre.toUpperCase()}`}
            subtitulo={`${ordenes.length} ${ordenes.length === 1 ? 'orden' : 'órdenes'} en el periodo`}
            columnas={esNr ? columnasNoRealizadas() : detalle.id === 'DROP' ? columnasDetalleMaterial('drop') : columnasDetalleOrdenes()}
            filas={ordenes.map((t) => (esNr ? filaNoRealizada(t) : detalle.id === 'DROP' ? filaDetalleMaterial(t, 'drop') : filaDetalleOrden(t, hoja.hoja)))}
            vacio="Ninguna orden en este periodo."
            onClose={() => setDetalle(null)}
          />
        );
      })()}
      {detalle?.tipo === 'MATERIAL' && hoja && (
        <DetalleOrdenesModal
          titulo={`${MATERIALES.find((m) => m.id === detalle.material).nombre.toUpperCase()} · ${hoja.nombre.toUpperCase()}`}
          subtitulo="Órdenes finalizadas donde se usó este material"
          columnas={columnasDetalleMaterial(detalle.material)}
          filas={ordenesConMaterial(hoja.lista, detalle.material).map((t) => filaDetalleMaterial(t, detalle.material))}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}
