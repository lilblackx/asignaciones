// Cobro acordado con el cliente al crear la orden: lo que la oficina habló con el cliente (visita técnica, un monto, exonerada) y una nota,
// para que quien finaliza la orden sepa qué se acordó aunque no sea quien la creó. Se guarda en `ticket.cobroAcordado` y solo lo escribe y
// lo ve la oficina (ADMIN y USUARIO; el técnico no lo puede cambiar). No es el cobro final: al finalizar el selector de cobro viene con esto
// ya elegido y se puede cambiar (ver cobroInicialDeOrden).
//
//   cobroAcordado: { modo: 'VISITA_TECNICA' | 'OTRO_MONTO' | 'EXONERADO' | '', monto, moneda, nota, por, en }
//     modo ''   sin definir (solo hay una nota)
//     monto     solo con OTRO_MONTO, ya formateado ("5.696" o "30"); moneda 'BS' o 'USD'
//     nota      texto libre de la oficina (hasta MAX_NOTA letras)
//     por, en   quién lo anotó y cuándo (los pone la app al guardar)
//
// El formulario trabaja con texto (`cobroSel`: { modo, otro, moneda, nota }); resolverCobroAcordado lo convierte a lo que se guarda.
import { COBRO_EXONERADO, COBRO_INICIAL, COBRO_OTRO, COBRO_VISITA, ETIQUETA_COBRO, MONEDA_BS, MONEDA_USD, formatoMontoBs, parseMontoBs, textoMonto } from './cobro.js';
import { montoParaCampo } from './montoCalculadora.js';
import { esTipoGarantia } from './garantia.js';
import { etiquetaTipoVisita } from './tipoVisita.js';

export const MAX_NOTA_COBRO = 200;
export const SIN_DEFINIR = '';
export const MODOS_ACORDADOS = [COBRO_VISITA, COBRO_OTRO, COBRO_EXONERADO];

export const COBRO_SEL_INICIAL = { modo: SIN_DEFINIR, otro: '', moneda: MONEDA_BS, nota: '' };

const limpiarNota = (raw) => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTA_COBRO);

// El cobro acordado de una orden, o null si no tiene (o no es válido).
export function cobroAcordadoDe(t) {
  const c = t?.cobroAcordado;
  if (!c || typeof c !== 'object') return null;
  const modo = MODOS_ACORDADOS.includes(c.modo) ? c.modo : SIN_DEFINIR;
  const nota = limpiarNota(c.nota);
  if (!modo && !nota) return null;
  return { modo, monto: modo === COBRO_OTRO ? String(c.monto ?? '') : '', moneda: modo === COBRO_OTRO && c.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS, nota, por: String(c.por || ''), en: Number(c.en) || 0 };
}

// La orden -> el formulario (texto). "Otro monto" se muestra como lo escribe la calculadora ("5.696,00").
export function formularioCobroAcordado(t) {
  const c = cobroAcordadoDe(t);
  if (!c) return { ...COBRO_SEL_INICIAL };
  const numero = Number(String(c.monto).replace(/\./g, '').replace(',', '.'));
  return { modo: c.modo, otro: c.modo === COBRO_OTRO ? montoParaCampo(numero) : '', moneda: c.moneda, nota: c.nota };
}

// El formulario -> { valor } con lo que se guarda (null si no se acordó nada), o { error } si el monto no es válido.
export function resolverCobroAcordado(sel) {
  const modo = MODOS_ACORDADOS.includes(sel?.modo) ? sel.modo : SIN_DEFINIR;
  const nota = limpiarNota(sel?.nota);
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
  return x.modo === y.modo && x.monto === y.monto && x.moneda === y.moneda && x.nota === y.nota;
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
