import { useMemo, useState } from 'react';
import { Banknote } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useDatosAlmacen } from '../hooks/useDatosAlmacen';
import { useFinanzas } from '../hooks/useFinanzas';
import { useTasaDolar } from '../hooks/useTasaDolar';
import { todasLasOrdenes } from '../utils/gestionTecnicos';
import { diaLegible, rangoDe } from '../utils/periodoReporte';
import { diaDe } from '../utils/totalesMes';
import { FECHA_CORTE, mudanzasSinTipo, ordenesPagables, rangoPagable, ordenesYaPagadas, resumenPagado, resumenPagos, totalesPagados } from '../utils/finanzas';
import { csvDeDocumento } from '../utils/csvReporte';
import { descargarCsv } from '../utils/exportarOrdenes';
import { exportarDocumento } from '../utils/exportarDocumento';
import { documentoPagosTecnicos, documentoResumenPagos } from '../utils/modelosReporte';
import Toast from './Toast';
import EncabezadoSimple from './EncabezadoSimple';
import BarraFinanzas from './finanzas/BarraFinanzas';
import TasaBcv from './finanzas/TasaBcv';
import TecnicosFinanzas from './finanzas/TecnicosFinanzas';
import TamanoLetra from './finanzas/TamanoLetra';
import { useTamanoLetra } from '../hooks/useTamanoLetra';
import ResumenPagado from './finanzas/ResumenPagado';
import TabuladorPrecios from './finanzas/TabuladorPrecios';

// "3:45 p. m." (hora de Caracas) de cuando se leyeron las órdenes por última vez.
const horaLegible = (ms) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms));

// `documento` y `archivo`: lo que se baja con "Exportar" en esa sección (el tabulador no tiene).
const SECCIONES = [
  { id: 'PAGOS', nombre: 'Técnicos', corto: 'Técnicos', documento: documentoPagosTecnicos, archivo: 'pago-a-tecnicos' },
  { id: 'PRECIOS', nombre: 'Tabulador de precios', corto: 'Precios' },
  { id: 'REPORTE', nombre: 'Reporte de pagos', corto: 'Reporte', documento: documentoResumenPagos, archivo: 'resumen-de-pagos' },
];

// Pantalla de FINANZAS: pagar a los técnicos, el tabulador de precios y el reporte de lo pagado. No toca las órdenes: lo que guarda va en sus propias colecciones.
export default function FinanzasApp({ auth }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout } = auth;
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { toastMsg, setToastMsg } = useToast();
  // Sin listeners en vivo sobre las órdenes (ver useDatosAlmacen): se leen al abrir y con "Actualizar".
  const { tickets, technicians, reports, cargado, error, actualizadoEn, actualizando, actualizar, hayMasReportes, cargandoReportes, cargarReportesAnteriores } = useDatosAlmacen(firebaseUser);

  const [nivelLetra, setNivelLetra] = useTamanoLetra();
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

  // Lo que se debe cuenta desde la fecha de corte: lo anterior del periodo elegido no se muestra.
  const rangoDeuda = useMemo(() => rangoPagable(rango), [rango]);
  const items = useMemo(() => ordenesPagables(ordenes, rangoDeuda, { tecnico, registros: finanzas.registros, tiposMudanza: finanzas.tiposMudanza }), [ordenes, rangoDeuda, tecnico, finanzas.registros, finanzas.tiposMudanza]);
  const sinTipo = useMemo(() => mudanzasSinTipo(ordenes, rangoDeuda, { tecnico, tiposMudanza: finanzas.tiposMudanza }), [ordenes, rangoDeuda, tecnico, finanzas.tiposMudanza]);
  // Los adelantos del técnico elegido arriba (o de todos).
  const adelantosVisibles = useMemo(() => finanzas.adelantos.filter((a) => !tecnico || String(a.tecnico).toUpperCase() === tecnico.toUpperCase()), [finanzas.adelantos, tecnico]);
  const filasPagos = useMemo(() => resumenPagos(items, finanzas.tarifas, finanzas.idsPagadas, adelantosVisibles), [items, finanzas.tarifas, finanzas.idsPagadas, adelantosVisibles]);
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
      const contexto = { rango, tecnico, ahora: Date.now(), generadoPor: currentUser, pagosFinanzas: { filas: filasPagos, pagos: finanzas.pagos, pagadasPorTecnico, tasa, adelantos: adelantosVisibles } };
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

        <main className="p-4 sm:p-6 w-full flex-1 space-y-3 text-base">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Secciones de Finanzas" className="flex gap-2 w-full md:w-auto">
              {SECCIONES.map(({ id, nombre, corto }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={seccion === id}
                  onClick={() => setSeccion(id)}
                  className={`flex-1 md:flex-none h-10 px-4 rounded-lg text-base font-semibold border-2 transition-colors ${seccion === id ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-600 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                >
                  <span className="sm:hidden">{corto}</span><span className="hidden sm:inline">{nombre}</span>
                </button>
              ))}
            </div>
            <TamanoLetra nivel={nivelLetra} onNivel={setNivelLetra} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <TasaBcv tasa={bcv.tasa} fecha={bcv.fecha} cargando={bcv.cargando} error={bcv.error} onActualizar={bcv.actualizar} />
            {cargado && (
              <span role="status" className="sm:ml-auto text-sm text-zinc-600 dark:text-zinc-300">{error ? 'No se pudo actualizar.' : `Última actualización: ${horaLegible(actualizadoEn)}`}</span>
            )}
          </div>

          {error && !actualizadoEn ? (
            <p role="alert" className="text-lg text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar los datos. Revisa tu conexión e intenta de nuevo.</p>
          ) : !cargado ? (
            <p role="status" className="text-lg text-zinc-600 dark:text-zinc-300 text-center py-10">Cargando...</p>
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
              {errorExportar && <p role="alert" className="text-base text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-lg px-4 py-3">{errorExportar}</p>}
              {finanzas.error && <p role="alert" className="text-base text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-lg px-4 py-3">No se pudieron leer los datos de Finanzas (tarifas o pagos). Recarga la página.</p>}

              {seccion === 'PAGOS' && FECHA_CORTE && rango.desde < FECHA_CORTE && (
                <p role="status" className="text-base text-zinc-700 dark:text-zinc-200 bg-zinc-200/70 dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3">
                  Finanzas cuenta lo que se debe a los técnicos desde el {diaLegible(FECHA_CORTE)}: lo anterior de este periodo no se muestra.
                </p>
              )}
              <div key={seccion} className="lg:animate-fade-in space-y-4">
              {seccion === 'PAGOS' && (
                <TecnicosFinanzas
                  filas={filasPagos}
                  items={items}
                  sinTipo={sinTipo}
                  onTipoMudanza={finanzas.guardarTipoMudanza}
                  tarifas={finanzas.tarifas}
                  pagos={finanzas.pagos}
                  adelantos={adelantosVisibles}
                  pagadasPorTecnico={pagadasPorTecnico}
                  rango={rango}
                  tasa={tasa}
                  ocupado={finanzas.ocupado}
                  historial={historial}
                  onPagar={(fila, opciones) => finanzas.pagar(fila, rangoDeuda, { ...opciones, tasa })}
                  onAnular={finanzas.anular}
                  onAdelanto={finanzas.registrarAdelanto}
                  onAnularAdelanto={finanzas.anularAdelanto}
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
