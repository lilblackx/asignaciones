import { Check } from 'lucide-react';
import { COBRO_EXONERADO, COBRO_OTRO, COBRO_VISITA, MONEDA_BS, MONEDA_USD, formatoMontoBs } from '../../utils/cobro';
import { COBRO_PAGADA, MAX_NOTA_COBRO, SIN_DEFINIR, textoModoAcordado } from '../../utils/cobroAcordado';
import FormularioPagoCliente from '../FormularioPagoCliente';
import { montoCalculadora } from '../../utils/montoCalculadora';
import { stripEmojis } from '../../utils/sanitizeInput';
import { claseCampo } from '../estilos';

const OPCIONES = [
  [SIN_DEFINIR, 'Sin definir'],
  [COBRO_VISITA, 'Visita técnica'],
  [COBRO_OTRO, 'Monto'],
  [COBRO_EXONERADO, 'Exonerada'],
  [COBRO_PAGADA, 'Pagada'],
];

// Cobro acordado con el cliente al crear (o editar) la orden, para que quien la finalice sepa qué se habló aunque no sea quien la creó
// (ver utils/cobroAcordado). Es solo de la oficina: no cambia nada hasta que se finaliza, y entonces el selector de cobro viene con esto elegido.
// `permitirPagada`: ofrece "Pagada" y pide los datos del pago. Una orden que ya es "Pagada" (`value.pagada`) muestra su resumen y no vuelve a pedirlos.
// `value`: el formulario (`cobroSel`: { modo, otro, moneda, nota }); `onChange(siguiente)`; `error`: mensaje del monto, si lo hay.
// "Pagada": muestra el formulario de pago del técnico (moneda, forma, cuenta, banco, referencia, monto, fecha y hora). `cuentasEmpresa`: las formas de pago de la empresa; `pagoRef`: para pedir los datos al guardar.
export default function CobroAcordadoField({ idPrefix, value, onChange, error = '', wrapperClassName = 'space-y-1', cuentasEmpresa = [], pagoRef = null, permitirPagada = false }) {
  const moneda = value.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS;
  const esMonto = value.modo === COBRO_OTRO;
  const etiqueta = 'text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400 ml-1';

  return (
    <div className={wrapperClassName}>
      <p id={`${idPrefix}-cobro-acordado`} className={etiqueta}>
        COBRO ACORDADO CON EL CLIENTE <span className="font-normal normal-case text-zinc-400">(opcional; lo ve quien finaliza la orden)</span>
      </p>
      <div role="radiogroup" aria-labelledby={`${idPrefix}-cobro-acordado`} className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-1.5">
        {OPCIONES.filter(([modo]) => modo !== COBRO_PAGADA || permitirPagada || value.modo === COBRO_PAGADA).map(([modo, texto]) => {
          const activa = value.modo === modo;
          return (
            <button
              key={modo || 'sin-definir'}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => onChange({ ...value, modo })}
              className={`min-h-11 lg:min-h-9 px-2 py-1.5 rounded-xl border-2 text-xs font-bold whitespace-nowrap flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activa ? 'border-sky-500 bg-sky-700 text-white' : 'border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-sky-400'
              }`}
            >
              {activa && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
              {texto}
            </button>
          );
        })}
      </div>

      {value.modo === COBRO_PAGADA && value.pagada?.pago && (
        <p className="rounded-xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2 text-xs font-bold text-emerald-900 dark:text-emerald-300">
          {textoModoAcordado({ modo: COBRO_PAGADA, monto: formatoMontoBs(value.pagada.pago.monto), moneda: value.pagada.pago.moneda, pago: value.pagada.pago })}
          {value.pagada.nota ? ` · ${value.pagada.nota}` : ''}
        </p>
      )}

      {value.modo === COBRO_PAGADA && permitirPagada && !value.pagada?.pago && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-3">
          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">DATOS DEL PAGO</p>
          <FormularioPagoCliente incrustado permitirPagarDespues={false} confirmar={false} cuentasEmpresa={cuentasEmpresa} ref={pagoRef} idPrefijo={`${idPrefix}-pago`} notaEtiqueta="Nota del pago" />
        </div>
      )}

      {esMonto && (
        <div className="space-y-1">
          <div className="flex items-stretch gap-1.5">
            <div role="radiogroup" aria-label="Moneda del cobro acordado" className="grid grid-cols-2 gap-1.5 shrink-0">
              {[[MONEDA_BS, 'Bs'], [MONEDA_USD, '$']].map(([valor, texto]) => {
                const activa = moneda === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={activa}
                    onClick={() => onChange({ ...value, moneda: valor })}
                    className={`min-h-11 lg:min-h-9 min-w-11 px-3 rounded-xl border-2 text-xs font-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      activa ? 'border-sky-500 bg-sky-700 text-white' : 'border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-sky-400'
                    }`}
                  >
                    {texto}
                  </button>
                );
              })}
            </div>
            <input
              id={`${idPrefix}-cobro-monto`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={`Monto acordado en ${moneda === MONEDA_USD ? 'dólares' : 'bolívares'}`}
              placeholder="0,00"
              value={value.otro}
              onFocus={(e) => e.target.select()}
              onChange={(e) => onChange({ ...value, otro: montoCalculadora(e.target.value) })}
              aria-invalid={!!error}
              aria-describedby={error ? `${idPrefix}-cobro-monto-error` : undefined}
              className={`min-w-0 flex-1 ${claseCampo('compacto', error ? 'error' : 'normal')} text-right font-bold tabular-nums`}
            />
          </div>
          {error && <p id={`${idPrefix}-cobro-monto-error`} role="alert" className="text-[11px] max-lg:text-xs font-bold text-red-600 dark:text-red-400 ml-1">{error}</p>}
        </div>
      )}

      {/* Con "Pagada" la nota es la del propio pago (arriba): no se repite. */}
      {value.modo !== COBRO_PAGADA && (
        <input
          id={`${idPrefix}-cobro-nota`}
          type="text"
          autoComplete="off"
          maxLength={MAX_NOTA_COBRO}
          aria-label="Nota del cobro acordado"
          placeholder="Nota (opcional). Ej. Revisión de equipos: se cobra solo si resulta falla del cliente"
          value={value.nota}
          onChange={(e) => onChange({ ...value, nota: stripEmojis(e.target.value) })}
          className={claseCampo('compacto')}
        />
      )}
    </div>
  );
}
