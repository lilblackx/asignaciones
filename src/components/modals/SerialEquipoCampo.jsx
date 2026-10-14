import { MAX_LARGO_SERIAL } from '../../utils/instalacion';

// Serial del equipo nuevo en una visita de "Cambio de equipo" (obligatorio). Mismo formato que el
// serial de la ONU de una instalación: letras y números, en mayúsculas.
export default function SerialEquipoCampo({ serial, onSerial, error }) {
  return (
    <div className="space-y-1 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
      <label htmlFor="pf-serial-equipo" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
        SERIAL DEL EQUIPO NUEVO <span className="font-normal text-red-500">(obligatorio)</span>
      </label>
      <input
        id="pf-serial-equipo"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={MAX_LARGO_SERIAL}
        placeholder="Ej. HWTC1A2B3C4D"
        value={serial}
        onChange={(e) => onSerial(e.target.value.replace(/[^0-9a-zA-Z-]/g, '').toUpperCase())}
        aria-invalid={!!error}
        aria-describedby={error ? 'pf-serial-equipo-error' : undefined}
        className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-amber-500'}`}
      />
      {error && <p id="pf-serial-equipo-error" role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{error}</p>}
    </div>
  );
}
