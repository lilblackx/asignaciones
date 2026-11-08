// Pagos adicionales: un ítem con nombre y precio en dólares (por ejemplo "Domingo trabajado") que Finanzas crea en el Tabulador de precios y suma al próximo pago de cualquier técnico, sin
// que haya una orden detrás. Funciones puras.
// El catálogo es un solo documento, tarifasPago/adicionales: { items: [{ id, nombre, precio }], por, en }.
// Cada vez que se le suma uno a un técnico se guarda un documento en pagosAdicionales con el nombre y el precio de ese momento (cambiar el precio del ítem después no mueve lo ya registrado):
//   { tecnico, concepto (id del ítem), nombre, precio, cantidad, monto, aplicado, nota, por, creadoEn, anulado, notificado }   (anulado: anuladoPor y anuladoEn; pagoId: el último pago que lo tocó)
// `aplicado` es lo que ya entró en pagos (sube al pagar, baja al anular el pago, nunca pasa de `monto`). Un pago adicional se suma entero al próximo pago del técnico.
import { saldoAdelanto } from './adelantos.js';

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;
const limpiar = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

export const MAX_ITEMS_ADICIONALES = 30;
export const MAX_NOMBRE_ADICIONAL = 60;
export const MAX_NOTA_ADICIONAL = 300;
export const MAX_CANTIDAD_ADICIONAL = 99;
export const MAX_PRECIO_ADICIONAL = 100000;
export const MAX_MONTO_ADICIONAL = 100000;

const clave = (nombre) => limpiar(nombre).toLocaleLowerCase('es');

// El catálogo guardado -> [{ id, nombre, precio }] ordenado por nombre. Ignora lo que no tenga forma de ítem.
export function itemsAdicionales(guardado) {
  const lista = Array.isArray(guardado?.items) ? guardado.items : [];
  return lista
    .filter((i) => i && typeof i.id === 'string' && i.id && typeof i.nombre === 'string' && i.nombre.trim())
    .map((i) => ({ id: i.id, nombre: limpiar(i.nombre), precio: redondear(i.precio) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// "5" / "5,50" / "5.50" -> dólares (más de 0, dos decimales) o { error }. A diferencia del tabulador de órdenes, un ítem sin precio no sirve.
export function parsePrecioAdicional(texto) {
  const limpio = String(texto ?? '').trim().replace(',', '.');
  if (limpio === '') return { error: 'Escribe el precio.' };
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(limpio)) return { error: 'Escribe solo números, con hasta 2 decimales. Ejemplo: 5 o 5,50' };
  const valor = Number(limpio);
  if (!(valor > 0)) return { error: 'El precio debe ser mayor a 0.' };
  if (valor > MAX_PRECIO_ADICIONAL) return { error: `El precio no puede pasar de ${MAX_PRECIO_ADICIONAL}.` };
  return { valor };
}

// Un ítem del tabulador: { nombre, precio } (texto) -> { valor: { nombre, precio } } o { error, campo }. `otros`: los demás ítems (para no repetir el nombre).
export function parseItemAdicional({ nombre, precio } = {}, otros = []) {
  const n = limpiar(nombre);
  if (!n) return { error: 'Escribe el nombre del ítem.', campo: 'nombre' };
  if (n.length > MAX_NOMBRE_ADICIONAL) return { error: `El nombre es demasiado largo (máximo ${MAX_NOMBRE_ADICIONAL} caracteres).`, campo: 'nombre' };
  if (otros.some((o) => clave(o.nombre) === clave(n))) return { error: 'Ya hay un ítem con ese nombre.', campo: 'nombre' };
  const p = parsePrecioAdicional(precio);
  if (p.error) return { error: p.error, campo: 'precio' };
  return { valor: { nombre: n, precio: p.valor } };
}

// Un id nuevo para un ítem del catálogo.
export const idItemAdicional = (ahora = Date.now(), azar = Math.random()) => `i${ahora.toString(36)}${Math.floor(azar * 1e6).toString(36)}`;

// La lista completa lista para guardar: `filas` son [{ id, nombre, precio }] en texto (lo que se escribe); devuelve { valor: [{ id, nombre, precio }] } o { error, id, campo }.
export function parseCatalogoAdicionales(filas) {
  if (filas.length > MAX_ITEMS_ADICIONALES) return { error: `Pueden ser hasta ${MAX_ITEMS_ADICIONALES} ítems.` };
  const listos = [];
  for (const fila of filas) {
    const r = parseItemAdicional(fila, listos);
    if (r.error) return { error: r.error, id: fila.id, campo: r.campo };
    listos.push({ id: fila.id, ...r.valor });
  }
  return { valor: listos };
}

// "3" -> 3 (entero de 1 a MAX_CANTIDAD_ADICIONAL) o { error }.
export function parseCantidadAdicional(texto) {
  const limpio = String(texto ?? '').trim();
  if (limpio === '') return { error: 'Escribe la cantidad.' };
  if (!/^\d{1,3}$/.test(limpio)) return { error: 'La cantidad es un número entero. Ejemplo: 1' };
  const valor = Number(limpio);
  if (valor < 1) return { error: 'La cantidad debe ser al menos 1.' };
  if (valor > MAX_CANTIDAD_ADICIONAL) return { error: `La cantidad no puede pasar de ${MAX_CANTIDAD_ADICIONAL}.` };
  return { valor };
}

// Lo que se registra a un técnico: { itemId, cantidad, nota } + el catálogo -> { valor: { item, cantidad, nota, monto } } o { error, campo }.
export function parseAdicional({ itemId, cantidad = '1', nota = '' } = {}, items = []) {
  const item = items.find((i) => i.id === itemId);
  if (!item) return { error: 'Elige el ítem.', campo: 'item' };
  const c = parseCantidadAdicional(cantidad);
  if (c.error) return { error: c.error, campo: 'cantidad' };
  const notaLimpia = limpiar(nota);
  if (notaLimpia.length > MAX_NOTA_ADICIONAL) return { error: `La nota es demasiado larga (máximo ${MAX_NOTA_ADICIONAL} caracteres).`, campo: 'nota' };
  const monto = redondear(item.precio * c.valor);
  if (monto > MAX_MONTO_ADICIONAL) return { error: `El monto no puede pasar de ${MAX_MONTO_ADICIONAL} $.`, campo: 'cantidad' };
  return { valor: { item, cantidad: c.valor, nota: notaLimpia, monto } };
}

// El pago adicional listo para guardar. `datos`: lo que devuelve parseAdicional; `por`: quien lo registra. La fecha y la hora son las de `ahora`.
export const armarAdicional = (tecnico, datos, { por, ahora, notificar = false }) => ({
  tecnico,
  concepto: datos.item.id,
  nombre: datos.item.nombre,
  precio: redondear(datos.item.precio),
  cantidad: datos.cantidad,
  monto: redondear(datos.monto),
  aplicado: 0,
  nota: datos.nota || '',
  por,
  creadoEn: ahora,
  anulado: false,
  notificado: Boolean(notificar),
});

// Los pagos adicionales con saldo de un técnico, del más viejo al más nuevo.
export const adicionalesConSaldo = (adicionales, tecnico) => adicionales
  .filter((a) => a.tecnico === tecnico && saldoAdelanto(a) > 0)
  .sort((a, b) => (Number(a.creadoEn) || 0) - (Number(b.creadoEn) || 0));

// Se puede anular mientras no haya entrado en ningún pago.
export const sePuedeAnularAdicional = (a) => Boolean(a) && !a.anulado && !(Number(a.aplicado) > 0);

// "Domingo trabajado" / "Domingo trabajado × 3".
export const textoAdicional = (a) => (Number(a?.cantidad) > 1 ? `${a.nombre} × ${a.cantidad}` : String(a?.nombre ?? ''));

