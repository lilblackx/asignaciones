import { Check } from 'lucide-react';
import { COLORES_CONECTOR_EXTERNO, COLORES_CONECTOR_INTERNO, ETIQUETA_COLOR, MAX_CONECTORES_POR_COLOR } from '../../utils/tipoVisita';

const ESTILO_COLOR = {
  VERDE: { punto: 'bg-emerald-500', activo: 'bg-emerald-700 border-emerald-700 text-white' },
  AZUL: { punto: 'bg-blue-500', activo: 'bg-blue-600 border-blue-600 text-white' },
};

// Un conector con sus colores posibles. Tocar el color lo marca; volver a tocarlo lo quita
// (los conectores son opcionales). El color se lee también en el texto, no solo en el punto.
function GrupoConector({ id, etiqueta, ayuda, colores, valor, onChange }) {
  return (
    <div role="group" aria-labelledby={`${id}-etiqueta`} className="space-y-1.5">
      <p id={`${id}-etiqueta`} className="text-[11px] max-lg:text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
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
                activo ? ESTILO_COLOR[color].activo : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-amber-500'
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
        <p className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 ml-1">Toca un color para marcarlo; vuelve a tocarlo para quitarlo.</p>
      </div>
      <GrupoConector id="pf-conector-externo" etiqueta="Conector externo" ayuda="(solo verde)" colores={COLORES_CONECTOR_EXTERNO} valor={colorExterno} onChange={onExterno} />
      <GrupoConector id="pf-conector-interno" etiqueta="Conector interno" ayuda="(verde o azul)" colores={COLORES_CONECTOR_INTERNO} valor={colorInterno} onChange={onInterno} />
    </div>
  );
}

// Cantidad de conectores usados en una visita de conector. El externo es siempre verde (un solo campo, de
// verdes); el interno, verdes y azules (dos campos; pueden quedar en 0 pero al menos 1 en total). Cada campo tiene
// botones - y + grandes para el celular y también se puede escribir.
function CampoCantidad({ id, etiqueta, color, valor, onChange, error }) {
  const n = /^\d{1,2}$/.test(String(valor).trim()) ? parseInt(valor, 10) : 0;
  const poner = (x) => onChange(String(Math.min(MAX_CONECTORES_POR_COLOR, Math.max(0, x))));
  const boton = 'w-11 h-11 shrink-0 rounded-xl border-2 border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 text-lg font-black hover:border-amber-500 disabled:opacity-40 disabled:hover:border-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';
  return (
    <div className="flex-1 min-w-[9.5rem] flex flex-col justify-between gap-1.5">
      <label htmlFor={id} className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
        <span className={`w-3.5 h-3.5 rounded-full ${ESTILO_COLOR[color].punto}`} aria-hidden="true" /> {etiqueta}
      </label>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={`Quitar un conector ${etiqueta.toLowerCase()}`} disabled={n <= 0} onClick={() => poner(n - 1)} className={boton}>−</button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          maxLength="2"
          placeholder="0"
          value={valor}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          className={`w-full min-w-0 text-center bg-white dark:bg-zinc-950 border-2 ${error ? 'border-red-500' : 'border-zinc-400 dark:border-zinc-700'} px-2 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-base font-black text-zinc-900 dark:text-white`}
        />
        <button type="button" aria-label={`Agregar un conector ${etiqueta.toLowerCase()}`} disabled={n >= MAX_CONECTORES_POR_COLOR} onClick={() => poner(n + 1)} className={boton}>+</button>
      </div>
    </div>
  );
}

// Cantidad de conectores usados en una instalación (obligatorio: al menos 1 en total). Igual que en las visitas, pero
// con los dos tipos a la vez: el externo es solo verde (un campo) y el interno, verde o azul (dos campos).
export function CantidadesConectorInstalacion({ externoVerde, internoVerde, internoAzul, onExternoVerde, onInternoVerde, onInternoAzul, error }) {
  const mensaje = error?.mensaje || '';
  return (
    <div className="space-y-3">
      <div>
        <p id="pf-cantidad-conectores-inst-etiqueta" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
          CONECTORES USADOS <span className="font-normal text-red-500">(obligatorio: al menos 1 en total)</span>
        </p>
        <p className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 ml-1">Escribe cuántos usaste de cada tipo y color; deja en 0 el que no usaste.</p>
      </div>
      <div role="group" aria-labelledby="pf-cantidad-conectores-inst-etiqueta" className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-[11px] max-lg:text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">Conector externo <span className="font-normal text-zinc-400">(solo verde)</span></p>
          <div className="flex flex-wrap gap-3">
            <CampoCantidad id="pf-cant-ext-verde" etiqueta="Verdes" color="VERDE" valor={externoVerde} onChange={onExternoVerde} error={error?.campo === 'externoVerde' ? mensaje : ''} />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] max-lg:text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">Conector interno <span className="font-normal text-zinc-400">(verde o azul)</span></p>
          <div className="flex flex-wrap gap-3">
            <CampoCantidad id="pf-cant-int-verde" etiqueta="Verdes" color="VERDE" valor={internoVerde} onChange={onInternoVerde} error={error?.campo === 'internoVerde' ? mensaje : ''} />
            <CampoCantidad id="pf-cant-int-azul" etiqueta="Azules" color="AZUL" valor={internoAzul} onChange={onInternoAzul} error={error?.campo === 'internoAzul' ? mensaje : ''} />
          </div>
        </div>
      </div>
      {mensaje && <p role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{mensaje}</p>}
    </div>
  );
}

export function CantidadesConectorVisita({ interno, verde, azul, onVerde, onAzul, error }) {
  const mensaje = error?.mensaje || '';
  return (
    <div className="space-y-1.5">
      <p id="pf-cantidad-conectores-etiqueta" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
        CONECTORES USADOS{' '}
        <span className="font-normal text-red-500">{interno ? '(obligatorio: al menos 1 en total)' : '(obligatorio)'}</span>
      </p>
      <p className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 ml-1">{interno ? 'Escribe cuántos usaste de cada color; deja en 0 el que no usaste.' : 'El conector externo es solo verde: escribe cuántos usaste. Si también cambiaste un conector interno azul, escribe cuántos; si no, déjalo en 0.'}</p>
      <div role="group" aria-labelledby="pf-cantidad-conectores-etiqueta" className="flex flex-wrap gap-3">
        <CampoCantidad id="pf-cant-verde" etiqueta={interno ? 'Verdes' : 'Externos verdes'} color="VERDE" valor={verde} onChange={onVerde} error={error?.campo === 'verde' ? mensaje : ''} />
        <CampoCantidad id="pf-cant-azul" etiqueta={interno ? 'Azules' : 'Internos azules (opcional)'} color="AZUL" valor={azul} onChange={onAzul} error={error?.campo === 'azul' ? mensaje : ''} />
      </div>
      {mensaje && <p role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{mensaje}</p>}
    </div>
  );
}
