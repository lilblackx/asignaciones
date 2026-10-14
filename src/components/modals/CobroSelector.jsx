import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { COBRO_EXONERADO, COBRO_OTRO, COBRO_VISITA, ETIQUETA_COBRO } from '../../utils/cobro';

// Qué cobro se le informa al técnico al finalizar la orden: "Visita técnica" (el monto de
// siempre), "Otro monto" (escrito a mano; es el que verá el técnico en su aviso final) o
// "Exonerar" (no se cobra; el aviso le dice que no cobre nada).
// `idBase` evita ids repetidos si hay dos selectores en pantalla.
export default function CobroSelector({ idBase = 'cobro', montoVisita, seleccion, onChange, error }) {
  const inputRef = useRef(null);
  const esOtro = seleccion.modo === COBRO_OTRO;

  // Al elegir "Otro monto" el cursor pasa al campo del monto.
  useEffect(() => {
    if (esOtro) inputRef.current?.focus();
  }, [esOtro]);

  const opcion = (modo, titulo, detalle) => {
    const activa = seleccion.modo === modo;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={activa}
        onClick={() => onChange({ ...seleccion, modo })}
        className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
          activa ? 'border-sky-500 bg-white dark:bg-sky-950/40' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:border-sky-400'
        }`}
      >
        <span className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center ${activa ? 'bg-sky-600 border-sky-600 text-white' : 'border-zinc-400 dark:border-zinc-600'}`} aria-hidden="true">
          {activa && <Check className="w-3.5 h-3.5" />}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-black text-zinc-900 dark:text-white">{titulo}</span>
          {detalle && <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{detalle}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-2 text-left">
      <p id={`${idBase}-titulo`} className="text-xs font-black text-sky-900 dark:text-sky-200">COBRO QUE VERÁ EL TÉCNICO</p>
      <div role="radiogroup" aria-labelledby={`${idBase}-titulo`} className="space-y-2">
        {opcion(COBRO_VISITA, ETIQUETA_COBRO[COBRO_VISITA], montoVisita ? `${montoVisita} Bs (monto de siempre, con la tasa de hoy)` : 'La tasa no está configurada: el técnico no verá monto.')}
        {opcion(COBRO_OTRO, ETIQUETA_COBRO[COBRO_OTRO], 'Escribe el monto que se debe cobrar')}
        {opcion(COBRO_EXONERADO, ETIQUETA_COBRO[COBRO_EXONERADO], 'No se cobra esta visita al cliente')}
      </div>
      {esOtro && (
        <div className="space-y-1">
          <label htmlFor={`${idBase}-otro`} className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 ml-1">MONTO A COBRAR (Bs)</label>
          <input
            id={`${idBase}-otro`}
            ref={inputRef}
            type="text"
            inputMode="decimal"
            maxLength={12}
            placeholder="Ej. 5000"
            value={seleccion.otro}
            onChange={(e) => onChange({ ...seleccion, otro: e.target.value.replace(/[^\d,]/g, '') })}
            aria-invalid={!!error}
            aria-describedby={error ? `${idBase}-error` : undefined}
            className={`w-full bg-white dark:bg-zinc-950 border-2 px-3 py-2.5 rounded-xl outline-none text-sm font-bold text-zinc-900 dark:text-white shadow-sm focus:ring-0 ${error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-sky-500'}`}
          />
          {error && <p id={`${idBase}-error`} role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{error}</p>}
        </div>
      )}
    </div>
  );
}
