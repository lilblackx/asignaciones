import { MAX_LARGO_MARCA, totalMetraje } from '../../utils/metraje';
import { claseCampo } from '../estilos';

const claseEtiqueta = 'text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1';
const claseEtiquetaCompacta = 'text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400 ml-1';

// Metraje inicial y final del cable (las marcas de la bobina al empezar y al terminar): el técnico escribe las dos y la app calcula el
// total de metros (ver utils/metraje). Se usa en la instalación, el recableado y la edición de la oficina.
// `compacto`: tamaño de los formularios de la oficina; sin él, el del técnico.
export default function MetrajeInicialFinal({ idInicial, idFinal, inicial, final, onInicial, onFinal, errorInicial, errorFinal, deshabilitado = false, compacto = false, totalGuardado = null }) {
  const total = deshabilitado ? null : totalMetraje(inicial, final);
  const etiqueta = compacto ? claseEtiquetaCompacta : claseEtiqueta;
  const campo = (id, valor, onChange, error, nombre) => (
    <div className="space-y-1 min-w-0 flex-1">
      <label htmlFor={id} className={etiqueta}>
        {nombre} {!compacto && <span className="font-normal text-red-500">(obligatorio)</span>}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={MAX_LARGO_MARCA}
        placeholder={nombre === 'METRAJE INICIAL' ? 'Ej. 500' : 'Ej. 620'}
        value={deshabilitado ? '' : valor}
        disabled={deshabilitado}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, MAX_LARGO_MARCA))}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`min-w-0 ${claseCampo(compacto ? 'compacto' : 'grande', error ? 'error' : 'normal')} disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      {error && <p id={`${id}-error`} role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        {campo(idInicial, inicial, onInicial, errorInicial, 'METRAJE INICIAL')}
        {campo(idFinal, final, onFinal, errorFinal, 'METRAJE FINAL')}
      </div>
      {!deshabilitado && (
        <p role="status" className={`${compacto ? 'text-[11px] max-lg:text-xs' : 'text-xs'} ml-1 ${total != null ? 'font-black text-zinc-800 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}>
          {total != null
            ? `Total de cable usado: ${total} m`
            : totalGuardado
            ? `Total registrado: ${totalGuardado} m. Escribe el metraje inicial y final para reemplazarlo.`
            : 'Marca del cable al empezar y al terminar: el total de metros se calcula solo.'}
        </p>
      )}
    </div>
  );
}
