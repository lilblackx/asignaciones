// Cédula o RIF tal como se muestra: el venezolano (V) solo con sus puntos de miles; el resto, con su prefijo
// y sin puntos (ej. "J-123456789"). Módulo sin JSX para poder usarlo también en las pruebas.
export const formatCedula = (cedula, tipoDocumento) => {
  if (!cedula) return cedula;
  if (!tipoDocumento || tipoDocumento === 'V') return cedula;
  // RIF (jurídico/extranjero/gubernamental): sin puntos, solo el prefijo y los números.
  return `${tipoDocumento}-${String(cedula).replace(/\D/g, '')}`;
};

// La cédula con su prefijo, para las pantallas que siempre lo muestran (ventas y su exportación): "V-12345678". Si el valor ya trae
// el prefijo ("V-22222222", escrito a mano o guardado así) no se vuelve a poner. Distinta de formatCedula: esa deja la cédula V sin prefijo.
// Como en formatCedula, solo la cédula V lleva puntos de miles: el RIF y los demás documentos (J, E, G) van sin ellos ("J-407162578").
export const formatearCedula = (cedula, tipoDocumento) => {
  const valor = String(cedula ?? '').trim();
  if (!valor) return '';
  const conPrefijo = valor.match(/^([VEJGP])-(.*)$/i);
  const tipo = (conPrefijo ? conPrefijo[1] : tipoDocumento || 'V').toUpperCase();
  const numero = conPrefijo ? conPrefijo[2] : valor;
  return `${tipo}-${tipo === 'V' ? numero : numero.replace(/\./g, '')}`;
};
