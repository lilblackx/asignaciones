import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useCierreAutomatico } from '../../../hooks/useCierreAutomatico';

// Lunes a domingo (0 = domingo, como Date.getDay y el Worker).
const DIAS = [
  { valor: 1, corto: 'Lun', largo: 'Lunes' },
  { valor: 2, corto: 'Mar', largo: 'Martes' },
  { valor: 3, corto: 'Mié', largo: 'Miércoles' },
  { valor: 4, corto: 'Jue', largo: 'Jueves' },
  { valor: 5, corto: 'Vie', largo: 'Viernes' },
  { valor: 6, corto: 'Sáb', largo: 'Sábado' },
  { valor: 0, corto: 'Dom', largo: 'Domingo' },
];
const TODOS_LOS_DIAS = DIAS.map(d => d.valor);
const HORA_POR_DEFECTO = '23:30';

const horaValida = (hora) => /^([01]\d|2[0-3]):[0-5]\d$/.test(hora || '');

function formatoHora12(hora) {
  if (!horaValida(hora)) return hora;
  const [h, m] = hora.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

function resumenDias(dias) {
  if (dias.length === 7) return 'todos los días';
  return DIAS.filter(d => dias.includes(d.valor)).map(d => d.corto).join(', ');
}

export default function CierreAutomaticoConfig({ isAdmin, usuario }) {
  const { config, loading, guardar } = useCierreAutomatico();
  // draft: lo que el admin está editando; null = sin cambios sin guardar.
  const [draft, setDraft] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const guardado = {
    activo: config?.activo === true,
    hora: horaValida(config?.hora) ? config.hora : HORA_POR_DEFECTO,
    dias: Array.isArray(config?.dias) ? config.dias : TODOS_LOS_DIAS,
  };
  const valores = draft ?? guardado;
  const cambio = (parcial) => { setMensaje(null); setDraft({ ...valores, ...parcial }); };
  const toggleDia = (dia) => cambio({ dias: valores.dias.includes(dia) ? valores.dias.filter(d => d !== dia) : [...valores.dias, dia] });

  const error = valores.activo && valores.dias.length === 0 ? 'Elige al menos un día.'
    : valores.activo && !horaValida(valores.hora) ? 'Elige una hora válida.'
    : '';

  const onGuardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      await guardar({ ...valores, dias: DIAS.filter(d => valores.dias.includes(d.valor)).map(d => d.valor) }, usuario);
      setDraft(null);
      setMensaje({ tipo: 'ok', texto: valores.activo ? 'Guardado. El cierre automático quedó activo.' : 'Guardado. El cierre automático quedó desactivado.' });
    } catch (err) {
      console.error('No se pudo guardar el cierre automático:', err);
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar. Intenta de nuevo.' });
    } finally {
      setGuardando(false);
    }
  };

  const ultima = config?.ultimaEjecucionEn
    ? `${new Date(config.ultimaEjecucionEn).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })} · ${config.ultimoResultado || ''}`
    : config?.ultimoResultado || null;

  return (
    <div className="mb-8 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" /> Cierre automático
            {!loading && (
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${guardado.activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                {guardado.activo ? 'Activo' : 'Desactivado'}
              </span>
            )}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {guardado.activo
              ? <>Se ejecuta <strong>{resumenDias(guardado.dias)}</strong> a las <strong>{formatoHora12(guardado.hora)}</strong> (hora de Venezuela).</>
              : 'Ejecuta el cierre solo, a la hora y los días que elijas.'}
            {' '}Hace lo mismo que el botón y avisa por notificación a los administradores y usuarios con permiso de cierre.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            role="switch"
            aria-checked={valores.activo}
            aria-label="Cierre automático"
            disabled={loading}
            onClick={() => cambio({ activo: !valores.activo })}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${valores.activo ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${valores.activo ? 'translate-x-5' : ''}`} />
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label htmlFor="cierre-hora" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Hora</label>
            <input
              id="cierre-hora"
              type="time"
              value={valores.hora}
              onChange={(e) => cambio({ hora: e.target.value })}
              className="w-full sm:w-36 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-red-600 [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <div role="group" aria-label="Días de la semana" className="flex flex-wrap gap-1.5">
            {DIAS.map(d => {
              const activo = valores.dias.includes(d.valor);
              return (
                <button
                  key={d.valor}
                  type="button"
                  aria-pressed={activo}
                  aria-label={d.largo}
                  onClick={() => toggleDia(d.valor)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${activo ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'}`}
                >
                  {d.corto}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onGuardar}
              disabled={!draft || !!error || guardando}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {draft && <button type="button" onClick={() => { setDraft(null); setMensaje(null); }} className="text-xs font-bold text-zinc-500 hover:underline">Descartar</button>}
            {error && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
            {mensaje && <p role="status" className={`text-xs font-bold ${mensaje.tipo === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{mensaje.texto}</p>}
          </div>
          <p className="text-[11px] text-zinc-400">Si lo activas después de la hora de hoy, el primer cierre es el próximo día elegido.</p>
        </div>
      )}

      {ultima && (
        <p className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-bold">Último cierre automático:</span> {ultima}
        </p>
      )}
    </div>
  );
}
