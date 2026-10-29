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
import CobroModal from './modals/CobroModal';
import { BUSCADOR } from './estilos';
import { SELECTOR } from './finanzas/estilos';
import { useAhora } from '../hooks/useAhora';
import { useNotifications } from '../hooks/useNotifications';
import { useTema } from '../hooks/useTema';
import { useToast } from '../hooks/useToast';
import { useAvisosCobros, useCobrosAdministracion } from '../hooks/useCobrosClientes';
import { trabajarCobro } from '../lib/cobrosClientes';
import { fechaCorta, fechaISO } from '../utils/calendario';
import { exportCobrosToCsv } from '../utils/exportReport';
import {
  ESTADO_COBRO, ETIQUETA_ESTADO_COBRO, FILTROS_ESTADO_COBRO, diasEsperando, filtrarCobros, ordenarCobros, resumenCobros, textoDeCobro, tieneCambioDeMonto,
} from '../utils/cobrosClientes';
import { formatoMontoBs, textoMonto } from '../utils/cobro';

const CLASE_ESTADO = { PENDIENTE: 'bg-amber-400 text-black', CARGADO: 'bg-emerald-700 text-white' };
const ETIQUETA = 'text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400';
const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const monto = (m, moneda) => textoMonto(formatoMontoBs(Number(m) || 0), moneda);
const TIPOS = [{ value: '', label: 'Todas las órdenes' }, { value: 'INSTALACION', label: 'Instalaciones' }, { value: 'OTRAS', label: 'Visitas y otras' }];

// Los períodos del módulo (por el día en que se emitió el cobro).
const PERIODOS = [{ valor: '7', etiqueta: '7 días', dias: 7 }, { valor: '30', etiqueta: '30 días', dias: 30 }, { valor: '90', etiqueta: '90 días', dias: 90 }];
const PERIODO_RANGO = 'RANGO';
const desdeHace = (dias, base) => fechaISO(base - (dias - 1) * 86400000);

// El módulo de ADMINISTRACION: los cobros que se emiten al finalizarse las órdenes, para subirlos a mano al portal de la empresa y marcarlos como cargados (el cliente ve su factura y paga allá). Los
// pendientes y los que tienen un cambio de monto por corregir salen siempre, de cualquier fecha; el resto, del período elegido. Solo escribe los cobros (ver trabajarCobro).
// `onAbrirMenu`: cuando el ADMIN está aquí dentro del menú lateral, el botón ☰ que lo abre en el celular.
export default function AdministracionApp({ auth, onAbrirMenu }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout } = auth;
  const esAdministracion = role === ROLES.ADMINISTRACION;
  const [isDarkMode, setIsDarkMode] = useTema(currentUser);
  const { toastMsg, setToastMsg } = useToast();
  const notifications = useNotifications(esAdministracion ? currentUser : null);
  // Los avisos de cobros nuevos (pantalla, campana y sonido): solo ADMINISTRACION; el ADMIN no los recibe.
  useAvisosCobros({ firebaseUser, activo: esAdministracion, onNotify: notifications.addNotification, setToastMsg });
  const ahora = useAhora();

  const [periodo, setPeriodo] = useState('30');
  const [rango, setRango] = useState(() => ({ desde: desdeHace(7, ahora), hasta: fechaISO(ahora) }));
  const rangoEfectivo = useMemo(
    () => (periodo === PERIODO_RANGO ? rango : { desde: desdeHace(PERIODOS.find((p) => p.valor === periodo)?.dias || 30, ahora), hasta: fechaISO(ahora) }),
    [periodo, rango, ahora],
  );
  const { cobros, cargado, error } = useCobrosAdministracion(firebaseUser, rangoEfectivo);
  const [estado, setEstado] = useState('TODOS');
  const [tecnico, setTecnico] = useState('');
  const [tipo, setTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [abierto, setAbierto] = useState(null); // el id del cobro abierto en la ventana

  const filas = useMemo(() => ordenarCobros(filtrarCobros(cobros, { estado, tecnico, tipo, busqueda })), [cobros, estado, tecnico, tipo, busqueda]);
  const resumen = useMemo(() => resumenCobros(filtrarCobros(cobros, { tecnico, tipo, busqueda })), [cobros, tecnico, tipo, busqueda]);
  const tecnicos = useMemo(() => [...new Set(cobros.map((c) => c.tecnico).filter(Boolean))].sort(), [cobros]);
  const cobroAbierto = abierto ? cobros.find((c) => c.id === abierto) || null : null;
  const filtrosActivos = (periodo !== '30' ? 1 : 0) + (tecnico ? 1 : 0) + (tipo ? 1 : 0);
  const etiquetaPeriodo = periodo === PERIODO_RANGO ? `del ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}` : `últimos ${PERIODOS.find((p) => p.valor === periodo)?.dias || 30} días`;

  const trabajar = async (accion, datos) => {
    try {
      const r = await trabajarCobro(cobroAbierto.id, accion, datos, { por: currentUser });
      if (r?.ok) setToastMsg({ type: 'success', text: accion === 'devolver' ? 'Devuelto a pendiente.' : accion === 'confirmar' ? 'Cambio de monto confirmado.' : 'Marcado como cargado en el portal.' });
      return r;
    } catch (e) {
      console.error('No se pudo trabajar el cobro:', e);
      return { error: 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.' };
    }
  };

  const chipEstado = ({ valor, etiqueta }) => (
    <Chip activo={estado === valor} tamano="compacto" key={valor} type="button" onClick={() => setEstado(valor)}>{etiqueta}</Chip>
  );
  const tarjetaResumen = (clave, titulo) => {
    const r = resumen[clave];
    const montos = [r.montos.BS > 0 && monto(r.montos.BS, 'BS'), r.montos.USD > 0 && monto(r.montos.USD, 'USD')].filter(Boolean);
    const porCargar = clave === ESTADO_COBRO.PENDIENTE;
    return (
      <button key={clave} type="button" onClick={() => setEstado(estado === clave ? 'TODOS' : clave)} aria-pressed={estado === clave}
        className={`text-left rounded-xl border-2 p-3 transition-colors bg-white dark:bg-zinc-900 ${porCargar ? 'col-span-2 lg:col-span-1 ' : ''}${estado === clave || (porCargar && r.cantidad > 0 && estado === 'TODOS') ? 'border-red-600' : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-500'}`}>
        <p className={`font-black tabular-nums ${porCargar ? 'text-4xl' : 'text-2xl'} ${porCargar && r.cantidad > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{r.cantidad}</p>
        <p className="text-xs font-bold">{titulo}</p>
        {(montos.length > 0 || (porCargar && r.cantidad > 0)) && <p className={`${ETIQUETA} tabular-nums`}>{[...montos, porCargar && r.cantidad > 0 && 'de cualquier fecha'].filter(Boolean).join(' · ')}</p>}
      </button>
    );
  };
  const tarjetaAlertas = (
    <button type="button" onClick={() => setEstado(estado === 'ALERTA' ? 'TODOS' : 'ALERTA')} aria-pressed={estado === 'ALERTA'}
      className={`text-left rounded-xl border-2 p-3 transition-colors bg-white dark:bg-zinc-900 ${estado === 'ALERTA' || resumen.alertas > 0 ? 'border-amber-500' : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-500'}`}>
      <p className={`text-2xl font-black tabular-nums ${resumen.alertas > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>{resumen.alertas}</p>
      <p className="text-xs font-bold">Con cambio de monto</p>
      {resumen.alertas > 0 && <p className={ETIQUETA}>corrígelos en el portal</p>}
    </button>
  );

  const estadoChip = (c) => <span className={`inline-block whitespace-nowrap text-[11px] max-lg:text-xs leading-tight font-black px-2 py-0.5 rounded ${CLASE_ESTADO[c.estado] || ''}`}>{ETIQUETA_ESTADO_COBRO[c.estado] || c.estado}</span>;
  const alerta = (c) => tieneCambioDeMonto(c) && (
    <span className="inline-flex items-center gap-1 text-[11px] max-lg:text-xs font-bold text-amber-800 dark:text-amber-300"><AlertTriangle className="w-3 h-3" aria-hidden="true" />Cambió el monto</span>
  );
  const accionTexto = (c) => (tieneCambioDeMonto(c) ? 'Corregir' : c.estado === ESTADO_COBRO.PENDIENTE ? 'Cargar' : 'Ver');
  const accionDestacada = (c) => tieneCambioDeMonto(c) || c.estado === ESTADO_COBRO.PENDIENTE;
  const tipoTexto = (c) => (c.esInstalacion ? 'Instalación' : [c.tipoTrabajo, c.falla].filter(Boolean).join(' · '));

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
            <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-10">Cargando cobros...</p>
          ) : error && !cargado ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar los cobros. Revisa tu conexión e intenta de nuevo.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {tarjetaResumen(ESTADO_COBRO.PENDIENTE, 'Pendientes por cargar')}
                {tarjetaResumen(ESTADO_COBRO.CARGADO, 'Cargados en el portal')}
                {tarjetaAlertas}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                  <input type="search" aria-label="Buscar por código, cliente, cédula o técnico" placeholder="Código, cliente o cédula" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={BUSCADOR} />
                  <BotonLimpiarBusqueda valor={busqueda} onLimpiar={() => setBusqueda('')} />
                </div>
                <BotonFiltros abierto={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} cuenta={filtrosActivos} />
                <BotonExportar
                  grande
                  onClick={() => exportCobrosToCsv(filas, [`Período: ${etiquetaPeriodo}`, estado !== 'TODOS' && `Estado: ${estado === 'ALERTA' ? 'Con cambio de monto' : ETIQUETA_ESTADO_COBRO[estado]}`, tecnico && `Técnico: ${tecnico}`, tipo && `Tipo: ${TIPOS.find((t) => t.value === tipo)?.label}`, busqueda.trim() && `Búsqueda: "${busqueda.trim()}"`].filter(Boolean).join(' · '))}
                  disabled={!filas.length}
                  ariaLabel="Exportar a Excel"
                  title="Exportar a Excel"
                  etiqueta="Exportar"
                  etiquetaSoloPc
                />
              </div>

              <Colapsable>{filtersOpen && (
                <div className="rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-3">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Estado">{FILTROS_ESTADO_COBRO.map(chipEstado)}</div>
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
                    {[...PERIODOS, { valor: PERIODO_RANGO, etiqueta: 'Rango' }].map(({ valor, etiqueta }) => (
                      <Chip activo={periodo === valor} tamano="compacto" key={valor} type="button" onClick={() => setPeriodo(valor)}>{etiqueta}</Chip>
                    ))}
                    {periodo === PERIODO_RANGO && <RangoFechas desde={rango.desde} hasta={rango.hasta} onDesde={(v) => setRango((r) => ({ ...r, desde: v }))} onHasta={(v) => setRango((r) => ({ ...r, hasta: v }))} maximo={fechaISO(ahora)} />}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <SelectMenu ariaLabel="Técnico" className={SELECTOR} value={tecnico} onChange={setTecnico} items={[{ value: '', label: 'Todos los técnicos' }, ...tecnicos.map((t) => ({ value: t, label: t }))]} />
                    <SelectMenu ariaLabel="Tipo de orden" className={SELECTOR} value={tipo} onChange={setTipo} items={TIPOS} />
                  </div>
                </div>
              )}</Colapsable>

              <p className="text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">{filas.length} {filas.length === 1 ? 'cobro' : 'cobros'} · {etiquetaPeriodo}</p>

              {!filas.length ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-10">{cobros.length ? 'Ningún cobro coincide con lo que buscas. Prueba quitar algún filtro.' : 'Todavía no hay cobros. Aparecen aquí en cuanto se finaliza una orden con cobro o una instalación.'}</p>
              ) : (
                <>
                  {/* Celular: una tarjeta por cobro. */}
                  <ul className="md:hidden flex flex-col gap-2">
                    {filas.map((c) => (
                      <li key={c.id} className="rounded-xl border-2 border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-black text-sm">{c.codigo || 'S/C'} <span className="font-bold">· {c.nombre}</span></p>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">{tipoTexto(c)} · {fechaHora(c.creadoEn)}</p>
                          </div>
                          {estadoChip(c)}
                        </div>
                        <p className="text-sm font-bold break-words">{textoDeCobro(c)}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {alerta(c)}
                          {c.estado === ESTADO_COBRO.PENDIENTE && <span className={ETIQUETA}>{diasEsperando(c, ahora)} d esperando</span>}
                        </div>
                        <Boton variante={accionDestacada(c) ? 'principal' : 'secundario'} tamano="grande" className="w-full" onClick={() => setAbierto(c.id)}>{accionTexto(c)}</Boton>
                      </li>
                    ))}
                  </ul>

                  {/* Escritorio: tabla. */}
                  <div className="hidden md:block rounded-xl border-2 border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-100 dark:bg-zinc-950 text-[11px] max-lg:text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                        <tr>{['Emitido', 'Código', 'Cliente', 'Técnico', 'Trabajo', 'Monto', 'Estado', ''].map((t, i) => <th key={`${t}${i}`} scope="col" className="px-3 py-2.5 font-bold">{t}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {filas.map((c) => (
                          <tr key={c.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="px-3 py-2.5 min-w-[6.5rem]">{fechaHora(c.creadoEn)}{c.estado === ESTADO_COBRO.PENDIENTE && <span className={`block ${ETIQUETA}`}>{diasEsperando(c, ahora)} d esperando</span>}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-bold">{c.codigo || 'S/C'}</td>
                            <td className="px-3 py-2.5 min-w-[8rem]">{c.nombre}</td>
                            <td className="px-3 py-2.5 min-w-[7rem]">{c.tecnico}</td>
                            <td className="px-3 py-2.5 min-w-[8rem] text-zinc-700 dark:text-zinc-300 break-words">{tipoTexto(c)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-bold">{textoDeCobro(c)}{alerta(c) && <span className="block">{alerta(c)}</span>}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{estadoChip(c)}</td>
                            <td className="px-3 py-2.5"><Boton variante={accionDestacada(c) ? 'principal' : 'secundario'} tamano="compacto" onClick={() => setAbierto(c.id)}>{accionTexto(c)}</Boton></td>
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
        {cobroAbierto && <CobroModal key={cobroAbierto.id} cobro={cobroAbierto} onTrabajar={trabajar} onClose={() => setAbierto(null)} />}
        <PieVersion />
      </div>
    </div>
  );
}
