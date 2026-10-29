import { useMemo, useState } from 'react';
import { Banknote, RefreshCw } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useTema } from '../hooks/useTema';
import { useDatosAlmacen } from '../hooks/useDatosAlmacen';
import { useFinanzas } from '../hooks/useFinanzas';
import { usePagosFinanzas } from '../hooks/usePagosOrdenes';
import { useTasaDolar } from '../hooks/useTasaDolar';
import { todasLasOrdenes } from '../utils/gestionTecnicos';
import { rangoDe } from '../utils/periodoReporte';
import { diaDe } from '../utils/totalesMes';
import { corteTodaviaNoLlega, textoFechaCorte, rangoPagable, ordenesYaPagadas, resumenPagado, resumenPagos, totalesPagados } from '../utils/finanzas';
import { itemsParaRevisar, paraFinanzas, revisar } from '../utils/revisionPagos';
import { csvDeDocumento } from '../utils/csvReporte';
import { descargarCsv } from '../utils/exportarOrdenes';
import { exportarDocumento } from '../utils/exportarDocumento';
import { documentoPagosClientes, documentoPagosTecnicos, documentoResumenPagos } from '../utils/modelosReporte';
import Toast from './Toast';
import EncabezadoSimple from './EncabezadoSimple';
import PieVersion from './PieVersion';
import BarraFinanzas from './finanzas/BarraFinanzas';
import AccionesEncabezado from './AccionesEncabezado';
import MenuExportar from './modals/reports/MenuExportar';
import TasaBcv from './finanzas/TasaBcv';
import TecnicosFinanzas from './finanzas/TecnicosFinanzas';
import TamanoLetra from './finanzas/TamanoLetra';
import { useTamanoLetra } from '../hooks/useTamanoLetra';
import ResumenPagado from './finanzas/ResumenPagado';
import PagosClientes from './finanzas/PagosClientes';
import TabuladorPrecios from './finanzas/TabuladorPrecios';

// "3:45 p. m." (hora de Caracas) de cuando se leyeron las órdenes por última vez.
const horaLegible = (ms) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms));

// `documento` y `archivo`: lo que se baja con "Exportar" en esa sección (el tabulador no tiene).
// Mientras no está abierta "Pagos de clientes" no se lee nada de pagosOrdenes (un rango vacío no consulta).
const SIN_LEER = { desde: '', hasta: '' };

const SECCIONES = [
  { id: 'PAGOS', nombre: 'Técnicos', corto: 'Técnicos', documento: documentoPagosTecnicos, archivo: 'pago-a-tecnicos' },
  { id: 'CLIENTES', nombre: 'Pagos de clientes', corto: 'Clientes', documento: documentoPagosClientes, archivo: 'pagos-de-clientes' },
  { id: 'PRECIOS', nombre: 'Tabulador de precios', corto: 'Precios' },
  { id: 'REPORTE', nombre: 'Reporte de pagos', corto: 'Reporte', documento: documentoResumenPagos, archivo: 'resumen-de-pagos' },
];

// Pantalla de FINANZAS: pagar a los técnicos, el tabulador de precios y el reporte de lo pagado. No toca las órdenes: lo que guarda va en sus propias colecciones.
// `onAbrirMenu`: cuando un administrador está aquí dentro del menú lateral, el botón ☰ que lo abre en el celular.
export default function FinanzasApp({ auth, onAbrirMenu }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout } = auth;
  const [isDarkMode, setIsDarkMode] = useTema(currentUser);
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
  // Lo que pagaron los clientes por instalaciones y cambios de equipo (lo registra el técnico); solo se lee cuando se abre esa sección.
  const pagosClientes = usePagosFinanzas(firebaseUser, seccion === 'CLIENTES' ? rango : SIN_LEER);
  // La tasa BCV del dólar, para mostrar los bolívares (cada pago guarda la de su momento).
  const bcv = useTasaDolar();
  const tasa = bcv.tasa;
  const ordenes = useMemo(() => todasLasOrdenes(tickets, reports), [tickets, reports]);
  const nombresTecnicos = useMemo(() => technicians.map((t) => t.name).filter(Boolean).sort(), [technicians]);
  const historial = { hasMoreReports: hayMasReportes, isLoadingReports: cargandoReportes, onLoadMoreReports: cargarReportesAnteriores };

  // Lo que se debe cuenta desde la fecha de corte: lo anterior del periodo elegido no se muestra.
  const rangoDeuda = useMemo(() => rangoPagable(rango), [rango]);
  // Finanzas solo ve lo que un administrador aprobó (ver el módulo Revisión de órdenes) y lo que ya se pagó. `revisados` trae todo con su estado de revisión.
  const revisados = useMemo(
    () => revisar(itemsParaRevisar({ ordenes, rango: rangoDeuda, rangoElegido: rango, tecnico, registros: finanzas.registros, tiposMudanza: finanzas.tiposMudanza }), finanzas.revisiones),
    [ordenes, rangoDeuda, rango, tecnico, finanzas.registros, finanzas.tiposMudanza, finanzas.revisiones],
  );
  const items = useMemo(() => paraFinanzas(revisados, finanzas.idsPagadas), [revisados, finanzas.idsPagadas]);
  // Lo que todavía espera la revisión del administrador (no está aprobado, retenido ni excluido).
  const esperandoRevision = useMemo(() => revisados.filter((i) => i.estadoRevision === 'PENDIENTE' && !finanzas.idsPagadas.has(i.clave)).length, [revisados, finanzas.idsPagadas]);
  // Las originales que tienen una garantía de otro técnico por revisar (todavía sin aprobar): su descuento puede llegar después de pagarlas.
  const garantiasPendientes = useMemo(() => new Set(revisados.filter((i) => i.garantiaDe?.id && i.estadoRevision !== 'APROBADA' && i.estadoRevision !== 'EXCLUIDA').map((i) => i.garantiaDe.id)), [revisados]);
  const sinTipo = [];
  // Los adelantos del técnico elegido arriba (o de todos).
  const adelantosVisibles = useMemo(() => finanzas.adelantos.filter((a) => !tecnico || String(a.tecnico).toUpperCase() === tecnico.toUpperCase()), [finanzas.adelantos, tecnico]);
  // Los descuentos y bonos por órdenes corregidas del técnico elegido (o de todos): entran en su próximo pago.
  const ajustesVisibles = useMemo(() => finanzas.ajustes.filter((a) => !tecnico || String(a.tecnico).toUpperCase() === tecnico.toUpperCase()), [finanzas.ajustes, tecnico]);
  // Los descuentos con motivo del técnico elegido (o de todos): se restan de su próximo pago.
  const descuentosVisibles = useMemo(() => finanzas.descuentos.filter((d) => !tecnico || String(d.tecnico).toUpperCase() === tecnico.toUpperCase()), [finanzas.descuentos, tecnico]);
  const filasPagos = useMemo(() => resumenPagos(items, finanzas.tarifas, finanzas.idsPagadas, adelantosVisibles, ajustesVisibles, descuentosVisibles), [items, finanzas.tarifas, finanzas.idsPagadas, adelantosVisibles, ajustesVisibles, descuentosVisibles]);
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
      const contexto = { rango, tecnico, ahora: Date.now(), generadoPor: currentUser, pagosClientes: pagosClientes.pagos, pagosFinanzas: { filas: filasPagos, pagos: finanzas.pagos, pagadasPorTecnico, tasa, adelantos: adelantosVisibles, descuentos: descuentosVisibles } };
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
      <div className="min-h-screen bg-fondo text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />
        <EncabezadoSimple onAbrirMenu={onAbrirMenu} contexto={cargado ? (error ? 'No se pudo actualizar.' : `Última actualización: ${horaLegible(actualizadoEn)}`) : ''} titulo="Finanzas" icono={Banknote} nombre={currentUserName || currentUser} rol={role} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} />

        {cargado && seccion !== 'PRECIOS' && (
          <AccionesEncabezado
            encabezado={(
              <>
                <button
                  type="button"
                  onClick={actualizar}
                  disabled={actualizando}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className={`w-4 h-4 ${actualizando ? 'animate-spin' : ''}`} aria-hidden="true" /> {actualizando ? 'Actualizando...' : 'Actualizar'}
                </button>
                <MenuExportar formatos={['pdf', 'docx', 'csv']} onElegir={exportar} ocupado={exportando} extra="h-9! px-3! text-xs! bg-zinc-800! border-zinc-700! text-white! hover:bg-zinc-700!" />
              </>
            )}
          />
        )}

        <main className="p-4 sm:p-6 w-full flex-1 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Secciones de Finanzas" className="flex gap-2 w-full md:w-auto">
              {SECCIONES.map(({ id, nombre, corto }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={seccion === id}
                  onClick={() => setSeccion(id)}
                  className={`flex-1 md:flex-none min-w-0 h-9 px-2 sm:px-4 rounded-lg text-sm font-semibold border transition-colors ${seccion === id ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
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
              <span role="status" className="sm:ml-auto lg:hidden text-xs text-zinc-600 dark:text-zinc-300">{error ? 'No se pudo actualizar.' : `Última actualización: ${horaLegible(actualizadoEn)}`}</span>
            )}
          </div>

          {error && !actualizadoEn ? (
            <p role="alert" className="text-base text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar los datos. Revisa tu conexión e intenta de nuevo.</p>
          ) : !cargado ? (
            <p role="status" className="text-base text-zinc-600 dark:text-zinc-300 text-center py-10">Cargando...</p>
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
                  onRecargar={() => { actualizar(); if (seccion === 'CLIENTES') pagosClientes.recargar(); }}
                  formatosExportar={['pdf', 'docx', 'csv']}
                  onExportar={exportar}
                  exportando={exportando}
                />
              )}
              {errorExportar && <p role="alert" className="text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg px-4 py-3">{errorExportar}</p>}
              {finanzas.error && <p role="alert" className="text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg px-4 py-3">No se pudieron leer los datos de Finanzas (tarifas o pagos). Recarga la página.</p>}

              {seccion === 'PAGOS' && corteTodaviaNoLlega() && (
                <p role="status" className="text-sm text-zinc-700 dark:text-zinc-200 bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-700 rounded-lg px-4 py-3">
                  Comienza a contar a partir del {textoFechaCorte()}: lo anterior de este periodo no se muestra.
                </p>
              )}
              <div key={seccion} className="lg:animate-fade-in space-y-4">
              {seccion === 'PAGOS' && (
                <TecnicosFinanzas
                  filas={filasPagos}
                  items={items}
                  sinTipo={sinTipo}
                  esperandoRevision={esperandoRevision}
                  onTipoMudanza={finanzas.guardarTipoMudanza}
                  tarifas={finanzas.tarifas}
                  pagos={finanzas.pagos}
                  adelantos={adelantosVisibles}
                  descuentos={descuentosVisibles}
                  ajustes={ajustesVisibles}
                  ajustesTodos={finanzas.ajustes}
                  garantiasPendientes={garantiasPendientes}
                  pagadasPorTecnico={pagadasPorTecnico}
                  rango={rango}
                  tasa={tasa}
                  ocupado={finanzas.ocupado}
                  historial={historial}
                  onPagar={(fila, opciones) => finanzas.pagar(fila, rangoDeuda, { ...opciones, tasa })}
                  onAnular={finanzas.anular}
                  tecnicosTodos={nombresTecnicos}
                  onAdelanto={finanzas.registrarAdelanto}
                  onAnularAdelanto={finanzas.anularAdelanto}
                  onDescuento={finanzas.registrarDescuento}
                  onAnularDescuento={finanzas.anularDescuento}
                />
              )}
              {seccion === 'CLIENTES' && <PagosClientes pagos={pagosClientes.pagos} rango={rango} tecnico={tecnico} cargado={pagosClientes.cargado} error={pagosClientes.error} />}
              {seccion === 'PRECIOS' && <TabuladorPrecios tasa={tasa} tarifas={finanzas.tarifas} tarifasCargadas={finanzas.tarifasCargadas} ocupado={finanzas.ocupado} onGuardar={finanzas.guardarTarifas} />}
              {seccion === 'REPORTE' && <ResumenPagado resumen={pagado} rango={rango} ordenesPagadas={yaPagadas} tarifas={finanzas.tarifas} tasa={tasa} />}
              </div>
            </>
          )}
        </main>
        <PieVersion />
      </div>
    </div>
  );
}
