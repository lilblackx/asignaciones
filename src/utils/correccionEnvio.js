// Corregir, desde "Envíos al inventario", lo que viaja al almacén de una orden (serial, metraje, conectores...) aunque la orden ya esté
// cerrada. Es la misma corrección de "Editar orden" (utils/edicionDatosTecnico), sin tocar nada más de la orden: ni el cobro, ni el
// técnico, ni el estado. Función pura: la usan la pantalla y las pruebas.
import { cambiosDatosTecnico, formularioDatosTecnico, formularioModificado, validarDatosTecnico } from './edicionDatosTecnico.js';
import { esInstalacion } from './instalacion.js';
import { generarMensajeWhatsAppInstalacion } from './whatsapp.js';

// La orden con los datos corregidos y su línea en el historial. `formulario`: lo que se escribió (como lo entrega el formulario).
// Devuelve { ticket, cambios } o { error, errores, primerCampo } si algo no es válido, o { sinCambios: true } si no se tocó nada.
export function corregirDatosParaEnvio(ticket, formulario, { por, ahora = new Date() } = {}) {
  if (!formularioModificado(formularioDatosTecnico(ticket), formulario)) return { sinCambios: true };
  const revision = validarDatosTecnico(ticket, formulario);
  if (revision.error) return { error: true, errores: revision.errores, primerCampo: revision.primerCampo };
  const corregida = { ...ticket, ...revision.datos };
  // Una instalación ya finalizada guarda su plantilla: se rehace con lo corregido (igual que al editar la orden).
  if (corregida.estado === 'FINALIZADO' && esInstalacion(corregida.tipoTrabajo)) {
    const texto = generarMensajeWhatsAppInstalacion({ ...corregida, estado: 'FINALIZADO' });
    if (texto) corregida.plantillaFinal = texto;
  }
  const cambios = cambiosDatosTecnico(ticket, corregida);
  if (cambios.length === 0) return { sinCambios: true };
  corregida.historialEdiciones = [
    ...(ticket.historialEdiciones || []),
    { fecha: ahora.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }), operador: por || 'OPERADOR', detalle: `${cambios.join(' | ')} (desde Envíos al inventario)` },
  ];
  return { ticket: corregida, cambios };
}
