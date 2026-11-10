// Prueba la confirmación antes de pre-finalizar: que el técnico siempre pase por ella (el formulario no envía directo), que "Volver" sea el primer botón, y que muestre lo que se va a enviar
// (serial, VLAN, NAP, metraje, equipo nuevo...) según el tipo de orden. No necesita el emulador. Uso: `npm run test:confirmarprefinalizar`.
import { readFileSync } from 'node:fs';
import { datosParaConfirmar } from '../src/utils/confirmarPreFinalizar.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const etiquetas = (extra) => datosParaConfirmar(extra).map((f) => f.etiqueta);
const valor = (extra, etiqueta) => datosParaConfirmar(extra).find((f) => f.etiqueta === etiqueta)?.valor;

// --- Qué se muestra, según la orden ---
const instalacion = { instalacion: { serial: 'VSOL00B9766A', vlan: '101', posteadura: ['P-12', 'P-13'], metraje: 120, puertosDisponibles: '4', conectores: { externo: { verde: 1 }, interno: { verde: 1, azul: 0 } } }, nap: 'N10D14 - Puerto 3', observacionTecnico: 'Listo', potenciaDbm: -19.5 };
check('instalación: serial, VLAN, NAP, metraje, postes, puertos, conectores, potencia y observación', etiquetas(instalacion), ['Serial', 'VLAN', 'NAP y puerto', 'Metraje del drop', 'Posteadura', 'Puertos disponibles en la NAP', 'Conectores usados', 'Potencia óptica', 'Observación']);
check('instalación: el serial sale destacado (grande)', datosParaConfirmar(instalacion)[0], { etiqueta: 'Serial', valor: 'VSOL00B9766A', destacado: true });
check('instalación: el metraje existente no dice metros', valor({ ...instalacion, instalacion: { ...instalacion.instalacion, metrajeExistente: true, metraje: null } }, 'Metraje del drop'), 'Metraje existente (no se descuenta cable)');
check('instalación: los postes salen separados por comas', valor(instalacion, 'Posteadura'), 'P-12, P-13');
check('cambio de equipo: el tipo y el serial del equipo nuevo (serial destacado)', datosParaConfirmar({ tipoVisita: 'CAMBIO_EQUIPO', tipoEquipoNuevo: 'MR', serialEquipo: '54504C47BDAA8E40', observacionTecnico: 'ok' }).slice(0, 2), [{ etiqueta: 'Tipo de equipo nuevo', valor: 'MR', destacado: false }, { etiqueta: 'Serial del equipo nuevo', valor: '54504C47BDAA8E40', destacado: true }]);
check('visita de conector externo: NAP y conectores', etiquetas({ tipoVisita: 'CONECTOR_EXTERNO', nap: 'N1 - Puerto 2', conectoresUsados: { verde: 2, azul: 1 }, observacionTecnico: 'x' }), ['NAP y puerto', 'Conectores usados', 'Observación']);
check('recableado: los metros de cable', valor({ tipoVisita: 'RECABLEADO', metrosCable: 250, observacionTecnico: 'x' }, 'Metros de cable'), '250 m');
check('una visita sin datos especiales solo muestra la observación', etiquetas({ tipoVisita: 'CONFIG_ROUTER', observacionTecnico: 'Configurado' }), ['Observación']);
check('sin datos no hay nada que mostrar', datosParaConfirmar(null), []);

// --- Siempre pasa por la confirmación ---
const modal = leer('../src/components/modals/PreFinalizarModal.jsx');
const confirmacion = leer('../src/components/modals/ConfirmPreFinalizarModal.jsx');
const alEnviar = modal.slice(modal.indexOf('const handleSubmit'), modal.indexOf('const confirmarPreFinalizar'));
check('el formulario NO envía directo: al confirmar solo abre la confirmación (setPorConfirmar)', alEnviar.includes('setPorConfirmar(') && !alEnviar.includes('onConfirm('), true);
check('solo "Sí, pre-finalizar" envía la orden (confirmarPreFinalizar llama a onConfirm)', modal.slice(modal.indexOf('const confirmarPreFinalizar')).split('};')[0].includes('onConfirm(ticket, porConfirmar)'), true);
check('la confirmación recibe los datos que se envían y el pago', modal.includes('datos={datosParaConfirmar(porConfirmar)}') && modal.includes('pago={porConfirmar.pagoCliente'), true);
check('"Volver" es el primer botón (recibe el cursor al abrir): un toque de más no envía', confirmacion.indexOf('onClick={onCancel}') < confirmacion.indexOf('onClick={onConfirm}'), true);
check('la confirmación muestra los datos que se envían', confirmacion.includes('DATOS QUE SE ENVÍAN') && confirmacion.includes('datos.map('), true);
check('Escape con la confirmación abierta cierra solo la confirmación (no pierde lo escrito)', modal.includes('if (!porConfirmar) onClose()'), true);

if (failures > 0) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las pruebas pasaron.');
