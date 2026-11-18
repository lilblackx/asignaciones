// Prueba de humo de los asistentes por pasos: dibuja de verdad (en el servidor, sin navegador) el formulario de pre-finalizar, la revisión de la oficina y la pantalla del cobro, y comprueba que abren sin romperse y en el primer
// paso que toca (indicador, número de paso, indicación y botones). No recorre los pasos siguientes (eso pide interacción); eso lo cubren las demás pruebas de pasos. No necesita el emulador.
// Uso: `npm run test:humopasos`.
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const servidor = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false }, logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const cargar = async (ruta) => (await servidor.ssrLoadModule(ruta)).default;
const dibujar = (Componente, props) => renderToString(createElement(Componente, props));
const textoPlano = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

try {
  const base = { id: 'T1', codigo: 'AO7', nombre: 'Ana', cedula: '12345678', telefono: '0414-1234567', direccion: 'Calle 1', tecnico: 'JOSE', historialEdiciones: [] };

  // --- Pre-finalizar del técnico ---
  const PreFinalizar = await cargar('/src/components/modals/PreFinalizarModal.jsx');
  const noop = () => {};
  const instalacion = textoPlano(dibujar(PreFinalizar, { ticket: { ...base, estado: 'PENDIENTE', tipoTrabajo: 'INSTALACIÓN', falla: 'SM' }, onConfirm: noop, onClose: noop }));
  check('pre-finalizar de una instalación abre en el paso 1 de 4 con Orden, Equipo, Cable y Cierre y el botón Siguiente', [/Paso 1 de 4/.test(instalacion), ['Orden', 'Equipo', 'Cable', 'Cierre'].every((p) => instalacion.includes(p)), instalacion.includes('Siguiente'), instalacion.includes('Pre-finalizar')], [true, true, true, true]);
  check('el primer paso de una instalación no pide tipo de visita ni muestra campos del equipo', [instalacion.includes('TIPO DE VISITA'), instalacion.includes('SERIAL')], [false, false]);

  const averia = textoPlano(dibujar(PreFinalizar, { ticket: { ...base, estado: 'PENDIENTE', tipoTrabajo: 'AVERÍA', falla: 'LOS', observacion: 'Revisa el conector.', observacionInterna: false }, onConfirm: noop, onClose: noop }));
  check('pre-finalizar de una avería sin tipo elegido abre en el paso 1 de 2 y pide elegir el tipo de visita, con la nota de la oficina en el primer paso', [/Paso 1 de 2/.test(averia), averia.toUpperCase().includes('TIPO DE VISITA'), averia.includes('elige el tipo de visita'), averia.toUpperCase().includes('NOTA DE LA OFICINA'), averia.includes('Revisa el conector.')], [true, true, true, true, true]);

  const devuelta = textoPlano(dibujar(PreFinalizar, { ticket: { ...base, estado: 'PENDIENTE', tipoTrabajo: 'AVERÍA', falla: 'LOS', historialEdiciones: [{ fecha: '12/11/26', operador: 'admin', tipo: 'devuelto', detalle: 'Devuelta al técnico | Motivo: Falta la potencia.', motivo: 'Falta la potencia.' }] }, onConfirm: noop, onClose: noop }));
  check('una orden devuelta muestra el motivo de la oficina en el primer paso', [devuelta.includes('Devuelta por admin'), devuelta.includes('Falta la potencia.')], [true, true]);

  // --- Revisión de la oficina ---
  const Aprobar = await cargar('/src/components/modals/AprobarFinalizarModal.jsx');
  const revisar = (ticket) => textoPlano(dibujar(Aprobar, { ticket, actual: ticket, montoBs: '5.696', onConfirm: noop, onGuardarValores: noop, onDevolver: noop, onCopy: noop, onClose: noop }));
  const instalacionOficina = revisar({ ...base, estado: 'PRE-FINALIZADO', tipoTrabajo: 'INSTALACIÓN', falla: 'SM', instalacion: { serial: 'GPON12AB34CD', vlan: '120', nap: 'NAP 02', puerto: '5' } });
  check('la revisión de una instalación abre en el paso 1 de 4 (Revisar, Autorizar, Valores, Decisión) con "Devolver" en el pie', [/Paso 1 de 4/.test(instalacionOficina), ['Revisar', 'Autorizar', 'Valores', 'Decisión'].every((p) => instalacionOficina.includes(p)), instalacionOficina.includes('Devolver'), instalacionOficina.includes('Siguiente')], [true, true, true, true]);
  const averiaOficina = revisar({ ...base, estado: 'PRE-FINALIZADO', tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: 'CONECTOR_EXTERNO', nap: 'NAP 03 - 2' });
  check('la revisión de una avería con NAP no tiene paso de autorizar: 4 pasos y los datos se llaman "Datos del cliente"', [/Paso 1 de 4/.test(averiaOficina), averiaOficina.includes('Autorizar'), averiaOficina.includes('Datos del cliente')], [true, false, true]);

  // --- Cobro del técnico ---
  const Cobro = await cargar('/src/components/modals/CobroResultanteModal.jsx');
  // Las fotos solo se piden en las instalaciones: una avería con cobro tiene el cobro y el pago; una instalación, el cobro, el pago y las fotos.
  const finalizadoEn = Date.now() + 5 * 24 * 3600 * 1000;
  const registro = { onRegistrar: noop, onPagaDespues: noop, otrasOrdenes: [], onPosponer: noop, onSubirDetalles: noop };
  const pantallaDelCobro = (ticket) => dibujar(Cobro, { ticket, formasPago: [], onCopy: noop, onClose: noop, registro });
  const orden = { ...base, estado: 'FINALIZADO', finalizadoEn, tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: 'CONECTOR_EXTERNO', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA' };
  const htmlCobro = pantallaDelCobro(orden);
  const cobro = textoPlano(htmlCobro);
  check('el cobro de una avería abre en el paso 1 de 2 (Cobro, Pago) con el monto, Siguiente y "Hacerlo después", sin paso de fotos', [/Paso 1 de 2/.test(cobro), ['Cobro', 'Pago'].every((p) => cobro.includes(p)), !cobro.includes('Fotos'), cobro.includes('5.696'), cobro.includes('Siguiente'), cobro.includes('Hacerlo después')], [true, true, true, true, true, true]);
  check('el "Hacerlo después" de la avería dice que la oficina espera solo el pago', [htmlCobro.includes('hasta que registres el pago.'), htmlCobro.includes('subas las fotos')], [true, false]);
  const instalacionDelTecnico = { ...base, estado: 'FINALIZADO', finalizadoEn, tipoTrabajo: 'INSTALACIÓN', falla: 'SM' };
  const htmlInstalacion = pantallaDelCobro(instalacionDelTecnico);
  const cobroInstalacion = textoPlano(htmlInstalacion);
  check('el cobro de una instalación abre en el paso 1 de 3 (Cobro, Pago, Fotos) con Siguiente y "Hacerlo después", y la oficina espera el pago y las fotos', [/Paso 1 de 3/.test(cobroInstalacion), ['Cobro', 'Pago', 'Fotos'].every((p) => cobroInstalacion.includes(p)), cobroInstalacion.includes('Siguiente'), cobroInstalacion.includes('Hacerlo después'), htmlInstalacion.includes('hasta que registres el pago y subas las fotos.')], [true, true, true, true, true]);
  const pagoRegistrado = { tipo: 'PAGO', pago: { moneda: 'USD', forma: 'Efectivo', monto: 25, banco: '', titular: '', cuentaEmpresa: '', referencia: '', pagadoEn: finalizadoEn }, nota: '', compartidoCon: null, monedaDistinta: false, diferencia: false, registradoPor: 'jose', registradoEn: finalizadoEn };
  const htmlSoloFotos = pantallaDelCobro({ ...instalacionDelTecnico, pagoCliente: pagoRegistrado });
  check('una instalación con el pago ya registrado abre directo en las fotos y la oficina espera solo las fotos', [textoPlano(htmlSoloFotos).toUpperCase().includes('DETALLES DE LA ORDEN'), htmlSoloFotos.includes('hasta que subas las fotos.'), htmlSoloFotos.includes('registres el pago')], [true, true, false]);
} finally {
  await servidor.close();
}

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
process.exit(0);
