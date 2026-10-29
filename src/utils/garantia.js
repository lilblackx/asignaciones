// Garantía de otro técnico: una orden que se hace de nuevo porque lo que hizo otro técnico falló (la garantía). La orden de la garantía lleva `garantiaDe` con la orden original: así, al
// revisarla, el administrador decide si le descuenta algo al técnico de la original (ver ajustes.js). Funciones puras (las usan los formularios de la orden, Revisión y las pruebas).
//   garantiaDe: { id, codigo, tecnico, cliente }    id es la clave de la orden original (claveOrden: la misma de revisionPagos y ordenesPagadas)
import { claveOrden, SIN_TECNICO } from './finanzas.js';
import { esCodigoSinNumero } from './correlativo.js';

export const esGarantia = (orden) => Boolean(orden?.garantiaDe?.id);

const sinTildes = (texto) => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// El tipo de trabajo "GARANTIA" (la oficina vuelve a visitar a un cliente por algo que ya se hizo). No es la "garant\u00eda de otro t\u00e9cnico" de arriba.
export const esTipoGarantia = (tipoTrabajo) => sinTildes(tipoTrabajo).toUpperCase() === 'GARANTIA';

// Una orden de tipo GARANTIA lleva el c\u00f3digo de la orden original, no un n\u00famero nuevo del contador: si no, la oficina se lo cambiaba a mano y el n\u00famero autom\u00e1tico quedaba gastado sin ninguna orden.
// Estas son las \u00f3rdenes del cliente (por su c\u00e9dula) cuyo c\u00f3digo se puede reutilizar: con n\u00famero ya asignado, una por c\u00f3digo, la m\u00e1s reciente primero.
export function codigosParaGarantia(ordenes, cedula, limite = 5) {
  const ced = String(cedula || '').replace(/\D/g, '');
  if (ced.length < 5) return [];
  const vistos = new Set();
  return ordenes
    .filter((o) => String(o.cedula || '').replace(/\D/g, '') === ced && o.codigo && !esCodigoSinNumero(o.codigo) && !esTipoGarantia(o.tipoTrabajo))
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .filter((o) => { const c = String(o.codigo).toUpperCase(); if (vistos.has(c)) return false; vistos.add(c); return true; })
    .slice(0, limite)
    .map((o) => ({ codigo: String(o.codigo).toUpperCase(), tipoTrabajo: o.tipoTrabajo || '', estado: o.estado || '', tecnico: o.tecnico || '' }));
}

// Al crear una GARANTIA del cliente con \u00f3rdenes anteriores el c\u00f3digo es obligatorio (el de la original). Sin \u00f3rdenes anteriores del cliente en la app, puede quedar vac\u00edo y toma un n\u00famero nuevo.
export function errorCodigoGarantia(tipoTrabajo, codigo, candidatas) {
  if (!esTipoGarantia(tipoTrabajo) || String(codigo || '').trim() || !candidatas.length) return '';
  return 'Una garant\u00eda lleva el c\u00f3digo de la orden original. Elige una de las \u00f3rdenes del cliente o escribe el c\u00f3digo.';
}
const mismoTecnico = (a, b) => sinTildes(a) !== '' && sinTildes(a) === sinTildes(b);

// Lo que se guarda en la orden de la garantía para recordar cuál es la original.
export const datosGarantia = (original) => ({
  id: claveOrden(original),
  codigo: String(original.codigo || '').slice(0, 40),
  tecnico: String(original.tecnico || '').slice(0, 100),
  cliente: String(original.nombre || '').slice(0, 100),
});

// Errores al guardar una orden con el check "Garantía de otro técnico": sin original elegida, o con la original del mismo técnico (entonces no es de otro técnico).
export function errorGarantia(garantiaDe, { tecnico = '' } = {}) {
  if (!garantiaDe) return '';
  if (!garantiaDe.id) return 'Elige la orden original de la garantía.';
  if (mismoTecnico(garantiaDe.tecnico, tecnico)) return 'La orden original es del mismo técnico: una garantía de otro técnico debe ser de uno distinto.';
  return '';
}

// Las órdenes que se pueden elegir como original: con técnico, sin cancelar, que no sean ya otra garantía, ni la misma orden, ni de `tecnico` (el de la garantía). Con texto busca por código, cliente,
// cédula, teléfono, dirección o técnico; sin texto solo ofrece las del mismo cliente (`cedula`). Las del mismo cliente van primero y luego las más recientes.
export function buscarOrdenesGarantia(ordenes, texto, { idExcluido = '', tecnico = '', cedula = '', limite = 8 } = {}) {
  const q = sinTildes(texto);
  const ced = String(cedula || '').replace(/\D/g, '');
  const delCliente = (o) => ced.length > 0 && String(o.cedula || '').replace(/\D/g, '') === ced;
  return ordenes
    .filter((o) => o.tecnico && o.tecnico !== SIN_TECNICO && o.estado !== 'CANCELADO' && !esGarantia(o) && claveOrden(o) !== idExcluido && !mismoTecnico(o.tecnico, tecnico))
    .filter((o) => (q ? [o.codigo, o.nombre, o.cedula, o.telefono, o.direccion, o.tecnico].some((v) => sinTildes(v).includes(q)) : delCliente(o)))
    .sort((a, b) => Number(delCliente(b)) - Number(delCliente(a)) || (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .slice(0, limite);
}
