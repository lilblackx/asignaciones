import { useState } from 'react';
import { LocateFixed, PauseCircle, Route, Settings } from 'lucide-react';
import Modal, { IZQUIERDA_ESTRECHO, PANEL_COMPLETO, PANEL_PAGINA } from './Modal';
import EncabezadoModulo from './EncabezadoModulo';
import Colapsable from './Colapsable';
import EstadoSistema from './EstadoSistema';
import { TARJETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { FUNCIONES } from '../utils/funciones';
import Aviso from './Aviso';
import Interruptor from './Interruptor';

// Configuración (solo ADMIN): las funciones que se encienden o se apagan para toda la app, el interruptor remoto de emergencia y el estado del sistema. Cada
// función es un interruptor con su explicación y nace desactivada (ver utils/funciones.js). Aquí irán sumándose más ajustes. Los cambios se guardan al mover el interruptor
// y llegan solos a quien tenga la app abierta.
const OPCIONES = [
  {
    clave: FUNCIONES.RUTAS,
    Icono: Route,
    titulo: 'Ruta del día para los técnicos',
    detalle: 'Muestra a cada técnico el botón "Ruta" junto a su nombre. Arma el recorrido de sus órdenes de hoy (primero las de prioridad alta, luego de la más cercana a la más lejana desde donde esté) y lo abre en Google Maps. Pide la ubicación del teléfono solo al abrir la ruta.',
  },
  {
    clave: FUNCIONES.UBICACION,
    Icono: LocateFixed,
    titulo: 'Ubicación de técnicos en la calle',
    detalle: 'Agrega el módulo "Ubicación" al menú del administrador: al pedir la de un técnico, su teléfono la envía sola cuando abra la app, durante 30 minutos, y se ve en un mapa. Además guarda un punto al marcar En camino, Llegué o pre-finalizar (la última ubicación conocida, por 24 horas). El técnico no recibe ningún aviso: solo funciona con la app abierta y el permiso de ubicación del teléfono activo. Al apagarla se detiene todo en segundos.',
  },
];

const fechaCaracas = (ms) => new Date(ms).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Caracas' });

// Una función con su título, su estado y su explicación, y a la derecha su interruptor. `etiquetas`: lo que dice la insignia encendida y apagada; `marcada` null: aún sin leer.
function TarjetaFuncion({ id, Icono, titulo, detalle, marcada, cargado, ocupada, etiquetas, avisoCuandoMarcada = false, onCambiar, pie = null }) {
  const sinDato = marcada === null;
  const insignia = !cargado ? 'Cargando' : sinDato ? 'Sin dato' : marcada ? etiquetas.marcada : etiquetas.desmarcada;
  const resaltada = marcada === true && avisoCuandoMarcada;
  // Neutra mientras no hay dato; ámbar si lo encendido es una alerta; verde si todo está en orden (lo encendido, o lo apagado cuando encender es la alerta).
  const verde = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
  const neutra = 'bg-secondary text-muted-foreground';
  const claseInsignia = !cargado || sinDato ? neutra
    : resaltada ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300'
    : marcada !== avisoCuandoMarcada ? verde : neutra;
  return (
    <div className={`${TARJETA} p-4 flex items-start gap-3 ${resaltada ? 'border-amber-400 dark:border-amber-700' : ''}`}>
      <span aria-hidden="true" className={`shrink-0 w-9 h-9 rounded-full inline-flex items-center justify-center ${resaltada ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'}`}>
        <Icono className="w-[18px] h-[18px]" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 id={`${id}-titulo`} className="text-sm font-black text-foreground">{titulo}</h4>
          <span className={`whitespace-nowrap text-xs font-bold px-2 py-0.5 rounded-full ${claseInsignia}`}>{insignia}</span>
        </div>
        <p id={`${id}-detalle`} className="text-xs text-muted-foreground">{detalle}</p>
        {pie && <p className="text-xs text-muted-foreground">{pie}</p>}
      </div>
      <Interruptor
        id={id}
        activo={marcada === true}
        deshabilitado={!cargado || sinDato || ocupada}
        onCambiar={onCambiar}
        ariaLabel={titulo}
        ariaDescribedBy={`${id}-detalle`}
        tono={avisoCuandoMarcada ? 'atencion' : 'exito'}
        className="mt-1"
      />
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
      <div className={enPagina ? PANEL_PAGINA : `bg-card rounded-card shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto border border-border ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={Settings} titulo="Configuración" onClose={onClose} enPagina={enPagina} />
        <div className={`p-4 space-y-4 ${IZQUIERDA_ESTRECHO}`}>
          <p className={TEXTO_SUAVE}>Funciones de la app que se encienden o se apagan para todos. Los cambios se guardan al mover el interruptor.</p>

          {(error || interruptorError) && (
            <Aviso nivel="error" compact>No se pudo leer la configuración. Lo que ves puede no ser lo guardado.</Aviso>
          )}

          <section aria-labelledby="config-funciones" className="space-y-3">
            <h3 id="config-funciones" className={TITULO_SECCION}>Funciones</h3>
            {OPCIONES.map(({ clave, Icono, titulo, detalle }) => (
              <TarjetaFuncion
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
            <TarjetaFuncion
              id="config-pausarAutomaticas"
              Icono={PauseCircle}
              titulo="Pausar las escrituras automáticas"
              detalle="Interruptor de emergencia para todas las pantallas abiertas. Encendido, la app deja de hacer lo que hace sola (limpiar avisos vencidos, completar datos que faltan, numerar ventas); lo que cada persona guarda con sus botones sigue funcionando. Úsalo si en Estaciones ves lecturas o rechazos fuera de lo normal, y apágalo cuando se resuelva. Se aplica en segundos."
              pie={ultimoCambio}
              marcada={pausarAutomaticas}
              cargado={interruptorCargado}
              ocupada={guardando === 'pausarAutomaticas'}
              etiquetas={{ marcada: 'Pausadas', desmarcada: 'Normales' }}
              avisoCuandoMarcada
              onCambiar={(valor) => guardar('pausarAutomaticas', () => cambiarPausa(valor))}
            />
          </section>

          <Colapsable>{fallo && <p role="alert" className="text-xs font-bold text-red-700 dark:text-red-400">{fallo}</p>}</Colapsable>

          <EstadoSistema pausadas={pausarAutomaticas} />
        </div>
      </div>
    </Modal>
  );
}
