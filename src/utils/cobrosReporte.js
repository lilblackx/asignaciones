// Reporte "Cobros": de las órdenes finalizadas en el periodo que llevan cobro (todas menos las instalaciones), cuántas se cobraron,
// cuántas se exoneraron y cuántas no tienen cobro registrado, con su porcentaje; por concepto (el tipo de visita o de trabajo) y por
// técnico; y cuánto se cobró en Bs y en $. El cobro lo elige quien aprueba o finaliza la orden (ver utils/cobro.js).
import { COBRO_OTRO, MONEDA_USD, conceptoCobro, estaExonerado, llevaCobro, monedaDe } from './cobro.js';
import { delTecnico, finalizadaEn, porcentaje, textoPorcentaje } from './gestionTecnicos.js';

export const RESULTADOS = [
  { id: 'visita', nombre: 'Cobrada: visita técnica', grupo: 'cobrada' },
  { id: 'otro', nombre: 'Cobrada: otro monto', grupo: 'cobrada' },
  { id: 'exonerada', nombre: 'Exonerada', grupo: 'exonerada' },
  { id: 'sinCobro', nombre: 'Sin cobro registrado', grupo: 'sinCobro' },
];

// Cómo terminó el cobro de una orden: 'visita', 'otro', 'exonerada' o 'sinCobro'. Un monto sin tipo es de visita técnica (como lo guarda camposCobro).
export function resultadoCobro(t) {
  if (estaExonerado(t)) return 'exonerada';
  if (!t?.cobroBs) return 'sinCobro';
  return t.cobroTipo === COBRO_OTRO ? 'otro' : 'visita';
}

// "5.696" / "5000,50" → 5696 / 5000.5 (el formato que guarda formatoMontoBs).
export function montoDe(texto) {
  const numero = Number(String(texto ?? '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : 0;
}

const contar = (lista) => {
  const cuenta = { total: lista.length, cobradas: 0, exoneradas: 0, sinCobro: 0, visita: 0, otro: 0 };
  for (const t of lista) {
    const r = resultadoCobro(t);
    if (r === 'exonerada') cuenta.exoneradas++;
    else if (r === 'sinCobro') cuenta.sinCobro++;
    else { cuenta.cobradas++; cuenta[r]++; }
  }
  return { ...cuenta, pctCobradas: porcentaje(cuenta.cobradas, cuenta.total), pctExoneradas: porcentaje(cuenta.exoneradas, cuenta.total), pctSinCobro: porcentaje(cuenta.sinCobro, cuenta.total) };
};

const porClave = (lista, clave) => {
  const mapa = new Map();
  for (const t of lista) {
    const k = clave(t) || 'SIN ASIGNAR';
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(t);
  }
  return [...mapa.entries()].map(([nombre, ordenes]) => ({ nombre, ...contar(ordenes) })).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
};

export function resumenCobros(ordenes, rango, { tecnico } = {}) {
  const finalizadas = ordenes.filter((t) => finalizadaEn(t, rango) && delTecnico(t, tecnico));
  const conCobro = finalizadas.filter(llevaCobro);
  const cobradas = conCobro.filter((t) => ['visita', 'otro'].includes(resultadoCobro(t)));
  const montos = { bs: 0, usd: 0, ordenesBs: 0, ordenesUsd: 0 };
  for (const t of cobradas) {
    const usd = monedaDe(t) === MONEDA_USD;
    montos[usd ? 'usd' : 'bs'] += montoDe(t.cobroBs);
    montos[usd ? 'ordenesUsd' : 'ordenesBs']++;
  }
  return {
    finalizadas: finalizadas.length,
    instalaciones: finalizadas.length - conCobro.length,
    total: contar(conCobro),
    porConcepto: porClave(conCobro, conceptoCobro),
    porTecnico: porClave(conCobro, (t) => t.tecnico),
    montos,
  };
}

// --- Textos (los usan la pantalla, el PDF, el Word y el CSV) ---
const numero = (valor, moneda) => `${valor.toLocaleString('es-VE', { maximumFractionDigits: 2 })} ${moneda}`;

export const columnasMonto = () => [{ titulo: 'Moneda' }, { titulo: 'Órdenes', derecha: true }, { titulo: 'Total cobrado', derecha: true }];
export const filasMonto = ({ montos }) => [['Bolívares (Bs)', String(montos.ordenesBs), numero(montos.bs, 'Bs')], ['Dólares ($)', String(montos.ordenesUsd), numero(montos.usd, '$')]];

export function cifrasCobros(resumen) {
  const { total } = resumen;
  const detalle = (cantidad) => (total.total ? `${cantidad} de ${total.total}` : 'Sin órdenes');
  return [
    { etiqueta: 'Órdenes con cobro', valor: total.total, detalle: resumen.instalaciones ? `${resumen.instalaciones} instalaciones no cuentan` : 'finalizadas en el periodo' },
    { etiqueta: 'Cobradas', valor: textoPorcentaje(total.pctCobradas), detalle: detalle(total.cobradas) },
    { etiqueta: 'Exoneradas', valor: textoPorcentaje(total.pctExoneradas), detalle: detalle(total.exoneradas) },
    { etiqueta: 'Sin cobro registrado', valor: textoPorcentaje(total.pctSinCobro), detalle: detalle(total.sinCobro) },
  ];
}

export const columnasResultado = () => [{ titulo: 'Resultado' }, { titulo: 'Órdenes', derecha: true }, { titulo: '%', derecha: true }];
export function filasResultado({ total }) {
  const cuenta = { visita: total.visita, otro: total.otro, exonerada: total.exoneradas, sinCobro: total.sinCobro };
  return RESULTADOS.map((r) => [r.nombre, String(cuenta[r.id]), textoPorcentaje(porcentaje(cuenta[r.id], total.total))]);
}

export const columnasDesglose = (primera) => [{ titulo: primera }, { titulo: 'Órdenes', derecha: true }, { titulo: 'Cobradas', derecha: true }, { titulo: 'Exoneradas', derecha: true }, { titulo: 'Sin cobro', derecha: true }, { titulo: '% exoneradas', derecha: true }];
export const filaDesglose = (f) => [f.nombre, String(f.total), String(f.cobradas), String(f.exoneradas), String(f.sinCobro), textoPorcentaje(f.pctExoneradas)];

export const NOTA_COBROS = 'Cuenta las órdenes finalizadas en el periodo. Las instalaciones no llevan cobro y no entran. «Sin cobro registrado» son órdenes cerradas sin monto ni exoneración (por ejemplo, sin la tasa configurada o cerradas antes de que se guardara el cobro). El monto de una visita técnica es el del momento en que se cerró.';
