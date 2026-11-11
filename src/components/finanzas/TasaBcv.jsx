import { CircleDollarSign, RefreshCw, TriangleAlert } from 'lucide-react';
import SelectMenu from '../SelectMenu';
import { fechaHoraLegible } from '../../utils/formatoFecha';
import { etiquetaDiaLarga, opcionElegida } from '../../utils/tasasDolar';
import { claseSelector } from '../estilos';

// La tasa BCV del dólar con que se muestran los bolívares y se paga. Con el historial de los últimos 7 días (`opciones`, ver utils/tasasDolar.js) se elige con cuál: por defecto la más reciente, pero se
// puede pagar con la de un día anterior (los pagos son semanales y a veces se pagan el martes con la tasa del lunes); si no es la más reciente, lo dice. Sin historial muestra la tasa de ahora y cuándo la
// actualizó el BCV. Sin conexión a la API avisa, y si ya tenía una tasa la conserva.
const NUMERO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export default function TasaBcv({ tasa, fecha, cargando, error, onActualizar, opciones = [], dia = null, onElegir }) {
  const elegida = opcionElegida(opciones, dia);
  const masReciente = opciones[0] || null;
  const viejo = elegida && masReciente && elegida.dia !== masReciente.dia;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        {elegida ? (
          <>
            <span className="inline-flex items-center gap-2 font-bold text-zinc-800 dark:text-zinc-100">
              <CircleDollarSign className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
              <label htmlFor="finanzas-tasa-dia">Tasa BCV para los pagos</label>
            </span>
            <div className="w-full sm:w-auto sm:min-w-[17rem]">
              <SelectMenu id="finanzas-tasa-dia" ariaLabel="Tasa BCV para los pagos" className={`${claseSelector('normal')} aria-expanded:border-red-600 tabular-nums`} value={elegida.dia} onChange={onElegir} items={opciones.map((o) => ({ value: o.dia, label: o.texto }))} />
            </div>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 font-bold text-zinc-800 dark:text-zinc-100">
              <CircleDollarSign className="w-5 h-5 text-red-600" aria-hidden="true" />
              {tasa ? (
                <>Tasa BCV: <span className="tabular-nums text-sm font-bold text-zinc-900 dark:text-white">{tasa.toLocaleString('es-VE', NUMERO)}</span> Bs por dólar</>
              ) : cargando ? 'Consultando la tasa BCV...' : 'Sin tasa BCV'}
            </span>
            {tasa && fecha && <span className="text-zinc-600 dark:text-zinc-300">actualizada {fechaHoraLegible(fecha)}</span>}
          </>
        )}
        {error && <span role="alert" className="font-bold text-amber-800 dark:text-amber-300">{tasa ? 'No se pudo actualizar la tasa.' : 'No se pudo consultar la tasa: los bolívares no se muestran.'}</span>}
        <button type="button" onClick={onActualizar} disabled={cargando} aria-label="Actualizar la tasa BCV" title="Actualizar la tasa BCV" className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60 transition-colors">
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>
      {viejo && (
        <p role="status" className="flex items-start gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
          <TriangleAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Estás usando la tasa del {etiquetaDiaLarga(elegida.dia)} ({elegida.tasa.toLocaleString('es-VE', NUMERO)} Bs), no la más reciente ({masReciente.tasa.toLocaleString('es-VE', NUMERO)} Bs del {etiquetaDiaLarga(masReciente.dia)}). Los bolívares y los pagos nuevos salen con esa tasa.</span>
        </p>
      )}
    </div>
  );
}
