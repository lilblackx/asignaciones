import { useState } from 'react';
import { AlertTriangle, Coins, RefreshCw, X } from 'lucide-react';
import Modal from '../Modal';
import { diasDesactualizada } from '../../utils/tasa';

// Convierte una tasa/monto (número) a los dígitos que representarían sus centavos,
// para poder editarlos como una calculadora: cada dígito que se escribe entra por la derecha.
function toDigits(value) {
  return Math.round((Number(value) || 0) * 100).toString();
}

// Toma cualquier texto (lo que quedó en el input tras la edición) y se queda solo
// con los dígitos, para recalcular el valor formateado desde cero en cada tecla.
function digitsFromInput(rawInput) {
  return rawInput.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

function digitsToDisplay(digits) {
  const num = digits === '' ? 0 : parseInt(digits, 10);
  return (num / 100).toFixed(2);
}

function digitsToNumber(digits) {
  const num = digits === '' ? 0 : parseInt(digits, 10);
  return num / 100;
}

const NUMBER_INPUT_CLASS = 'w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white px-3 py-2 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-sm shadow-sm text-right font-mono';

export default function TasaBcvModal({ tasaConfig, onActualizarAutomatica, onActualizarManual, onClose }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tasaDigits, setTasaDigits] = useState(toDigits(tasaConfig?.tasa));
  const [montoDigits, setMontoDigits] = useState(toDigits(tasaConfig?.montoBaseEUR));

  // Resincroniza el buffer editable cuando tasaConfig cambia por fuera (refresh
  // automático, guardado, o snapshot en vivo de Firestore). Se ajusta durante el
  // render (no en un efecto) para evitar el repintado extra de un setState en efecto.
  const [prevTasaConfig, setPrevTasaConfig] = useState(tasaConfig);
  if (tasaConfig?.tasa !== prevTasaConfig?.tasa || tasaConfig?.montoBaseEUR !== prevTasaConfig?.montoBaseEUR) {
    setPrevTasaConfig(tasaConfig);
    setTasaDigits(toDigits(tasaConfig?.tasa));
    setMontoDigits(toDigits(tasaConfig?.montoBaseEUR));
  }

  const montoBsActual = tasaConfig?.montoBaseEUR && tasaConfig?.tasa
    ? (tasaConfig.montoBaseEUR * tasaConfig.tasa).toLocaleString('es-VE', { maximumFractionDigits: 0 })
    : null;

  const dias = diasDesactualizada(tasaConfig?.actualizadoEn);
  const estaDesactualizada = dias === null || dias >= 1;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onActualizarAutomatica();
    setIsRefreshing(false);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    await onActualizarManual(digitsToNumber(tasaDigits), digitsToNumber(montoDigits));
    setIsSaving(false);
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-6 py-4 border-b-2 border-red-600 flex justify-between items-center">
          <h2 className="text-lg font-black text-white flex items-center gap-2"><Coins className="w-5 h-5 text-red-500" /> TASA</h2>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {estaDesactualizada && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {dias === null ? 'Nunca se ha configurado la tasa.' : dias === 1 ? 'Tasa desactualizada: es de ayer.' : `Tasa desactualizada: tiene ${dias} días.`}
            </div>
          )}
          <div className="bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 font-bold">Tasa actual</span>
              <span className="font-black text-zinc-900 dark:text-white">{tasaConfig?.tasa ? tasaConfig.tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Sin configurar'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 font-bold">Monto base (EUR)</span>
              <span className="font-black text-zinc-900 dark:text-white">{tasaConfig?.montoBaseEUR ? tasaConfig.montoBaseEUR.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 font-bold">Cobro resultante</span>
              <span className="font-black text-red-600 dark:text-red-400">{montoBsActual ? `${montoBsActual} Bs` : '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 font-bold">Fuente</span>
              <span className="font-black text-zinc-900 dark:text-white uppercase">{tasaConfig?.fuente || '—'}</span>
            </div>
            {tasaConfig?.actualizadoEn && (
              <div className="flex justify-between text-[10px] text-zinc-400 pt-1">
                <span>Última actualización</span>
                <span>{new Date(tasaConfig.actualizadoEn).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-colors shadow-md text-white ${isRefreshing ? 'bg-zinc-400 cursor-not-allowed' : 'bg-zinc-800 hover:bg-zinc-700'}`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> {isRefreshing ? 'Actualizando...' : 'Actualizar automático'}
          </button>

          <form onSubmit={handleManualSubmit} className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-4">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 block ml-1">AJUSTE MANUAL</label>
            <div className="space-y-2">
              <label htmlFor="tasa-manual" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">TASA (Bs por EUR)</label>
              <input
                id="tasa-manual"
                required
                type="text"
                inputMode="numeric"
                value={digitsToDisplay(tasaDigits)}
                onChange={(e) => setTasaDigits(digitsFromInput(e.target.value))}
                className={NUMBER_INPUT_CLASS}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="monto-manual" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">MONTO BASE (EUR)</label>
              <input
                id="monto-manual"
                required
                type="text"
                inputMode="numeric"
                value={digitsToDisplay(montoDigits)}
                onChange={(e) => setMontoDigits(digitsFromInput(e.target.value))}
                className={NUMBER_INPUT_CLASS}
              />
            </div>
            <button type="submit" disabled={isSaving} className={`w-full px-4 py-3 text-white font-bold rounded-xl transition-colors shadow-md ${isSaving ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{isSaving ? 'Guardando...' : 'Guardar manual'}</button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
