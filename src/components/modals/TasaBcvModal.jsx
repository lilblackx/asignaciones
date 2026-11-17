import { useState } from 'react';
import { Coins, RefreshCw } from 'lucide-react';
import Modal, { CENTRADO_ESTRECHO, PANEL_COMPLETO, PANEL_PAGINA } from '../Modal';
import EncabezadoModulo from '../EncabezadoModulo';
import FormasPagoEditor from './FormasPagoEditor';
import { diasDesactualizada } from '../../utils/tasa';
import Spinner from '../Spinner';
import Boton from '../Boton';
import { TARJETA, TITULO_SECCION, claseCampo } from '../estilos';
import Aviso from '../Aviso';

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

const NUMBER_INPUT_CLASS = `${claseCampo('grande')} text-right font-mono`;

const PESTANAS = [
  { id: 'tasa', etiqueta: 'Tasa BCV' },
  { id: 'formas', etiqueta: 'Formas de pago' },
];

export default function TasaBcvModal({ tasaConfig, onActualizarAutomatica, onActualizarManual, formasPago, onGuardarFormasPago, onClose, enPagina = false }) {
  const [pestana, setPestana] = useState('tasa');
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
    <Modal enPagina={enPagina} onClose={onClose} zIndexClass="z-[60]" completa>
      <div className={enPagina ? PANEL_PAGINA : `bg-card rounded-card shadow-2xl w-full max-w-sm max-h-[90dvh] overflow-y-auto border border-border ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={Coins} titulo="Tasa y pagos" onClose={onClose} enPagina={enPagina} />

        <div className={`border-b border-border ${CENTRADO_ESTRECHO}`}>
        <div role="tablist" aria-label="Secciones de Tasa y pagos" className="flex">
          {PESTANAS.map(p => (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`tab-${p.id}`}
              aria-selected={pestana === p.id}
              aria-controls={`panel-${p.id}`}
              onClick={() => setPestana(p.id)}
              className={`flex-1 px-3 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${pestana === p.id ? 'border-red-600 text-red-700 dark:text-red-400' : 'border-transparent text-muted-foreground hover:text-zinc-900 dark:hover:text-white'}`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        </div>

        {pestana === 'formas' ? (
          <div role="tabpanel" id="panel-formas" aria-labelledby="tab-formas" className={`p-6 ${CENTRADO_ESTRECHO}`}>
            <FormasPagoEditor formasPago={formasPago} onGuardar={onGuardarFormasPago} />
          </div>
        ) : (
          <div role="tabpanel" id="panel-tasa" aria-labelledby="tab-tasa" className={`p-6 space-y-5 ${CENTRADO_ESTRECHO}`}>
            {estaDesactualizada && (
              <Aviso nivel="atencion" compact>{dias === null ? 'Nunca se ha configurado la tasa.' : dias === 1 ? 'Tasa desactualizada: es de ayer.' : `Tasa desactualizada: tiene ${dias} días.`}</Aviso>
            )}
            <dl className={`${TARJETA} p-4 text-sm divide-y divide-border`}>
              <div className="flex justify-between gap-3 py-2 first:pt-0">
                <dt className="text-muted-foreground">Tasa actual</dt>
                <dd className="font-bold text-foreground tabular-nums">{tasaConfig?.tasa ? tasaConfig.tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Sin configurar'}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Monto base (EUR)</dt>
                <dd className="font-bold text-foreground tabular-nums">{tasaConfig?.montoBaseEUR ? tasaConfig.montoBaseEUR.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</dd>
              </div>
              <div className="flex justify-between items-baseline gap-3 py-2">
                <dt className="text-muted-foreground">Cobro resultante</dt>
                <dd className="text-lg font-black text-red-700 dark:text-red-400 tabular-nums">{montoBsActual ? `${montoBsActual} Bs` : '-'}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Fuente</dt>
                <dd className="font-bold text-foreground capitalize">{String(tasaConfig?.fuente || '-').toLowerCase()}</dd>
              </div>
              {tasaConfig?.actualizadoEn && (
                <div className="flex justify-between gap-3 pt-2 text-xs text-muted-foreground">
                  <dt>Última actualización</dt>
                  <dd>{new Date(tasaConfig.actualizadoEn).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</dd>
                </div>
              )}
            </dl>

            <Boton variante="secundario" tamano="grande" className="w-full" type="button" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> {isRefreshing ? 'Actualizando...' : 'Actualizar automático'}
            </Boton>

            <form onSubmit={handleManualSubmit} className="border-t border-border pt-4 space-y-4">
              <h3 className={TITULO_SECCION}>Ajuste manual</h3>
              <div className="space-y-2">
                <label htmlFor="tasa-manual" className="text-xs font-semibold text-muted-foreground ml-1">Tasa (Bs por EUR)</label>
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
                <label htmlFor="monto-manual" className="text-xs font-semibold text-muted-foreground ml-1">Monto base (EUR)</label>
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
              <Boton variante="principal" tamano="grande" className="w-full" type="submit" disabled={isSaving}>{isSaving && <Spinner />}{isSaving ? 'Guardando...' : 'Guardar manual'}</Boton>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
}
