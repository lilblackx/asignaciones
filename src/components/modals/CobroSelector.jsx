import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { COBRO_EXONERADO, COBRO_OTRO, COBRO_VISITA, ETIQUETA_COBRO, MONEDA_BS, MONEDA_USD } from '../../utils/cobro';

// Qué cobro se le informa al técnico al finalizar la orden: "Visita técnica" (el monto de
// siempre), "Otro monto" (escrito a mano; es el que verá el técnico en su aviso final) o
// "Exonerar" (no se cobra; el aviso le dice que no cobre nada).
// `idBase` evita ids repetidos si hay dos selectores en pantalla. `modos` limita las opciones que se ofrecen
// (la consulta de cobro de un recableado no lleva "Visita técnica").
export default function CobroSelector({ idBase = 'cobro', montoVisita, seleccion, onChange, error, modos = [COBRO_VISITA, COBRO_OTRO, COBRO_EXONERADO], tituloOtro = ETIQUETA_COBRO[COBRO_OTRO] }) {
  const inputRef = useRef(null);
  const esOtro = seleccion.modo === COBRO_OTRO;
  const moneda = seleccion.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS;

  // Al elegir "Otro monto" el cursor pasa al campo del monto; si el monto escrito no es válido, vuelve ahí.
  // Si el selector ya se abre con "Otro monto" (cobro respondido de antemano), no se lleva el cursor: taparía el aviso de arriba.
  const modoAlAbrir = useRef(seleccion.modo);
  useEffect(() => {
    if (!esOtro) modoAlAbrir.current = null;
    if (esOtro && modoAlAbrir.current !== COBRO_OTRO) inputRef.current?.focus();
  }, [esOtro]);
  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

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
        {modos.includes(COBRO_VISITA) && opcion(COBRO_VISITA, ETIQUETA_COBRO[COBRO_VISITA], montoVisita ? `${montoVisita} Bs (monto de siempre, con la tasa de hoy; siempre en Bs)` : 'La tasa no está configurada: el técnico no verá monto.')}
        {modos.includes(COBRO_OTRO) && opcion(COBRO_OTRO, tituloOtro, 'Escribe el monto que se debe cobrar, en Bs o en $')}
        {modos.includes(COBRO_EXONERADO) && opcion(COBRO_EXONERADO, ETIQUETA_COBRO[COBRO_EXONERADO], 'No se cobra esta visita al cliente')}
      </div>
      {esOtro && (
        <div className="space-y-1">
          <div role="radiogroup" aria-label="Moneda del cobro" className="grid grid-cols-2 gap-2">
            {[[MONEDA_BS, 'Bs (bolívares)'], [MONEDA_USD, '$ (dólares)']].map(([valor, texto]) => {
              const activa = moneda === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  onClick={() => onChange({ ...seleccion, moneda: valor })}
                  className={`px-3 py-2 rounded-xl border-2 text-xs font-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    activa ? 'border-sky-500 bg-sky-600 text-white' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-sky-400'
                  }`}
                >
                  {texto}
                </button>
              );
            })}
          </div>
          <label htmlFor={`${idBase}-otro`} className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 ml-1">MONTO A COBRAR ({moneda === MONEDA_USD ? '$' : 'Bs'})</label>
          <input
            id={`${idBase}-otro`}
            ref={inputRef}
            type="text"
            inputMode="decimal"
            maxLength={12}
            placeholder={moneda === MONEDA_USD ? 'Ej. 30' : 'Ej. 5000'}
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
