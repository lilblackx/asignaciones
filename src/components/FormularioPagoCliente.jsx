import { useImperativeHandle, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Link2 } from 'lucide-react';
import Colapsable from './Colapsable';
import SelectMenu from './SelectMenu';
import Spinner from './Spinner';
import CampoFecha from './CampoFecha';
import CampoHora from './CampoHora';
import CampoBanco from './finanzas/CampoBanco';
import { AREA_TEXTO, BOTON, CAMPO_FECHA, CAMPO_FORMULARIO, ETIQUETA } from './estilos';
import { SELECTOR } from './finanzas/estilos';
import { MAX_REFERENCIA, MAX_TITULAR } from '../utils/datosPago';
import { stripEmojis } from '../utils/sanitizeInput';
import {
  MONEDA_BS, MONEDA_USD, MONEDAS_CLIENTE, aplicaBancoCliente, claveReferencia, cuentasParaForma, exigeReferencia, exigeTitularCliente, fechaHoraDeMarca, formasDeCliente, notaPagoCompartido, parsePagoCliente,
} from '../utils/pagoCliente';

// La hora cabe en una sola fila desde 320 px: selectores con menos relleno.
const SELECTOR_HORA = SELECTOR.replace('pl-3 pr-9', 'pl-2.5 pr-7');

const MensajeError = ({ texto }) => <Colapsable>{texto && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{texto}</p>}</Colapsable>;

// 5696 -> "5696"; 5696.5 -> "5696,5" (sin puntos de miles: así se escribe el monto en la app).
const montoComoTexto = (monto) => (monto ? String(monto).replace('.', ',') : '');

// El formulario del pago que hace el cliente. Lo usan el técnico (al finalizarse la orden con cobro, o dentro del Pre-finalizar de una instalación) y Administración (al cobrar un pendiente,
// conciliar o corregir un pago). Valida todo con utils/pagoCliente.
//   cobro: { monto, moneda } lo que la oficina cobró (el formulario lo trae escrito) o null (instalaciones).
//   cuentasEmpresa: las formas de pago de la empresa ya normalizadas (para elegir en qué cuenta llegó el pago).
//   valoresIniciales: un pago ya registrado ({ moneda, forma, monto, ... }) para corregirlo.
//   onGuardar(valor, nota): guarda; devuelve undefined/{ ok } si se guardó, { error, campo } si el servidor rechazó algo, o { repetida: { ticketId, codigo } } si la referencia ya está en otra orden.
//   onPagaDespues({ nota, compartidoCon? }): solo el técnico ("el cliente paga después" y "pagó junto con otra orden"). Sin esta función no aparecen esos botones.
//   otrasOrdenes: [{ id, codigo, nombre }] otras órdenes del mismo cliente, para "pagó junto con otra orden".
//   permitirPagarDespues: false en las instalaciones (el cliente siempre paga de una vez): no hay "el cliente paga después"; "pagó junto con otra orden" sigue saliendo si la referencia ya está en otra orden.
//   notaObligatoria: la nota siempre se exige (Administración al corregir). `guardarTexto`: el texto del botón principal.
//   incrustado: el formulario va dentro de otro con su propio botón (el Pre-finalizar de una instalación): no lleva botones y, con `ref`, se pide la decisión con `await ref.current.obtener()`, que devuelve
//   { tipo: 'pago', valor, nota } (ya pagó) o { tipo: 'despues', nota, compartidoCon? } o null si falta algo (marca el error). `verificarReferencia(clave) -> { ticketId, codigo } | null` dice si la referencia ya está en otra orden.
export default function FormularioPagoCliente({
  cobro = null, cuentasEmpresa = [], valoresIniciales = null, ocupado = false, onGuardar = null, onPagaDespues = null, otrasOrdenes = [],
  guardarTexto = 'Registrar pago', idPrefijo = 'pc', notaObligatoria = false, permitirPagarDespues = true, notaEtiqueta = 'Nota', incrustado = false, verificarReferencia = null, ref = null,
}) {
  const inicial = valoresIniciales;
  const [form, setForm] = useState(() => ({
    moneda: inicial?.moneda || cobro?.moneda || MONEDA_BS,
    forma: inicial?.forma || '',
    monto: inicial ? montoComoTexto(inicial.monto) : montoComoTexto(cobro?.monto),
    banco: inicial?.banco || '',
    titular: inicial?.titular || '',
    cuentaEmpresa: inicial?.cuentaEmpresa || '',
    referencia: inicial?.referencia || '',
    nota: '',
    ...fechaHoraDeMarca(inicial?.pagadoEn || Date.now()),
  }));
  const [hoy] = useState(() => fechaHoraDeMarca(Date.now()).fecha);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [repetida, setRepetida] = useState(null);
  const [pagaDespues, setPagaDespues] = useState(false);
  const [notaPendiente, setNotaPendiente] = useState('');
  const [otraElegida, setOtraElegida] = useState('');
  // Solo incrustado: la otra orden con la que se dijo que pagó junto (se envía al confirmar el Pre-finalizar).
  const [compartidoCon, setCompartidoCon] = useState(null);

  const cuentas = useMemo(() => cuentasParaForma(cuentasEmpresa, form.forma), [cuentasEmpresa, form.forma]);
  const limpiarAvisos = () => { setError(null); setRepetida(null); setCompartidoCon(null); };
  const cambiar = (campo, valor) => { setForm((f) => ({ ...f, [campo]: valor })); limpiarAvisos(); };
  const cambiarMoneda = (moneda) => { setForm((f) => ({ ...f, moneda, forma: formasDeCliente(moneda).includes(f.forma) ? f.forma : '', cuentaEmpresa: '' })); limpiarAvisos(); };
  const elegirForma = (forma) => { setForm((f) => ({ ...f, forma, banco: aplicaBancoCliente(forma) ? f.banco : '', titular: exigeTitularCliente(forma) ? f.titular : '', cuentaEmpresa: '' })); limpiarAvisos(); };
  const texto = (campo) => (error?.campo === campo ? error.texto : '');

  // Avisos en vivo (no bloquean): moneda distinta al cobro y monto distinto.
  const monedaDistinta = Boolean(cobro) && form.moneda !== cobro.moneda;
  const montoNumero = Number(String(form.monto).replace(',', '.'));
  const diferencia = Boolean(cobro) && !monedaDistinta && String(form.monto).trim() !== '' && Number.isFinite(montoNumero) && Math.abs(montoNumero - cobro.monto) > 0.005;

  const validar = () => parsePagoCliente(form, { cuentas, cobro });
  const mostrarRepetida = (r) => { setRepetida(r); setOtraElegida(String(r.ticketId)); };

  const guardar = async () => {
    const r = validar();
    if (r.error) { setError({ texto: r.error, campo: r.campo }); return false; }
    if (notaObligatoria && !form.nota.trim()) { setError({ texto: 'Escribe la nota.', campo: 'nota' }); return false; }
    setGuardando(true);
    try {
      const respuesta = await onGuardar(r.valor, form.nota);
      if (respuesta?.repetida) { mostrarRepetida(respuesta.repetida); return false; }
      if (respuesta?.error) { setError({ texto: respuesta.error, campo: respuesta.campo }); return false; }
      return true;
    } finally {
      setGuardando(false);
    }
  };

  const notaPendienteLimpia = notaPendiente.trim();
  const confirmarPagaDespues = async () => {
    if (!notaPendienteLimpia) { setError({ texto: 'Escribe la nota: por ejemplo, cuándo va a pagar el cliente.', campo: 'notaPendiente' }); return; }
    setGuardando(true);
    try { await onPagaDespues({ nota: notaPendienteLimpia }); } finally { setGuardando(false); }
  };

  // "Pagó junto con otra orden": la que tiene esa referencia está preseleccionada.
  const candidatas = useMemo(() => {
    const lista = [];
    if (repetida) lista.push({ id: String(repetida.ticketId), codigo: repetida.codigo, etiqueta: `${repetida.codigo || 'Otra orden'} · tiene esa referencia` });
    for (const o of otrasOrdenes) if (!lista.some((c) => c.id === String(o.id))) lista.push({ id: String(o.id), codigo: o.codigo, etiqueta: `${o.codigo || 'S/C'}${o.nombre ? ` · ${o.nombre}` : ''}` });
    return lista;
  }, [repetida, otrasOrdenes]);
  const confirmarCompartido = async () => {
    const otra = candidatas.find((c) => c.id === otraElegida);
    if (!otra) { setError({ texto: 'Elige la otra orden.', campo: 'otraOrden' }); return; }
    const elegida = { id: otra.id, codigo: otra.codigo };
    // Dentro del Pre-finalizar no se guarda ahora: queda elegida y se envía con el resto al confirmar.
    if (incrustado) { setCompartidoCon(elegida); setRepetida(null); setError(null); return; }
    setGuardando(true);
    try { await onPagaDespues({ nota: notaPagoCompartido(otra, form.referencia), compartidoCon: elegida }); } finally { setGuardando(false); }
  };

  // Incrustado: el contenedor pide la decisión al confirmar. Devuelve null si falta algo.
  useImperativeHandle(ref, () => ({
    obtener: async () => {
      if (pagaDespues && permitirPagarDespues) {
        if (!notaPendienteLimpia) { setError({ texto: 'Escribe la nota: por ejemplo, cuándo va a pagar el cliente.', campo: 'notaPendiente' }); return null; }
        return { tipo: 'despues', nota: notaPendienteLimpia };
      }
      if (compartidoCon) return { tipo: 'despues', nota: notaPagoCompartido(compartidoCon, form.referencia), compartidoCon };
      const r = validar();
      if (r.error) { setError({ texto: r.error, campo: r.campo }); return null; }
      const ajena = verificarReferencia ? await verificarReferencia(claveReferencia(r.valor.pago.forma, r.valor.pago.banco, r.valor.pago.referencia)) : null;
      if (ajena) { mostrarRepetida(ajena); return null; }
      return { tipo: 'pago', valor: r.valor, nota: form.nota };
    },
  }));

  const bloqueado = ocupado || guardando;
  const id = (campo) => `${idPrefijo}-${campo}`;
  const botonMoneda = (m) => (
    <button
      key={m.id}
      type="button"
      aria-pressed={form.moneda === m.id}
      onClick={() => cambiarMoneda(m.id)}
      className={`flex-1 h-11 rounded-lg text-sm font-bold border transition-colors ${form.moneda === m.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:border-zinc-500'}`}
    >{m.nombre}</button>
  );
  const areaPaga = (
    <div className="space-y-2 rounded-lg border border-zinc-300 dark:border-zinc-700 p-3">
      <label htmlFor={id('nota-pendiente')} className={ETIQUETA}>¿Cuándo o cómo va a pagar? (obligatorio)</label>
      <textarea id={id('nota-pendiente')} value={notaPendiente} onChange={(e) => { setNotaPendiente(stripEmojis(e.target.value)); setError(null); }} maxLength={300} rows={2} placeholder="Ej. Paga el viernes por pago móvil" className={AREA_TEXTO} />
      <MensajeError texto={texto('notaPendiente')} />
      <p className="text-xs text-zinc-600 dark:text-zinc-400">La orden pasa a Administración y ya no tienes que hacer nada más con este pago.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {incrustado && permitirPagarDespues && (
        <div role="group" aria-label="¿El cliente ya pagó?" className="flex gap-2">
          {[[false, 'El cliente ya pagó'], [true, 'Paga después']].map(([valor, etiqueta]) => (
            <button key={String(valor)} type="button" aria-pressed={pagaDespues === valor} onClick={() => { setPagaDespues(valor); limpiarAvisos(); }}
              className={`flex-1 h-11 rounded-lg text-sm font-bold border transition-colors ${pagaDespues === valor ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:border-zinc-500'}`}
            >{etiqueta}</button>
          ))}
        </div>
      )}

      {incrustado && pagaDespues && permitirPagarDespues ? areaPaga : (
        <>
          <div>
            <p className={ETIQUETA}>Moneda del pago</p>
            <div role="group" aria-label="Moneda del pago" className="mt-1 flex gap-2">{MONEDAS_CLIENTE.map(botonMoneda)}</div>
            <MensajeError texto={texto('moneda')} />
            <Colapsable>{monedaDistinta && <p className="text-xs text-amber-800 dark:text-amber-300 font-bold mt-1">El cobro es en {cobro.moneda === MONEDA_USD ? 'dólares' : 'bolívares'} y el cliente pagó en otra moneda: se guarda tal cual y Administración lo verá marcado.</p>}</Colapsable>
          </div>

          <div>
            <label htmlFor={id('forma')} className={ETIQUETA}>Forma de pago</label>
            <div className="mt-1">
              <SelectMenu id={id('forma')} ariaLabel="Forma de pago" className={SELECTOR} value={form.forma} onChange={elegirForma} items={[{ value: '', label: 'Elige la forma de pago' }, ...formasDeCliente(form.moneda).map((f) => ({ value: f, label: f }))]} />
            </div>
            <MensajeError texto={texto('forma')} />
          </div>

          <Colapsable>{form.forma && cuentas.length > 0 && (
            <div>
              <label htmlFor={id('cuenta')} className={ETIQUETA}>Cuenta de la empresa donde llegó el pago</label>
              <div className="mt-1">
                <SelectMenu id={id('cuenta')} ariaLabel="Cuenta de la empresa donde llegó el pago" className={SELECTOR} value={form.cuentaEmpresa} onChange={(v) => cambiar('cuentaEmpresa', v)} items={[{ value: '', label: 'Elige la cuenta' }, ...cuentas.map((c) => ({ value: c, label: c }))]} />
              </div>
              <MensajeError texto={texto('cuentaEmpresa')} />
            </div>
          )}</Colapsable>

          <Colapsable>{form.forma && aplicaBancoCliente(form.forma) && (
            <CampoBanco key={form.forma === 'Zelle' ? 'eeuu' : 'venezuela'} id={id('banco')} forma={form.forma} value={form.banco} onChange={(v) => cambiar('banco', v)} opcional={!['Pago móvil', 'Transferencia'].includes(form.forma)} error={texto('banco')} />
          )}</Colapsable>

          <Colapsable>{exigeTitularCliente(form.forma) && (
            <div>
              <label htmlFor={id('titular')} className={ETIQUETA}>Titular de la cuenta Zelle</label>
              <input id={id('titular')} value={form.titular} onChange={(e) => cambiar('titular', stripEmojis(e.target.value))} maxLength={MAX_TITULAR} autoComplete="off" placeholder="Nombre de quien hizo el Zelle" aria-invalid={error?.campo === 'titular'} className={`${CAMPO_FORMULARIO} mt-1`} />
              <MensajeError texto={texto('titular')} />
            </div>
          )}</Colapsable>

          <Colapsable>{form.forma && exigeReferencia(form.forma) && (
            <div>
              <label htmlFor={id('referencia')} className={ETIQUETA}>Referencia</label>
              <input id={id('referencia')} value={form.referencia} onChange={(e) => cambiar('referencia', stripEmojis(e.target.value))} maxLength={MAX_REFERENCIA} autoComplete="off" inputMode="text" aria-invalid={error?.campo === 'referencia'} className={`${CAMPO_FORMULARIO} mt-1`} />
              <MensajeError texto={texto('referencia')} />
            </div>
          )}</Colapsable>

          <div>
            <label htmlFor={id('monto')} className={ETIQUETA}>Monto pagado ({form.moneda === MONEDA_USD ? '$' : 'Bs'})</label>
            <input id={id('monto')} value={form.monto} onChange={(e) => cambiar('monto', e.target.value.replace(/[^\d,]/g, ''))} inputMode="decimal" autoComplete="off" placeholder="Ej. 5696 o 5696,50" aria-invalid={error?.campo === 'monto'} className={`${CAMPO_FORMULARIO} mt-1`} />
            <MensajeError texto={texto('monto')} />
            <Colapsable>{diferencia && <p className="text-xs text-amber-800 dark:text-amber-300 font-bold mt-1">El monto es distinto al cobro: escribe en la nota por qué.</p>}</Colapsable>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="min-w-0">
              <label htmlFor={id('fecha')} className={ETIQUETA}>Fecha</label>
              <div className="mt-1"><CampoFecha id={id('fecha')} ariaLabel="Fecha del pago" valor={form.fecha} max={hoy} onChange={(v) => cambiar('fecha', v)} grande clase={CAMPO_FECHA} /></div>
            </div>
            <div className="min-w-0">
              <label htmlFor={id('hora')} className={ETIQUETA}>Hora</label>
              <div className="mt-1"><CampoHora id={id('hora')} ariaLabel="Hora del pago" valor={form.hora} onChange={(v) => cambiar('hora', v)} claseSelector={SELECTOR_HORA} /></div>
            </div>
          </div>
          <MensajeError texto={texto('fecha')} />

          <div>
            <label htmlFor={id('nota')} className={ETIQUETA}>{notaEtiqueta} {!diferencia && !notaObligatoria && <span className="font-normal">(opcional)</span>}</label>
            <textarea id={id('nota')} value={form.nota} onChange={(e) => cambiar('nota', stripEmojis(e.target.value))} maxLength={300} rows={2} className={`${AREA_TEXTO} mt-1`} />
            <MensajeError texto={texto('nota')} />
          </div>
        </>
      )}

      {repetida && (
        <div role="alert" className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/40 p-3 space-y-2">
          <p className="text-sm font-bold text-red-800 dark:text-red-300">Esa referencia ya está registrada en la orden {repetida.codigo || 'de otra orden'}. No se puede usar de nuevo.</p>
          <p className="text-xs text-red-800 dark:text-red-300">Si te equivocaste al escribirla, corrígela. Si el cliente pagó varias órdenes con un solo pago, usa "Pagó junto con otra orden".</p>
          {onPagaDespues && candidatas.length > 0 && (
            <div className="space-y-2 pt-1">
              <SelectMenu id={id('otra')} ariaLabel="Otra orden" className={SELECTOR} value={otraElegida} onChange={(v) => { setOtraElegida(v); setError(null); }} items={[{ value: '', label: 'Elige la otra orden' }, ...candidatas.map((c) => ({ value: c.id, label: c.etiqueta }))]} />
              <MensajeError texto={texto('otraOrden')} />
              <button type="button" onClick={confirmarCompartido} disabled={bloqueado} className={`${BOTON} w-full`}>
                {guardando ? <Spinner /> : <Link2 className="w-4 h-4" aria-hidden="true" />} Pagó junto con otra orden
              </button>
            </div>
          )}
        </div>
      )}

      {compartidoCon && (
        <div role="status" className="rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-1">
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Pagó junto con la orden {compartidoCon.codigo || 'elegida'}.</p>
          <p className="text-xs text-emerald-900 dark:text-emerald-200">Al confirmar, el pago pasa a Administración. Si te equivocaste, cambia cualquier dato del pago para volver a elegir.</p>
        </div>
      )}

      {!incrustado && (
        <div className="space-y-2 pt-1">
          <button type="button" onClick={guardar} disabled={bloqueado} className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black text-sm transition-colors">
            {guardando ? <Spinner /> : <CheckCircle2 className="w-5 h-5" aria-hidden="true" />} {guardarTexto}
          </button>

          {onPagaDespues && permitirPagarDespues && (
            <>
              <button type="button" onClick={() => { setPagaDespues((v) => !v); setError(null); }} aria-expanded={pagaDespues} disabled={bloqueado} className={`${BOTON} w-full h-11`}>
                <Clock className="w-4 h-4" aria-hidden="true" /> El cliente paga después
              </button>
              <Colapsable>{pagaDespues && (
                <div className="space-y-2">
                  {areaPaga}
                  <button type="button" onClick={confirmarPagaDespues} disabled={bloqueado} className={`${BOTON} w-full h-11`}>
                    {guardando ? <Spinner /> : null} Confirmar: el cliente paga después
                  </button>
                </div>
              )}</Colapsable>
            </>
          )}
        </div>
      )}
    </div>
  );
}
