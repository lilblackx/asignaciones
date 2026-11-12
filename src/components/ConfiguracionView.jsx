import { useState } from 'react';
import { AlertTriangle, PauseCircle, Route, Settings } from 'lucide-react';
import Modal, { CENTRADO_ESTRECHO, PANEL_COMPLETO, PANEL_PAGINA } from './Modal';
import EncabezadoModulo from './EncabezadoModulo';
import Colapsable from './Colapsable';
import EstadoSistema from './EstadoSistema';
import { TARJETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { FUNCIONES } from '../utils/funciones';

// Configuración (solo ADMIN): las funciones que se encienden o se apagan para toda la app, el interruptor remoto de emergencia y el estado del sistema. Cada
// función es una casilla con su explicación y nace desactivada (ver utils/funciones.js). Aquí irán sumándose más ajustes. Los cambios se guardan al marcar la casilla
// y llegan solos a quien tenga la app abierta.
const OPCIONES = [
  {
    clave: FUNCIONES.RUTAS,
    Icono: Route,
    titulo: 'Ruta del día para los técnicos',
    detalle: 'Muestra a cada técnico el botón "Ruta" junto a su nombre. Arma el recorrido de sus órdenes de hoy (primero las de prioridad alta, luego de la más cercana a la más lejana desde donde esté) y lo abre en Google Maps. Pide la ubicación del teléfono solo al abrir la ruta.',
  },
];

const fechaCaracas = (ms) => new Date(ms).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Caracas' });

// Una casilla con su título, su estado y su explicación. `etiquetas`: lo que dice la insignia marcada y desmarcada; `marcada` null: aún sin leer.
function TarjetaCasilla({ id, Icono, titulo, detalle, marcada, cargado, ocupada, etiquetas, avisoCuandoMarcada = false, onCambiar, pie = null }) {
  const sinDato = marcada === null;
  const insignia = !cargado ? 'Cargando' : sinDato ? 'Sin dato' : marcada ? etiquetas.marcada : etiquetas.desmarcada;
  const resaltada = marcada === true && avisoCuandoMarcada;
  // Neutra mientras no hay dato; ámbar si lo marcado es una alerta; verde si todo está en orden (lo marcado, o lo desmarcado cuando marcar es la alerta).
  const verde = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
  const neutra = 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  const claseInsignia = !cargado || sinDato ? neutra
    : resaltada ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300'
    : marcada !== avisoCuandoMarcada ? verde : neutra;
  return (
    <div className={`${TARJETA} p-3 ${resaltada ? 'border-amber-400 dark:border-amber-700' : ''}`}>
      <label htmlFor={id} className="flex items-start gap-3 cursor-pointer max-lg:min-h-11">
        <input
          id={id}
          type="checkbox"
          checked={marcada === true}
          disabled={!cargado || sinDato || ocupada}
          onChange={(e) => onCambiar(e.target.checked)}
          className="mt-0.5 w-5 h-5 shrink-0 accent-red-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <span className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black text-zinc-900 dark:text-white">
            <Icono className={`w-4 h-4 shrink-0 ${resaltada ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`} aria-hidden="true" />
            {titulo}
            <span className={`whitespace-nowrap text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded ${claseInsignia}`}>{insignia}</span>
          </span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400">{detalle}</span>
          {pie && <span className="block text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400">{pie}</span>}
        </span>
      </label>
    </div>
  );
}

// `interruptor`: { pausarAutomaticas (null: sin leer), cargado, error, actualizadoPor, actualizadoEn, cambiarPausa } de hooks/useInterruptorRemoto.
export default function ConfiguracionView({ funciones, cargado, error, onCambiar, interruptor, enPagina = false, onClose }) {
  const [guardando, setGuardando] = useState(null);
  const [fallo, setFallo] = useState('');

  const guardar = async (clave, accion) => {
    setFallo('');
    setGuardando(clave);
    const ok = await accion();
    setGuardando(null);
    if (!ok) setFallo('No se pudo guardar el cambio. Revisa tu conexión e inténtalo de nuevo.');
  };
  const cambiar = (clave, valor) => guardar(clave, () => onCambiar(clave, valor));

  const { pausarAutomaticas, cargado: interruptorCargado, error: interruptorError, actualizadoPor, actualizadoEn, cambiarPausa } = interruptor;
  const ultimoCambio = actualizadoEn ? `Último cambio: ${fechaCaracas(actualizadoEn)}${actualizadoPor ? ` · ${actualizadoPor}` : ''}` : null;

  return (
    <Modal enPagina={enPagina} onClose={onClose} zIndexClass="z-50" completa>
      <div className={enPagina ? PANEL_PAGINA : `bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto border border-zinc-300 dark:border-zinc-800 ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={Settings} titulo="Configuración" onClose={onClose} enPagina={enPagina} />
        <div className={`p-4 space-y-4 ${CENTRADO_ESTRECHO}`}>
          <p className={TEXTO_SUAVE}>Funciones de la app que se encienden o se apagan para todos. Los cambios se guardan al marcar la casilla.</p>

          {(error || interruptorError) && (
            <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 px-2.5 py-1.5 text-xs font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> <span>No se pudo leer la configuración. Lo que ves puede no ser lo guardado.</span>
            </p>
          )}

          <section aria-labelledby="config-funciones" className="space-y-3">
            <h3 id="config-funciones" className={TITULO_SECCION}>Funciones</h3>
            {OPCIONES.map(({ clave, Icono, titulo, detalle }) => (
              <TarjetaCasilla
                key={clave}
                id={`config-${clave}`}
                Icono={Icono}
                titulo={titulo}
                detalle={detalle}
                marcada={funciones[clave] === true}
                cargado={cargado}
                ocupada={guardando === clave}
                etiquetas={{ marcada: 'Activada', desmarcada: 'Desactivada' }}
                onCambiar={(valor) => cambiar(clave, valor)}
              />
            ))}
          </section>

          <section aria-labelledby="config-interruptor" className="space-y-3">
            <h3 id="config-interruptor" className={TITULO_SECCION}>Interruptor remoto</h3>
            <TarjetaCasilla
              id="config-pausarAutomaticas"
              Icono={PauseCircle}
              titulo="Pausar las escrituras automáticas"
              detalle="Interruptor de emergencia para todas las pantallas abiertas. Marcado, la app deja de hacer lo que hace sola (limpiar avisos vencidos, completar datos que faltan, numerar ventas); lo que cada persona guarda con sus botones sigue funcionando. Úsalo si en Estaciones ves lecturas o rechazos fuera de lo normal, y desmárcalo cuando se resuelva. Se aplica en segundos."
              pie={ultimoCambio}
              marcada={pausarAutomaticas}
              cargado={interruptorCargado}
              ocupada={guardando === 'pausarAutomaticas'}
              etiquetas={{ marcada: 'Pausadas', desmarcada: 'Normales' }}
              avisoCuandoMarcada
              onCambiar={(valor) => guardar('pausarAutomaticas', () => cambiarPausa(valor))}
            />
          </section>

          <Colapsable>{fallo && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400">{fallo}</p>}</Colapsable>

          <EstadoSistema pausadas={pausarAutomaticas} />
        </div>
      </div>
    </Modal>
  );
}
