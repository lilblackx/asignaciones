// Prueba que los campos que aparecen al pulsar "El cliente paga después" (pago del cliente) y "Devolver" (aprobar una orden) hacen bajar la pantalla hasta ellos y reciben el foco, con el mismo hook
// (src/hooks/useMostrarAlAparecer.js): el bloque lo usa como `ref`, la pantalla baja suave (o sin animación con "reducir movimiento") y el foco no mueve la pantalla por su cuenta. No necesita el emulador.
// Uso: `npm run test:aparecer`.
import { readFileSync } from 'node:fs';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const leer = (ruta) => readFileSync(ruta, 'utf8');
const hook = leer('src/hooks/useMostrarAlAparecer.js');
const pago = leer('src/components/FormularioPagoCliente.jsx');
const aprobar = leer('src/components/modals/AprobarFinalizarModal.jsx');

check('el hook baja la pantalla suave, espera el despliegue, respeta "reducir movimiento" y da el foco sin mover la pantalla', [
  hook.includes("behavior: sinMovimiento ? 'auto' : 'smooth'"), hook.includes('DURACION_PLIEGUE_MS'), hook.includes('prefers-reduced-motion: reduce'), hook.includes('focus({ preventScroll: true })'), hook.includes('scrollMarginBottom'),
], [true, true, true, true, true]);
check('"El cliente paga después": el bloque nuevo usa el hook y el foco va a la nota', [pago.includes('useMostrarAlAparecer({ enfocar: `${idPrefijo}-nota-pendiente` })'), pago.includes('<div ref={mostrarPagaDespues}'), pago.includes("id={id('nota-pendiente')}")], [true, true, true]);
check('"Devolver": el bloque del motivo usa el hook, deja libre la barra de botones y el foco va al motivo', [aprobar.includes("useMostrarAlAparecer({ margenInferior: porPasos ? 8 : 88, enfocar: 'aprobar-motivo' })"), aprobar.includes('<div ref={mostrarMotivo}'), aprobar.includes('id="aprobar-motivo"')], [true, true, true]);
check('el motivo de la devolución tiene un solo id y su etiqueta apunta a él (antes tenía dos y la etiqueta no lo enlazaba)', [(aprobar.match(/id="motivo-devolucion"/g) || []).length, aprobar.includes('htmlFor="aprobar-motivo"'), aprobar.includes('autoFocus')], [0, true, false]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
