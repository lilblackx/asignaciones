// Teléfonos tal como los escriben en la orden: venezolanos ("0414-1234567",
// "+58 414 1234567", "4141234567") o extranjeros con "+" ("+1 305 555 1234").
// Devuelven null si no se puede armar un número usable, para no mostrar un
// botón que falle.

const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '');

// Una orden puede traer varios teléfonos: se guardan en el mismo string
// separados por " / " ("0414-1234567 / 0424-7654321"), así lo viejo, la
// búsqueda, el Excel y el mensaje de WhatsApp siguen funcionando sin migrar.
export const MAX_TELEFONOS = 3;

export const parseTelefonos = (valor) => String(valor || '').split('/').map(t => t.trim()).filter(Boolean);

export const unirTelefonos = (lista) => lista.map(t => t.trim()).filter(Boolean).join(' / ');

// Internacional sin "+": 584141234567. Sirve para wa.me.
export function telefonoInternacional(telefono) {
  const texto = String(telefono || '').trim();
  const d = soloDigitos(texto);
  // Extranjero: lleva "+" (o "00") y un código de país que no es el 58. Se acepta
  // cualquier largo E.164 (8 a 15 dígitos) porque cada país numera distinto.
  const internacional = texto.startsWith('+') || texto.startsWith('00');
  if (internacional && !texto.replace(/^(\+|00)\s*/, '').startsWith('58')) {
    const sinPrefijo = texto.startsWith('+') ? d : d.slice(2);
    return sinPrefijo.length >= 8 && sinPrefijo.length <= 15 ? sinPrefijo : null;
  }
  if (d.length === 12 && d.startsWith('58')) return d;
  if (d.length === 11 && d.startsWith('0')) return `58${d.slice(1)}`;
  if (d.length === 10) return `58${d}`;
  return null;
}

// Quita lo que no puede ir en un teléfono (letras, "/", etc.); deja dígitos y
// los signos con que se escriben: "+58 (414) 123-4567".
export const limpiarTelefono = (texto) => String(texto || '').replace(/[^\d+\-().\s]/g, '');

// Mensaje de error de un número del formulario ('' si está bien). `anteriores`
// son los números de las filas de arriba, para detectar repetidos.
export function errorTelefono(texto, anteriores = []) {
  if (!String(texto || '').trim()) return '';
  const n = telefonoInternacional(texto);
  if (!n) return 'Número inválido. Ej: 0414-1234567 o +1 305 555 1234';
  if (anteriores.some(a => telefonoInternacional(a) === n)) return 'Número repetido';
  return '';
}

export const getEnlaceLlamada =(telefono) => {
  const n = telefonoInternacional(telefono);
  return n ? `tel:+${n}` : null;
};

export const getEnlaceWhatsApp = (telefono) => {
  const n = telefonoInternacional(telefono);
  return n ? `https://wa.me/${n}` : null;
};
