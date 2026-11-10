import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ETIQUETA } from './estilos';
import { formatoMontoBs, textoMonto } from '../utils/cobro';
import { TIPO_PAGO, avisosDePago, lineaDePago, pagoClienteDe, pagoVisibleEnFinanzas } from '../utils/pagoEnOrden';

const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');

// Verde: el pago está registrado y cuadra. Ámbar: pide atención (el cliente paga después, otra moneda u otro monto). Azul: pagó junto con otra orden.
const TONO = {
  ok: { linea: 'text-emerald-800 dark:text-emerald-300', caja: 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  atencion: { linea: 'text-amber-800 dark:text-amber-300', caja: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' },
  info: { linea: 'text-sky-800 dark:text-sky-300', caja: 'border-sky-600 bg-sky-50 dark:bg-sky-950/30' },
};
const tonoDe = (p) => (p.tipo === TIPO_PAGO.JUNTO ? 'info' : p.tipo === TIPO_PAGO.DESPUES || avisosDePago(p).length > 0 ? 'atencion' : 'ok');
const TAMANO = { normal: 'text-xs', compacto: 'text-[11px] max-lg:text-xs', grande: 'text-sm' };

// Referencia del pago con su botón para copiarla (para buscarla en el banco o pegarla donde haga falta).
function FilaCopiable({ etiqueta, valor }) {
  const [copiado, setCopiado] = useState(false);
  if (!valor) return null;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(String(valor)); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sin portapapeles: la referencia está a la vista */ }
  };
  return (
    <div className="min-w-0">
      <p className={ETIQUETA}>{etiqueta}</p>
      <div className="mt-0.5 flex items-center justify-between gap-3">
        <p className="min-w-0 text-base font-black tracking-wide text-zinc-900 dark:text-white break-all">{valor}</p>
        <button type="button" onClick={copiar} aria-label={`Copiar ${etiqueta.toLowerCase()}`} className="shrink-0 inline-flex items-center justify-center gap-1.5 h-10 min-w-[6.25rem] px-3 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
          {copiado ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />} {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

function Fila({ etiqueta, children }) {
  if (!children && children !== 0) return null;
  return (
    <div className="min-w-0">
      <p className={ETIQUETA}>{etiqueta}</p>
      <p className="text-sm font-bold text-zinc-900 dark:text-white break-words">{children}</p>
    </div>
  );
}

// Los datos de un pago ({ tipo, pago, nota, compartidoCon, monedaDistinta, diferencia }, ver utils/pagoEnOrden), uno por uno: el monto grande y debajo la forma de pago, el banco, el titular, la referencia, la
// cuenta de la empresa donde llegó, cuándo se pagó y la nota. La usan el detalle del pago en cada pantalla y la confirmación del técnico antes de registrarlo.
export function FichaDelPago({ pago: p, copiable = false }) {
  if (!p) return null;
  const avisos = avisosDePago(p);
  return (
    <div className="space-y-2.5">
      {p.tipo === TIPO_PAGO.PAGO ? (
        <>
          <p className="text-2xl font-black text-zinc-900 dark:text-white leading-tight break-words">{textoMonto(formatoMontoBs(Number(p.pago.monto) || 0), p.pago.moneda)}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Fila etiqueta="Forma de pago">{p.pago.forma}</Fila>
            <Fila etiqueta="Banco">{p.pago.banco}</Fila>
            <Fila etiqueta="Titular de la cuenta">{p.pago.titular}</Fila>
            <div className={copiable ? 'col-span-2 min-w-0' : 'min-w-0'}>{copiable ? <FilaCopiable etiqueta="Referencia" valor={p.pago.referencia} /> : <Fila etiqueta="Referencia">{p.pago.referencia}</Fila>}</div>
            <div className="col-span-2 min-w-0"><Fila etiqueta="Cuenta de la empresa">{p.pago.cuentaEmpresa}</Fila></div>
            <div className="col-span-2 min-w-0"><Fila etiqueta="Pagado el">{fechaHora(p.pago.pagadoEn)}</Fila></div>
          </div>
        </>
      ) : (
        <p className="text-base font-black text-zinc-900 dark:text-white break-words">{lineaDePago(p)}</p>
      )}
      {avisos.map((a) => <p key={a} role="status" className="text-xs font-bold text-amber-800 dark:text-amber-300">{a}</p>)}
      {p.nota && <div className="min-w-0"><Fila etiqueta={p.tipo === TIPO_PAGO.PAGO ? 'Nota del técnico' : 'Nota'}>{p.nota}</Fila></div>}
    </div>
  );
}

// El pago que el técnico registró por una orden o un cobro (ver utils/pagoEnOrden), sin ícono: una línea para las listas o, con `bloque`, una caja con todos sus datos para los detalles.
// No muestra nada si no hay pago. `tamano`: 'normal', 'compacto' (tablas: dos líneas como máximo, el texto completo en el título) o 'grande' (tarjetas del celular).
// `paraFinanzas`: en Finanzas solo se ve el pago de las instalaciones y los cambios de equipo (lo mismo que Finanzas ya ve de los pagos de clientes); en las demás órdenes no se muestra.
export default function PagoDelCliente({ orden, bloque = false, tamano = 'normal', paraFinanzas = false, className = '' }) {
  const p = pagoClienteDe(orden);
  if (!p || (paraFinanzas && !pagoVisibleEnFinanzas(orden))) return null;
  const tono = TONO[tonoDe(p)];
  if (bloque) {
    return (
      <div className={`rounded-xl border px-3 py-2.5 ${tono.caja} ${className}`}>
        <p className="text-sm font-black text-zinc-900 dark:text-white">Pago del cliente <span className="font-bold text-zinc-700 dark:text-zinc-300">(registrado por {orden.tecnico || p.registradoPor || 'el técnico'})</span></p>
        <div className="mt-2"><FichaDelPago pago={p} copiable /></div>
        <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
          {p.registradoEn ? `Registrado el ${fechaHora(p.registradoEn)}` : ''}
          {p.corregidoPor ? ` · Corregido por ${p.corregidoPor}${p.corregidoEn ? ` · ${fechaHora(p.corregidoEn)}` : ''}` : ''}
        </p>
      </div>
    );
  }
  const texto = [p.tipo === TIPO_PAGO.PAGO ? `Pagó: ${lineaDePago(p)}` : lineaDePago(p), p.nota && `Nota: ${p.nota}`].filter(Boolean).join(' · ');
  return (
    <div className={`min-w-0 break-words font-semibold ${TAMANO[tamano]} ${tono.linea} ${tamano === 'compacto' ? 'line-clamp-2' : ''} ${className}`} title={tamano === 'compacto' ? texto : undefined}>
      {texto}
    </div>
  );
}
