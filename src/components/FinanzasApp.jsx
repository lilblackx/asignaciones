import { useMemo, useState } from 'react';
import { Banknote } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useDatosAlmacen } from '../hooks/useDatosAlmacen';
import { useFinanzas } from '../hooks/useFinanzas';
import { useTasaDolar } from '../hooks/useTasaDolar';
import { todasLasOrdenes } from '../utils/gestionTecnicos';
import { rangoDe } from '../utils/periodoReporte';
import { diaDe } from '../utils/totalesMes';
import { mudanzasSinTipo, ordenesPagables, ordenesYaPagadas, resumenPagado, resumenPagos, totalesPagados } from '../utils/finanzas';
import { csvDeDocumento } from '../utils/csvReporte';
import { descargarCsv } from '../utils/exportarOrdenes';
import { exportarDocumento } from '../utils/exportarDocumento';
import { documentoPagosTecnicos, documentoResumenPagos } from '../utils/modelosReporte';
import Toast from './Toast';
import EncabezadoSimple from './EncabezadoSimple';
import BarraFinanzas from './finanzas/BarraFinanzas';
import TasaBcv from './finanzas/TasaBcv';
import PagosFinanzas from './finanzas/PagosFinanzas';
import ResumenPagado from './finanzas/ResumenPagado';
import TabuladorPrecios from './finanzas/TabuladorPrecios';

// `documento` y `archivo`: lo que se baja con "Exportar" en esa sección (el tabulador no tiene).
const SECCIONES = [
  { id: 'PAGOS', nombre: 'Técnicos', documento: documentoPagosTecnicos, archivo: 'pago-a-tecnicos' },
  { id: 'PRECIOS', nombre: 'Tabulador de precios' },
  { id: 'REPORTE', nombre: 'Reporte de pagos', documento: documentoResumenPagos, archivo: 'resumen-de-pagos' },
];

// Pantalla de FINANZAS: pagar a los técnicos, el tabulador de precios y el reporte de lo pagado. No toca las órdenes: lo que guarda va en sus propias colecciones.
export default function FinanzasApp({ auth }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout } = auth;
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { toastMsg, setToastMsg } = useToast();
  // Sin listeners en vivo sobre las órdenes (ver useDatosAlmacen): se leen al abrir y con "Actualizar".
  const { tickets, technicians, reports, cargado, error, actualizadoEn, actualizando, actualizar, hayMasReportes, cargandoReportes, cargarReportesAnteriores } = useDatosAlmacen(firebaseUser);

  const [seccion, setSeccion] = useState('PAGOS');
  const [periodo, setPeriodo] = useState('7_DIAS');
  const [hoy] = useState(() => diaDe(Date.now()));
  const [personalizado, setPersonalizado] = useState(() => ({ desde: rangoDe('7_DIAS').desde, hasta: hoy }));
  const [tecnico, setTecnico] = useState('');
  const [exportando, setExportando] = useState(null);
  const [errorExportar, setErrorExportar] = useState('');

  const rango = useMemo(() => rangoDe(periodo, personalizado), [periodo, personalizado]);
  const finanzas = useFinanzas({ firebaseUser, rango, usuario: currentUser, setToastMsg });
  // La tasa BCV del dólar, para mostrar los bolívares (cada pago guarda la de su momento).
  const bcv = useTasaDolar();
  const tasa = bcv.tasa;
  const ordenes = useMemo(() => todasLasOrdenes(tickets, reports), [tickets, reports]);
  const nombresTecnicos = useMemo(() => technicians.map((t) => t.name).filter(Boolean).sort(), [technicians]);
  const historial = { hasMoreReports: hayMasReportes, isLoadingReports: cargandoReportes, onLoadMoreReports: cargarReportesAnteriores };

  const items = useMemo(() => ordenesPagables(ordenes, rango, { tecnico, registros: finanzas.registros, tiposMudanza: finanzas.tiposMudanza }), [ordenes, rango, tecnico, finanzas.registros, finanzas.tiposMudanza]);
  const sinTipo = useMemo(() => mudanzasSinTipo(ordenes, rango, { tecnico, tiposMudanza: finanzas.tiposMudanza }), [ordenes, rango, tecnico, finanzas.tiposMudanza]);
  const filasPagos = useMemo(() => resumenPagos(items, finanzas.tarifas, finanzas.idsPagadas), [items, finanzas.tarifas, finanzas.idsPagadas]);
  // Lo ya pagado en el periodo por técnico (respeta el técnico elegido arriba).
  const pagadasPorTecnico = useMemo(
    () => {
      const tasaDe = (pagoId) => finanzas.pagos.find((p) => p.id === pagoId)?.tasa || tasa;
      return totalesPagados(finanzas.pagadas.filter((p) => !tecnico || String(p.tecnico).toUpperCase() === tecnico.toUpperCase()), tasaDe);
    },
    [finanzas.pagadas, finanzas.pagos, tecnico, tasa],
  );
  const yaPagadas = useMemo(
    () => ordenesYaPagadas(finanzas.pagadas.filter((p) => !tecnico || String(p.tecnico).toUpperCase() === tecnico.toUpperCase()), items),
    [finanzas.pagadas, items, tecnico],
  );
  const pagado = useMemo(() => resumenPagado(finanzas.pagos, rango, { tecnico, tasa }), [finanzas.pagos, rango, tecnico, tasa]);

  const actual = SECCIONES.find((s) => s.id === seccion);

  const exportar = async (formato) => {
    setErrorExportar('');
    setExportando(formato);
    try {
      const contexto = { rango, tecnico, ahora: Date.now(), generadoPor: currentUser, pagosFinanzas: { filas: filasPagos, pagos: finanzas.pagos, pagadasPorTecnico, tasa } };
      const documento = actual.documento(contexto);
      if (formato === 'csv') descargarCsv(csvDeDocumento(documento), `${actual.archivo}_${rango.desde}_${rango.hasta}.csv`);
      else await exportarDocumento(documento, formato, rango);
    } catch (e) {
      console.error('No se pudo generar el archivo:', e);
      setErrorExportar('No se pudo generar el archivo. Intenta de nuevo.');
    } finally {
      setExportando(null);
    }
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />
        <EncabezadoSimple titulo="Finanzas" icono={Banknote} nombre={currentUserName || currentUser} rol={role} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} />

        <main className="p-4 max-w-[1400px] mx-auto w-full flex-1 space-y-3">
          <div role="tablist" aria-label="Secciones de Finanzas" className="flex gap-1.5 p-1 rounded-xl bg-zinc-200 dark:bg-zinc-900 md:max-w-xl mb-2">
            {SECCIONES.map(({ id, nombre }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={seccion === id}
                onClick={() => setSeccion(id)}
                className={`flex-1 px-2 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${seccion === id ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
              >
                {nombre}
              </button>
            ))}
          </div>

          <TasaBcv tasa={bcv.tasa} fecha={bcv.fecha} cargando={bcv.cargando} error={bcv.error} onActualizar={bcv.actualizar} />

          {error && !actualizadoEn ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar los datos. Revisa tu conexión e intenta de nuevo.</p>
          ) : !cargado ? (
            <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-10">Cargando...</p>
          ) : (
            <>
              {seccion !== 'PRECIOS' && (
                <BarraFinanzas
                  periodo={periodo}
                  onPeriodo={setPeriodo}
                  personalizado={personalizado}
                  onPersonalizado={setPersonalizado}
                  hoy={hoy}
                  tecnico={tecnico}
                  onTecnico={setTecnico}
                  tecnicos={nombresTecnicos}
                  cargando={actualizando}
                  onRecargar={actualizar}
                  formatosExportar={['pdf', 'docx', 'csv']}
                  onExportar={exportar}
                  exportando={exportando}
                />
              )}
              {errorExportar && <p role="alert" className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{errorExportar}</p>}
              {finanzas.error && <p role="alert" className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">No se pudieron leer los datos de Finanzas (tarifas o pagos). Recarga la página.</p>}

              <div key={seccion} className="lg:animate-fade-in space-y-3">
              {seccion === 'PAGOS' && (
                <PagosFinanzas
                  filas={filasPagos}
                  items={items}
                  sinTipo={sinTipo}
                  onTipoMudanza={finanzas.guardarTipoMudanza}
                  tarifas={finanzas.tarifas}
                  pagos={finanzas.pagos}
                  pagadasPorTecnico={pagadasPorTecnico}
                  rango={rango}
                  tasa={tasa}
                  ocupado={finanzas.ocupado}
                  historial={historial}
                  onPagar={(fila) => finanzas.pagar(fila, rango, '', tasa)}
                  onAnular={finanzas.anular}
                />
              )}
              {seccion === 'PRECIOS' && <TabuladorPrecios tasa={tasa} tarifas={finanzas.tarifas} tarifasCargadas={finanzas.tarifasCargadas} ocupado={finanzas.ocupado} onGuardar={finanzas.guardarTarifas} />}
              {seccion === 'REPORTE' && <ResumenPagado resumen={pagado} rango={rango} ordenesPagadas={yaPagadas} tarifas={finanzas.tarifas} tasa={tasa} />}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
