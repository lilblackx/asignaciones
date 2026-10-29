import { useMemo, useState } from 'react';
import { AlertTriangle, Landmark, Search } from 'lucide-react';
import { ROLES, etiquetaRol } from '../constants';
import BotonExportar from './BotonExportar';
import BotonFiltros from './BotonFiltros';
import BotonLimpiarBusqueda from './BotonLimpiarBusqueda';
import Boton from './Boton';
import Chip from './Chip';
import Colapsable from './Colapsable';
import EncabezadoSimple from './EncabezadoSimple';
import NotificationBell from './NotificationBell';
import PieVersion from './PieVersion';
import RangoFechas from './RangoFechas';
import SelectMenu from './SelectMenu';
import Toast from './Toast';
import ConciliarPagoModal from './modals/ConciliarPagoModal';
import { BUSCADOR } from './estilos';
import { SELECTOR } from './finanzas/estilos';
import { useAhora } from '../hooks/useAhora';
import { useFormasPago } from '../hooks/useFormasPago';
import { useNotifications } from '../hooks/useNotifications';
import { useTema } from '../hooks/useTema';
import { useToast } from '../hooks/useToast';
import { useAvisosAdministracion, usePagosAdministracion } from '../hooks/usePagosOrdenes';
import { trabajarPago } from '../lib/pagosOrdenes';
import { fechaCorta, fechaISO } from '../utils/calendario';
import { exportPagosToCsv } from '../utils/exportReport';
import { formatoMontoBs, textoMonto } from '../utils/cobro';
import { normalizarFormasPago } from '../utils/formasPago';
import {
  ESTADO_PAGO, ETIQUETA_ESTADO_PAGO, FILTROS_ESTADO_PAGO, diasEsperando, filtrarPagos, monedaDePago, ordenarPagos, resumenPagos, textoPago,
} from '../utils/pagoCliente';

const CLASE_ESTADO = {
  PENDIENTE_COBRO: 'bg-amber-400 text-black',
  POR_CONCILIAR: 'bg-sky-700 text-white',
  CONCILIADO: 'bg-emerald-700 text-white',
  SIN_COBRAR: 'bg-red-600 text-white',
};
const ETIQUETA = 'text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400';
const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const monto = (m, moneda) => textoMonto(formatoMontoBs(Number(m) || 0), moneda);

// Los períodos del módulo (por la fecha en que se registró el pago).
const PERIODOS = [{ valor: '7', etiqueta: '7 días', dias: 7 }, { valor: '30', etiqueta: '30 días', dias: 30 }, { valor: '90', etiqueta: '90 días', dias: 90 }];
const PERIODO_RANGO = 'RANGO';
const desdeHace = (dias, base) => fechaISO(base - (dias - 1) * 86400000);

// El módulo de ADMINISTRACION: los pagos que los clientes hacen por las órdenes, para conciliarlos. Los pendientes de cobro (el técnico dijo que el cliente paga después) salen siempre, de cualquier fecha; el resto,
// del período elegido. Solo escribe los pagos (ver trabajarPago). `onAbrirMenu`: cuando el ADMIN está aquí dentro del menú lateral, el botón ☰ que lo abre en el celular.
export default function AdministracionApp({ auth, onAbrirMenu }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout } = auth;
  const esAdministracion = role === ROLES.ADMINISTRACION;
  const [isDarkMode, setIsDarkMode] = useTema(currentUser);
  const { toastMsg, setToastMsg } = useToast();
  const notifications = useNotifications(esAdministracion ? currentUser : null);
  // Los avisos de pagos nuevos (pantalla, campana y sonido): solo ADMINISTRACION; el ADMIN no los recibe.
  useAvisosAdministracion({ firebaseUser, activo: esAdministracion, onNotify: notifications.addNotification, setToastMsg });
  const ahora = useAhora();
  const { formasPago } = useFormasPago(firebaseUser);
  const cuentasEmpresa = useMemo(() => normalizarFormasPago(formasPago), [formasPago]);

  const [periodo, setPeriodo] = useState('30');
  const [rango, setRango] = useState(() => ({ desde: desdeHace(7, ahora), hasta: fechaISO(ahora) }));
  const rangoEfectivo = useMemo(
    () => (periodo === PERIODO_RANGO ? rango : { desde: desdeHace(PERIODOS.find((p) => p.valor === periodo)?.dias || 30, ahora), hasta: fechaISO(ahora) }),
    [periodo, rango, ahora],
  );
  const { pagos, cargado, error } = usePagosAdministracion(firebaseUser, rangoEfectivo);
  const [estado, setEstado] = useState('TODOS');
  const [tecnico, setTecnico] = useState('');
  const [forma, setForma] = useState('');
  const [moneda, setMoneda] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [abierto, setAbierto] = useState(null); // el id del pago abierto en la ventana

  const filas = useMemo(() => ordenarPagos(filtrarPagos(pagos, { estado, tecnico, forma, moneda, busqueda })), [pagos, estado, tecnico, forma, moneda, busqueda]);
  const resumen = useMemo(() => resumenPagos(filtrarPagos(pagos, { tecnico, forma, moneda, busqueda })), [pagos, tecnico, forma, moneda, busqueda]);
  const tecnicos = useMemo(() => [...new Set(pagos.map((p) => p.tecnico).filter(Boolean))].sort(), [pagos]);
  const formas = useMemo(() => [...new Set(pagos.map((p) => p.pago?.forma).filter(Boolean))].sort(), [pagos]);
  const pagoAbierto = abierto ? pagos.find((p) => p.id === abierto) || null : null;
  const filtrosActivos = (periodo !== '30' ? 1 : 0) + (tecnico ? 1 : 0) + (forma ? 1 : 0) + (moneda ? 1 : 0);
  const etiquetaPeriodo = periodo === PERIODO_RANGO ? `del ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}` : `últimos ${PERIODOS.find((p) => p.valor === periodo)?.dias || 30} días`;

  const trabajar = async (accion, datos) => {
    try {
      const r = await trabajarPago(pagoAbierto.id, accion, datos, { por: currentUser });
      if (r?.ok) {
        setToastMsg({ type: 'success', text: accion === 'sinCobrar' ? 'Marcado sin cobrar.' : accion === 'devolver' ? 'Devuelto a por conciliar.' : accion === 'corregir' ? 'Corrección guardada.' : r.repiteReferencia ? 'Pago conciliado (referencia repetida, con tu nota).' : 'Pago conciliado.' });
      }
      return r;
    } catch (e) {
      console.error('No se pudo trabajar el pago:', e);
      return { error: 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.' };
    }
  };

  const chipEstado = ({ valor, etiqueta }) => (
    <Chip activo={estado === valor} tamano="compacto" key={valor} type="button" onClick={() => setEstado(valor)}>{etiqueta}</Chip>
  );
  const tarjetaResumen = (clave, titulo) => {
    const r = resumen[clave];
    const montos = [r.montos.BS > 0 && monto(r.montos.BS, 'BS'), r.montos.USD > 0 && monto(r.montos.USD, 'USD')].filter(Boolean);
    const porCobrar = clave === ESTADO_PAGO.PENDIENTE;
    const sinFecha = porCobrar && r.cantidad > 0 ? 'de cualquier fecha' : '';
    return (
      <button key={clave} type="button" onClick={() => setEstado(estado === clave ? 'TODOS' : clave)} aria-pressed={estado === clave}
        className={`text-left rounded-xl border-2 p-3 transition-colors bg-white dark:bg-zinc-900 ${porCobrar || clave === ESTADO_PAGO.SIN_COBRAR ? 'col-span-2 lg:col-span-1 ' : ''}${estado === clave || (porCobrar && r.cantidad > 0 && estado === 'TODOS') ? 'border-red-600' : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-500'}`}>
        <p className={`font-black tabular-nums ${porCobrar ? 'text-4xl' : 'text-2xl'} ${porCobrar && r.cantidad > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{r.cantidad}</p>
        <p className="text-xs font-bold">{titulo}</p>
        {(montos.length > 0 || sinFecha) && <p className={`${ETIQUETA} tabular-nums`}>{[...montos, sinFecha].filter(Boolean).join(' · ')}</p>}
      </button>
    );
  };

  const estadoChip = (p) => <span className={`inline-block whitespace-nowrap text-[11px] max-lg:text-xs leading-tight font-black px-2 py-0.5 rounded ${CLASE_ESTADO[p.estado] || ''}`}>{ETIQUETA_ESTADO_PAGO[p.estado] || p.estado}</span>;
  const alertas = (p) => (p.monedaDistinta || p.diferencia) && (
    <span className="inline-flex items-center gap-1 text-[11px] max-lg:text-xs font-bold text-amber-800 dark:text-amber-300"><AlertTriangle className="w-3 h-3" aria-hidden="true" />{p.monedaDistinta ? 'Moneda distinta' : 'Monto distinto'}</span>
  );
  const detallePago = (p) => (p.pago ? textoPago(p.pago) : p.compartidoCon ? `Pagó junto con ${p.compartidoCon.codigo}` : p.cobro ? `Cobro: ${monto(p.cobro.monto, p.cobro.moneda)}` : 'Sin cobro');
  const accionTexto = (p) => (p.estado === ESTADO_PAGO.PENDIENTE ? 'Cobrar' : p.estado === ESTADO_PAGO.POR_CONCILIAR ? 'Conciliar' : 'Ver');

  const campana = esAdministracion && (
    <NotificationBell
      notifications={notifications.notifications}
      unreadCount={notifications.unreadCount}
      isOpen={notifications.isOpen}
      setIsOpen={notifications.setIsOpen}
      dismissNotification={notifications.dismissNotification}
      clearAll={notifications.clearAll}
      onOpenNotification={() => notifications.setIsOpen(false)}
    />
  );

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-fondo text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />
        <EncabezadoSimple onAbrirMenu={onAbrirMenu} titulo="Administración" icono={Landmark} nombre={currentUserName || currentUser} rol={etiquetaRol(role)} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} campana={campana || null} />

        <main className="p-3 sm:p-4 max-w-[1400px] mx-auto w-full flex-1 space-y-3">
          {!cargado && !error ? (
            <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-10">Cargando pagos...</p>
          ) : error && !cargado ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar los pagos. Revisa tu conexión e intenta de nuevo.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {tarjetaResumen(ESTADO_PAGO.PENDIENTE, 'Pendientes de cobro')}
                {tarjetaResumen(ESTADO_PAGO.POR_CONCILIAR, 'Por conciliar')}
                {tarjetaResumen(ESTADO_PAGO.CONCILIADO, 'Conciliados')}
                {tarjetaResumen(ESTADO_PAGO.SIN_COBRAR, 'Sin cobrar')}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                  <input type="search" aria-label="Buscar por código, cliente, cédula, técnico o referencia" placeholder="Código, cliente o cédula" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={BUSCADOR} />
                  <BotonLimpiarBusqueda valor={busqueda} onLimpiar={() => setBusqueda('')} />
                </div>
                <BotonFiltros abierto={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} cuenta={filtrosActivos} />
                <BotonExportar
                  grande
                  onClick={() => exportPagosToCsv(filas, [`Período: ${etiquetaPeriodo}`, estado !== 'TODOS' && `Estado: ${ETIQUETA_ESTADO_PAGO[estado]}`, tecnico && `Técnico: ${tecnico}`, forma && `Forma: ${forma}`, moneda && `Moneda: ${moneda === 'USD' ? '$' : 'Bs'}`, busqueda.trim() && `Búsqueda: "${busqueda.trim()}"`].filter(Boolean).join(' · '))}
                  disabled={!filas.length}
                  ariaLabel="Exportar a Excel"
                  title="Exportar a Excel"
                  etiqueta="Exportar"
                  etiquetaSoloPc
                />
              </div>

              <Colapsable>{filtersOpen && (
                <div className="rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-3">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Estado">{FILTROS_ESTADO_PAGO.map(chipEstado)}</div>
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
                    {[...PERIODOS, { valor: PERIODO_RANGO, etiqueta: 'Rango' }].map(({ valor, etiqueta }) => (
                      <Chip activo={periodo === valor} tamano="compacto" key={valor} type="button" onClick={() => setPeriodo(valor)}>{etiqueta}</Chip>
                    ))}
                    {periodo === PERIODO_RANGO && <RangoFechas desde={rango.desde} hasta={rango.hasta} onDesde={(v) => setRango((r) => ({ ...r, desde: v }))} onHasta={(v) => setRango((r) => ({ ...r, hasta: v }))} maximo={fechaISO(ahora)} />}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <SelectMenu ariaLabel="Técnico" className={SELECTOR} value={tecnico} onChange={setTecnico} items={[{ value: '', label: 'Todos los técnicos' }, ...tecnicos.map((t) => ({ value: t, label: t }))]} />
                    <SelectMenu ariaLabel="Forma de pago" className={SELECTOR} value={forma} onChange={setForma} items={[{ value: '', label: 'Todas las formas' }, ...formas.map((f) => ({ value: f, label: f }))]} />
                    <SelectMenu ariaLabel="Moneda" className={SELECTOR} value={moneda} onChange={setMoneda} items={[{ value: '', label: 'Bs y $' }, { value: 'BS', label: 'Bolívares (Bs)' }, { value: 'USD', label: 'Dólares ($)' }]} />
                  </div>
                </div>
              )}</Colapsable>

              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">{filas.length} {filas.length === 1 ? 'pago' : 'pagos'} · {etiquetaPeriodo}</p>
              </div>

              {!filas.length ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-10">{pagos.length ? 'Ningún pago coincide con lo que buscas. Prueba quitar algún filtro.' : 'Todavía no hay pagos. Aparecen aquí en cuanto un técnico registra el pago de un cliente o dice que paga después.'}</p>
              ) : (
                <>
                  {/* Celular: una tarjeta por pago. */}
                  <ul className="md:hidden flex flex-col gap-2">
                    {filas.map((p) => (
                      <li key={p.id} className="rounded-xl border-2 border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-black text-sm">{p.codigo || 'S/C'} <span className="font-bold">· {p.nombre}</span></p>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">{p.tecnico} · {fechaHora(p.creadoEn)}</p>
                          </div>
                          {estadoChip(p)}
                        </div>
                        <p className="text-sm font-bold break-words">{detallePago(p)}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {alertas(p)}
                          {p.estado === ESTADO_PAGO.PENDIENTE && <span className={ETIQUETA}>{diasEsperando(p, ahora)} d esperando</span>}
                        </div>
                        {p.nota && <p className="text-xs text-zinc-700 dark:text-zinc-300 break-words">Nota: {p.nota}</p>}
                        <Boton variante={p.estado === ESTADO_PAGO.PENDIENTE ? 'principal' : 'secundario'} tamano="grande" className="w-full" onClick={() => setAbierto(p.id)}>{accionTexto(p)}</Boton>
                      </li>
                    ))}
                  </ul>

                  {/* Escritorio: tabla. */}
                  <div className="hidden md:block rounded-xl border-2 border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-100 dark:bg-zinc-950 text-[11px] max-lg:text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                        <tr>{['Registrado', 'Código', 'Cliente', 'Técnico', 'Pago', 'Estado', 'Nota del técnico', ''].map((c, i) => <th key={`${c}${i}`} scope="col" className="px-3 py-2.5 font-bold">{c}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {filas.map((p) => (
                          <tr key={p.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="px-3 py-2.5 min-w-[6.5rem]">{fechaHora(p.creadoEn)}{p.estado === ESTADO_PAGO.PENDIENTE && <span className={`block ${ETIQUETA}`}>{diasEsperando(p, ahora)} d esperando</span>}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-bold">{p.codigo || 'S/C'}</td>
                            <td className="px-3 py-2.5 min-w-[8rem]">{p.nombre}</td>
                            <td className="px-3 py-2.5 min-w-[7rem]">{p.tecnico}</td>
                            <td className="px-3 py-2.5 min-w-[12rem]"><span className="font-bold break-words">{detallePago(p)}</span>{alertas(p) && <span className="block">{alertas(p)}</span>}{p.pago && monedaDePago(p) && p.cobro && <span className={`block ${ETIQUETA}`}>Cobro: {monto(p.cobro.monto, p.cobro.moneda)}</span>}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{estadoChip(p)}</td>
                            <td className="px-3 py-2.5 min-w-[8rem] text-zinc-700 dark:text-zinc-300 break-words">{p.nota || '-'}</td>
                            <td className="px-3 py-2.5"><Boton variante={p.estado === ESTADO_PAGO.PENDIENTE ? 'principal' : 'secundario'} tamano="compacto" onClick={() => setAbierto(p.id)}>{accionTexto(p)}</Boton></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </main>
        {pagoAbierto && <ConciliarPagoModal key={pagoAbierto.id} pago={pagoAbierto} cuentasEmpresa={cuentasEmpresa} onTrabajar={trabajar} onClose={() => setAbierto(null)} />}
        <PieVersion />
      </div>
    </div>
  );
}
