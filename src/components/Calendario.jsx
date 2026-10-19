import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DIAS_SEMANA, MESES, casillasDelMes, mover, partesISO } from '../utils/calendario';

const nombreDelDia = (iso) => { const p = partesISO(iso); return `${p.dia} de ${MESES[p.mes - 1].toLowerCase()} de ${p.anio}`; };

// Calendario de la app (el del navegador se ve distinto en cada equipo): un mes a la vez, con flechas para cambiar de mes. No deja
// elegir días después de `max` (hoy, "AAAA-MM-DD"). `valor`: la fecha elegida ("AAAA-MM-DD") o ''. `onElegir(iso)` al tocar un día.
export default function Calendario({ valor, max, onElegir, onCerrar }) {
  const hoy = max;
  const tope = max;
  const inicial = partesISO(valor) || partesISO(tope);
  const [vista, setVista] = useState({ anio: inicial.anio, mes: inicial.mes });
  const topeP = partesISO(tope);
  const haySiguiente = vista.anio * 12 + vista.mes < topeP.anio * 12 + topeP.mes;
  const ir = (pasos) => setVista((v) => mover(v.anio, v.mes, pasos));

  return (
    <div role="group" aria-label="Calendario" className="w-full max-w-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => ir(-1)} aria-label="Mes anterior" className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <p className="text-sm font-bold text-zinc-900 dark:text-white" aria-live="polite">{MESES[vista.mes - 1]} {vista.anio}</p>
        <button type="button" onClick={() => ir(1)} disabled={!haySiguiente} aria-label="Mes siguiente" className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DIAS_SEMANA.map((d, i) => <span key={i} className="py-1 text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400" aria-hidden="true">{d}</span>)}
        {casillasDelMes(vista.anio, vista.mes).map((iso, i) => {
          if (!iso) return <span key={`hueco-${i}`} />;
          const elegido = iso === valor;
          const bloqueado = iso > tope;
          return (
            <button
              key={iso}
              type="button"
              disabled={bloqueado}
              aria-pressed={elegido}
              aria-label={nombreDelDia(iso)}
              onClick={() => onElegir(iso)}
              className={`h-9 rounded-lg text-sm tabular-nums transition-colors ${elegido ? 'bg-red-600 text-white font-bold' : bloqueado ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed' : `font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${iso === hoy ? 'ring-1 ring-inset ring-red-500/70' : ''}`}`}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <button type="button" onClick={() => onElegir(hoy)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Hoy</button>
        <button type="button" onClick={onCerrar} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cerrar</button>
      </div>
    </div>
  );
}
