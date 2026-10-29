import { useState } from 'react';
import { ArrowLeft, HandCoins } from 'lucide-react';
import Colapsable from '../Colapsable';
import SelectMenu from '../SelectMenu';
import Spinner from '../Spinner';
import CampoBanco from './CampoBanco';
import { BOTON, BOTON_CON_BORDE_GRANDE, BOTON_GRANDE, CAMPO, CAMPO_FECHA, CHIP, ESTADO, ETIQUETA, SELECTOR, TEXTO_SUAVE } from './estilos';
import CampoFecha from '../CampoFecha';
import CampoHora from '../CampoHora';
import { aBs, bolivares, dolares } from '../../utils/finanzas';
import { MAX_NOTA, MAX_REFERENCIA, MONEDA_USD, esZelle, exigeBanco, exigeReferencia, fechaHoraDeMarca, formasDeMoneda, parseAdelanto, parseMontoAdelanto } from '../../utils/datosPago';
import { stripEmojis } from '../../utils/sanitizeInput';

// Registrar un adelanto a un técnico: siempre en dólares. Queda por descontar y se resta de lo que tenga pendiente en su próximo pago. Va en la misma pantalla (no es una ventana).
// `onGuardar(entrada, { notificar })` devuelve true si se guardó.
export default function PanelAdelanto({ tecnico, porDescontar = 0, tasa, ocupado, onGuardar, onVolver, volverTexto = 'Volver al detalle' }) {
  const [hoy] = useState(() => fechaHoraDeMarca(Date.now()).fecha);
  const [form, setForm] = useState(() => ({ monto: '', forma: '', banco: '', referencia: '', nota: '', ...fechaHoraDeMarca(Date.now()) }));
  const [notificar, setNotificar] = useState(true);
  const [error, setError] = useState(null);

  const cambiar = (campo, valor) => { setForm((f) => ({ ...f, [campo]: valor })); setError(null); };
  const monto = parseMontoAdelanto(form.monto).valor;
  const texto = (campo) => (error?.campo === campo ? error.texto : '');

  const guardar = async () => {
    const r = parseAdelanto(form);
    if (r.error) { setError({ texto: r.error, campo: r.campo }); return; }
    if (await onGuardar(r.valor, { notificar })) onVolver();
  };

  return (
    <div className="space-y-4 lg:animate-fade-in">
      <div>
        <button type="button" onClick={onVolver} disabled={ocupado} className={`${BOTON} mb-3`}><ArrowLeft className="w-5 h-5" aria-hidden="true" /> {volverTexto}</button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">Registrar un adelanto a {tecnico}</h2>
          <span className={`${CHIP} ${ESTADO.CON_ADELANTO.clase}`}>Adelanto</span>
        </div>
        <p className={`${TEXTO_SUAVE} mt-1`}>Un adelanto es siempre en dólares y se resta de lo que el técnico tenga pendiente en su próximo pago.{porDescontar > 0 ? ` Ya tiene ${dolares(porDescontar)} de adelantos por descontar.` : ''}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 max-w-4xl">
        <div className="space-y-5">
          <div>
            <label htmlFor="adelanto-monto" className={ETIQUETA}>Monto en dólares</label>
            <div className="relative mt-1">
              <input id="adelanto-monto" value={form.monto} onChange={(e) => cambiar('monto', stripEmojis(e.target.value))} inputMode="decimal" autoComplete="off" aria-invalid={error?.campo === 'monto'} className={`${CAMPO} pr-10 text-sm font-bold`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base font-bold text-zinc-600 dark:text-zinc-300 pointer-events-none">$</span>
            </div>
            <Colapsable>{texto('monto') ? <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('monto')}</p> : (monto > 0 && tasa > 0 && <p className={`${TEXTO_SUAVE} font-bold mt-1 tabular-nums`}>{bolivares(aBs(monto, tasa))}</p>)}</Colapsable>
          </div>

          <div>
            <label htmlFor="adelanto-forma" className={ETIQUETA}>Forma de pago</label>
            <div className="mt-1">
              <SelectMenu id="adelanto-forma" ariaLabel="Forma de pago" className={SELECTOR} value={form.forma} onChange={(v) => setForm((f) => ({ ...f, forma: v, banco: esZelle(f.forma) === esZelle(v) ? f.banco : '' }))} items={[{ value: '', label: 'Elige la forma de pago' }, ...formasDeMoneda(MONEDA_USD).map((f) => ({ value: f, label: f }))]} />
            </div>
            <Colapsable>{texto('forma') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('forma')}</p>}</Colapsable>
          </div>

          <Colapsable>{form.forma && form.forma !== 'Efectivo' && <CampoBanco key={esZelle(form.forma) ? 'eeuu' : 'venezuela'} id="adelanto-banco" forma={form.forma} value={form.banco} onChange={(v) => cambiar('banco', v)} opcional={!exigeBanco(form.forma)} error={texto('banco')} />}</Colapsable>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="adelanto-referencia" className={ETIQUETA}>Referencia {form.forma && !exigeReferencia(form.forma) && <span className="font-normal">(no aplica en efectivo)</span>}</label>
            <input id="adelanto-referencia" value={form.referencia} onChange={(e) => cambiar('referencia', stripEmojis(e.target.value))} maxLength={MAX_REFERENCIA} autoComplete="off" aria-invalid={error?.campo === 'referencia'} className={`${CAMPO} mt-1`} />
            <Colapsable>{texto('referencia') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('referencia')}</p>}</Colapsable>
          </div>

          <div>
            <label htmlFor="adelanto-fecha" className={ETIQUETA}>Fecha</label>
            <div className="mt-1"><CampoFecha id="adelanto-fecha" ariaLabel="Fecha del adelanto" valor={form.fecha} max={hoy} onChange={(v) => cambiar('fecha', v)} grande clase={CAMPO_FECHA} /></div>
          </div>
          <div>
            <label htmlFor="adelanto-hora" className={ETIQUETA}>Hora</label>
            <div className="mt-1"><CampoHora id="adelanto-hora" ariaLabel="Hora del adelanto" valor={form.hora} onChange={(v) => cambiar('hora', v)} claseSelector={SELECTOR.replace('pl-3 pr-9', 'pl-2.5 pr-7')} claseBoton="px-2.5 min-[400px]:px-4 text-sm" /></div>
          </div>
          <Colapsable>{texto('fecha') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold -mt-3">{texto('fecha')}</p>}</Colapsable>

          <div>
            <label htmlFor="adelanto-nota" className={ETIQUETA}>Nota <span className="font-normal">(opcional)</span></label>
            <input id="adelanto-nota" value={form.nota} onChange={(e) => cambiar('nota', stripEmojis(e.target.value))} maxLength={MAX_NOTA} autoComplete="off" className={`${CAMPO} mt-1`} />
            <Colapsable>{texto('nota') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto('nota')}</p>}</Colapsable>
          </div>

          <label htmlFor="adelanto-notificar" className="flex items-center gap-3 text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
            <input id="adelanto-notificar" type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} className="w-5 h-5 accent-red-600" />
            Notificar al técnico
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={ocupado} className={`${BOTON_GRANDE} bg-red-600 hover:bg-red-700 text-white`}>
          {ocupado ? <Spinner /> : <HandCoins className="w-5 h-5" aria-hidden="true" />} Registrar adelanto
        </button>
        <button type="button" onClick={onVolver} disabled={ocupado} className={BOTON_CON_BORDE_GRANDE}>Cancelar</button>
      </div>
    </div>
  );
}
