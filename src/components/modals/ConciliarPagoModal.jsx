import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Ban, Check, CheckCircle2, Copy, Pencil, Undo2, X } from 'lucide-react';
import Modal from '../Modal';
import Boton from '../Boton';
import Colapsable from '../Colapsable';
import FormularioPagoCliente from '../FormularioPagoCliente';
import Spinner from '../Spinner';
import TelefonoAccion from '../TelefonoAccion';
import { AREA_TEXTO, ETIQUETA } from '../estilos';
import { formatCedula } from '../../utils/ticketDisplay';
import { formatoMontoBs, textoMonto } from '../../utils/cobro';
import { ESTADO_PAGO, ETIQUETA_ESTADO_PAGO, diasEsperando, textoPago } from '../../utils/pagoCliente';
import { stripEmojis } from '../../utils/sanitizeInput';

const CLASE_ESTADO = {
  PENDIENTE_COBRO: 'bg-amber-400 text-black',
  POR_CONCILIAR: 'bg-sky-700 text-white',
  CONCILIADO: 'bg-emerald-700 text-white',
  SIN_COBRAR: 'bg-red-600 text-white',
};

const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-');

function Dato({ etiqueta, children }) {
  if (!children && children !== 0) return null;
  return (
    <div className="min-w-0">
      <p className={ETIQUETA}>{etiqueta}</p>
      <p className="text-sm font-bold text-zinc-900 dark:text-white break-words">{children}</p>
    </div>
  );
}

// La ventana de un pago de un cliente para ADMINISTRACION (y el ADMIN): sus datos, el historial y lo que se puede hacer según su estado.
//   - Pendiente de cobro (o sin cobrar): cobrarlo y conciliarlo registrando los datos del pago, o marcarlo sin cobrar.
//   - Por conciliar: conciliarlo tal cual, corregir sus datos o marcarlo sin cobrar.
//   - Conciliado: corregir sus datos o devolverlo a por conciliar.
// `onTrabajar(accion, { valor, nota })` devuelve { ok } o { error, campo }; accion: 'conciliar' | 'corregir' | 'sinCobrar' | 'devolver'.
export default function ConciliarPagoModal({ pago, cuentasEmpresa, onTrabajar, onClose }) {
  const [vista, setVista] = useState('detalle'); // 'detalle' | 'cobrar' | 'corregir' | 'sinCobrar' | 'devolver'
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [numeroCopiado, setNumeroCopiado] = useState(false);
  // En PC no hay teléfono para llamar: se ofrece copiar el número ("Chat" abre WhatsApp Web o la app de escritorio).
  const copiarNumero = async () => {
    try { await navigator.clipboard.writeText(pago.telefono); setNumeroCopiado(true); setTimeout(() => setNumeroCopiado(false), 1800); } catch { /* sin portapapeles: el número está a la vista */ }
  };

  const sinDatos = !pago.pago;
  const hecho = async (accion, datos) => {
    const r = await onTrabajar(accion, datos);
    if (r?.ok) onClose();
    return r;
  };
  const conciliarTalCual = async () => {
    setTrabajando(true);
    setError('');
    try {
      const r = await onTrabajar('conciliar', { nota });
      if (r?.ok) onClose(); else setError(r?.error || 'No se pudo conciliar.');
    } finally { setTrabajando(false); }
  };
  const marcarSinCobrar = async () => {
    if (!nota.trim()) { setError('Escribe por qué no se cobró.'); return; }
    setTrabajando(true);
    setError('');
    try {
      const r = await onTrabajar('sinCobrar', { nota });
      if (r?.ok) onClose(); else setError(r?.error || 'No se pudo marcar.');
    } finally { setTrabajando(false); }
  };

  const devolver = async () => {
    if (!nota.trim()) { setError('Escribe por qué se devuelve.'); return; }
    setTrabajando(true);
    setError('');
    try {
      const r = await onTrabajar('devolver', { nota });
      if (r?.ok) onClose(); else setError(r?.error || 'No se pudo devolver.');
    } finally { setTrabajando(false); }
  };

  const volver = () => { setVista('detalle'); setError(''); setNota(''); };
  const cobro = pago.cobro;

  return (
    <Modal onClose={onClose} zIndexClass="z-[80]">
      <div role="dialog" aria-labelledby="conciliar-titulo" className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="conciliar-titulo" className="text-base font-black text-white">{pago.codigo || 'S/C'}</h2>
              <span className={`whitespace-nowrap text-[11px] max-lg:text-xs leading-tight font-black px-2 py-0.5 rounded ${CLASE_ESTADO[pago.estado] || ''}`}>{ETIQUETA_ESTADO_PAGO[pago.estado] || pago.estado}</span>
            </div>
            <p className="text-xs font-bold text-zinc-300 truncate">{pago.nombre}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {vista === 'detalle' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Dato etiqueta="Cliente">{pago.nombre}</Dato>
                <Dato etiqueta="Cédula">{pago.cedula ? formatCedula(pago.cedula) : ''}</Dato>
                <div className="col-span-2 min-w-0">
                  <p className={ETIQUETA}>Teléfono del cliente</p>
                  {pago.telefono && (
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white break-words">{pago.telefono}</span>
                      <TelefonoAccion telefono={pago.telefono} tipo="llamar" nombre={pago.nombre} className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" />
                      <button type="button" onClick={copiarNumero} className="max-lg:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">{numeroCopiado ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />} {numeroCopiado ? 'Copiado' : 'Copiar'}</button>
                      <TelefonoAccion telefono={pago.telefono} tipo="chat" nombre={pago.nombre} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors" />
                    </div>
                  )}
                </div>
                <Dato etiqueta="Técnico">{pago.tecnico}</Dato>
                <Dato etiqueta="Trabajo">{[pago.tipoTrabajo, pago.falla].filter(Boolean).join(' · ')}</Dato>
                <Dato etiqueta="Cobro de la orden">{cobro ? textoMonto(formatoMontoBs(cobro.monto), cobro.moneda) : 'Sin cobro (instalación)'}</Dato>
                <Dato etiqueta="Registrado">{fechaHora(pago.creadoEn)}{pago.estado === ESTADO_PAGO.PENDIENTE ? ` · ${diasEsperando(pago)} d esperando` : ''}</Dato>
              </div>

              {(pago.monedaDistinta || pago.diferencia) && (
                <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{pago.monedaDistinta ? 'El cliente pagó en otra moneda que la del cobro.' : 'El monto pagado es distinto al cobro.'}</span>
                </div>
              )}

              {pago.pago ? (
                <div className="rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
                  <p className={ETIQUETA}>Pago que registró el técnico</p>
                  <p className="text-base font-black text-zinc-900 dark:text-white break-words">{textoPago(pago.pago)}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {pago.pago.titular && <Dato etiqueta="Titular de la cuenta">{pago.pago.titular}</Dato>}
                    <Dato etiqueta="Cuenta de la empresa">{pago.pago.cuentaEmpresa}</Dato>
                    <Dato etiqueta="Pagado el">{fechaHora(pago.pago.pagadoEn)}</Dato>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900/60 p-3 space-y-1">
                  <p className="text-sm font-black text-amber-900 dark:text-amber-200">{pago.compartidoCon ? `Pagó junto con la orden ${pago.compartidoCon.codigo}` : 'El cliente paga después'}</p>
                  <p className="text-xs text-amber-900 dark:text-amber-200">Hay que cobrarlo y registrar los datos del pago.</p>
                </div>
              )}

              {pago.nota && <Dato etiqueta="Nota del técnico">{pago.nota}</Dato>}
              {pago.notaAdministracion && <Dato etiqueta="Nota de Administración">{pago.notaAdministracion}</Dato>}
              {(pago.estado === ESTADO_PAGO.CONCILIADO || pago.estado === ESTADO_PAGO.SIN_COBRAR) && pago.conciliadoPor && <Dato etiqueta={pago.estado === ESTADO_PAGO.CONCILIADO ? 'Conciliado por' : 'Marcado sin cobrar por'}>{pago.conciliadoPor} · {fechaHora(pago.conciliadoEn)}</Dato>}

              <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                <summary className="px-3 py-2 text-xs font-black tracking-wide text-zinc-700 dark:text-zinc-300 cursor-pointer">HISTORIAL ({(pago.historial || []).length})</summary>
                <ul className="px-3 pb-2 space-y-1.5">
                  {[...(pago.historial || [])].reverse().map((h, i) => (
                    <li key={`${h.en}-${i}`} className="text-xs text-zinc-700 dark:text-zinc-300 break-words"><span className="font-bold">{fechaHora(h.en)} · {h.por}:</span> {h.detalle}</li>
                  ))}
                </ul>
              </details>

              <Colapsable>{error && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold">{error}</p>}</Colapsable>

              <div className="space-y-2">
                {sinDatos ? (
                  <Boton variante="principal" tamano="grande" icono={CheckCircle2} className="w-full" onClick={() => setVista('cobrar')}>Cobrar y conciliar</Boton>
                ) : pago.estado === ESTADO_PAGO.POR_CONCILIAR ? (
                  <>
                    <div>
                      <label htmlFor="conciliar-nota" className={ETIQUETA}>Nota <span className="font-normal">(opcional)</span></label>
                      <textarea id="conciliar-nota" value={nota} onChange={(e) => setNota(stripEmojis(e.target.value))} maxLength={300} rows={2} className={`${AREA_TEXTO} mt-1`} />
                    </div>
                    <Boton variante="principal" tamano="grande" icono={CheckCircle2} className="w-full" onClick={conciliarTalCual} disabled={trabajando}>{trabajando ? <Spinner /> : null} Conciliar</Boton>
                  </>
                ) : null}
                {pago.pago && <Boton variante="secundario" tamano="grande" icono={Pencil} className="w-full" onClick={() => { setVista('corregir'); setError(''); }}>Corregir los datos del pago</Boton>}
                {pago.estado === ESTADO_PAGO.CONCILIADO && (
                  <Boton variante="secundario" tamano="grande" icono={Undo2} className="w-full" onClick={() => { setVista('devolver'); setError(''); setNota(''); }}>Devolver a por conciliar</Boton>
                )}
                {pago.estado !== ESTADO_PAGO.SIN_COBRAR && pago.estado !== ESTADO_PAGO.CONCILIADO && (
                  <Boton variante="peligro" tamano="grande" icono={Ban} className="w-full" onClick={() => { setVista('sinCobrar'); setError(''); setNota(''); }}>Marcar sin cobrar</Boton>
                )}
              </div>
            </>
          )}

          {vista === 'cobrar' && (
            <>
              <Boton variante="discreto" tamano="compacto" icono={ArrowLeft} onClick={volver}>Volver</Boton>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white">COBRAR Y CONCILIAR</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Registra los datos del pago que el cliente hizo. Si la referencia ya está en otra orden, puedes repetirla escribiendo en la nota por qué (un solo pago para varias órdenes).</p>
              <FormularioPagoCliente idPrefijo="adm-cobrar" cobro={cobro} cuentasEmpresa={cuentasEmpresa} guardarTexto="Conciliar con estos datos" onGuardar={(valor, n) => hecho('conciliar', { valor, nota: n })} />
            </>
          )}

          {vista === 'corregir' && (
            <>
              <Boton variante="discreto" tamano="compacto" icono={ArrowLeft} onClick={volver}>Volver</Boton>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white">CORREGIR LOS DATOS DEL PAGO</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Cambia lo que esté mal y escribe en la nota qué corregiste. Queda en el historial con tu nombre y la hora.</p>
              <FormularioPagoCliente idPrefijo="adm-corregir" cobro={cobro} cuentasEmpresa={cuentasEmpresa} valoresIniciales={pago.pago} notaObligatoria notaEtiqueta="¿Qué corregiste?" guardarTexto="Guardar la corrección" onGuardar={(valor, n) => hecho('corregir', { valor, nota: n })} />
            </>
          )}

          {vista === 'devolver' && (
            <>
              <Boton variante="discreto" tamano="compacto" icono={ArrowLeft} onClick={volver}>Volver</Boton>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white">DEVOLVER A POR CONCILIAR</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">El pago vuelve a la lista por conciliar con los mismos datos. Queda en el historial con tu nombre. Si es una instalación, Finanzas deja de ver el pago hasta que se concilie otra vez.</p>
              <div>
                <label htmlFor="devolver-nota" className={ETIQUETA}>Motivo (obligatorio)</label>
                <textarea id="devolver-nota" value={nota} onChange={(e) => { setNota(stripEmojis(e.target.value)); setError(''); }} maxLength={300} rows={3} className={`${AREA_TEXTO} mt-1`} />
              </div>
              <Colapsable>{error && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold">{error}</p>}</Colapsable>
              <Boton variante="principal" tamano="grande" icono={Undo2} className="w-full" onClick={devolver} disabled={trabajando}>{trabajando ? <Spinner /> : null} Devolver a por conciliar</Boton>
            </>
          )}

          {vista === 'sinCobrar' && (
            <>
              <Boton variante="discreto" tamano="compacto" icono={ArrowLeft} onClick={volver}>Volver</Boton>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white">MARCAR SIN COBRAR</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">El cliente no pagó. Sale de los pendientes. Escribe el motivo; si luego paga, puedes cobrarlo y conciliarlo desde aquí.</p>
              <div>
                <label htmlFor="sin-cobrar-nota" className={ETIQUETA}>Motivo (obligatorio)</label>
                <textarea id="sin-cobrar-nota" value={nota} onChange={(e) => { setNota(stripEmojis(e.target.value)); setError(''); }} maxLength={300} rows={3} className={`${AREA_TEXTO} mt-1`} />
              </div>
              <Colapsable>{error && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold">{error}</p>}</Colapsable>
              <Boton variante="peligro" tamano="grande" icono={Ban} className="w-full" onClick={marcarSinCobrar} disabled={trabajando}>{trabajando ? <Spinner /> : null} Marcar sin cobrar</Boton>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
