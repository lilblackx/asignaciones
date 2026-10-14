import { stripEmojis } from '../../utils/sanitizeInput';

// NAP y puerto en dos campos (la orden los guarda juntos en `nap`, ver utils/napPuerto). Los usan
// la visita de conector externo y la instalación, para que se vean y se llenen igual.
export default function NapPuertoCampos({ nap, onNap, napError, puerto, onPuerto, puertoError }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2.5 items-start">
        <div className="space-y-1 flex-1 min-w-0">
          <label htmlFor="pf-nap" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
            NOMENCLATURA DE LA NAP <span className="font-normal text-red-500">(obligatorio)</span>
          </label>
          <input
            id="pf-nap"
            type="text"
            maxLength="40"
            placeholder="Ej. NAP 08"
            value={nap}
            onChange={(e) => onNap(stripEmojis(e.target.value))}
            aria-invalid={!!napError}
            className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${napError ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-amber-500'}`}
          />
          {napError && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{napError}</p>}
        </div>
        <div className="space-y-1 w-24 shrink-0">
          <label htmlFor="pf-puerto" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
            PUERTO <span className="font-normal text-red-500">(obligatorio)</span>
          </label>
          <input
            id="pf-puerto"
            type="text"
            inputMode="numeric"
            maxLength="3"
            placeholder="Ej. 3"
            value={puerto}
            onChange={(e) => onPuerto(e.target.value.replace(/\D/g, ''))}
            aria-invalid={!!puertoError}
            className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${puertoError ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-amber-500'}`}
          />
          {puertoError && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{puertoError}</p>}
        </div>
      </div>
    </div>
  );
}
