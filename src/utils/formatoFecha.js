// "19/10/2026 11:35" en hora de Caracas.
export const fechaHoraLegible = (ms) => new Intl.DateTimeFormat('es-VE', {
  timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(ms)).replace(',', '');
