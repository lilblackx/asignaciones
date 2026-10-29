import { useState } from 'react';
import { ArrowLeft, MinusCircle } from 'lucide-react';
import Colapsable from '../Colapsable';
import CampoFecha from '../CampoFecha';
import SelectMenu from '../SelectMenu';
import ConfirmModal from '../modals/ConfirmModal';
import Spinner from '../Spinner';
import { BOTON, BOTON_CON_BORDE_GRANDE, BOTON_GRANDE, CAMPO, CHIP, ESTADO, ETIQUETA, SELECTOR, TEXTO_SUAVE } from './estilos';
import { CAMPO_FECHA } from '../estilos';
import { aBs, bolivares, dolares } from '../../utils/finanzas';
import { FRECUENCIAS, MAX_CUOTAS, MAX_MOTIVO, parseDescuento, parseMontoDescuento, parseProgramacion, planDeCuotas, saldoTrasDescuento } from '../../utils/descuentos';
import { fechaCorta } from '../../utils/calendario';
import { diaDe } from '../../utils/totalesMes';
import { stripEmojis } from '../../utils/sanitizeInput';

// Registrar un descuento a un técnico: siempre en dólares y con un motivo (sin motivo no se guarda). Queda por descontar y se resta de lo que tenga pendiente en su próximo pago;
// la fecha y la hora son las de ahora. Si es más de lo que se le puede descontar hoy, pide confirmar antes de guardar. Va en la misma pantalla (no es una ventana).
// Se puede programar: "Aplicar desde" una fecha (entra al primer pago que se haga desde ese día) y, si se quiere, en cuotas (el monto es el total y se reparte en fechas a intervalos).
// `neto`: lo que tiene por cobrar ahora (ya sin sus otros descuentos); `onGuardar(entrada, { notificar, programacion })` devuelve true si se guardó (`programacion`: null si entra ya y de una vez).
export default function PanelDescuento({ tecnico, neto = 0, porDescontar = 0, tasa, ocupado, onGuardar, onVolver, volverTexto = 'Volver al detalle' }) {
  const [hoy] = useState(() => diaDe(Date.now()));
  const [form, setForm] = useState(() => ({ monto: '', motivo: '', desde: diaDe(Date.now()), cuotas: '1', frecuencia: 'SEMANA' }));
  const [notificar, setNotificar] = useState(true);
  const [error, setError] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  const cambiar = (campo, valor) => { setForm((f) => ({ ...f, [campo]: valor })); setError(null); };
  const monto = parseMontoDescuento(form.monto).valor;
  const programacion = parseProgramacion({ desde: form.desde, cuotas: form.cuotas, frecuencia: form.frecuencia }, { hoy }).valor;
  const enCuotas = Number(form.cuotas) > 1;
  const entraYa = !programacion || (programacion.cuotas === 1 && programacion.desde === hoy);
  const plan = monto > 0 && programacion && !entraYa ? planDeCuotas(monto, programacion) : [];
  const texto = (campo) => (error?.campo === campo ? error.texto : '');

  const guardarYa = async (entrada, programa) => {
    if (await onGuardar(entrada, { notificar, programacion: programa })) onVolver();
  };
  const guardar = async () => {
    const r = parseDescuento(form);
    if (r.error) { setError({ texto: r.error, campo: r.campo }); return; }
    const p = parseProgramacion({ desde: form.desde, cuotas: form.cuotas, frecuencia: form.frecuencia }, { hoy });
    if (p.error) { setError({ texto: p.error, campo: p.campo }); return; }
    const inmediato = p.valor.cuotas === 1 && p.valor.desde === hoy;
    // Más que lo que se le puede descontar hoy: lo que sobra queda para los pagos siguientes, y se confirma por si el monto está mal escrito. Uno programado no se compara: aún no se sabe qué tendrá por cobrar.
    if (inmediato && saldoTrasDescuento(r.valor.monto, neto) > 0) { setConfirmando({ entrada: r.valor, programa: null }); return; }
    await guardarYa(r.valor, inmediato ? null : p.valor);
  };
  const confirmarSaldo = async () => {
    const { entrada, programa } = confirmando;
    setConfirmando(null);
    await guardarYa(entrada, programa);
  };

  return (
    <div className="space-y-4 lg:animate-fade-in">
      <div>
        <button type="button" onClick={onVolver} disabled={ocupado} className={`${BOTON} mb-3`}><ArrowLeft className="w-5 h-5" aria-hidden="true" /> {volverTexto}</button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">{entraYa ? 'Registrar' : 'Programar'} un descuento a {tecnico}</h2>
          <span className={`${CHIP} ${ESTADO.CON_ADELANTO.clase}`}>Descuento</span>
        </div>
        <p className={`${TEXTO_SUAVE} mt-1`}>Un descuento es siempre en dólares y se resta de lo que el técnico tenga pendiente en su próximo pago. Si eliges otra fecha, entra al primer pago que se le haga desde ese día.{porDescontar > 0 ? ` Ya tiene ${dolares(porDescontar)} de descuentos por descontar.` : ''}</p>
      </div>

      <div className="space-y-5 max-w-xl">
        <div>
          <label htmlFor="descuento-monto" className={ETIQUETA}>{enCuotas ? 'Monto total en dólares' : 'Monto en dólares'}</label>
          <div className="relative mt-1">
            <input id="descuento-monto" value={form.monto} onChange={(e) => cambiar('monto', stripEmojis(e.target.value))} inputMode="decimal" autoComplete="off" aria-invalid={error?.campo === 'monto'} className={`${CAMPO} pr-10 text-sm font-bold`} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base font-bold text-zinc-600 dark:text-zinc-300 pointer-events-none">$</span>
          </div>
          <Colapsable>{texto('monto') ? <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('monto')}</p> : (monto > 0 && tasa > 0 && <p className={`${TEXTO_SUAVE} font-bold mt-1 tabular-nums`}>{bolivares(aBs(monto, tasa))}</p>)}</Colapsable>
        </div>

        <div>
          <label htmlFor="descuento-motivo" className={ETIQUETA}>Motivo <span className="font-normal">(obligatorio, lo ve el técnico)</span></label>
          <input id="descuento-motivo" value={form.motivo} onChange={(e) => cambiar('motivo', stripEmojis(e.target.value))} maxLength={MAX_MOTIVO} autoComplete="off" aria-invalid={error?.campo === 'motivo'} className={`${CAMPO} mt-1`} />
          <Colapsable>{texto('motivo') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('motivo')}</p>}</Colapsable>
        </div>

        <div>
          <label htmlFor="descuento-desde" className={ETIQUETA}>Aplicar desde</label>
          <div className="mt-1"><CampoFecha id="descuento-desde" ariaLabel="Aplicar el descuento desde" valor={form.desde} min={hoy} onChange={(v) => cambiar('desde', v)} grande clase={CAMPO_FECHA} /></div>
          <Colapsable>{texto('desde') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('desde')}</p>}</Colapsable>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="descuento-cuotas" className={ETIQUETA}>¿En cuántas cuotas?</label>
            <div className="mt-1"><SelectMenu id="descuento-cuotas" ariaLabel="Cuotas del descuento" className={SELECTOR} value={form.cuotas} onChange={(v) => cambiar('cuotas', v)} items={Array.from({ length: MAX_CUOTAS }, (_, i) => ({ value: String(i + 1), label: i === 0 ? 'Un solo descuento' : `${i + 1} cuotas` }))} /></div>
            <Colapsable>{texto('cuotas') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('cuotas')}</p>}</Colapsable>
          </div>
          <Colapsable>{enCuotas && (
            <div>
              <label htmlFor="descuento-frecuencia" className={ETIQUETA}>Cada cuánto</label>
              <div className="mt-1"><SelectMenu id="descuento-frecuencia" ariaLabel="Cada cuánto se descuenta una cuota" className={SELECTOR} value={form.frecuencia} onChange={(v) => cambiar('frecuencia', v)} items={FRECUENCIAS.map((f) => ({ value: f.id, label: f.etiqueta }))} /></div>
              <Colapsable>{texto('frecuencia') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('frecuencia')}</p>}</Colapsable>
            </div>
          )}</Colapsable>
        </div>

        <Colapsable>{plan.length > 0 && (
          <ul aria-label="Cuándo se descuenta" className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {plan.map((c) => (
              <li key={c.cuota} className="py-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-bold">{plan.length > 1 ? `Cuota ${c.cuota} de ${c.cuotas}` : 'Descuento'} <span className="font-normal text-zinc-600 dark:text-zinc-300">· desde el {fechaCorta(c.desde)}</span></span>
                <span className="font-bold tabular-nums">{dolares(c.monto)}</span>
              </li>
            ))}
          </ul>
        )}</Colapsable>

        <label htmlFor="descuento-notificar" className="flex items-center gap-3 text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
          <input id="descuento-notificar" type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} className="w-5 h-5 accent-red-600" />
          Avisar al técnico{!entraYa ? ' (solo al programarlo)' : ''}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={ocupado} className={`${BOTON_GRANDE} bg-red-600 hover:bg-red-700 text-white`}>
          {ocupado ? <Spinner /> : <MinusCircle className="w-5 h-5" aria-hidden="true" />} {entraYa ? 'Registrar descuento' : 'Programar descuento'}
        </button>
        <button type="button" onClick={onVolver} disabled={ocupado} className={BOTON_CON_BORDE_GRANDE}>Cancelar</button>
      </div>

      {confirmando && (
        <ConfirmModal
          color="yellow"
          title="El descuento es mayor a lo que tiene por cobrar"
          description={`${tecnico} tiene ${dolares(Math.max(0, neto))} por cobrar ahora. Del descuento de ${dolares(confirmando.entrada.monto)} se le restan ${dolares(Math.max(0, neto))} en su próximo pago y quedarán ${dolares(saldoTrasDescuento(confirmando.entrada.monto, neto))} por descontar en pagos siguientes.`}
          confirmLabel="Sí, registrar"
          processingLabel="Guardando..."
          onCancel={() => setConfirmando(null)}
          onConfirm={confirmarSaldo}
        />
      )}
    </div>
  );
}
