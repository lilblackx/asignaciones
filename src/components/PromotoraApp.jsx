import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownAZ, Building2, CalendarDays, ChevronDown, Download, Megaphone, Search, SlidersHorizontal } from 'lucide-react';
import { etiquetaRol } from '../constants';
import BotonLimpiarBusqueda from './BotonLimpiarBusqueda';
import { useToast } from '../hooks/useToast';
import { useTema } from '../hooks/useTema';
import { useAhora } from '../hooks/useAhora';
import { usePreferencia } from '../hooks/usePreferencia';
import { useEstadisticasMes } from '../hooks/useEstadisticasMes';
import { useInstalacionesPromotora } from '../hooks/useInstalacionesPromotora';
import { useHistorialInstalaciones } from '../hooks/useHistorialInstalaciones';
import { useCrearVenta } from '../hooks/useCrearVenta';
import { DIRECCION_POR_DEFECTO, FILTROS_FECHA, OPCIONES_ORDEN_DIRECCION, ORDEN_ESTADOS_PROMOTORA, ORDEN_POR_DEFECTO, RETENCION_DIAS_HISTORIAL, RETENCION_DIAS_HISTORIAL_VENTAS, algunaOrdenSalio, atrasoOrden, categoriaOrden, claveFiltroFecha, enRangoFecha, etiquetaFiltroEstado, fechaOrden, ordenarOrdenes, resumenPorPromotor, textoPlantillaFinal, unirInstalaciones } from '../utils/estadoInstalacion';
import { mesDe, mesesDeTotales, totalesDelMes } from '../utils/totalesMes';
import { claveNombre } from '../utils/promotora';
import { csvDeOrdenes, descargarCsv, nombreArchivoExportacion } from '../utils/exportarOrdenes';
import Toast from './Toast';
import EncabezadoSimple from './EncabezadoSimple';
import PieVersion from './PieVersion';
import TarjetaInstalacion from './TarjetaInstalacion';
import ResumenPromotores from './ResumenPromotores';
import TotalesMes from './TotalesMes';
import SelectMenu from './SelectMenu';
import Calendario from './Calendario';
import { fechaCorta, fechaISO } from '../utils/calendario';
import PlantillaFinalModal from './modals/PlantillaFinalModal';
import { promotoraDeOrden } from '../utils/whatsapp';
import Spinner from './Spinner';
import Colapsable from './Colapsable';

const NuevaVentaModal = lazy(() => import('./modals/NuevaVentaModal'));

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// El número va en un recuadro al lado de la etiqueta, como las insignias del resto de la app ("SIN TÉCNICO 3").
function Contador({ n, tono }) {
  return <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums ${tono}`}>{n}</span>;
}

const ETIQUETA_FILTRO = 'text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400';
const claveDePromotor = (o) => claveNombre(promotoraDeOrden(o)) || '-';

// Pantalla de la PROMOTORA: todas las instalaciones y en qué van. Solo lectura; no ve averías, cobros ni datos técnicos.
// `onAbrirMenu`: cuando un administrador está aquí dentro del menú lateral (solo lectura, ve las de todas las promotoras), el botón ☰ que lo abre en el celular.
export default function PromotoraApp({ auth, onAbrirMenu }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout, promotoraClaves, promotoraNombres, verTodasInstalaciones, puedeCrearVentas } = auth;
  // El tema y la categoría elegida se recuerdan en este equipo, por usuario (no cuestan nada en Firebase).
  const [isDarkMode, setIsDarkMode] = useTema(currentUser);
  const { toastMsg, setToastMsg } = useToast();
  const ahora = useAhora();
  // Solo ve las instalaciones de su promotora (los nombres que el administrador le asignó). Sin nombres no ve nada,
  // salvo el perfil de ventas (`verTodasInstalaciones`), que ve las de todas las promotoras.
  const sinNombre = !verTodasInstalaciones && promotoraClaves.length === 0;
  const { tickets, cargado, error } = useInstalacionesPromotora(firebaseUser, promotoraClaves, verTodasInstalaciones);
  const { historial, actualizarCuandoPueda: actualizarHistorial, hayMas: hayMasCerradas, cargarMas: cargarMasCerradas, cargandoMas } = useHistorialInstalaciones(firebaseUser, promotoraClaves, verTodasInstalaciones);
  // Las órdenes abiertas llegan solas en vivo; las cerradas se leen una vez (cuesta lecturas). Cuando una orden sale de la lista en vivo,
  // el cierre del día la pasó al historial: ahí se vuelve a leer lo cerrado, sin que nadie tenga que pedirlo.
  const idsEnVivo = useRef(null);
  useEffect(() => {
    if (!cargado) return;
    if (algunaOrdenSalio(idsEnVivo.current, tickets)) actualizarHistorial();
    idsEnVivo.current = new Set(tickets.map((t) => t.id));
  }, [tickets, cargado, actualizarHistorial]);
  const [filtro, setFiltro] = useState('TODAS');
  // Solo ventas (ve todas) trabaja con instalaciones y averías LOS: elige ver las dos juntas, solo instalaciones o solo LOS.
  const [categoria, setCategoria] = usePreferencia(`categoria:${currentUser}`, 'TODO', (v) => ['TODO', 'INSTALACION', 'LOS'].includes(v));
  const vista = verTodasInstalaciones ? categoria : 'INSTALACION';
  const [busqueda, setBusqueda] = useState('');
  const [fecha, setFecha] = useState('TODAS');
  // Un día elegido en el calendario del filtro de fecha: la fecha del calendario (AAAA-MM-DD); solo filtra cuando se eligió.
  const [dia, setDia] = useState('');
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const claveFecha = claveFiltroFecha(fecha, dia);
  const [promotor, setPromotor] = useState('TODOS');
  const [soloAtrasadas, setSoloAtrasadas] = useState(false);
  const [criterioOrden, setCriterioOrden] = useState(ORDEN_POR_DEFECTO);
  const [direccion, setDireccion] = useState(DIRECCION_POR_DEFECTO);
  const [verResumen, setVerResumen] = useState(false);
  const [verFiltros, setVerFiltros] = useState(false);
  const [creandoVenta, setCreandoVenta] = useState(false);
  const crearVenta = useCrearVenta(firebaseUser, { username: currentUser, nombre: currentUserName, verTodas: verTodasInstalaciones, promotoraClaves }, setToastMsg);
  const [mes, setMes] = useState(() => mesDe(ahora));
  // Con un día elegido en el calendario, se leen más cerradas (por páginas) hasta cubrir ese día: si no, el día elegido podría parecer vacío
  // solo porque sus órdenes todavía no se cargaron.
  useEffect(() => {
    if (!claveFecha.startsWith('DIA:') || !hayMasCerradas || cargandoMas) return;
    const [anio, mesDia, diaDelMes] = claveFecha.slice(4).split('-').map(Number);
    const inicioDelDia = new Date(anio, mesDia - 1, diaDelMes).getTime();
    const masVieja = historial.reduce((min, h) => Math.min(min, h.archivadoEn || Infinity), Infinity);
    if (masVieja > inicioDelDia) cargarMasCerradas();
  }, [claveFecha, hayMasCerradas, cargandoMas, historial, cargarMasCerradas]);

  // Instalación finalizada cuya plantilla se está viendo (se guarda la orden; el texto se arma al mostrarla).
  const [plantillaDe, setPlantillaDe] = useState(null);

  // Copia el texto y avisa con el toast (devuelve si pudo, para el visto del botón).
  const copiar = async (texto, mensaje) => {
    try {
      await navigator.clipboard.writeText(texto);
      setToastMsg({ type: 'success', text: mensaje });
      return true;
    } catch {
      setToastMsg({ type: 'error', text: 'No se pudo copiar.' });
      return false;
    }
  };

  // "Copiar" de la tarjeta: la misma plantilla que muestra "Ver plantilla", sin abrirla.
  const copiarDeTarjeta = (orden) => copiar(textoPlantillaFinal(orden), `Plantilla de ${orden.codigo || 'la orden'} copiada.`);

  // Totales del mes (solo ventas): lo cerrado sale de un documento por mes; lo de hoy, de las órdenes en vivo que ya están cargadas.
  const meses = useMemo(() => mesesDeTotales(ahora), [ahora]);
  const { contador, cargado: totalesCargados, error: errorTotales } = useEstadisticasMes(firebaseUser, verTodasInstalaciones, mes);
  const totales = useMemo(() => (totalesCargados || errorTotales ? totalesDelMes(contador, tickets, mes, ahora) : null), [contador, totalesCargados, errorTotales, tickets, mes, ahora]);

  const todas = useMemo(() => unirInstalaciones(tickets, historial, ahora), [tickets, historial, ahora]);
  const cuantasPorCategoria = useMemo(() => todas.reduce((acc, o) => ({ ...acc, [categoriaOrden(o)]: (acc[categoriaOrden(o)] || 0) + 1 }), {}), [todas]);
  // Lo que se ve según el selector de arriba; los demás filtros, el conteo y el buscador trabajan sobre esto.
  const ordenes = useMemo(() => (vista === 'TODO' ? todas : todas.filter((o) => categoriaOrden(o) === vista)), [todas, vista]);
  const porFecha = useMemo(() => ordenes.filter((o) => enRangoFecha(fechaOrden(o), claveFecha, ahora)), [ordenes, claveFecha, ahora]);
  // Los promotores que hay en lo que se está viendo (para el selector y el resumen); el elegido que ya no está en la lista se descarta solo.
  const filasPromotor = useMemo(() => (verTodasInstalaciones ? resumenPorPromotor(porFecha) : []), [porFecha, verTodasInstalaciones]);
  const promotorActivo = filasPromotor.some((f) => (f.clave || '-') === promotor) ? promotor : 'TODOS';
  const base = useMemo(() => (promotorActivo === 'TODOS' ? porFecha : porFecha.filter((o) => claveDePromotor(o) === promotorActivo)), [porFecha, promotorActivo]);
  const conteo = useMemo(() => base.reduce((acc, o) => ({ ...acc, [o.vista.clave]: (acc[o.vista.clave] || 0) + 1 }), {}), [base]);
  const atrasadas = useMemo(() => base.filter((o) => atrasoOrden(o, ahora)).length, [base, ahora]);
  const visibles = useMemo(() => {
    const q = sinTildes(busqueda).trim();
    const lista = base.filter((o) => (filtro === 'TODAS' || o.vista.clave === filtro)
      && (!soloAtrasadas || atrasoOrden(o, ahora))
      && (!q || sinTildes(`${o.nombre} ${o.cedula} ${o.codigo} ${verTodasInstalaciones ? promotoraDeOrden(o) : ''}`).includes(q)));
    return ordenarOrdenes(lista, criterioOrden, ahora, direccion);
  }, [base, filtro, soloAtrasadas, busqueda, verTodasInstalaciones, criterioOrden, direccion, ahora]);

  // Cuántos de los filtros del panel (estado, atrasadas, fecha, promotor y orden) están puestos: se avisa en el botón aunque el panel esté cerrado.
  const filtrosActivos = [filtro !== 'TODAS', soloAtrasadas, claveFecha !== 'TODAS', promotorActivo !== 'TODOS', criterioOrden !== ORDEN_POR_DEFECTO || direccion !== DIRECCION_POR_DEFECTO].filter(Boolean).length;
  const hayFiltros = filtro !== 'TODAS' || busqueda !== '' || fecha !== 'TODAS' || promotorActivo !== 'TODOS' || soloAtrasadas || criterioOrden !== ORDEN_POR_DEFECTO || direccion !== DIRECCION_POR_DEFECTO;
  const limpiarFiltros = () => { setFiltro('TODAS'); setBusqueda(''); setFecha('TODAS'); setDia(''); setCalendarioAbierto(false); setPromotor('TODOS'); setSoloAtrasadas(false); setCriterioOrden(ORDEN_POR_DEFECTO); setDireccion(DIRECCION_POR_DEFECTO); };
  // Baja a Excel (CSV) lo que se ve ahora, con los filtros y el orden elegidos.
  const exportar = () => {
    descargarCsv(csvDeOrdenes(visibles, ahora), nombreArchivoExportacion(ahora));
    setToastMsg({ type: 'success', text: `Se exportaron ${visibles.length} ${visibles.length === 1 ? 'orden' : 'órdenes'}.` });
  };
  // Cualquier opción de la lista olvida el día elegido; el ícono del calendario (dentro del menú de Fecha) abre o cierra el calendario.
  const elegirFecha = (valor) => {
    setFecha(valor);
    setDia('');
    setCalendarioAbierto(false);
  };
  const abrirCalendario = () => {
    if (fecha === 'DIA') { setCalendarioAbierto((v) => !v); return; }
    setFecha('DIA');
    setCalendarioAbierto(true);
  };
  const elegirOrden = (valor) => { const [criterio, sentido] = valor.split(':'); setCriterioOrden(criterio); setDireccion(sentido); };
  const elegirPromotor = (clave) => setPromotor(promotorActivo === clave ? 'TODOS' : clave);

  const chip = (clave, texto, n) => (
    <button
      key={clave}
      type="button"
      aria-pressed={filtro === clave}
      onClick={() => setFiltro(clave)}
      className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-colors ${filtro === clave ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'}`}
    >
      <span>{texto}</span>
      <Contador n={n} tono={filtro === clave ? 'bg-black/15' : 'bg-zinc-200 dark:bg-zinc-800'} />
    </button>
  );

  // Los desplegables son el menú propio de la app (SelectMenu), como en la pantalla de la oficina.
  // `extra`: { onIconClick, iconLabel, displayLabel } de SelectMenu (el ícono como botón y un texto propio para el valor).
  const selector = (id, etiqueta, icono, valor, alCambiar, opciones, extra = {}) => (
    <div className="flex flex-col gap-1 min-w-0">
      <span className={ETIQUETA_FILTRO}>{etiqueta}</span>
      <SelectMenu id={id} ariaLabel={etiqueta} icon={icono} value={valor} onChange={alCambiar} items={opciones.map(([value, label]) => ({ value, label }))} {...extra} />
    </div>
  );

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-fondo text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />
        <EncabezadoSimple onAbrirMenu={onAbrirMenu} titulo={verTodasInstalaciones ? 'Instalaciones y LOS' : 'Instalaciones'} tituloCorto="Instalaciones" icono={Building2} nombre={currentUserName || currentUser} rol={etiquetaRol(role)} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} accion={puedeCrearVentas ? { texto: 'Nuevo', onClick: () => setCreandoVenta(true), deshabilitado: !verTodasInstalaciones && promotoraClaves.length === 0, ayuda: !verTodasInstalaciones && promotoraClaves.length === 0 ? 'Tu usuario todavía no tiene un nombre de promotor asignado' : 'Nueva venta' } : null} />

        <main className="p-4 max-w-[1400px] mx-auto w-full flex-1 space-y-3">
          {verTodasInstalaciones && cargado && <TotalesMes mes={mes} meses={meses} onCambiarMes={setMes} totales={totales} error={errorTotales} />}

          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <input
                type="search"
                aria-label={verTodasInstalaciones ? 'Buscar por nombre, cédula, código o promotor' : 'Buscar por nombre, cédula o código'}
                placeholder={verTodasInstalaciones ? 'Buscar nombre, cédula, código o promotor' : 'Buscar nombre, cédula o código'}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-400 dark:border-zinc-700 pl-9 pr-10 py-2.5 rounded-xl text-sm focus:ring-0 focus:border-red-600 outline-none"
              />
              <BotonLimpiarBusqueda valor={busqueda} onLimpiar={() => setBusqueda('')} />
            </div>
            <button
              type="button"
              aria-expanded={verFiltros}
              onClick={() => setVerFiltros((v) => !v)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl border-2 text-xs font-bold transition-colors bg-white dark:bg-zinc-900 ${verFiltros ? 'border-red-600 text-red-600 dark:text-red-400' : 'border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400'}`}
            >
              <SlidersHorizontal className={`w-4 h-4 transition-transform duration-200 ${verFiltros ? 'lg:rotate-90' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">Filtros</span>
              {filtrosActivos > 0 && <span className="rounded-full bg-red-600 text-white text-[10px] leading-none px-1.5 py-1">{filtrosActivos}</span>}
            </button>
          </div>

          {verTodasInstalaciones && (
            <div role="group" aria-label="Qué órdenes ver" className="flex gap-1.5 p-1 rounded-xl bg-zinc-300 dark:bg-zinc-900 md:max-w-xl">
              {[
                ['TODO', 'Todo', todas.length],
                ['INSTALACION', 'Instalaciones', cuantasPorCategoria.INSTALACION || 0],
                ['LOS', 'LOS', cuantasPorCategoria.LOS || 0],
              ].map(([clave, texto, n]) => (
                <button
                  key={clave}
                  type="button"
                  aria-pressed={categoria === clave}
                  onClick={() => { setCategoria(clave); setFiltro('TODAS'); }}
                  className={`flex-1 whitespace-nowrap px-2 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${categoria === clave ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
                >
                  <span>{texto}</span>
                  <Contador n={n} tono={categoria === clave ? 'bg-zinc-200 dark:bg-zinc-700' : 'bg-zinc-300/70 dark:bg-zinc-800'} />
                </button>
              ))}
            </div>
          )}

          <Colapsable>{verFiltros && (
            <div className="rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-4">
              <div className="space-y-1.5">
                <p className={ETIQUETA_FILTRO}>Estado</p>
                <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
                  {chip('TODAS', 'Todas', base.length)}
                  {ORDEN_ESTADOS_PROMOTORA.filter((c) => conteo[c]).map((c) => chip(c, etiquetaFiltroEstado(c, vista), conteo[c]))}
                  {(atrasadas > 0 || soloAtrasadas) && (
                    <button
                      type="button"
                      aria-pressed={soloAtrasadas}
                      onClick={() => setSoloAtrasadas((v) => !v)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-colors ${soloAtrasadas ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'}`}
                    >
                      <span>Atrasadas</span>
                      <Contador n={atrasadas} tono={soloAtrasadas ? 'bg-black/15' : 'bg-zinc-200 dark:bg-zinc-800'} />
                    </button>
                  )}
                </div>
              </div>

              <div className={`grid gap-2 grid-cols-1 min-[360px]:grid-cols-2 ${verTodasInstalaciones ? 'md:grid-cols-3 md:max-w-2xl' : 'md:max-w-md'}`}>
                {selector('filtro-fecha', 'Fecha', CalendarDays, fecha, elegirFecha, FILTROS_FECHA, {
                  onIconClick: abrirCalendario,
                  iconLabel: 'Elegir una fecha en el calendario',
                  displayLabel: fecha === 'DIA' ? (dia ? fechaCorta(dia) : 'Elegir fecha') : undefined,
                })}
                {verTodasInstalaciones && selector('filtro-promotor', 'Promotor', Megaphone, promotorActivo, setPromotor, [['TODOS', `Todos (${porFecha.length})`], ...filasPromotor.map((f) => [f.clave || '-', `${f.nombre} (${f.total})`])])}
                <div className="min-[360px]:col-span-2 md:col-span-1 min-w-0">{selector('filtro-orden', 'Ordenar por', ArrowDownAZ, `${criterioOrden}:${direccion}`, elegirOrden, OPCIONES_ORDEN_DIRECCION)}</div>
              </div>
              {fecha === 'DIA' && calendarioAbierto && (
                <Calendario valor={dia} max={fechaISO(ahora)} onElegir={(iso) => { setDia(iso); setCalendarioAbierto(false); }} onCerrar={() => setCalendarioAbierto(false)} />
              )}
              {fecha === 'DIA' && <p className="text-[10px] text-zinc-600 dark:text-zinc-400">Las órdenes cerradas se conservan {verTodasInstalaciones ? RETENCION_DIAS_HISTORIAL_VENTAS : RETENCION_DIAS_HISTORIAL} días; de un día anterior solo salen las que siguen abiertas.</p>}

              {verTodasInstalaciones && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    aria-expanded={verResumen}
                    onClick={() => setVerResumen((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-red-600"
                  >
                    Resumen por promotor <ChevronDown className={`w-3.5 h-3.5 transition-transform ${verResumen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={exportar}
                    disabled={visibles.length === 0}
                    title="Bajar a Excel (CSV) lo que se ve ahora"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-red-600 disabled:opacity-50 disabled:hover:border-zinc-300 dark:disabled:hover:border-zinc-700"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" /> Exportar a Excel ({visibles.length})
                  </button>
                </div>
              )}
              <Colapsable>{verTodasInstalaciones && verResumen && <ResumenPromotores filas={filasPromotor} vista={vista} elegida={promotorActivo} onElegir={elegirPromotor} />}</Colapsable>
            </div>
          )}</Colapsable>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
              {visibles.length} de {ordenes.length} {vista === 'LOS' ? 'averías LOS' : vista === 'TODO' ? 'órdenes' : 'instalaciones'}
              {hayMasCerradas && <span className="text-zinc-600 dark:text-zinc-400"> · faltan cerradas por cargar</span>}
              {hayFiltros && <button type="button" onClick={limpiarFiltros} className="ml-2 font-bold text-red-600 dark:text-red-400 hover:underline">Limpiar filtros</button>}
            </p>
          </div>

          {sinNombre ? (
            <p role="alert" className="text-sm text-amber-700 dark:text-amber-400 text-center py-10 max-w-md mx-auto">Tu usuario todavía no tiene un nombre de promotor asignado, por eso no ves instalaciones. Pídele al administrador que lo agregue en Usuarios.</p>
          ) : error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar las instalaciones. Revisa tu conexión e intenta de nuevo.</p>
          ) : !cargado ? (
            <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-10">Cargando instalaciones...</p>
          ) : visibles.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-10">{ordenes.length === 0 ? (vista === 'LOS' ? 'Todavía no hay averías LOS.' : vista === 'TODO' ? 'Todavía no hay órdenes.' : 'Todavía no hay instalaciones.') : 'Ninguna orden coincide con los filtros.'}</p>
          ) : (
            <ul key={`${categoria}-${vista}`} className="grid gap-2.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 lg:animate-fade-in">
              {visibles.map((o) => <TarjetaInstalacion key={o.id} orden={o} onVerPlantilla={setPlantillaDe} onCopiarPlantilla={copiarDeTarjeta} onCopy={copiar} mostrarTipo={verTodasInstalaciones} ahora={ahora} />)}
            </ul>
          )}

          {hayMasCerradas && cargado && (
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={cargarMasCerradas}
                disabled={cargandoMas}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-red-600 disabled:opacity-50 disabled:hover:border-zinc-300 dark:disabled:hover:border-zinc-700 transition-colors"
              >
                {cargandoMas && <Spinner />}{cargandoMas ? 'Cargando...' : 'Cargar más cerradas'}
              </button>
              <p className="text-[10px] text-zinc-400 text-center">Se muestran las cerradas más recientes; los números y filtros son de lo cargado.</p>
            </div>
          )}

          <p className="text-[10px] text-zinc-400 text-center pt-2">
            {verTodasInstalaciones ? <>Ves las instalaciones de todas las promotoras y las averías LOS. </> : promotoraNombres.length > 0 && <>Ves las instalaciones de: {promotoraNombres.join(', ')}. </>}
            Las terminadas o canceladas se muestran durante {verTodasInstalaciones ? RETENCION_DIAS_HISTORIAL_VENTAS : RETENCION_DIAS_HISTORIAL} días.
          </p>
        </main>
        <PieVersion />

        {creandoVenta && (
          <Suspense fallback={null}>
            <NuevaVentaModal perfil={{ verTodas: verTodasInstalaciones, promotoraNombres, promotoraClaves }} tickets={tickets} onCrear={crearVenta} onClose={() => setCreandoVenta(false)} />
          </Suspense>
        )}

        {plantillaDe && <PlantillaFinalModal orden={plantillaDe} texto={textoPlantillaFinal(plantillaDe)} onCopy={copiar} onClose={() => setPlantillaDe(null)} />}
      </div>
    </div>
  );
}
