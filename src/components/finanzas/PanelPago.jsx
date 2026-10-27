import { useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Colapsable from '../Colapsable';
import NumeroPulso from '../NumeroPulso';
import SelectMenu from '../SelectMenu';
import Spinner from '../Spinner';
import CampoBanco from './CampoBanco';
import { BOTON, BOTON_GRANDE, CAMPO, CAMPO_FECHA, CHIP, ESTADO, ETIQUETA, SELECTOR, TEXTO_SUAVE } from './estilos';
import CampoFecha from '../CampoFecha';
import CampoHora from '../CampoHora';
import { aBs, bolivares, dolares, textoOrdenes } from '../../utils/finanzas';
import { MAX_REFERENCIA, MONEDA_BS, MONEDA_USD, esZelle, exigeBanco, exigeReferencia, fechaHoraDeMarca, formasDeMoneda, parseDatosPago } from '../../utils/datosPago';
import { etiquetaRango } from '../../utils/periodoReporte';
import { stripEmojis } from '../../utils/sanitizeInput';

// El segundo paso de pagar: los datos del pago (moneda, forma, banco, referencia, fecha y hora, nota y si se le avisa al técnico). Va en la misma pantalla que el detalle (no es una
// ventana), con el total pendiente siempre a la vista. Solo "Confirmar pago" guarda. `onConfirmar({ datosPago, notificar, nota })` devuelve true si se guardó.
export default function PanelPago({ fila, rango, tasa, ocupado, onConfirmar, onVolver }) {
  const [form, setForm] = useState(() => ({ moneda: tasa > 0 ? MONEDA_BS : MONEDA_USD, forma: '', banco: '', referencia: '', nota: '', ...fechaHoraDeMarca(Date.now()) }));
  const [hoy] = useState(() => fechaHoraDeMarca(Date.now()).fecha);
  const [notificar, setNotificar] = useState(true);
  const [error, setError] = useState(null);

  const neto = fila.neto ?? fila.total;
  const descuento = fila.descuento ?? 0;
  const cambiar = (campo, valor) => { setForm((f) => ({ ...f, [campo]: valor })); setError(null); };
  const cambiarMoneda = (moneda) => setForm((f) => ({ ...f, moneda, forma: formasDeMoneda(moneda).includes(f.forma) ? f.forma : '' }));
  const entregar = form.moneda === MONEDA_BS ? (tasa > 0 ? bolivares(aBs(neto, tasa)) : '-') : dolares(neto);

  const confirmar = async () => {
    const r = parseDatosPago(form);
    if (r.error) { setError({ texto: r.error, campo: r.campo }); return; }
    if (r.valor.moneda === MONEDA_BS && !(tasa > 0)) { setError({ texto: 'No hay tasa BCV: elige dólares o actualiza la tasa.', campo: 'moneda' }); return; }
    if (await onConfirmar({ datosPago: r.valor, notificar, nota: form.nota })) onVolver();
  };
  const texto = (campo) => (error?.campo === campo ? error.texto : '');

  return (
    <div className="space-y-4 lg:animate-fade-in">
      <div>
        <button type="button" onClick={onVolver} disabled={ocupado} className={`${BOTON} mb-3`}><ArrowLeft className="w-5 h-5" aria-hidden="true" /> Volver al detalle</button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">Registrar el pago a {fila.tecnico}</h2>
          <span className={`${CHIP} ${ESTADO.POR_PAGAR.clase}`}>Paso 2 de 2</span>
        </div>
        <p className={`${TEXTO_SUAVE} mt-1`}>{[etiquetaRango(rango), fila.pendientes.length > 0 && textoOrdenes(fila.pendientes.length), fila.bonos > 0 && `garantías ${dolares(fila.bonos)}`, descuento > 0 && `descuentos ${dolares(descuento)}`].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="border-y border-zinc-400 dark:border-zinc-700 py-4">
        <p className={ETIQUETA}>Total pendiente por pagar</p>
        <p className="text-xl font-extrabold tabular-nums text-zinc-900 dark:text-white leading-tight">{dolares(neto)}</p>
        {tasa > 0 && <p className="text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{bolivares(aBs(neto, tasa))}</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 max-w-4xl">
        <div className="space-y-5">
          <div>
            <p className={ETIQUETA}>Moneda</p>
            <div role="group" aria-label="Moneda del pago" className="mt-1 flex gap-2">
              {[[MONEDA_BS, 'Bolívares (Bs)'], [MONEDA_USD, 'Dólares ($)']].map(([id, etiqueta]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={form.moneda === id}
                  disabled={id === MONEDA_BS && !(tasa > 0)}
                  onClick={() => cambiarMoneda(id)}
                  className={`flex-1 h-9 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-40 ${form.moneda === id ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:border-zinc-500'}`}
                >{etiqueta}</button>
              ))}
            </div>
            <Colapsable>{!(tasa > 0) && <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">No hay tasa BCV: solo se puede pagar en dólares hasta que se actualice.</p>}</Colapsable>
            <Colapsable>{error?.campo === 'moneda' && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{error.texto}</p>}</Colapsable>
          </div>

          <div className="border border-zinc-400 dark:border-zinc-700 rounded-lg px-4 py-3">
            <p className={ETIQUETA}>Monto a entregar</p>
            <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white"><NumeroPulso valor={entregar} /></p>
            {form.moneda === MONEDA_BS && tasa > 0 && <p className={`${TEXTO_SUAVE} tabular-nums`}>{dolares(neto)} a {tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs por dólar</p>}
          </div>

          <div>
            <label htmlFor="pago-forma" className={ETIQUETA}>Forma de pago</label>
            <div className="mt-1">
              <SelectMenu id="pago-forma" ariaLabel="Forma de pago" className={SELECTOR} value={form.forma} onChange={(v) => setForm((f) => ({ ...f, forma: v, banco: esZelle(f.forma) === esZelle(v) ? f.banco : '' }))} items={[{ value: '', label: 'Elige la forma de pago' }, ...formasDeMoneda(form.moneda).map((f) => ({ value: f, label: f }))]} />
            </div>
            <Colapsable>{texto('forma') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('forma')}</p>}</Colapsable>
          </div>

          <Colapsable>{form.forma && form.forma !== 'Efectivo' && <CampoBanco key={esZelle(form.forma) ? 'eeuu' : 'venezuela'} id="pago-banco" forma={form.forma} value={form.banco} onChange={(v) => cambiar('banco', v)} opcional={!exigeBanco(form.forma)} error={texto('banco')} />}</Colapsable>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="pago-referencia" className={ETIQUETA}>Referencia {form.forma && !exigeReferencia(form.forma) && <span className="font-normal">(no aplica en efectivo)</span>}</label>
            <input id="pago-referencia" value={form.referencia} onChange={(e) => cambiar('referencia', stripEmojis(e.target.value))} maxLength={MAX_REFERENCIA} autoComplete="off" aria-invalid={error?.campo === 'referencia'} className={`${CAMPO} mt-1`} />
            <Colapsable>{texto('referencia') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('referencia')}</p>}</Colapsable>
          </div>

          <div>
            <label htmlFor="pago-fecha" className={ETIQUETA}>Fecha</label>
            <div className="mt-1"><CampoFecha id="pago-fecha" ariaLabel="Fecha del pago" valor={form.fecha} max={hoy} onChange={(v) => cambiar('fecha', v)} grande clase={CAMPO_FECHA} /></div>
          </div>
          <div>
            <label htmlFor="pago-hora" className={ETIQUETA}>Hora</label>
            <div className="mt-1"><CampoHora id="pago-hora" ariaLabel="Hora del pago" valor={form.hora} onChange={(v) => cambiar('hora', v)} claseSelector={SELECTOR} claseBoton="px-4 text-sm" /></div>
          </div>
          <Colapsable>{texto('fecha') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold -mt-3">{texto('fecha')}</p>}</Colapsable>

          <div>
            <label htmlFor="pago-nota" className={ETIQUETA}>Nota <span className="font-normal">(opcional)</span></label>
            <input id="pago-nota" value={form.nota} onChange={(e) => cambiar('nota', stripEmojis(e.target.value))} maxLength={300} autoComplete="off" className={`${CAMPO} mt-1`} />
          </div>

          <label htmlFor="pago-notificar" className="flex items-center gap-3 text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
            <input id="pago-notificar" type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} className="w-5 h-5 accent-red-600" />
            Notificar al técnico
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={confirmar} disabled={ocupado} className={`${BOTON_GRANDE} bg-red-600 hover:bg-red-700 text-white`}>
          {ocupado ? <Spinner /> : <CheckCircle2 className="w-5 h-5" aria-hidden="true" />} Confirmar pago
        </button>
        <button type="button" onClick={onVolver} disabled={ocupado} className={BOTON}>Cancelar</button>
      </div>
    </div>
  );
}
