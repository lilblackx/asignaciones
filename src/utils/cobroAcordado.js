// Cobro acordado con el cliente al crear la orden: lo que la oficina habló con el cliente (visita técnica, un monto, exonerada) y una nota,
// para que quien finaliza la orden sepa qué se acordó aunque no sea quien la creó. Se guarda en `ticket.cobroAcordado` y solo lo escribe y
// lo ve la oficina (ADMIN y USUARIO; el técnico no lo puede cambiar). No es el cobro final: al finalizar el selector de cobro viene con esto
// ya elegido y se puede cambiar (ver cobroInicialDeOrden).
//
//   cobroAcordado: { modo: 'VISITA_TECNICA' | 'OTRO_MONTO' | 'EXONERADO' | 'PAGADA' | '', monto, moneda, nota, pago?, por, en }
//     modo ''   sin definir (solo hay una nota)
//     monto     solo con OTRO_MONTO y PAGADA, ya formateado ("5.696" o "30"); moneda 'BS' o 'USD'
//     pago      solo con PAGADA: el pago que el cliente ya hizo al acordar el trabajo, con los datos de siempre ({ moneda, forma, monto, banco, titular, cuentaEmpresa, referencia, pagadoEn });
//               la nota de un pago PAGADA es la del propio pago. Al finalizar, el cobro se abre con ese monto y Revisión lo ofrece para registrar el pago.
//     nota      texto libre de la oficina (hasta MAX_NOTA letras)
//     por, en   quién lo anotó y cuándo (los pone la app al guardar)
//
// El formulario trabaja con texto (`cobroSel`: { modo, otro, moneda, nota, pagada? }); resolverCobroAcordado lo convierte a lo que se guarda. `pagada` ({ pago, nota }, lo que devuelve parsePagoCliente) es el pago
// de un cobro "Pagada": al crear lo entrega el formulario de pago; al editar es el que ya tenía la orden.
import { COBRO_EXONERADO, COBRO_INICIAL, COBRO_OTRO, COBRO_VISITA, ETIQUETA_COBRO, MONEDA_BS, MONEDA_USD, formatoMontoBs, parseMontoBs, textoMonto } from './cobro.js';
import { montoParaCampo } from './montoCalculadora.js';
import { esTipoGarantia } from './garantia.js';
import { etiquetaTipoVisita } from './tipoVisita.js';

export const MAX_NOTA_COBRO = 200;
export const SIN_DEFINIR = '';
export const COBRO_PAGADA = 'PAGADA';
export const MODOS_ACORDADOS = [COBRO_VISITA, COBRO_OTRO, COBRO_EXONERADO, COBRO_PAGADA];

export const COBRO_SEL_INICIAL = { modo: SIN_DEFINIR, otro: '', moneda: MONEDA_BS, nota: '' };

const limpiarNota = (raw) => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTA_COBRO);

// El cobro acordado de una orden, o null si no tiene (o no es válido).
export function cobroAcordadoDe(t) {
  const c = t?.cobroAcordado;
  if (!c || typeof c !== 'object') return null;
  const modo = MODOS_ACORDADOS.includes(c.modo) ? c.modo : SIN_DEFINIR;
  const nota = limpiarNota(c.nota);
  if (!modo && !nota) return null;
  const conMonto = modo === COBRO_OTRO || modo === COBRO_PAGADA;
  const pago = modo === COBRO_PAGADA && c.pago && typeof c.pago === 'object' ? { ...c.pago } : null;
  return { modo, monto: conMonto ? String(c.monto ?? '') : '', moneda: conMonto && c.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS, nota, ...(pago ? { pago } : {}), por: String(c.por || ''), en: Number(c.en) || 0 };
}

// La orden -> el formulario (texto). "Otro monto" se muestra como lo escribe la calculadora ("5.696,00").
export function formularioCobroAcordado(t) {
  const c = cobroAcordadoDe(t);
  if (!c) return { ...COBRO_SEL_INICIAL };
  const numero = Number(String(c.monto).replace(/\./g, '').replace(',', '.'));
  return { modo: c.modo, otro: c.modo === COBRO_OTRO ? montoParaCampo(numero) : '', moneda: c.moneda, nota: c.nota, ...(c.pago ? { pagada: { pago: c.pago, nota: c.nota } } : {}) };
}

// El formulario -> { valor } con lo que se guarda (null si no se acordó nada), o { error } si el monto no es válido. Con "Pagada" y todavía sin los datos del pago devuelve { valor: null, falta: true }
// (el formulario de pago los entrega al guardar: ver CreateTicketModal).
export function resolverCobroAcordado(sel, pagada = null) {
  const modo = MODOS_ACORDADOS.includes(sel?.modo) ? sel.modo : SIN_DEFINIR;
  const nota = limpiarNota(sel?.nota);
  if (modo === COBRO_PAGADA) {
    const datos = pagada || sel?.pagada;
    if (!datos?.pago) return { valor: null, falta: true };
    return { valor: { modo, monto: formatoMontoBs(datos.pago.monto), moneda: datos.pago.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS, nota: limpiarNota(datos.nota), pago: datos.pago } };
  }
  if (modo === COBRO_OTRO) {
    const monto = parseMontoBs(sel.otro);
    if (monto.error) return { error: monto.error };
    return { valor: { modo, monto: formatoMontoBs(monto.valor), moneda: sel.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS, nota } };
  }
  if (!modo && !nota) return { valor: null };
  return { valor: { modo, monto: '', moneda: MONEDA_BS, nota } };
}

// ¿Dos cobros acordados dicen lo mismo? (sin contar quién ni cuándo)
export const mismoCobroAcordado = (a, b) => {
  const x = cobroAcordadoDe({ cobroAcordado: a });
  const y = cobroAcordadoDe({ cobroAcordado: b });
  if (!x || !y) return !x && !y;
  return x.modo === y.modo && x.monto === y.monto && x.moneda === y.moneda && x.nota === y.nota && JSON.stringify(x.pago || null) === JSON.stringify(y.pago || null);
};

// Lo que se guarda en la orden: si no cambió respecto a lo que ya tenía se conserva tal cual (con quién y cuándo); si cambió, se sella con quién y cuándo.
export function sellarCobroAcordado(nuevo, previo, { por, en = Date.now() } = {}) {
  if (!nuevo) return null;
  if (mismoCobroAcordado(nuevo, previo)) return cobroAcordadoDe({ cobroAcordado: previo });
  return { ...nuevo, por: String(por || ''), en };
}

// "Visita técnica", "30 $", "Exonerada" ('' si no hay modo). Sin la nota.
export function textoModoAcordado(c) {
  if (!c?.modo) return '';
  if (c.modo === COBRO_OTRO) return textoMonto(c.monto, c.moneda);
  if (c.modo === COBRO_PAGADA) return ['Pagada', textoMonto(c.monto, c.moneda), c.pago?.forma].filter(Boolean).join(' · ');
  return c.modo === COBRO_EXONERADO ? 'Exonerada' : ETIQUETA_COBRO[c.modo];
}

// Para el historial y las listas: "Exonerada · revisión de equipos".
export function textoCobroAcordado(c) {
  if (!c) return '';
  return [textoModoAcordado(c), c.nota].filter(Boolean).join(' · ');
}

// El selector de cobro de quien finaliza se abre con lo acordado ya elegido (la nota no se copia); sin lo acordado, como siempre.
export function cobroInicialDeOrden(t) {
  const c = cobroAcordadoDe(t);
  if (!c?.modo) return { ...COBRO_INICIAL };
  // Una orden "Pagada" se cobra por el monto que el cliente ya pagó.
  if (c.modo === COBRO_PAGADA) return { modo: COBRO_OTRO, otro: montoParaCampo(Number(String(c.monto).split('.').join('').replace(',', '.'))), moneda: c.moneda };
  return { modo: c.modo, otro: c.modo === COBRO_OTRO ? formularioCobroAcordado(t).otro : '', moneda: c.moneda };
}

// ¿La orden es una garantía? Normalmente no se cobra: el selector de cobro lo sugiere (sin bloquear nada).
export const sugiereExonerar = (t) => esTipoGarantia(t?.tipoTrabajo);

// Aviso para quien finaliza cuando el técnico reportó un tipo de visita distinto: lo acordado se habló para lo que se creyó que era el trabajo.
// '' si no hay nada que avisar (sin cobro acordado con modo, o el técnico no reportó un tipo de visita).
export function avisoCambioDeTrabajo(t) {
  const c = cobroAcordadoDe(t);
  if (!c?.modo || !t?.tipoVisita) return '';
  return `El técnico reportó "${etiquetaTipoVisita(t.tipoVisita)}". Confirma que lo acordado (${textoModoAcordado(c)}) sigue aplicando para este trabajo.`;
}
