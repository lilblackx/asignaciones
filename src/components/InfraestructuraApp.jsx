import { useMemo, useState } from 'react';
import { FileText, Network, RefreshCw, Search } from 'lucide-react';
import { etiquetaRol } from '../constants';
import BotonExportar from './BotonExportar';
import BotonLimpiarBusqueda from './BotonLimpiarBusqueda';
import Colapsable from './Colapsable';
import { useToast } from '../hooks/useToast';
import { useTema } from '../hooks/useTema';
import { useAhora } from '../hooks/useAhora';
import { useInstalacionesInfra } from '../hooks/useInstalacionesInfra';
import { PERIODOS_INFRAESTRUCTURA, PERIODO_RANGO, desdePeriodo, filtrarInstalaciones, limitesRango } from '../utils/instalacionesInfra';
import { fechaCorta, fechaISO } from '../utils/calendario';
import { exportInstalacionesToCsv } from '../utils/exportReport';
import { tiempoTranscurrido } from '../utils/enCamino';
import Toast from './Toast';
import PlantillaFinalModal from './modals/PlantillaFinalModal';
import EncabezadoSimple from './EncabezadoSimple';
import PieVersion from './PieVersion';
import BotonFiltros from './BotonFiltros';
import { BUSCADOR } from './estilos';
import Chip from './Chip';
import Boton from './Boton';
import RangoFechas from './RangoFechas';

const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const dato = (valor) => valor || '—';
const ETIQUETA = 'text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400';

// Pantalla de INFRAESTRUCTURA: las instalaciones realizadas, con la NAP y el puerto donde quedó conectado cada cliente nuevo. Solo lectura.
// `onAbrirMenu`: cuando un administrador está aquí dentro del menú lateral, el botón ☰ que lo abre en el celular.
export default function InfraestructuraApp({ auth, onAbrirMenu }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout } = auth;
  const [isDarkMode, setIsDarkMode] = useTema(currentUser);
  const { toastMsg, setToastMsg } = useToast();
  const ahora = useAhora();
  const { instalaciones, cargado, error, actualizadoEn, actualizando, actualizar } = useInstalacionesInfra(firebaseUser);
  const [periodo, setPeriodo] = useState('30');
  const [busqueda, setBusqueda] = useState('');
  // El rango de fechas ("Rango"): al elegirlo empieza con la última semana y se ajusta con los dos calendarios.
  const [rango, setRango] = useState(() => ({ desde: fechaISO(desdePeriodo('7')), hasta: fechaISO(Date.now()) }));
  const limites = limitesRango(ahora);
  const [plantillaDe, setPlantillaDe] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtrosActivos = periodo !== '30' ? 1 : 0;

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

  const filas = useMemo(() => filtrarInstalaciones(instalaciones, { periodo, busqueda, desde: rango.desde, hasta: rango.hasta }), [instalaciones, periodo, busqueda, rango]);
  const etiquetaPeriodo = periodo === PERIODO_RANGO
    ? `del ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}`
    : PERIODOS_INFRAESTRUCTURA.find((p) => p.valor === periodo)?.etiqueta || '';

  const botonPlantilla = (f, clase) => (
    <Boton variante="secundario" tamano="normal" icono={FileText} className={clase} type="button" onClick={() => setPlantillaDe(f)} disabled={!f.plantilla} title={f.plantilla ? `Ver la plantilla final de ${f.codigo}` : 'Esta orden no tiene plantilla final'} aria-label={`Ver plantilla final de ${f.codigo}`}>
      Plantilla
    </Boton>
  );

  const chip = ({ valor, etiqueta }) => (
    <Chip activo={periodo === valor} tamano="compacto" key={valor} type="button" onClick={() => setPeriodo(valor)}>
      {etiqueta}
    </Chip>
  );

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-fondo text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />
        <EncabezadoSimple onAbrirMenu={onAbrirMenu} titulo="Infraestructura" icono={Network} nombre={currentUserName || currentUser} rol={etiquetaRol(role)} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} />

        <main className="p-3 sm:p-4 max-w-[1400px] mx-auto w-full flex-1 space-y-3">
          {!cargado ? (
            <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-10">Cargando instalaciones...</p>
          ) : error && !actualizadoEn ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar las instalaciones. Revisa tu conexión e intenta de nuevo.</p>
          ) : (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Buscar por cliente, código, técnico o NAP"
                    placeholder="Cliente, código o NAP"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className={BUSCADOR}
                  />
                  <BotonLimpiarBusqueda valor={busqueda} onLimpiar={() => setBusqueda('')} />
                </div>
                <BotonFiltros abierto={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} cuenta={filtrosActivos} />
                <BotonExportar
                  grande
                  onClick={() => exportInstalacionesToCsv(filas, `${etiquetaPeriodo}${busqueda.trim() ? ` · "${busqueda.trim()}"` : ''}`)}
                  disabled={!filas.length}
                  ariaLabel="Exportar a Excel"
                  title="Exportar a Excel"
                  etiqueta="Exportar"
                  etiquetaSoloPc
                />
              </div>

              <Colapsable>{filtersOpen && (
                <div className="rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Período">{[...PERIODOS_INFRAESTRUCTURA, { valor: PERIODO_RANGO, etiqueta: 'Rango' }].map(chip)}</div>
                  {periodo === PERIODO_RANGO && (
                    <RangoFechas desde={rango.desde} hasta={rango.hasta} onDesde={(v) => setRango((r) => ({ ...r, desde: v }))} onHasta={(v) => setRango((r) => ({ ...r, hasta: v }))} minimo={limites.min} maximo={limites.max} />
                  )}
                  </div>
                </div>
              )}</Colapsable>

              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-zinc-600 dark:text-zinc-400 ml-auto" aria-live="polite">{filas.length} {filas.length === 1 ? 'instalación' : 'instalaciones'}</p>
                <Boton variante="secundario" tamano="normal" icono={RefreshCw} girando={actualizando} onClick={actualizar} disabled={actualizando}>
                  {actualizando ? 'Actualizando...' : 'Actualizar'}
                </Boton>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 -mt-1">{error ? 'No se pudo actualizar.' : `Actualizado ${tiempoTranscurrido(actualizadoEn, ahora)}.`}</p>

              {!filas.length ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-10">{instalaciones.length ? 'Ninguna instalación coincide con lo que buscas.' : 'Todavía no hay instalaciones realizadas.'}</p>
              ) : (
                <>
                  {/* Celular: una tarjeta por instalación. */}
                  <ul className="md:hidden flex flex-col gap-2">
                    {filas.map((f) => (
                      <li key={f.id} className="rounded-xl border-2 border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm break-words">{f.cliente || 'Sin nombre'}</p>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">{dato(f.codigo)} · {fechaHora(f.fecha)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 dark:bg-zinc-950 p-2">
                          <div className="min-w-0"><p className={ETIQUETA}>NAP</p><p className="text-sm font-black break-words">{dato(f.nap)}</p></div>
                          <div className="min-w-0"><p className={ETIQUETA}>Puerto</p><p className="text-sm font-black">{dato(f.puerto)}</p></div>
                        </div>
                        {f.direccion && <p className="text-xs text-zinc-700 dark:text-zinc-300 break-words">{f.direccion}</p>}
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">Técnico: {dato(f.tecnico)} · Puertos libres: {dato(f.puertosDisponibles)}</p>
                        {botonPlantilla(f, 'w-full')}
                      </li>
                    ))}
                  </ul>

                  {/* Escritorio: tabla. */}
                  <div className="hidden md:block rounded-xl border-2 border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-100 dark:bg-zinc-950 text-[11px] uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                        <tr>
                          {['Fecha', 'Código', 'Cliente', 'Dirección', 'Técnico', 'NAP', 'Puerto', 'Puertos libres', 'Plantilla'].map((c) => <th key={c} scope="col" className="px-3 py-2.5 font-bold">{c}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {filas.map((f) => (
                          <tr key={f.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="px-3 py-2.5 min-w-[6.5rem]">{fechaHora(f.fecha)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-bold">{dato(f.codigo)}</td>
                            <td className="px-3 py-2.5 min-w-[8rem]">{dato(f.cliente)}</td>
                            <td className="px-3 py-2.5 min-w-[10rem] text-zinc-700 dark:text-zinc-300">{dato(f.direccion)}</td>
                            <td className="px-3 py-2.5 min-w-[7rem]">{dato(f.tecnico)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-black">{dato(f.nap)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-black">{dato(f.puerto)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{dato(f.puertosDisponibles)}</td>
                            <td className="px-3 py-2.5">{botonPlantilla(f, '')}</td>
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
        {plantillaDe && <PlantillaFinalModal orden={{ codigo: plantillaDe.codigo, nombre: plantillaDe.cliente }} texto={plantillaDe.plantilla} onCopy={copiar} onClose={() => setPlantillaDe(null)} />}
        <PieVersion />
      </div>
    </div>
  );
}
