// Cédula o RIF tal como se muestra: el venezolano (V) solo con sus puntos de miles; el resto, con su prefijo
// y sin puntos (ej. "J-123456789"). Módulo sin JSX para poder usarlo también en las pruebas.
export const formatCedula = (cedula, tipoDocumento) => {
  if (!cedula) return cedula;
  if (!tipoDocumento || tipoDocumento === 'V') return cedula;
  // RIF (jurídico/extranjero/gubernamental): sin puntos, solo el prefijo y los números.
  return `${tipoDocumento}-${String(cedula).replace(/\D/g, '')}`;
};
