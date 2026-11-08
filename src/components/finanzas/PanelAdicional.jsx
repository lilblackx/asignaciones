import { useState } from 'react';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import Colapsable from '../Colapsable';
import SelectMenu from '../SelectMenu';
import Spinner from '../Spinner';
import { BOTON, BOTON_CON_BORDE_GRANDE, BOTON_GRANDE, CAMPO, CHIP, ESTADO, ETIQUETA, SELECTOR, TEXTO_SUAVE } from './estilos';
import { aBs, bolivares, dolares } from '../../utils/finanzas';
import { MAX_NOTA_ADICIONAL, parseAdicional } from '../../utils/adicionales';
import { stripEmojis } from '../../utils/sanitizeInput';

// Sumarle un pago adicional a un técnico: eliges un ítem del tabulador, la cantidad y, si quieres, una nota. El monto es el precio por la cantidad, siempre en dólares, y entra entero en su próximo
// pago. La fecha y la hora son las de ahora. Va en la misma pantalla (no es una ventana). `items`: los ítems del tabulador; `onGuardar(entrada, { notificar })` devuelve true si se guardó.
export default function PanelAdicional({ tecnico, items = [], porPagar = 0, tasa, ocupado, onGuardar, onVolver, volverTexto = 'Volver al detalle' }) {
  const [form, setForm] = useState({ itemId: items.length === 1 ? items[0].id : '', cantidad: '1', nota: '' });
  const [notificar, setNotificar] = useState(true);
  const [error, setError] = useState(null);

  const cambiar = (campo, valor) => { setForm((f) => ({ ...f, [campo]: valor })); setError(null); };
  const vista = parseAdicional(form, items).valor;
  const texto = (campo) => (error?.campo === campo ? error.texto : '');

  const guardar = async () => {
    const r = parseAdicional(form, items);
    if (r.error) { setError({ texto: r.error, campo: r.campo }); return; }
    if (await onGuardar(r.valor, { notificar })) onVolver();
  };

  return (
    <div className="space-y-4 lg:animate-fade-in">
      <div>
        <button type="button" onClick={onVolver} disabled={ocupado} className={`${BOTON} mb-3`}><ArrowLeft className="w-5 h-5" aria-hidden="true" /> {volverTexto}</button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">Sumar un pago adicional a {tecnico}</h2>
          <span className={`${CHIP} ${ESTADO.PAGADO.clase}`}>Pago adicional</span>
        </div>
        <p className={`${TEXTO_SUAVE} mt-1`}>Se suma entero a lo que se le paga en su próximo pago. El precio sale del ítem en el Tabulador de precios.{porPagar > 0 ? ` Ya tiene ${dolares(porPagar)} de pagos adicionales por pagar.` : ''}</p>
      </div>

      {items.length === 0 ? (
        <p role="status" className="max-w-xl rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">Todavía no hay ítems de pagos adicionales. Créalos primero en el Tabulador de precios, en la sección «Pagos adicionales».</p>
      ) : (
        <div className="space-y-5 max-w-xl">
          <div>
            <label htmlFor="adicional-item" className={ETIQUETA}>Ítem</label>
            <div className="mt-1">
              <SelectMenu id="adicional-item" ariaLabel="Ítem del pago adicional" className={SELECTOR} value={form.itemId} onChange={(v) => cambiar('itemId', v)} items={[{ value: '', label: 'Elige el ítem' }, ...items.map((i) => ({ value: i.id, label: `${i.nombre} · ${dolares(i.precio)}` }))]} />
            </div>
            <Colapsable>{texto('item') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('item')}</p>}</Colapsable>
          </div>

          <div>
            <label htmlFor="adicional-cantidad" className={ETIQUETA}>Cantidad <span className="font-normal">(por ejemplo, cuántos domingos)</span></label>
            <input id="adicional-cantidad" value={form.cantidad} onChange={(e) => cambiar('cantidad', stripEmojis(e.target.value))} inputMode="numeric" autoComplete="off" aria-invalid={error?.campo === 'cantidad'} className={`${CAMPO} mt-1 text-sm font-bold`} />
            <Colapsable>{texto('cantidad') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('cantidad')}</p>}</Colapsable>
          </div>

          <Colapsable>{vista && (
            <p className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-2 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-bold text-zinc-900 dark:text-white">{vista.cantidad} × {dolares(vista.item.precio)}</span>
              <span className="text-right"><span className="block font-bold tabular-nums text-zinc-900 dark:text-white">{dolares(vista.monto)}</span>{tasa > 0 && <span className="block text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">{bolivares(aBs(vista.monto, tasa))}</span>}</span>
            </p>
          )}</Colapsable>

          <div>
            <label htmlFor="adicional-nota" className={ETIQUETA}>Nota <span className="font-normal">(opcional, la ve el técnico)</span></label>
            <input id="adicional-nota" value={form.nota} onChange={(e) => cambiar('nota', stripEmojis(e.target.value))} maxLength={MAX_NOTA_ADICIONAL} autoComplete="off" aria-invalid={error?.campo === 'nota'} className={`${CAMPO} mt-1`} />
            <Colapsable>{texto('nota') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('nota')}</p>}</Colapsable>
          </div>

          <label htmlFor="adicional-notificar" className="flex items-center gap-3 text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
            <input id="adicional-notificar" type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} className="w-5 h-5 accent-red-600" />
            Avisar al técnico
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {items.length > 0 && (
          <button type="button" onClick={guardar} disabled={ocupado} className={`${BOTON_GRANDE} bg-red-600 hover:bg-red-700 text-white`}>
            {ocupado ? <Spinner /> : <PlusCircle className="w-5 h-5" aria-hidden="true" />} Registrar pago adicional
          </button>
        )}
        <button type="button" onClick={onVolver} disabled={ocupado} className={BOTON_CON_BORDE_GRANDE}>Cancelar</button>
      </div>
    </div>
  );
}
