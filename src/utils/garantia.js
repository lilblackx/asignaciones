// Garantía de otro técnico: una orden que se hace de nuevo porque lo que hizo otro técnico falló (la garantía). La orden de la garantía lleva `garantiaDe` con la orden original: así, al
// revisarla, el administrador decide si le descuenta algo al técnico de la original (ver ajustes.js). Funciones puras (las usan los formularios de la orden, Revisión y las pruebas).
//   garantiaDe: { id, codigo, tecnico, cliente }    id es la clave de la orden original (claveOrden: la misma de revisionPagos y ordenesPagadas)
import { claveOrden, SIN_TECNICO } from './finanzas.js';

export const esGarantia = (orden) => Boolean(orden?.garantiaDe?.id);

const sinTildes = (texto) => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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
