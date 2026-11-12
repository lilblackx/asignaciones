// Metraje inicial y final del cable (las marcas de la bobina al empezar y al terminar el trabajo). El total de metros usados
// lo calcula la app: es la diferencia entre las dos marcas, sin importar si la marca sube o baja. Se pide en las instalaciones
// y en los recableados; ese total es el que sigue leyendo todo lo demás (Materiales, envío al inventario, plantilla, reportes).
// Las órdenes anteriores a que se pidiera solo tienen el total y no se tocan.
// Módulo sin dependencias.

export const MAX_LARGO_MARCA = 4; // dígitos: hasta 9999

const leerMarca = (raw, nombre) => {
  const txt = String(raw ?? '').trim();
  if (txt === '') return { error: `Escribe el metraje ${nombre}.` };
  if (!/^\d{1,4}$/.test(txt)) return { error: `El metraje ${nombre} debe ser un número entero de metros. Ejemplo: 500` };
  return { valor: parseInt(txt, 10) };
};

// Lo escrito por el técnico -> { valor: { inicial, final, total } } o { errores: { inicial?, final? } } (con un mensaje por campo).
export function calcularMetraje(rawInicial, rawFinal) {
  const inicial = leerMarca(rawInicial, 'inicial');
  const final = leerMarca(rawFinal, 'final');
  const errores = {};
  if (inicial.error) errores.inicial = inicial.error;
  if (final.error) errores.final = final.error;
  if (!errores.inicial && !errores.final && inicial.valor === final.valor) errores.final = 'El metraje final no puede ser igual al inicial.';
  if (errores.inicial || errores.final) return { errores };
  return { valor: { inicial: inicial.valor, final: final.valor, total: Math.abs(final.valor - inicial.valor) } };
}

// Total para mostrarlo mientras se escribe (null si todavía no se puede calcular).
export const totalMetraje = (rawInicial, rawFinal) => calcularMetraje(rawInicial, rawFinal).valor?.total ?? null;

const esMarca = (v) => Number.isInteger(v) && v >= 0;

// ¿La orden guardó las dos marcas? (`datos` es la instalación o la orden de un recableado)
export const tieneMarcas = (datos) => esMarca(datos?.metrajeInicial) && esMarca(datos?.metrajeFinal);

// "inicial 500, final 620" ('' si la orden no las tiene).
export const textoMarcas = (datos) => (tieneMarcas(datos) ? `inicial ${datos.metrajeInicial}, final ${datos.metrajeFinal}` : '');

// "120 m (inicial 500, final 620)": el total con sus marcas si las tiene.
export const textoMetrajeConMarcas = (metros, datos) => {
  const marcas = textoMarcas(datos);
  return `${metros} m${marcas ? ` (${marcas})` : ''}`;
};
