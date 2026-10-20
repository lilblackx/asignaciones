// En qué grupo cae cada tipo de trabajo (el mismo reparto que usan la hoja de cálculo del departamento y el Registro de estadísticas):
//   INSTALACION: las instalaciones.
//   AVERIA:      averías, reconexiones, low signal y cambios de equipo.
//   VISITA:      mudanzas, retiros de equipo, garantías y validaciones de NAP.
//   OTRO:        cualquier tipo que no esté en las listas de arriba (no debería haber; así, si aparece uno nuevo, no se pierde de las cuentas).
// Todo tipo cae en un solo grupo, de modo que Instalaciones + Averías + Visitas + Otros suman siempre el total.
import { esInstalacion } from './instalacion.js';

export const normalizarTipo = (tipo) => String(tipo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

export const TRABAJOS_AVERIA = ['AVERIA', 'RECONEXION', 'LOW SIGNAL', 'CAMBIO DE EQUIPO'];
export const TRABAJOS_VISITA = ['MUDANZA', 'RETIRO EQUIPO', 'GARANTIA', 'VALIDACION NAP'];

export function grupoDeTrabajo(t) {
  if (esInstalacion(t?.tipoTrabajo)) return 'INSTALACION';
  const tipo = normalizarTipo(t?.tipoTrabajo);
  if (TRABAJOS_AVERIA.includes(tipo)) return 'AVERIA';
  if (TRABAJOS_VISITA.includes(tipo)) return 'VISITA';
  return 'OTRO';
}
