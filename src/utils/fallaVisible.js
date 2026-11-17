// La falla o el tipo que se escribe bajo el tipo de trabajo en las listas. En una instalación, "Instalación nueva" es lo que se da por hecho: no se repite.
// Sin falla, o igual al tipo de trabajo, tampoco se muestra.
const plano = (t = '') => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function fallaVisible(ticket) {
  const falla = (ticket?.falla || '').trim();
  if (!falla || plano(falla) === plano(ticket?.tipoTrabajo)) return '';
  if (plano(ticket?.tipoTrabajo) === 'instalacion' && plano(falla) === 'instalacion nueva') return '';
  return falla;
}
