import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DIAS_SEMANA, MESES, casillasDelMes, fechaISO, mover, partesISO } from '../utils/calendario';

const nombreDelDia = (iso) => { const p = partesISO(iso); return `${p.dia} de ${MESES[p.mes - 1].toLowerCase()} de ${p.anio}`; };

// Calendario de la app (el del navegador se ve distinto en cada equipo): un mes a la vez, con flechas para cambiar de mes. No deja
// elegir días después de `max` ni antes de `min` ("AAAA-MM-DD"; sin ellos no hay límite). `valor`: la fecha elegida ("AAAA-MM-DD") o ''. `onElegir(iso)` al tocar un día.
// `hoy`: el día de hoy para el botón "Hoy" (por defecto el del equipo). `onBorrar`: con él aparece "Borrar" (para una fecha opcional). `grande`: letra y casillas más grandes
// (Finanzas, para leerlo sin esfuerzo).
export default function Calendario({ valor, min, max, hoy: hoyElegido, onElegir, onBorrar, onCerrar, grande = false }) {
  const [hoyDelEquipo] = useState(() => fechaISO(Date.now()));
  const hoy = hoyElegido || max || hoyDelEquipo;
  const tope = max || '';
  const piso = min || '';
  const inicial = partesISO(valor) || partesISO(hoy);
  const [vista, setVista] = useState({ anio: inicial.anio, mes: inicial.mes });
  const topeP = partesISO(tope);
  const pisoP = partesISO(piso);
  const haySiguiente = !topeP || vista.anio * 12 + vista.mes < topeP.anio * 12 + topeP.mes;
  const hayAnterior = !pisoP || vista.anio * 12 + vista.mes > pisoP.anio * 12 + pisoP.mes;
  const ir = (pasos) => setVista((v) => mover(v.anio, v.mes, pasos));

  return (
    <div role="group" aria-label="Calendario" className={`w-full ${grande ? 'max-w-sm p-4' : 'max-w-xs p-3'} bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => ir(-1)} disabled={!hayAnterior} aria-label="Mes anterior" className={`${grande ? 'p-2.5' : 'p-1.5'} rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed`}>
          <ChevronLeft className={grande ? 'w-6 h-6' : 'w-4 h-4'} aria-hidden="true" />
        </button>
        <p className={`${grande ? 'text-xl' : 'text-sm'} font-bold text-zinc-900 dark:text-white`} aria-live="polite">{MESES[vista.mes - 1]} {vista.anio}</p>
        <button type="button" onClick={() => ir(1)} disabled={!haySiguiente} aria-label="Mes siguiente" className={`${grande ? 'p-2.5' : 'p-1.5'} rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed`}>
          <ChevronRight className={grande ? 'w-6 h-6' : 'w-4 h-4'} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DIAS_SEMANA.map((d, i) => <span key={i} className={`py-1 ${grande ? 'text-base text-zinc-700 dark:text-zinc-200' : 'text-[10px] text-zinc-500 dark:text-zinc-400'} font-bold uppercase`} aria-hidden="true">{d}</span>)}
        {casillasDelMes(vista.anio, vista.mes).map((iso, i) => {
          if (!iso) return <span key={`hueco-${i}`} />;
          const elegido = iso === valor;
          const bloqueado = (Boolean(tope) && iso > tope) || (Boolean(piso) && iso < piso);
          return (
            <button
              key={iso}
              type="button"
              disabled={bloqueado}
              aria-pressed={elegido}
              aria-label={nombreDelDia(iso)}
              onClick={() => onElegir(iso)}
              className={`${grande ? 'h-11 text-base' : 'h-9 text-sm'} rounded-lg tabular-nums transition-colors ${elegido ? 'bg-red-600 text-white font-bold' : bloqueado ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed' : `font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${iso === hoy ? 'ring-1 ring-inset ring-red-500/70' : ''}`}`}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <button type="button" onClick={() => onElegir(hoy)} className={`${grande ? 'px-4 py-2.5 text-base' : 'px-2.5 py-1.5 text-xs'} rounded-lg font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors`}>Hoy</button>
        {onBorrar && <button type="button" onClick={onBorrar} className={`${grande ? 'px-4 py-2.5 text-base' : 'px-2.5 py-1.5 text-xs'} rounded-lg font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`}>Borrar</button>}
        <button type="button" onClick={onCerrar} className={`${grande ? 'px-4 py-2.5 text-base' : 'px-2.5 py-1.5 text-xs'} rounded-lg font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`}>Cerrar</button>
      </div>
    </div>
  );
}
