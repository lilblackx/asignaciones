import { Check, Copy, X } from 'lucide-react';
import { useState } from 'react';
import Modal from '../Modal';
import TelefonoAccion from '../TelefonoAccion';
import { ETIQUETA } from '../estilos';
import { formatCedula } from '../../utils/ticketDisplay';
import { formatoMontoBs, textoMonto } from '../../utils/cobro';
import { CLASE_PAGO_FINANZAS, ETIQUETA_PAGO_FINANZAS, textoPago } from '../../utils/pagoCliente';

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

// Un pago que el técnico registró (historial: desde que los cobros pasaron a Administración ya no se registran pagos), con todos sus datos y en solo lectura. Lo ve Finanzas, siempre como "Registrado".
export default function PagoRegistradoModal({ pago, onClose }) {
  const [numeroCopiado, setNumeroCopiado] = useState(false);
  // En PC no hay teléfono para llamar: se ofrece copiar el número ("Chat" abre WhatsApp Web o la app de escritorio).
  const copiarNumero = async () => {
    try { await navigator.clipboard.writeText(pago.telefono); setNumeroCopiado(true); setTimeout(() => setNumeroCopiado(false), 1800); } catch { /* sin portapapeles: el número está a la vista */ }
  };
  const cobro = pago.cobro;

  return (
    <Modal onClose={onClose} zIndexClass="z-[80]">
      <div role="dialog" aria-labelledby="pago-titulo" className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="pago-titulo" className="text-base font-black text-white">{pago.codigo || 'S/C'}</h2>
              <span className={`whitespace-nowrap text-[11px] max-lg:text-xs leading-tight font-black px-2 py-0.5 rounded ${CLASE_PAGO_FINANZAS}`}>{ETIQUETA_PAGO_FINANZAS}</span>
            </div>
            <p className="text-xs font-bold text-zinc-300 truncate">{pago.nombre}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
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
            <Dato etiqueta="Registrado">{fechaHora(pago.creadoEn)}</Dato>
          </div>

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
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900/60 p-3">
              <p className="text-sm font-black text-amber-900 dark:text-amber-200">{pago.compartidoCon ? `Pagó junto con la orden ${pago.compartidoCon.codigo}` : 'El cliente iba a pagar después'}</p>
              <p className="text-xs text-amber-900 dark:text-amber-200">El técnico no registró datos del pago.</p>
            </div>
          )}

          {pago.nota && <Dato etiqueta="Nota del técnico">{pago.nota}</Dato>}

          <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <summary className="px-3 py-2 text-xs font-black tracking-wide text-zinc-700 dark:text-zinc-300 cursor-pointer">HISTORIAL ({(pago.historial || []).length})</summary>
            <ul className="px-3 pb-2 space-y-1.5">
              {[...(pago.historial || [])].reverse().map((h, i) => (
                <li key={`${h.en}-${i}`} className="text-xs text-zinc-700 dark:text-zinc-300 break-words"><span className="font-bold">{fechaHora(h.en)} · {h.por}:</span> {h.detalle}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </Modal>
  );
}
