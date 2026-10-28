import { useState } from 'react';
import { CheckCircle2, PauseCircle, Pencil, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import BuscadorOrden from '../BuscadorOrden';
import SelectMenu from '../SelectMenu';
import Colapsable from '../Colapsable';
import { BOTON, BOTON_FILA, CAMPO, CHIP, ETIQUETA, SELECTOR, TEXTO_SUAVE } from '../finanzas/estilos';
import { CONCEPTOS_PAGO, aBs, bolivares, dolares } from '../../utils/finanzas';
import { ETIQUETA_REVISION, MAX_MOTIVO_REVISION, motivoNoAprobable } from '../../utils/revisionPagos';
import { parseMontoAjuste } from '../../utils/ajustes';
import { buscarOrdenesGarantia, datosGarantia } from '../../utils/garantia';
import { diaLegible } from '../../utils/periodoReporte';
import { stripEmojis } from '../../utils/sanitizeInput';
import Boton from '../Boton';
import Chip from '../Chip';
import InsigniaJM from '../InsigniaJM';

// Una orden en la revisión de pagos: lo que se paga por ella, su estado y las acciones del administrador (aprobar, retener, excluir, corregir o volver a pendiente). Retener y excluir
// piden un motivo y corregir deja elegir otro técnico y otro concepto: esos formularios se despliegan debajo de la fila. Una garantía de otro técnico (o cualquier orden, si la oficina olvidó marcarla) se
// resuelve en su propio formulario: se elige la orden original de la que se descuenta y el monto, o se deja sin descuento con un motivo. Una garantía sin resolver no se puede aprobar.
// `onAccion(item, accion, { motivo, correccion })` devuelve true si se guardó; `onDeshacer(item)`; `onVerOrden(item)`.
const CHIP_ESTADO = {
  PENDIENTE: 'bg-amber-400 text-black',
  APROBADA: 'bg-emerald-700 text-white',
  RETENIDA: 'bg-sky-700 text-white',
  EXCLUIDA: 'bg-red-600 text-white',
};

// `ordenesBusqueda`: las órdenes entre las que se busca la original; `precioOrigen(id)`: lo que cobra esa original (null si no se sabe); `tecnicoDe(orden)`: su técnico efectivo en la revisión.
export default function FilaRevision({ item, precio, tasa, tecnicos, ocupado, onAccion, onDeshacer, onVerOrden, ordenesBusqueda = [], precioOrigen = () => null, tecnicoDe = (o) => o.tecnico }) {
  const [abierto, setAbierto] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [correccion, setCorreccion] = useState({ tecnico: '', concepto: '' });
  // La decisión de la garantía: modo 'DESCONTAR' (con la original y el monto) o 'SIN' (con motivo).
  const [garantia, setGarantia] = useState({ modo: '', origen: null, monto: '', sinDescuento: '' });
  const [error, setError] = useState('');

  const estado = item.estadoRevision;
  const abrir = (que) => {
    setAbierto((a) => (a === que ? null : que));
    setMotivo('');
    setError('');
    setCorreccion({ tecnico: item.revision?.tecnicoCorregido || '', concepto: item.revision?.conceptoCorregido || '' });
    // Si la oficina marcó la garantía, la original ya viene elegida; si ya se había decidido, se ve lo decidido.
    const marcada = item.descuentoDe || item.garantiaDe;
    setGarantia({
      modo: item.descuento > 0 ? 'DESCONTAR' : item.garantiaSinDescuento ? 'SIN' : item.garantiaDe ? '' : 'DESCONTAR',
      origen: marcada ? { id: marcada.id, codigo: marcada.codigo, tecnico: item.descuentoDe ? marcada.tecnico : (ordenesBusqueda.find((o) => (o.id ?? `${o.codigo}-${o.createdAt}`) === marcada.id) ? tecnicoDe(ordenesBusqueda.find((o) => (o.id ?? `${o.codigo}-${o.createdAt}`) === marcada.id)) : marcada.tecnico), cliente: marcada.cliente || '' } : null,
      monto: item.descuento > 0 ? String(item.descuento).replace('.', ',') : '',
      sinDescuento: item.garantiaSinDescuento || '',
    });
  };
  const cerrar = () => { setAbierto(null); setMotivo(''); setError(''); };

  const confirmar = async (accion) => {
    const ok = await onAccion(item, accion, accion === 'CORREGIR' ? { correccion } : { motivo });
    if (ok === true) cerrar(); else if (typeof ok === 'string') setError(ok);
  };
  const guardarGarantia = async () => {
    let decision;
    if (garantia.modo === 'SIN') {
      decision = { sinDescuento: garantia.sinDescuento };
    } else if (garantia.modo === 'DESCONTAR') {
      if (!garantia.origen?.id) { setError('Elige la orden original de la que se descuenta.'); return; }
      const m = parseMontoAjuste(garantia.monto);
      if (m.error) { setError(m.error); return; }
      decision = { descuento: m.valor, origen: garantia.origen, tope: topeOrigen || 0 };
    } else {
      setError('Elige si se descuenta de la orden original o no.');
      return;
    }
    const ok = await onAccion(item, 'GARANTIA', { garantia: decision });
    if (ok === true) cerrar(); else if (typeof ok === 'string') setError(ok);
  };
  const aprobar = async () => {
    const r = await onAccion(item, 'APROBAR', {});
    if (typeof r === 'string') setError(r);
  };

  const topeOrigen = garantia.origen?.id ? precioOrigen(garantia.origen.id) : null;
  const problema = estado === 'APROBADA' ? '' : motivoNoAprobable(item);
  const esGarantiaDeOtro = Boolean(item.garantiaDe);
  const nombreConcepto = (id) => CONCEPTOS_PAGO.find((c) => c.id === id)?.nombre || '';
  const conceptos = [{ value: '', label: item.conceptoOriginal ? `Sin cambio (${nombreConcepto(item.conceptoOriginal)})` : 'Elige el concepto' }, ...CONCEPTOS_PAGO.map((c) => ({ value: c.id, label: c.nombre }))];
  const nombresTecnicos = [{ value: '', label: `Sin cambio (${item.tecnicoOriginal})` }, ...tecnicos.map((t) => ({ value: t, label: t }))];

  return (
    <li className="py-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-sm text-zinc-900 dark:text-zinc-100 break-words">
            <button type="button" onClick={() => onVerOrden(item)} aria-label={`Ver el detalle de la orden ${item.orden.codigo || 'sin código'}`} className="font-bold underline decoration-2 underline-offset-2 hover:text-red-600 dark:hover:text-red-400">{item.orden.codigo || 'S/C'}</button>
            {item.orden.nombre ? ` · ${item.orden.nombre}` : ''}
            <InsigniaJM orden={item.orden} className="ml-2" />
          </p>
          <p className={TEXTO_SUAVE}>{diaLegible(item.dia).slice(0, 5)} · {item.concepto ? nombreConcepto(item.concepto) : <span className="font-bold text-amber-700 dark:text-amber-300">Sin concepto: corrígela</span>}</p>
          {esGarantiaDeOtro && item.descuento <= 0 && !item.garantiaSinDescuento && <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Garantía de otro técnico: de la orden {item.garantiaDe.codigo || 's/c'} ({item.garantiaDe.tecnico}). Decide si se le descuenta algo antes de aprobarla.</p>}
          {esGarantiaDeOtro && item.garantiaSinDescuento && <p className="text-xs font-semibold text-sky-800 dark:text-sky-300">Garantía de {item.garantiaDe.codigo || 's/c'} ({item.garantiaDe.tecnico}) sin descuento: {item.garantiaSinDescuento}</p>}
          {item.descuento > 0 && item.descuentoDe && <p className="text-xs font-bold text-sky-800 dark:text-sky-300">Descuento de {dolares(item.descuento)} de la orden {item.descuentoDe.codigo || 's/c'} ({item.descuentoDe.tecnico}) por esta garantía: se le suma a {item.tecnico}.</p>}
          {item.corregida && <p className="text-xs font-semibold text-sky-800 dark:text-sky-300">Corregida: {[item.revision?.tecnicoCorregido && `técnico ${item.revision.tecnicoCorregido} (era ${item.tecnicoOriginal})`, item.revision?.conceptoCorregido && `concepto ${nombreConcepto(item.revision.conceptoCorregido)}${item.conceptoOriginal ? ` (era ${nombreConcepto(item.conceptoOriginal)})` : ''}`].filter(Boolean).join(' · ')}</p>}
          {item.cambioDespues && <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">La orden cambió después de revisarse: hay que revisarla otra vez.</p>}
          {item.revision?.motivo && <p className={TEXTO_SUAVE}>Motivo: {item.revision.motivo} · {item.revision.por}</p>}
          {estado === 'APROBADA' && item.revision && <p className={TEXTO_SUAVE}>Aprobada por {item.revision.por}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`${CHIP} ${CHIP_ESTADO[estado]}`}>{ETIQUETA_REVISION[estado]}</span>
          <span className="text-right">
            <span className="block text-sm font-bold tabular-nums text-zinc-900 dark:text-white">{dolares(precio)}</span>
            {tasa > 0 && <span className="block text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">{bolivares(aBs(precio, tasa))}</span>}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(estado === 'PENDIENTE' || estado === 'RETENIDA' || estado === 'EXCLUIDA') && (
          <button type="button" onClick={aprobar} disabled={ocupado || Boolean(problema)} title={problema || undefined} className={`${BOTON_FILA} !border-emerald-600 !text-emerald-700 dark:!text-emerald-300`}><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Aprobar</button>
        )}
        {(estado === 'PENDIENTE' || estado === 'APROBADA') && <button type="button" onClick={() => abrir('RETENER')} disabled={ocupado} className={BOTON_FILA}><PauseCircle className="w-4 h-4" aria-hidden="true" /> Retener</button>}
        {estado !== 'EXCLUIDA' && <button type="button" onClick={() => abrir('EXCLUIR')} disabled={ocupado} className={BOTON_FILA}><XCircle className="w-4 h-4" aria-hidden="true" /> Excluir</button>}
        {(estado === 'PENDIENTE' || estado === 'APROBADA') && (
          <button type="button" onClick={() => abrir('GARANTIA')} disabled={ocupado} className={`${BOTON_FILA} ${esGarantiaDeOtro && !item.garantiaResuelta ? '!border-amber-500 !bg-amber-100 !text-amber-900 dark:!bg-amber-900/30 dark:!text-amber-200' : ''}`}><ShieldAlert className="w-4 h-4" aria-hidden="true" /> {esGarantiaDeOtro && !item.garantiaResuelta ? 'Resolver garantía' : esGarantiaDeOtro ? 'Garantía' : 'Descuento por garantía'}</button>
        )}
        {estado !== 'EXCLUIDA' && estado !== 'RETENIDA' && <button type="button" onClick={() => abrir('CORREGIR')} disabled={ocupado} className={BOTON_FILA}><Pencil className="w-4 h-4" aria-hidden="true" /> Corregir</button>}
        {(estado !== 'PENDIENTE' || item.revision) && <button type="button" onClick={() => onDeshacer(item)} disabled={ocupado} className={BOTON_FILA}><RotateCcw className="w-4 h-4" aria-hidden="true" /> Volver a pendiente</button>}
      </div>
      {/* El aviso de la garantía sin resolver ya está arriba, con la orden original: no se repite. */}
      {problema && estado !== 'APROBADA' && !(esGarantiaDeOtro && !item.garantiaResuelta) && <p className="text-xs text-amber-800 dark:text-amber-300">{problema}</p>}
      {error && !abierto && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}

      <Colapsable>{(abierto === 'RETENER' || abierto === 'EXCLUIR') && (
        <div className="mt-1 rounded-lg border border-zinc-400 dark:border-zinc-700 p-3 space-y-3">
          <div>
            <label htmlFor={`motivo-${item.clave}`} className={ETIQUETA}>{abierto === 'RETENER' ? 'Por qué se retiene (no pasa a Finanzas por ahora)' : 'Por qué se excluye (no se paga)'}</label>
            <input id={`motivo-${item.clave}`} value={motivo} onChange={(e) => { setMotivo(stripEmojis(e.target.value)); setError(''); }} maxLength={MAX_MOTIVO_REVISION} autoComplete="off" className={`${CAMPO} mt-1`} />
            {error && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400 mt-1">{error}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton variante="principal" tamano="normal" type="button" onClick={() => confirmar(abierto)} disabled={ocupado}>{abierto === 'RETENER' ? 'Retener' : 'Excluir'}</Boton>
            <button type="button" onClick={cerrar} className={BOTON}>Cancelar</button>
          </div>
        </div>
      )}</Colapsable>

      <Colapsable>{abierto === 'CORREGIR' && (
        <div className="mt-1 rounded-lg border border-zinc-400 dark:border-zinc-700 p-3 space-y-3">
          <p className={TEXTO_SUAVE}>La corrección vale para Finanzas aunque la orden esté en un cierre. Si la orden estaba aprobada, vuelve a pendiente para aprobarla ya corregida.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className={ETIQUETA}>Técnico al que se le paga</p>
              <div className="mt-1"><SelectMenu id={`tec-${item.clave}`} ariaLabel="Técnico al que se le paga" className={SELECTOR} value={correccion.tecnico} onChange={(v) => setCorreccion((c) => ({ ...c, tecnico: v }))} items={nombresTecnicos} /></div>
            </div>
            <div>
              <p className={ETIQUETA}>Concepto con que se paga</p>
              <div className="mt-1"><SelectMenu id={`con-${item.clave}`} ariaLabel="Concepto con que se paga" className={SELECTOR} value={correccion.concepto} onChange={(v) => setCorreccion((c) => ({ ...c, concepto: v }))} items={conceptos} /></div>
            </div>
          </div>
          {error && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Boton variante="principal" tamano="normal" type="button" onClick={() => confirmar('CORREGIR')} disabled={ocupado}>Guardar corrección</Boton>
            <button type="button" onClick={cerrar} className={BOTON}>Cancelar</button>
          </div>
        </div>
      )}</Colapsable>

      <Colapsable>{abierto === 'GARANTIA' && (
        <div className="mt-1 rounded-lg border border-zinc-400 dark:border-zinc-700 p-3 space-y-3">
          <p className={TEXTO_SUAVE}>
            {esGarantiaDeOtro
              ? `La oficina marcó esta orden como garantía de la ${item.garantiaDe.codigo || 'orden'} (técnico ${item.garantiaDe.tecnico}). Decide si se le descuenta algo a ese técnico: el monto que escribas se le paga a ${item.tecnico} y la garantía no se paga como orden.`
              : `Si esta orden es una garantía de otro técnico y la oficina olvidó marcarla, elige aquí la orden original: el monto se le descuenta a su técnico y se le paga a ${item.tecnico}, y esta orden no se paga como orden.`}
            {item.estadoRevision === 'APROBADA' ? ' Como ya estaba aprobada, vuelve a pendiente para aprobarla con la nueva decisión.' : ''}
          </p>
          <div role="radiogroup" aria-label="Decisión de la garantía" className="flex flex-wrap gap-2">
            {[['DESCONTAR', 'Descontar de la orden original'], ['SIN', 'Sin descuento']].map(([id, texto]) => (
              <Chip activo={garantia.modo === id} key={id} type="button" role="radio" aria-checked={garantia.modo === id} onClick={() => { setGarantia((g) => ({ ...g, modo: id })); setError(''); }}>{texto}</Chip>
            ))}
          </div>
          {garantia.modo === 'DESCONTAR' && (
            <div className="space-y-3">
              <div>
                <p className={ETIQUETA}>Orden original de la que se descuenta</p>
                <BuscadorOrden
                  className="mt-1"
                  id={`origen-${item.clave}`}
                  etiqueta="Orden original de la que se descuenta"
                  valor={garantia.origen?.id ? garantia.origen : null}
                  onElegir={(o) => { setGarantia((g) => ({ ...g, origen: o ? { ...datosGarantia(o), tecnico: tecnicoDe(o) } : null })); setError(''); }}
                  buscar={(texto) => buscarOrdenesGarantia(ordenesBusqueda.map((o) => ({ ...o, tecnico: tecnicoDe(o) })), texto, { idExcluido: item.clave, tecnico: item.tecnico, cedula: item.orden.cedula })}
                  detalle={(o) => o.tipoTrabajo || ''}
                  ayuda="Escribe el código, el cliente, la cédula o el técnico. Salen primero las órdenes del mismo cliente."
                />
                {garantia.origen?.id && <p className={`${TEXTO_SUAVE} mt-1`}>{topeOrigen > 0 ? `Esa orden cobra ${dolares(topeOrigen)}: el descuento no puede pasar de ahí.` : 'No se pudo calcular lo que cobra esa orden: revisa bien el monto.'} Si ya se le pagó, el monto se descuenta de su próximo pago.</p>}
              </div>
              <div className="max-w-xs">
                <label htmlFor={`monto-${item.clave}`} className={ETIQUETA}>Monto a descontar (en dólares)</label>
                <div className="relative mt-1">
                  <input id={`monto-${item.clave}`} value={garantia.monto} onChange={(e) => { setGarantia((g) => ({ ...g, monto: e.target.value.replace(/[^\d.,]/g, '') })); setError(''); }} inputMode="decimal" autoComplete="off" placeholder="0,00" className={`${CAMPO} pr-9 text-right tabular-nums`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base font-bold text-zinc-600 dark:text-zinc-300 pointer-events-none" aria-hidden="true">$</span>
                </div>
              </div>
            </div>
          )}
          {garantia.modo === 'SIN' && (
            <div>
              <label htmlFor={`sin-${item.clave}`} className={ETIQUETA}>Por qué no se descuenta nada</label>
              <input id={`sin-${item.clave}`} value={garantia.sinDescuento} onChange={(e) => { setGarantia((g) => ({ ...g, sinDescuento: stripEmojis(e.target.value) })); setError(''); }} maxLength={MAX_MOTIVO_REVISION} autoComplete="off" className={`${CAMPO} mt-1`} />
            </div>
          )}
          {error && <p role="alert" className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Boton variante="principal" tamano="normal" type="button" onClick={guardarGarantia} disabled={ocupado}>Guardar decisión</Boton>
            <button type="button" onClick={cerrar} className={BOTON}>Cancelar</button>
          </div>
        </div>
      )}</Colapsable>
    </li>
  );
}
