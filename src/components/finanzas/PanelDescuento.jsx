import { useState } from 'react';
import { ArrowLeft, MinusCircle } from 'lucide-react';
import Colapsable from '../Colapsable';
import ConfirmModal from '../modals/ConfirmModal';
import Spinner from '../Spinner';
import { BOTON, BOTON_GRANDE, CAMPO, CHIP, ESTADO, ETIQUETA, TEXTO_SUAVE } from './estilos';
import { aBs, bolivares, dolares } from '../../utils/finanzas';
import { MAX_MOTIVO, parseDescuento, parseMontoDescuento, saldoTrasDescuento } from '../../utils/descuentos';
import { stripEmojis } from '../../utils/sanitizeInput';

// Registrar un descuento a un técnico: siempre en dólares y con un motivo (sin motivo no se guarda). Queda por descontar y se resta de lo que tenga pendiente en su próximo pago;
// la fecha y la hora son las de ahora. Si es más de lo que se le puede descontar hoy, pide confirmar antes de guardar. Va en la misma pantalla (no es una ventana).
// `neto`: lo que tiene por cobrar ahora (ya sin sus otros descuentos); `onGuardar(entrada, { notificar })` devuelve true si se guardó.
export default function PanelDescuento({ tecnico, neto = 0, porDescontar = 0, tasa, ocupado, onGuardar, onVolver }) {
  const [form, setForm] = useState({ monto: '', motivo: '' });
  const [notificar, setNotificar] = useState(true);
  const [error, setError] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  const cambiar = (campo, valor) => { setForm((f) => ({ ...f, [campo]: valor })); setError(null); };
  const monto = parseMontoDescuento(form.monto).valor;
  const texto = (campo) => (error?.campo === campo ? error.texto : '');

  const guardarYa = async (entrada) => {
    if (await onGuardar(entrada, { notificar })) onVolver();
  };
  const guardar = async () => {
    const r = parseDescuento(form);
    if (r.error) { setError({ texto: r.error, campo: r.campo }); return; }
    // Más que lo que se le puede descontar hoy: lo que sobra queda para los pagos siguientes, y se confirma por si el monto está mal escrito.
    if (saldoTrasDescuento(r.valor.monto, neto) > 0) { setConfirmando(r.valor); return; }
    await guardarYa(r.valor);
  };
  const confirmarSaldo = async () => {
    const entrada = confirmando;
    setConfirmando(null);
    await guardarYa(entrada);
  };

  return (
    <div className="space-y-4 lg:animate-fade-in">
      <div>
        <button type="button" onClick={onVolver} disabled={ocupado} className={`${BOTON} mb-3`}><ArrowLeft className="w-5 h-5" aria-hidden="true" /> Volver al detalle</button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">Registrar un descuento a {tecnico}</h2>
          <span className={`${CHIP} ${ESTADO.CON_ADELANTO.clase}`}>Descuento</span>
        </div>
        <p className={`${TEXTO_SUAVE} mt-1`}>Un descuento es siempre en dólares y se resta de lo que el técnico tenga pendiente en su próximo pago.{porDescontar > 0 ? ` Ya tiene ${dolares(porDescontar)} de descuentos por descontar.` : ''}</p>
      </div>

      <div className="space-y-5 max-w-xl">
        <div>
          <label htmlFor="descuento-monto" className={ETIQUETA}>Monto en dólares</label>
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

        <label htmlFor="descuento-notificar" className="flex items-center gap-3 text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
          <input id="descuento-notificar" type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} className="w-5 h-5 accent-red-600" />
          Avisar al técnico
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={ocupado} className={`${BOTON_GRANDE} bg-red-600 hover:bg-red-700 text-white`}>
          {ocupado ? <Spinner /> : <MinusCircle className="w-5 h-5" aria-hidden="true" />} Registrar descuento
        </button>
        <button type="button" onClick={onVolver} disabled={ocupado} className={BOTON}>Cancelar</button>
      </div>

      {confirmando && (
        <ConfirmModal
          color="yellow"
          title="El descuento es mayor a lo que tiene por cobrar"
          description={`${tecnico} tiene ${dolares(Math.max(0, neto))} por cobrar ahora. Del descuento de ${dolares(confirmando.monto)} se le restan ${dolares(Math.max(0, neto))} en su próximo pago y quedarán ${dolares(saldoTrasDescuento(confirmando.monto, neto))} por descontar en pagos siguientes.`}
          confirmLabel="Sí, registrar"
          processingLabel="Guardando..."
          onCancel={() => setConfirmando(null)}
          onConfirm={confirmarSaldo}
        />
      )}
    </div>
  );
}
