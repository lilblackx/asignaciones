// En la orden la NAP y el puerto viven en un solo texto (`nap`, ej. "NAP 08 - Puerto 3"),
// que es el que usan la plantilla y el resto de la app. El formulario de conector
// externo los pide en dos campos para evitar errores y los junta/separa con estas funciones.

export function unirNapPuerto(nap, puerto) {
  return `${String(nap || '').trim()} - Puerto ${String(puerto || '').trim()}`;
}

// "NAP 08 - Puerto 3" -> { nap: 'NAP 08', puerto: '3' }. Si el texto no sigue ese
// formato (orden vieja o escrita a mano) queda entero en `nap` y el puerto vacío.
export function separarNapPuerto(texto) {
  const limpio = String(texto || '').trim();
  const m = limpio.match(/^(.*?)\s*-\s*puerto\s+(\d+)$/i);
  return m ? { nap: m[1].trim(), puerto: m[2] } : { nap: limpio, puerto: '' };
}
