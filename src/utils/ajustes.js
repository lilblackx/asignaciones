// Descuentos y bonos por una garantía de otro técnico (siempre en dólares). Una orden que se hace de nuevo porque lo que hizo otro técnico falló lleva el check "Garantía de otro técnico" con su
// orden original. Al revisarla, el administrador decide descontar un monto M de esa orden original: al aprobar la garantía se crean dos ajustes, un DESCUENTO de M al técnico de la original y un
// BONO de M al técnico que hizo la garantía. La orden de la garantía en sí no se paga: solo se mueve ese monto. Funciones puras. Se guardan en la colección ajustesTecnicos, un documento por
// ajuste (el id sale de la orden de la garantía y de su revisión, así aprobar dos veces no los duplica):
//   { tecnico, tipo: 'DESCUENTO' | 'BONO', monto, aplicado, clave, codigo, claveOrigen, codigoOrigen, de, a, por, creadoEn, notificado }
//   clave y codigo son los de la garantía; claveOrigen y codigoOrigen, los de la orden original de la que se descuenta; de, el técnico de la original; a, el de la garantía.
// `aplicado` es lo que ya entró en pagos (sube al pagar, baja al anular el pago, nunca pasa de `monto`), igual que en los adelantos. Un descuento se resta del próximo pago del
// técnico (si no alcanza, el resto queda como saldo y se arrastra); un bono se suma entero al próximo pago.
import { saldoAdelanto } from './adelantos.js';

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

export const TIPOS_AJUSTE = ['DESCUENTO', 'BONO'];
export const MAX_AJUSTE = 100000;

// El id de cada ajuste de una orden: la clave de la orden (la misma de ordenesPagadas y de revisionPagos) y la firma de su revisión. Con la firma, si la orden cambia y se aprueba otra vez,
// los ajustes nuevos son otros documentos y nunca pisan a los viejos (que pudieron aplicarse ya a un pago).
export const idAjuste = (clave, tipo, firma) => `${tipo === 'BONO' ? 'bono' : 'desc'}_${clave}_${firma}`;
export const idsAjustesDeOrden = (clave, firma) => TIPOS_AJUSTE.map((tipo) => idAjuste(clave, tipo, firma));

// El monto que escribe el administrador ("5", "5,50", "5.5"): dólares positivos con hasta dos decimales. { valor } o { error }.
export function parseMontoAjuste(raw) {
  const texto = String(raw ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  if (!texto) return { error: 'Escribe el monto a descontar.' };
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return { error: 'El monto debe ser un número en dólares, con hasta dos decimales.' };
  const valor = Number(texto);
  if (!(valor > 0)) return { error: 'El monto a descontar debe ser mayor que cero.' };
  if (valor > MAX_AJUSTE) return { error: `El monto no puede pasar de ${MAX_AJUSTE} $.` };
  return { valor: redondear(valor) };
}

// Los dos ajustes de una orden revisada, listos para guardar: [{ id, datos }] (vacío si no hay descuento o no hay dos técnicos distintos con nombre).
// `item`: la garantía revisada (de `revisar`): su técnico (`tecnico`), el `descuento` y la orden original de la que se descuenta (`descuentoDe`: { id, codigo, tecnico }).
export function ajustesDeOrden(item, { por, ahora, sinTecnico = 'SIN ASIGNAR' }) {
  const monto = redondear(item.descuento);
  const origen = item.descuentoDe;
  const de = origen?.tecnico;
  const a = item.tecnico;
  if (!(monto > 0) || !origen?.id || !de || !a || de === a || de === sinTecnico || a === sinTecnico) return [];
  const base = { monto, aplicado: 0, clave: item.clave, codigo: String(item.orden?.codigo || '').slice(0, 40), claveOrigen: String(origen.id).slice(0, 200), codigoOrigen: String(origen.codigo || '').slice(0, 40), de: String(de).slice(0, 100), a: String(a).slice(0, 100), por, creadoEn: ahora, notificado: true };
  return [
    { id: idAjuste(item.clave, 'DESCUENTO', item.firma), datos: { ...base, tecnico: String(de).slice(0, 100), tipo: 'DESCUENTO' } },
    { id: idAjuste(item.clave, 'BONO', item.firma), datos: { ...base, tecnico: String(a).slice(0, 100), tipo: 'BONO' } },
  ];
}

const antes = (a, b) => (Number(a.creadoEn) || 0) - (Number(b.creadoEn) || 0);

// Los descuentos con saldo de un técnico, del más viejo al más nuevo.
export const descuentosConSaldo = (ajustes, tecnico) => ajustes.filter((a) => a.tipo === 'DESCUENTO' && a.tecnico === tecnico && saldoAdelanto(a) > 0).sort(antes);
// Los bonos con saldo de un técnico.
export const bonosConSaldo = (ajustes, tecnico) => ajustes.filter((a) => a.tipo === 'BONO' && a.tecnico === tecnico && saldoAdelanto(a) > 0).sort(antes);
