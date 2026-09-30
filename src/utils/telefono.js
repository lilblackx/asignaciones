// Teléfonos venezolanos tal como los escriben en la orden ("0414-1234567",
// "+58 414 1234567", "4141234567"). Devuelven null si no se puede armar un
// número usable, para no mostrar un botón que falle.

const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '');

// Internacional sin "+": 584141234567. Sirve para wa.me.
export function telefonoInternacional(telefono) {
  const d = soloDigitos(telefono);
  if (d.length === 12 && d.startsWith('58')) return d;
  if (d.length === 11 && d.startsWith('0')) return `58${d.slice(1)}`;
  if (d.length === 10) return `58${d}`;
  return null;
}

export const getEnlaceLlamada = (telefono) => {
  const n = telefonoInternacional(telefono);
  return n ? `tel:+${n}` : null;
};

export const getEnlaceWhatsApp = (telefono) => {
  const n = telefonoInternacional(telefono);
  return n ? `https://wa.me/${n}` : null;
};
