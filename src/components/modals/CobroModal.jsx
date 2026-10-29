import { useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, Undo2, X } from 'lucide-react';
import Modal from '../Modal';
import Boton from '../Boton';
import Colapsable from '../Colapsable';
import SelectMenu from '../SelectMenu';
import Spinner from '../Spinner';
import TelefonoAccion from '../TelefonoAccion';
import { CAMPO_FORMULARIO, ETIQUETA } from '../estilos';
import { SELECTOR } from '../finanzas/estilos';
import { formatCedula } from '../../utils/ticketDisplay';
import { formatoMontoBs, textoMonto } from '../../utils/cobro';
import { ESTADO_COBRO, ETIQUETA_ESTADO_COBRO, diasEsperando, textoDeCobro, textoParaCopiar } from '../../utils/cobrosClientes';
import { stripEmojis } from '../../utils/sanitizeInput';

const CLASE_ESTADO = { PENDIENTE: 'bg-amber-400 text-black', CARGADO: 'bg-emerald-700 text-white' };
const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const textoDeMonto = (m) => (m ? textoMonto(formatoMontoBs(Number(m.monto)), m.moneda) : 'sin cobro');

// Un dato del cobro con su botón de copiar (`copiable`) y, si hace falta, otros botones al lado (`children`).
function Dato({ clave, etiqueta, valor, copiable = true, copiado, onCopiar, children }) {
  if (!valor) return null;
  return (
    <div className="min-w-0">
      <p className={ETIQUETA}>{etiqueta}</p>
      <div className="flex flex-wrap items-center gap-2 mt-0.5">
        <span className="text-sm font-bold text-zinc-900 dark:text-white break-words">{valor}</span>
        {copiable && (
          <button type="button" onClick={() => onCopiar(clave, String(valor))} aria-label={`Copiar ${etiqueta.toLowerCase()}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            {copiado === clave ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />} {copiado === clave ? 'Copiado' : 'Copiar'}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

// El cobro de una orden para ADMINISTRACION (y el ADMIN): todo lo que hace falta para subirlo al portal de la empresa, cada dato con su botón de copiar, y lo que se puede hacer según su estado.
//   - Pendiente: marcarlo cargado (una instalación pide el monto aquí: la app no lo conoce).
//   - Cargado: devolverlo a pendiente si se marcó por error.
//   - Con cambio de monto (la orden cambió cuando ya estaba cargado): confirmar que se corrigió en el portal.
// `onTrabajar(accion, datos)` devuelve { ok } o { error, campo }; accion: 'cargar' | 'devolver' | 'confirmar'. `soloLectura` (Finanzas): se ven todos los datos y el historial, sin ninguna acción.
export default function CobroModal({ cobro, onTrabajar = null, soloLectura = false, onClose }) {
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState('USD');
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [copiado, setCopiado] = useState('');

  const copiar = async (clave, texto) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(clave); setTimeout(() => setCopiado((c) => (c === clave ? '' : c)), 1800); } catch { /* sin portapapeles: el dato está a la vista */ }
  };
  const trabajar = async (accion, datos) => {
    setTrabajando(true);
    setError(null);
    try {
      const r = await onTrabajar(accion, datos);
      if (r?.ok) onClose(); else setError({ texto: r?.error || 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.', campo: r?.campo });
    } finally { setTrabajando(false); }
  };

  const pendiente = cobro.estado === ESTADO_COBRO.PENDIENTE;
  const pideMonto = !soloLectura && pendiente && !(Number(cobro.monto) > 0);
  const cambio = cobro.montoCambio;

  return (
    <Modal onClose={onClose} zIndexClass="z-[80]">
      <div role="dialog" aria-labelledby="cobro-titulo" className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="cobro-titulo" className="text-base font-black text-white">{cobro.codigo || 'S/C'}</h2>
              <span className={`whitespace-nowrap text-[11px] max-lg:text-xs leading-tight font-black px-2 py-0.5 rounded ${CLASE_ESTADO[cobro.estado] || ''}`}>{ETIQUETA_ESTADO_COBRO[cobro.estado] || cobro.estado}</span>
            </div>
            <p className="text-xs font-bold text-zinc-300 truncate">{cobro.nombre}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {cambio && (
            <div role="alert" className="rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
              <p className="flex items-start gap-2 text-sm font-black text-amber-900 dark:text-amber-200"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> {cambio.nuevo ? 'El monto de la orden cambió' : 'La orden se canceló o dejó de tener cobro'}</p>
              <p className="text-xs text-amber-900 dark:text-amber-200">Estaba cargado en el portal con <span className="font-bold">{textoDeMonto(cambio.anterior)}</span>{cambio.nuevo ? <> y ahora es <span className="font-bold">{textoDeMonto(cambio.nuevo)}</span>. Corrígelo en el portal y confírmalo aquí.</> : '. Retíralo del portal y confírmalo aquí.'}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Dato copiado={copiado} onCopiar={copiar} clave="orden" etiqueta="Orden" valor={cobro.codigo || 'S/C'} />
            <Dato copiado={copiado} onCopiar={copiar} clave="monto" etiqueta="Monto a cobrar" valor={Number(cobro.monto) > 0 ? textoDeCobro(cobro) : ''} />
            <div className="col-span-2"><Dato copiado={copiado} onCopiar={copiar} clave="cliente" etiqueta="Cliente" valor={cobro.nombre} /></div>
            <Dato copiado={copiado} onCopiar={copiar} clave="cedula" etiqueta="Cédula" valor={cobro.cedula ? formatCedula(cobro.cedula) : ''} />
            <div className="col-span-2">
              <Dato copiado={copiado} onCopiar={copiar} clave="telefono" etiqueta="Teléfono del cliente" valor={cobro.telefono} copiable={false}>
                <TelefonoAccion telefono={cobro.telefono} tipo="llamar" nombre={cobro.nombre} className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" />
                <button type="button" onClick={() => copiar('telefono', cobro.telefono)} className="max-lg:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">{copiado === 'telefono' ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />} {copiado === 'telefono' ? 'Copiado' : 'Copiar'}</button>
                <TelefonoAccion telefono={cobro.telefono} tipo="chat" nombre={cobro.nombre} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors" />
              </Dato>
            </div>
            <Dato copiado={copiado} onCopiar={copiar} clave="trabajo" etiqueta="Trabajo" valor={[cobro.tipoTrabajo, cobro.falla].filter(Boolean).join(' · ')} copiable={false} />
            <Dato copiado={copiado} onCopiar={copiar} clave="tecnico" etiqueta="Técnico" valor={cobro.tecnico} copiable={false} />
            <Dato copiado={copiado} onCopiar={copiar} clave="emitido" etiqueta="Emitido" valor={`${fechaHora(cobro.creadoEn)}${pendiente ? ` · ${diasEsperando(cobro)} d esperando` : ''}`} copiable={false} />
            {!pendiente && <Dato copiado={copiado} onCopiar={copiar} clave="cargado" etiqueta="Cargado en el portal" valor={`${cobro.cargadoPor} · ${fechaHora(cobro.cargadoEn)}`} copiable={false} />}
          </div>

          {!soloLectura && <Boton variante="secundario" tamano="normal" icono={copiado === 'todo' ? Check : Copy} onClick={() => copiar('todo', textoParaCopiar(cobro))}>{copiado === 'todo' ? 'Copiado' : 'Copiar todos los datos'}</Boton>}

          <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <summary className="px-3 py-2 text-xs font-black tracking-wide text-zinc-700 dark:text-zinc-300 cursor-pointer">HISTORIAL ({(cobro.historial || []).length})</summary>
            <ul className="px-3 pb-2 space-y-1.5">
              {[...(cobro.historial || [])].reverse().map((h, i) => (
                <li key={`${h.en}-${i}`} className="text-xs text-zinc-700 dark:text-zinc-300 break-words"><span className="font-bold">{fechaHora(h.en)} · {h.por}:</span> {h.detalle}</li>
              ))}
            </ul>
          </details>

          {pideMonto && (
            <div className="space-y-2 rounded-lg border border-zinc-300 dark:border-zinc-700 p-3">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Esta instalación no trae monto: escribe el que subes al portal.</p>
              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <label htmlFor="cobro-monto" className={ETIQUETA}>Monto</label>
                  <input id="cobro-monto" value={monto} onChange={(e) => { setMonto(stripEmojis(e.target.value).replace(/[^\d,]/g, '')); setError(null); }} inputMode="decimal" autoComplete="off" placeholder="Ej. 45 o 45,50" aria-invalid={error?.campo === 'monto'} className={`${CAMPO_FORMULARIO} mt-1`} />
                </div>
                <SelectMenu ariaLabel="Moneda del monto" className={SELECTOR} value={moneda} onChange={(v) => { setMoneda(v); setError(null); }} items={[{ value: 'USD', label: 'Dólares ($)' }, { value: 'BS', label: 'Bolívares (Bs)' }]} />
              </div>
            </div>
          )}

          <Colapsable>{error && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold">{error.texto}</p>}</Colapsable>

          {!soloLectura && (
          <div className="space-y-2">
            {cambio && <Boton variante="principal" tamano="grande" icono={CheckCircle2} className="w-full" onClick={() => trabajar('confirmar')} disabled={trabajando}>{trabajando ? <Spinner /> : null} Ya lo corregí en el portal</Boton>}
            {pendiente && <Boton variante="principal" tamano="grande" icono={CheckCircle2} className="w-full" onClick={() => trabajar('cargar', { monto, moneda })} disabled={trabajando}>{trabajando ? <Spinner /> : null} Marcar como cargado en el portal</Boton>}
            {!pendiente && <Boton variante="secundario" tamano="grande" icono={Undo2} className="w-full" onClick={() => trabajar('devolver')} disabled={trabajando}>{trabajando ? <Spinner /> : null} Devolver a pendiente</Boton>}
          </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
