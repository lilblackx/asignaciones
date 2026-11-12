import { AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import Boton from './Boton';
import { TARJETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { useEstadoSistema } from '../hooks/useEstadoSistema';
import { cortacircuitosAbierto } from '../lib/escrituraAutomatica';
import { hayActualizacion } from '../lib/updateAvailable';
import { NIVEL, estadoDeAutomaticas, estadoDeVersion } from '../utils/estadoSistema';

// "Estado del sistema" de Configuración (solo ADMIN): de un vistazo, solo lectura. Lo único que hace es una petición a /version.json al abrir o al pulsar
// "Actualizar" (ver hooks/useEstadoSistema.js); no lee nada de Firestore. `pausadas`: lo que dice el interruptor remoto de la misma pantalla (null: aún sin leer).
const ICONO = {
  [NIVEL.BIEN]: { Icono: CheckCircle2, clase: 'text-emerald-600 dark:text-emerald-400', nombre: 'Bien' },
  [NIVEL.AVISO]: { Icono: AlertTriangle, clase: 'text-amber-600 dark:text-amber-400', nombre: 'Atención' },
  [NIVEL.INFO]: { Icono: Info, clase: 'text-zinc-500 dark:text-zinc-400', nombre: 'Sin dato' },
};

function Fila({ titulo, nivel, texto, detalle }) {
  const { Icono, clase, nombre } = ICONO[nivel];
  return (
    <li className="flex items-start gap-2.5 px-3 py-2.5">
      <Icono className={`w-5 h-5 shrink-0 mt-0.5 ${clase}`} role="img" aria-label={nombre} />
      <div className="min-w-0 space-y-0.5">
        <p className="text-[11px] max-lg:text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{titulo}</p>
        <p className="text-sm font-bold text-zinc-900 dark:text-white break-words">{texto}</p>
        {detalle && <p className={TEXTO_SUAVE}>{detalle}</p>}
      </div>
    </li>
  );
}

const horaLocal = (ms) => new Date(ms).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s+/g, ' ');

export default function EstadoSistema({ pausadas = null }) {
  const { versionServidor, cargado, leidoEn, actualizar } = useEstadoSistema();

  const version = estadoDeVersion(versionServidor, __APP_BUILD__, { actualizacionLista: hayActualizacion() });
  const automaticas = estadoDeAutomaticas({ pausadas, cortacircuitos: cortacircuitosAbierto() });
  const compilacion = `v${__APP_VERSION__} · compilada el ${__APP_COMPILACION__}${__APP_COMMIT__ ? ` · ${__APP_COMMIT__}` : ''}`;

  return (
    <section aria-labelledby="config-estado" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="config-estado" className={TITULO_SECCION}>Estado del sistema</h3>
        <Boton tamano="compacto" icono={RefreshCw} girando={!cargado} onClick={actualizar} disabled={!cargado}>Actualizar</Boton>
      </div>
      <ul className={`${TARJETA} divide-y divide-zinc-200 dark:divide-zinc-800`}>
        <Fila titulo="Versión de la app" nivel={cargado ? version.nivel : NIVEL.INFO} texto={cargado ? version.texto : 'Comprobando…'} detalle={compilacion} />
        <Fila titulo="Escrituras automáticas" nivel={automaticas.nivel} texto={automaticas.texto} detalle={automaticas.detalle} />
      </ul>
      <div className={`${TEXTO_SUAVE} space-y-1`}>
        {leidoEn > 0 && <p>Última comprobación: {horaLocal(leidoEn)}</p>}
        <p>Solo lee: no cambia nada. La tasa del dólar se ve en Tasa y pagos, el consumo de Firestore en Estaciones y los envíos pendientes en Envíos al inventario.</p>
      </div>
    </section>
  );
}
