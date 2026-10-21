import { useState } from 'react';
import Spinner from '../Spinner';
import { BOTON_GRANDE, CAMPO, ETIQUETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { stripEmojis } from '../../utils/sanitizeInput';
import { CONCEPTOS_PAGO, aBs, bolivares, parseTarifa } from '../../utils/finanzas';

// El tabulador de precios en filas grandes, sin cajas: el concepto, su precio en dólares (el campo) y su equivalente en bolívares a la tasa BCV de hoy.
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
    <section aria-label="Tabulador de precios" className="max-w-4xl space-y-4">
      <div>
        <h2 className={TITULO_SECCION}>Tabulador de precios</h2>
        <p className={`${TEXTO_SUAVE} mt-1`}>Lo que se le paga al técnico por cada orden de ese tipo, en dólares, con su equivalente en bolívares a la tasa BCV de hoy. Un pago ya registrado conserva los precios y la tasa de ese momento.</p>
      </div>

      <ul className="border-y-2 border-zinc-300 dark:border-zinc-700 divide-y-2 divide-zinc-200 dark:divide-zinc-800">
        {CONCEPTOS_PAGO.map(({ id, nombre }) => (
          <li key={id} className="py-2.5 grid grid-cols-1 sm:grid-cols-[1fr_11rem_14rem] items-center gap-x-4 gap-y-1">
            <label htmlFor={`tarifa-${id}`} className="text-base font-bold text-zinc-900 dark:text-white">{nombre}</label>
            <div className="relative">
              <input
                id={`tarifa-${id}`}
                value={borrador[id]}
                onChange={(e) => { setBorrador({ ...borrador, [id]: stripEmojis(e.target.value) }); setErrores({ ...errores, [id]: '' }); }}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={!!errores[id]}
                className={`${CAMPO} pr-9 text-base font-bold text-right tabular-nums`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold text-zinc-500 dark:text-zinc-300 pointer-events-none">$</span>
            </div>
            <p className={`${TEXTO_SUAVE} sm:text-right tabular-nums`}>
              {errores[id] ? <span role="alert" className="text-red-600 dark:text-red-400 font-bold">{errores[id]}</span> : tasa > 0 && <span className="text-base font-semibold">{bolivares(aBs(parseTarifa(borrador[id]).valor ?? 0, tasa))}</span>}
            </p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={guardar} disabled={ocupado || !cambiado} className={`${BOTON_GRANDE} bg-red-600 hover:bg-red-700 text-white`}>
          {ocupado && <Spinner />}Guardar precios
        </button>
        <span className={`${ETIQUETA} text-base`}>{cambiado ? 'Hay cambios sin guardar' : 'Precios al día'}</span>
      </div>
    </section>
  );
}

// La pestaña "Tabulador de precios": lo que se paga por cada tipo de orden. El formulario se vuelve a armar (key) cuando cambian los precios guardados.
export default function TabuladorPrecios({ tarifas, tasa = null, tarifasCargadas, ocupado, onGuardar }) {
  if (!tarifasCargadas) return <p role="status" className="text-lg text-zinc-600 dark:text-zinc-300 text-center py-10">Cargando...</p>;
  return <Formulario key={JSON.stringify(tarifas)} tarifas={tarifas} tasa={tasa} ocupado={ocupado} onGuardar={onGuardar} />;
}
