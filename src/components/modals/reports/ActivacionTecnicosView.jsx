import { useMemo } from 'react';
import NombreTecnico from '../../NombreTecnico';
import { activacionPorTecnico, formatoDuracion, fraccionDelDia } from '../../../utils/logTecnico';
import { diaLegible } from '../../../utils/periodoReporte';
import { cifrasActivacion } from '../../../utils/modelosReporte';
import { useAhora } from '../../../hooks/useAhora';
import Cifras from './Cifras';

const HORAS_EJE = [0, 6, 12, 18, 24];
const hora = (ms) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));

// Una barra de 24 horas con los tramos en que el técnico estuvo activo ese día.
function BarraDia({ dia, tramos }) {
  return (
    <div className="relative h-3.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden" role="img" aria-label={`Activo: ${tramos.map(([i, f]) => `${hora(i)} a ${hora(f)}`).join(', ')}`}>
      {HORAS_EJE.slice(1, -1).map((h) => <span key={h} className="absolute inset-y-0 w-px bg-zinc-400/60 dark:bg-zinc-700" style={{ left: `${(h / 24) * 100}%` }} aria-hidden="true" />)}
      {tramos.map(([ini, fin]) => (
        <span
          key={ini}
          title={`${hora(ini)} – ${hora(fin)}`}
          className="absolute inset-y-0 bg-emerald-500 rounded-sm"
          style={{ left: `${fraccionDelDia(ini, dia) * 100}%`, width: `max(3px, ${(fraccionDelDia(fin, dia) - fraccionDelDia(ini, dia)) * 100}%)` }}
        />
      ))}
    </div>
  );
}

const FILA = 'grid grid-cols-[1fr_auto] sm:grid-cols-[6.5rem_1fr_6rem] items-center gap-x-3 gap-y-1';

function EjeHoras() {
  return (
    <div className={`${FILA} mb-1`} aria-hidden="true">
      <span className="hidden sm:block" />
      <div className="relative h-3 col-span-2 sm:col-span-1 text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400">
        {HORAS_EJE.map((h) => (
          <span key={h} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${(h / 24) * 100}%` }}>{h}h</span>
        ))}
      </div>
      <span className="hidden sm:block" />
    </div>
  );
}

export default function ActivacionTecnicosView({ eventos, cargando, error, truncado, rango, tecnico, getTecnicoColor }) {
  // Se refresca cada minuto para que la barra de quien sigue activo crezca sola.
  const ahora = useAhora();

  // El cálculo usa todos los movimientos (el estado de un técnico al empezar el rango sale de los anteriores); el filtro solo recorta lo que se muestra.
  const activacion = useMemo(() => activacionPorTecnico(eventos, rango, tecnico, ahora), [eventos, rango, tecnico, ahora]);
  const { tramos, duraciones, tecnicos, movimientos } = activacion;

  return (
    <div>
      {error && <p className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4">No se pudo cargar el registro. Intenta actualizar.</p>}
      {truncado && <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4">Solo se leyeron los últimos movimientos; los más antiguos no cuentan.</p>}

      <Cifras items={cifrasActivacion(activacion)} />

      {tecnicos.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-8 text-center text-xs text-zinc-600 dark:text-zinc-400 shadow-sm">
          {cargando ? 'Cargando...' : 'Sin actividad registrada en este periodo. Solo cuenta desde el primer movimiento registrado de cada técnico.'}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tecnicos.map(({ nombre, dias, total: totalTecnico }) => (
            <section key={nombre} aria-label={nombre} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              <header className="flex items-center justify-between gap-3 mb-3">
                <NombreTecnico nombre={nombre} getTecnicoColor={getTecnicoColor} />
                <span className="text-sm font-black text-zinc-800 dark:text-zinc-100">{formatoDuracion(totalTecnico)} <span className="text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400">en total</span></span>
              </header>
              <EjeHoras />
              <div className="flex flex-col gap-2.5">
                {dias.map((dia) => (
                  <div key={dia} className={FILA}>
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 sm:order-1">{diaLegible(dia)}</span>
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-100 text-right sm:order-3">{formatoDuracion(duraciones[nombre][dia])}</span>
                    <div className="col-span-2 sm:col-span-1 sm:order-2"><BarraDia dia={dia} tramos={tramos[nombre][dia]} /></div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <details className="group mt-4 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl shadow-sm">
        <summary className="cursor-pointer select-none list-none px-4 sm:px-5 py-3 text-sm font-bold text-zinc-900 dark:text-white flex items-center justify-between">
          Movimientos <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{movimientos.length} · ver detalle</span>
        </summary>
        <div className="px-4 sm:px-5 pb-4">
          {movimientos.length === 0 ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 text-center py-4">Sin movimientos en este periodo.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {movimientos.map((m, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs">
                  <span className={`text-[11px] max-lg:text-xs font-black px-1.5 py-0.5 rounded ${m.accion === 'ACTIVADO' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{m.accion}</span>
                  <span className="font-bold">{m.tecnico}</span>
                  <span className="text-zinc-600 dark:text-zinc-400">{m.fechaHora}</span>
                  {m.por && <span className="text-zinc-600 dark:text-zinc-400 ml-auto">por {m.por}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
