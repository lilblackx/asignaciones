import { useState } from 'react';
import Spinner from '../Spinner';
import { stripEmojis } from '../../utils/sanitizeInput';
import { CONCEPTOS_PAGO, aBs, bolivares, parseTarifa } from '../../utils/finanzas';

// Misma tarjeta que las de ventas y las de los técnicos: cabecera negra, etiquetas pequeñas y un pie con la acción.
const ETIQUETA = 'text-[10px] font-semibold uppercase tracking-wide text-zinc-500';
const CAMPO = 'w-full bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 pl-3 pr-8 py-2.5 rounded-xl text-sm text-zinc-900 dark:text-white focus:ring-0 focus:border-red-600 outline-none';
const enTexto = (valor) => String(valor).replace('.', ',');

function Formulario({ tarifas, tasa, ocupado, onGuardar }) {
  const [borrador, setBorrador] = useState(() => Object.fromEntries(CONCEPTOS_PAGO.map(({ id }) => [id, enTexto(tarifas[id])])));
  const [errores, setErrores] = useState({});
  const cambiado = CONCEPTOS_PAGO.some(({ id }) => borrador[id] !== enTexto(tarifas[id]));

  const guardar = () => {
    const valores = {};
    const nuevos = {};
    for (const { id } of CONCEPTOS_PAGO) {
      const r = parseTarifa(borrador[id]);
      if (r.error) nuevos[id] = r.error; else valores[id] = r.valor;
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length === 0) onGuardar(valores);
  };

  return (
    <section aria-label="Tabulador de precios" className="max-w-3xl rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="bg-black px-3 py-2 flex items-center gap-2">
        <span className="text-lg font-black text-white leading-none">Tabulador de precios</span>
        <span className="ml-auto shrink-0 text-[10px] font-black uppercase tracking-wide rounded px-2 py-1 leading-none bg-zinc-600 text-white">Dólares</span>
      </div>

      <div className="p-3 space-y-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Lo que se le paga al técnico por cada orden de ese tipo, en dólares, con su equivalente en bolívares a la tasa BCV de hoy. Un pago ya registrado conserva los precios y la tasa de ese momento.</p>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3">
          {CONCEPTOS_PAGO.map(({ id, nombre }) => (
            <div key={id} className="min-w-0">
              <label htmlFor={`tarifa-${id}`} className={ETIQUETA}>{nombre}</label>
              <div className="relative mt-1">
                <input
                  id={`tarifa-${id}`}
                  value={borrador[id]}
                  onChange={(e) => { setBorrador({ ...borrador, [id]: stripEmojis(e.target.value) }); setErrores({ ...errores, [id]: '' }); }}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={!!errores[id]}
                  className={CAMPO}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400 pointer-events-none">$</span>
              </div>
              {errores[id] ? <p role="alert" className="text-[11px] text-red-500 font-bold mt-1">{errores[id]}</p> : tasa > 0 && (
                <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">{bolivares(aBs(parseTarifa(borrador[id]).valor ?? 0, tasa))}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 min-h-12 flex items-center justify-between gap-2">
        <span className={ETIQUETA}>{cambiado ? 'Cambios sin guardar' : 'Precios al día'}</span>
        <button type="button" onClick={guardar} disabled={ocupado || !cambiado} className="inline-flex items-center gap-1.5 text-xs font-black rounded bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 transition-colors disabled:opacity-50">
          {ocupado && <Spinner />}Guardar precios
        </button>
      </div>
    </section>
  );
}

// La pestaña "Tabulador de precios": lo que se paga por cada tipo de orden. El formulario se vuelve a armar (key) cuando cambian los precios guardados.
export default function TabuladorPrecios({ tarifas, tasa = null, tarifasCargadas, ocupado, onGuardar }) {
  if (!tarifasCargadas) return <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-10">Cargando...</p>;
  return <Formulario key={JSON.stringify(tarifas)} tarifas={tarifas} tasa={tasa} ocupado={ocupado} onGuardar={onGuardar} />;
}
