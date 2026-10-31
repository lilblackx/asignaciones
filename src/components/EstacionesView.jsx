import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, EyeOff, MonitorSmartphone, PauseCircle, ShieldAlert } from 'lucide-react';
import { collection, doc } from 'firebase/firestore';
import { onSnapshot } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import Modal, { CENTRADO_ESTRECHO, PANEL_COMPLETO, PANEL_PAGINA } from './Modal';
import EncabezadoModulo from './EncabezadoModulo';
import ChipFiltro from './Chip';
import { useAhora } from '../hooks/useAhora';
import { CHIP, ETIQUETA, TARJETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { EN_LINEA_MS, avisosDePantalla, enLinea, haceCuanto, ordenarEstaciones } from '../utils/estaciones';
import { CUOTA_GRATIS, UMBRALES_PROYECTO } from '../utils/usoFirestore';

// Estaciones (solo para los usuarios de USUARIOS_ESTACIONES): todo lo que puede afectar a producción en Firestore. Arriba, el uso del proyecto
// entero (lo calcula el Worker cada 15 minutos con las métricas de Google Cloud: estadoFirestore/actual); abajo, cada navegador con la app abierta,
// con sus lecturas, escrituras, rechazos, escuchadores y errores (ver utils/estaciones.js y hooks/useEstacion.js). Lee en vivo solo mientras está abierta.
const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const numero = (n) => (Number(n) || 0).toLocaleString('es-VE');
const horaCaracas = (ms) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms)).replace(/\s+/g, ' ');

function useEnVivo(ref, inicial) {
  const [estado, setEstado] = useState({ datos: inicial, cargado: false, error: false });
  useEffect(() => onSnapshot(ref(),
    (snap) => setEstado({ datos: snap.docs ? snap.docs.map((d) => ({ id: d.id, ...d.data() })) : (snap.exists() ? snap.data() : null), cargado: true, error: false }),
    (error) => { console.error('No se pudo leer el registro de estaciones:', error); setEstado((e) => ({ ...e, cargado: true, error: true })); }), []); // eslint-disable-line react-hooks/exhaustive-deps
  return estado;
}
const refEstaciones = () => collection(db, 'artifacts', appId, 'public', 'data', 'estaciones');
const refEstado = () => doc(db, 'artifacts', appId, 'public', 'data', 'estadoFirestore', 'actual');

function Alerta({ children }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 px-2.5 py-1.5 text-xs font-bold text-red-700 dark:text-red-300">
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> <span>{children}</span>
    </p>
  );
}
function Aviso({ children }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900 px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> <span>{children}</span>
    </p>
  );
}

// Cuánto va del día contra la cuota gratis: el número, el porcentaje escrito y una barra (el color es de estado y nunca va solo: el texto lo dice).
function Cuota({ etiqueta, valor, tope }) {
  const p = Math.round(((Number(valor) || 0) / tope) * 100);
  const estado = p >= 100 ? { barra: 'bg-red-600 dark:bg-red-500', texto: 'se pasó' } : p >= UMBRALES_PROYECTO.cuotaPorcentaje ? { barra: 'bg-amber-500', texto: 'cerca del tope' } : { barra: 'bg-zinc-500 dark:bg-zinc-400', texto: '' };
  return (
    <div className={`${TARJETA} px-3 py-2.5 min-w-0`}>
      <p className={ETIQUETA}>{etiqueta}</p>
      <p className="text-lg font-black text-zinc-900 dark:text-white">{numero(valor)} <span className="text-xs font-bold text-zinc-500">de {numero(tope)}</span></p>
      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden mt-1" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(p, 100)} aria-label={`${etiqueta}: ${p}% de la cuota gratis`}>
        <div className={`h-full rounded-full ${estado.barra}`} style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
      <p className={`${TEXTO_SUAVE} mt-1`}>{p}% de lo gratis{estado.texto && ` · ${estado.texto}`}</p>
    </div>
  );
}

// Columnas por hora de una sola medida (nunca dos escalas en un gráfico), con la línea del umbral; las horas sobre el umbral van en rojo y la
// línea dice qué significa. Al pasar el cursor (o tocar) una columna se ve su hora y su valor.
function ColumnasPorHora({ titulo, horas, campo, umbral, unidad }) {
  const [marcada, setMarcada] = useState(null);
  const maximo = Math.max(umbral * 1.15, ...horas.map((h) => h[campo] || 0), 1);
  const sobre = horas.filter((h) => (h[campo] || 0) > umbral).length;
  const pico = horas.reduce((m, h) => ((h[campo] || 0) > (m?.[campo] || 0) ? h : m), null);
  const resumen = `${titulo}, últimas 24 horas: pico de ${numero(pico?.[campo])} ${unidad} a las ${pico ? horaCaracas(pico.hasta) : '-'}; ${sobre} ${sobre === 1 ? 'hora' : 'horas'} sobre el umbral de ${numero(umbral)}.`;
  const actual = marcada !== null ? horas[marcada] : null;
  return (
    <figure className={`${TARJETA} p-3 min-w-0`}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-black text-zinc-800 dark:text-zinc-100">{titulo}</span>
        <span className={TEXTO_SUAVE}>{actual ? `${horaCaracas(actual.hasta - 3600000)}–${horaCaracas(actual.hasta)}: ${numero(actual[campo])} ${unidad}` : `pico ${numero(pico?.[campo])}`}</span>
      </figcaption>
      <div className="relative h-24 mt-2" role="img" aria-label={resumen}>
        <div className="absolute inset-x-0 border-t border-dashed border-red-500/70" style={{ bottom: `${(umbral / maximo) * 100}%` }} aria-hidden="true">
          <span className="absolute left-0 -top-4 text-[10px] font-bold text-red-600 dark:text-red-400">umbral {numero(umbral)}</span>
        </div>
        <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setMarcada(null)}>
          {horas.map((h, i) => {
            const valor = h[campo] || 0;
            return (
              <button key={h.hasta} type="button" onMouseEnter={() => setMarcada(i)} onFocus={() => setMarcada(i)} onClick={() => setMarcada(i)}
                aria-label={`${horaCaracas(h.hasta - 3600000)} a ${horaCaracas(h.hasta)}: ${numero(valor)} ${unidad}`}
                className="flex-1 h-full flex items-end min-w-0 focus:outline-none group">
                <span className={`w-full rounded-t-[4px] ${valor > umbral ? 'bg-red-600 dark:bg-red-500' : 'bg-sky-600 dark:bg-sky-500'} ${marcada === i ? 'opacity-100 ring-2 ring-zinc-900 dark:ring-white' : marcada !== null ? 'opacity-50' : ''}`}
                  style={{ height: `${Math.max(valor > 0 ? 2 : 0, (valor / maximo) * 100)}%` }} />
              </button>
            );
          })}
        </div>
      </div>
      <div className={`flex justify-between mt-1 ${TEXTO_SUAVE}`} aria-hidden="true">
        <span>{horas[0] ? horaCaracas(horas[0].hasta - 3600000) : ''}</span><span>ahora</span>
      </div>
    </figure>
  );
}

function PanelProyecto({ estado, cargado, error, ahora }) {
  if (error) return <Alerta>No se pudo leer el uso del proyecto.</Alerta>;
  if (!cargado) return <p className={TEXTO_SUAVE}>Cargando el uso del proyecto…</p>;
  if (!estado) return <p className={TEXTO_SUAVE}>Todavía no hay resumen del proyecto: el Worker lo calcula cada 15 minutos.</p>;
  const viejo = ahora - (Number(estado.actualizadoEn) || 0) > 40 * 60 * 1000;
  const horas = estado.porHora || [];
  return (
    <section aria-labelledby="uso-proyecto" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="uso-proyecto" className={TITULO_SECCION}>Todo el proyecto</h3>
        <span className={TEXTO_SUAVE}>actualizado {haceCuanto(Number(estado.actualizadoEn), ahora)}</span>
      </div>
      {estado.error && <Alerta>{estado.error}</Alerta>}
      {viejo && <Aviso>El resumen no se actualiza desde hace más de 40 minutos: revisa que el cron del Worker esté corriendo.</Aviso>}
      {(estado.alertas || []).map((a) => <Alerta key={a}>{a}</Alerta>)}
      {!estado.error && !(estado.alertas || []).length && !viejo && (
        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Uso normal en el proyecto.</p>
      )}
      {!estado.error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Cuota etiqueta="Lecturas hoy" valor={estado.hoy?.lecturas} tope={estado.cuota?.lecturas || CUOTA_GRATIS.lecturas} />
            <Cuota etiqueta="Escrituras hoy" valor={estado.hoy?.escrituras} tope={estado.cuota?.escrituras || CUOTA_GRATIS.escrituras} />
            <Cuota etiqueta="Borrados hoy" valor={estado.hoy?.borrados} tope={estado.cuota?.borrados || CUOTA_GRATIS.borrados} />
          </div>
          <p className={TEXTO_SUAVE}>
            El día de la cuota empieza a las {horaCaracas(Number(estado.inicioDia))} (medianoche en la hora del Pacífico, cuando Google la reinicia).
            {estado.escuchadores !== null && ` Ahora hay ${numero(estado.escuchadores)} escuchadores abiertos en ${numero(estado.conexiones)} conexiones.`}
          </p>
          {horas.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <ColumnasPorHora titulo="Lecturas por hora" horas={horas} campo="lecturas" umbral={UMBRALES_PROYECTO.lecturasHora} unidad="lecturas" />
              <ColumnasPorHora titulo="Rechazos de las reglas por hora" horas={horas} campo="rechazos" umbral={UMBRALES_PROYECTO.rechazosHora} unidad="rechazos" />
            </div>
          )}
          {horas.length > 0 && (
            <details className={`${TARJETA} px-3 py-2`}>
              <summary className="text-xs font-bold cursor-pointer text-zinc-700 dark:text-zinc-300">Ver como tabla</summary>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs tabular-nums">
                  <thead><tr className="text-left text-zinc-500">{['Hora', 'Lecturas', 'Escrituras', 'Borrados', 'Rechazos'].map((t) => <th key={t} className="py-1 pr-3 font-bold">{t}</th>)}</tr></thead>
                  <tbody>
                    {[...horas].reverse().map((h) => (
                      <tr key={h.hasta} className="border-t border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
                        <td className="py-1 pr-3">{horaCaracas(h.hasta - 3600000)}–{horaCaracas(h.hasta)}</td>
                        <td className="py-1 pr-3">{numero(h.lecturas)}</td><td className="py-1 pr-3">{numero(h.escrituras)}</td>
                        <td className="py-1 pr-3">{numero(h.borrados)}</td><td className="py-1 pr-3">{numero(h.rechazos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

const Dato = ({ etiqueta, children, alerta = false }) => (
  <div className="min-w-0"><dt className={ETIQUETA}>{etiqueta}</dt><dd className={`font-bold truncate ${alerta ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>{children}</dd></div>
);

function Estacion({ e, ahora }) {
  const activa = enLinea(e, ahora);
  const v = e.ventana || {};
  const minutos = Math.max(1, Math.round(((Number(v.hasta) || 0) - (Number(v.desde) || 0)) / 60000));
  const lista = (mapa) => Object.entries(mapa || {}).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${numero(n)}`).join(' · ');
  const equipo = e.equipo || {};
  const alertas = String(e.anomalia || '').split(' · ').filter(Boolean);
  const avisos = avisosDePantalla(e, __APP_BUILD__);
  return (
    <li className={`${TARJETA} p-3 space-y-2 ${alertas.length && activa ? 'border-red-500 dark:border-red-700' : ''}`}>
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${activa ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-zinc-900 dark:text-white truncate">{e.nombre || e.usuario || 'Sin usuario'} <span className="font-normal text-zinc-500">({e.usuario || 's/u'})</span></p>
          <p className={TEXTO_SUAVE}>{[equipo.sistema, equipo.navegador, equipo.pantalla, equipo.movil && 'móvil', equipo.instalada && 'app instalada'].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="text-right shrink-0">
          <span className={`${CHIP} bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200`}>{e.rol || 's/r'}</span>
          <p className={`${TEXTO_SUAVE} mt-1`}>{activa ? 'En línea' : 'Desconectada'} · {haceCuanto(Number(e.ultimaSenal), ahora)}</p>
        </div>
      </div>

      {alertas.map((a) => <Alerta key={a}>{a}</Alerta>)}
      {avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Dato etiqueta={`Lecturas (${minutos} min)`}>{numero(v.lecturas)} <span className="font-normal text-zinc-500">· sesión {numero(e.total?.lecturas)}</span></Dato>
        <Dato etiqueta={`Escrituras (${minutos} min)`}>{numero(v.escrituras)} <span className="font-normal text-zinc-500">· sesión {numero(e.total?.escrituras)}</span></Dato>
        <Dato etiqueta="Rechazadas por el servidor" alerta={v.rechazadas > 0}>{numero(v.rechazadas)} <span className="font-normal text-zinc-500">· sesión {numero(e.total?.rechazadas)}</span></Dato>
        <Dato etiqueta="Escuchadores abiertos">{numero(e.escuchadoresActivos)} <span className="font-normal text-zinc-500">· {numero(v.suscripciones)} suscripciones</span></Dato>
        <Dato etiqueta="Lecturas fallidas" alerta={v.erroresEscucha > 0}>{numero(v.erroresEscucha)}</Dato>
        <Dato etiqueta="Errores de la app" alerta={v.erroresApp > 0}>{numero(v.erroresApp)} <span className="font-normal text-zinc-500">· sesión {numero(e.total?.erroresApp)}</span></Dato>
        <Dato etiqueta="Escrituras automáticas" alerta={v.automaticasFallidas > 0}>{numero(v.automaticasIntentadas)} · {numero(v.automaticasFallidas)} fallidas</Dato>
        <Dato etiqueta="Versión">{e.build && e.build !== __APP_BUILD__ ? 'Anterior' : 'Actual'}</Dato>
      </dl>

      {Object.keys(v.porColeccion || {}).length > 0 && <p className={TEXTO_SUAVE}><span className="font-bold">Lee de:</span> {lista(v.porColeccion)}</p>}
      {Object.keys(v.escriturasPorColeccion || {}).length > 0 && <p className={TEXTO_SUAVE}><span className="font-bold">Escribe en:</span> {lista(v.escriturasPorColeccion)}</p>}
      {Object.keys(v.errores || {}).length > 0 && <p className="text-xs text-red-700 dark:text-red-300"><span className="font-bold">Errores de Firestore:</span> {lista(v.errores)}</p>}
      {e.ultimoError && <p className="text-xs text-red-700 dark:text-red-300 break-words"><span className="font-bold">Último error de la app:</span> {e.ultimoError}</p>}

      {(e.cortacircuitos || e.automaticasPausadas || e.visible === false) && (
        <div className="flex flex-wrap gap-1.5">
          {e.cortacircuitos && <span className={`${CHIP} gap-1 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300`}><ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" /> Freno de escrituras activado</span>}
          {e.automaticasPausadas && <span className={`${CHIP} gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300`}><PauseCircle className="w-3.5 h-3.5" aria-hidden="true" /> Automáticas en pausa</span>}
          {e.visible === false && <span className={`${CHIP} gap-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300`}><EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> Pestaña en segundo plano</span>}
        </div>
      )}
    </li>
  );
}

export default function EstacionesView({ enPagina = false, onClose }) {
  const ahora = useAhora();
  const estaciones = useEnVivo(refEstaciones, []);
  const proyecto = useEnVivo(refEstado, null);
  const [soloEnLinea, setSoloEnLinea] = useState(true);

  const recientes = useMemo(() => (estaciones.datos || []).filter((e) => ahora - (Number(e.ultimaSenal) || 0) < SIETE_DIAS_MS), [estaciones.datos, ahora]);
  const activas = recientes.filter((e) => enLinea(e, ahora));
  const visibles = ordenarEstaciones(soloEnLinea ? activas : recientes, ahora);
  const conProblema = activas.filter((e) => e.anomalia || avisosDePantalla(e, __APP_BUILD__).length).length;

  return (
    <Modal enPagina={enPagina} onClose={onClose} zIndexClass="z-50" completa>
      <div className={enPagina ? PANEL_PAGINA : `bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800 ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={MonitorSmartphone} titulo="Estaciones" onClose={onClose} enPagina={enPagina} />
        <div className={`p-4 space-y-5 ${CENTRADO_ESTRECHO}`}>
          <p className={TEXTO_SUAVE}>
            Todo lo que puede afectar a producción en Firestore: arriba, el uso del proyecto entero; abajo, cada navegador con la app abierta (se reporta cada
            10 minutos y en cuanto algo anda mal). Se considera desconectado si no reporta en {EN_LINEA_MS / 60000} minutos.
          </p>

          <PanelProyecto estado={proyecto.datos} cargado={proyecto.cargado} error={proyecto.error} ahora={ahora} />

          <section aria-labelledby="estaciones-lista" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="estaciones-lista" className={TITULO_SECCION}>Estaciones</h3>
              <span className={`text-xs font-bold ${conProblema ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>{conProblema ? `${conProblema} con algo que revisar` : 'Ninguna con problemas'}</span>
            </div>
            <div className="flex gap-2">
              <ChipFiltro activo={soloEnLinea} onClick={() => setSoloEnLinea(true)}>En línea ({activas.length})</ChipFiltro>
              <ChipFiltro activo={!soloEnLinea} onClick={() => setSoloEnLinea(false)}>Últimos 7 días ({recientes.length})</ChipFiltro>
            </div>
            {estaciones.error && <Alerta>No se pudieron leer las estaciones.</Alerta>}
            {!estaciones.cargado && <p className={TEXTO_SUAVE}>Cargando…</p>}
            {estaciones.cargado && !estaciones.error && visibles.length === 0 && (
              <p className={TEXTO_SUAVE}>{soloEnLinea ? 'No hay estaciones en línea ahora.' : 'Ninguna estación reportó en los últimos 7 días.'}</p>
            )}
            <ul className="space-y-2">
              {visibles.map((e) => <Estacion key={e.id} e={e} ahora={ahora} />)}
            </ul>
          </section>
        </div>
      </div>
    </Modal>
  );
}
