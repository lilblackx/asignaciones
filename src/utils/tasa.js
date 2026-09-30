const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Días de calendario desde la última actualización (0 = hoy). null si nunca se configuró.
export function diasDesactualizada(actualizadoEn) {
  if (!actualizadoEn) return null;
  const inicioHoy = new Date().setHours(0, 0, 0, 0);
  const inicioActualizacion = new Date(actualizadoEn).setHours(0, 0, 0, 0);
  return Math.round((inicioHoy - inicioActualizacion) / MS_POR_DIA);
}

// Mismo cálculo y formato que usa la plantilla de WhatsApp para el aviso de cobro.
export function montoBsDe(config) {
  if (!config?.montoBaseEUR || !config?.tasa) return null;
  return (config.montoBaseEUR * config.tasa).toLocaleString('es-VE', { maximumFractionDigits: 0 });
}

// Estado para mostrar la tasa: nivel 'ok' (de hoy), 'aviso' (de ayer),
// 'alerta' (2+ días) o 'sin' (nunca configurada).
export function getEstadoTasa(config) {
  const dias = diasDesactualizada(config?.actualizadoEn);
  if (!config?.tasa || dias === null) return { nivel: 'sin', dias: null };
  return { nivel: dias === 0 ? 'ok' : dias === 1 ? 'aviso' : 'alerta', dias };
}

// Texto de advertencia para cuando se copia una plantilla con la tasa vieja.
// null si la tasa es de hoy.
export function avisoTasaDesactualizada(config) {
  const { nivel, dias } = getEstadoTasa(config);
  if (nivel === 'ok') return null;
  if (nivel === 'sin') return 'la tasa BCV no está configurada, el monto en Bs puede salir vacío.';
  return `la tasa BCV ${dias === 1 ? 'es de ayer' : `tiene ${dias} días`}, revisa el monto en Bs.`;
}
