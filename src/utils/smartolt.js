const SMARTOLT_BASE = 'https://networkspeed.smartolt.com/onu/configured';

export function buildSmartOltUrl(cedula, tipoDocumento = 'V') {
  // Mismo criterio que formatCedula: todo documento que no sea "V" (J, E, G)
  // se busca con prefijo y solo dígitos.
  const freeText = tipoDocumento && tipoDocumento !== 'V'
    ? `${tipoDocumento}-${String(cedula || '').replace(/\D/g, '')}`
    : cedula;
  const params = new URLSearchParams({ free_text: freeText, sort_by: 'id', sort_order: 'desc' });
  return `${SMARTOLT_BASE}?${params.toString()}`;
}
