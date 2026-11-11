import { useState } from 'react';
import { AlertTriangle, Route, Settings } from 'lucide-react';
import Modal, { CENTRADO_ESTRECHO, PANEL_COMPLETO, PANEL_PAGINA } from './Modal';
import EncabezadoModulo from './EncabezadoModulo';
import Colapsable from './Colapsable';
import { TARJETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { FUNCIONES } from '../utils/funciones';

// Configuración (solo ADMIN): las funciones que se encienden o se apagan para toda la app. Cada una es una casilla con su explicación y nace
// desactivada (ver utils/funciones.js). Aquí irán sumándose más ajustes. Los cambios se guardan al marcar la casilla y llegan solos a quien
// tenga la app abierta.
const OPCIONES = [
  {
    clave: FUNCIONES.RUTAS,
    Icono: Route,
    titulo: 'Ruta del día para los técnicos',
    detalle: 'Muestra a cada técnico el botón "Ruta" junto a su nombre. Arma el recorrido de sus órdenes de hoy (primero las de prioridad alta, luego de la más cercana a la más lejana desde donde esté) y lo abre en Google Maps. Pide la ubicación del teléfono solo al abrir la ruta.',
  },
];

export default function ConfiguracionView({ funciones, cargado, error, onCambiar, enPagina = false, onClose }) {
  const [guardando, setGuardando] = useState(null);
  const [fallo, setFallo] = useState('');

  const cambiar = async (clave, valor) => {
    setFallo('');
    setGuardando(clave);
    const ok = await onCambiar(clave, valor);
    setGuardando(null);
    if (!ok) setFallo('No se pudo guardar el cambio. Revisa tu conexión e inténtalo de nuevo.');
  };

  return (
    <Modal enPagina={enPagina} onClose={onClose} zIndexClass="z-50" completa>
      <div className={enPagina ? PANEL_PAGINA : `bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto border border-zinc-300 dark:border-zinc-800 ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={Settings} titulo="Configuración" onClose={onClose} enPagina={enPagina} />
        <div className={`p-4 space-y-4 ${CENTRADO_ESTRECHO}`}>
          <p className={TEXTO_SUAVE}>Funciones de la app que se encienden o se apagan para todos. Los cambios se guardan al marcar la casilla.</p>

          {error && (
            <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 px-2.5 py-1.5 text-xs font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> <span>No se pudo leer la configuración. Lo que ves puede no ser lo guardado.</span>
            </p>
          )}

          <section aria-labelledby="config-funciones" className="space-y-3">
            <h3 id="config-funciones" className={TITULO_SECCION}>Funciones</h3>
            {OPCIONES.map(({ clave, Icono, titulo, detalle }) => {
              const activa = funciones[clave] === true;
              return (
                <div key={clave} className={`${TARJETA} p-3`}>
                  <label htmlFor={`config-${clave}`} className="flex items-start gap-3 cursor-pointer max-lg:min-h-11">
                    <input
                      id={`config-${clave}`}
                      type="checkbox"
                      checked={activa}
                      disabled={!cargado || guardando === clave}
                      onChange={(e) => cambiar(clave, e.target.checked)}
                      className="mt-0.5 w-5 h-5 shrink-0 accent-red-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0 space-y-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black text-zinc-900 dark:text-white">
                        <Icono className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />
                        {titulo}
                        <span className={`whitespace-nowrap text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded ${activa ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>{!cargado ? 'Cargando' : activa ? 'Activada' : 'Desactivada'}</span>
                      </span>
                      <span className="block text-xs text-zinc-600 dark:text-zinc-400">{detalle}</span>
                    </span>
                  </label>
                </div>
              );
            })}
            <Colapsable>{fallo && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400">{fallo}</p>}</Colapsable>
          </section>
        </div>
      </div>
    </Modal>
  );
}
