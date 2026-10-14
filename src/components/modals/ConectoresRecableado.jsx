import { Check } from 'lucide-react';
import { COLORES_CONECTOR_EXTERNO, COLORES_CONECTOR_INTERNO, ETIQUETA_COLOR } from '../../utils/tipoVisita';

const ESTILO_COLOR = {
  VERDE: { punto: 'bg-emerald-500', activo: 'bg-emerald-600 border-emerald-600 text-white' },
  AZUL: { punto: 'bg-blue-500', activo: 'bg-blue-600 border-blue-600 text-white' },
};

// Un conector con sus colores posibles. Tocar el color lo marca; volver a tocarlo lo quita
// (los conectores son opcionales). El color se lee también en el texto, no solo en el punto.
function GrupoConector({ id, etiqueta, ayuda, colores, valor, onChange }) {
  return (
    <div role="group" aria-labelledby={`${id}-etiqueta`} className="space-y-1.5">
      <p id={`${id}-etiqueta`} className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 ml-1">
        {etiqueta} <span className="font-normal text-zinc-400">{ayuda}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {colores.map((color) => {
          const activo = valor === color;
          return (
            <button
              key={color}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange(activo ? '' : color)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                activo ? ESTILO_COLOR[color].activo : 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-amber-500'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full ${ESTILO_COLOR[color].punto} ${activo ? 'ring-2 ring-white' : ''}`} aria-hidden="true" />
              {ETIQUETA_COLOR[color]}
              {activo && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Conectores colocados en un recableado (ambos opcionales y se pueden registrar los dos):
// el externo solo existe en verde; el interno, en verde o azul.
export default function ConectoresRecableado({ colorExterno, colorInterno, onExterno, onInterno }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
          CONECTORES <span className="font-normal text-zinc-400">(opcional)</span>
        </p>
        <p className="text-[10px] text-zinc-400 ml-1">Toca un color para marcarlo; vuelve a tocarlo para quitarlo.</p>
      </div>
      <GrupoConector id="pf-conector-externo" etiqueta="Conector externo" ayuda="(solo verde)" colores={COLORES_CONECTOR_EXTERNO} valor={colorExterno} onChange={onExterno} />
      <GrupoConector id="pf-conector-interno" etiqueta="Conector interno" ayuda="(verde o azul)" colores={COLORES_CONECTOR_INTERNO} valor={colorInterno} onChange={onInterno} />
    </div>
  );
}

// Color del conector de una visita de conector (externo o interno): el técnico elige uno, con el
// nombre "Conector verde" / "Conector azul". Si solo hay un color posible (el externo es siempre
// verde) ya viene marcado y no hay nada que elegir.
export function ColorConectorVisita({ colores, valor, onChange, error }) {
  const unico = colores.length === 1;
  const seleccionado = unico ? colores[0] : valor;
  return (
    <div className="space-y-1.5">
      <p id="pf-color-conector-etiqueta" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
        TIPO DE CONECTOR{' '}
        {unico
          ? <span className="font-normal text-zinc-400">(el externo es solo verde)</span>
          : <span className="font-normal text-red-500">(obligatorio)</span>}
      </p>
      <div id="pf-color-conector" role="radiogroup" aria-labelledby="pf-color-conector-etiqueta" aria-invalid={!!error} tabIndex={-1} className="flex flex-wrap gap-2 focus:outline-none">
        {colores.map((color) => {
          const activo = seleccionado === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={activo}
              disabled={unico}
              onClick={() => onChange(color)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-colors disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                activo ? ESTILO_COLOR[color].activo : `bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:border-amber-500 ${error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full ${ESTILO_COLOR[color].punto} ${activo ? 'ring-2 ring-white' : ''}`} aria-hidden="true" />
              Conector {ETIQUETA_COLOR[color].toLowerCase()}
              {activo && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{error}</p>}
    </div>
  );
}
