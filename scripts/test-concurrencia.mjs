// Prueba los textos y las reglas de la carrera entre dos personas sobre la misma orden (src/utils/concurrencia.js): qué se le dice a quien llega
// tarde, quién y cuándo lo hizo, y cuándo una orden abierta en un modal ya cambió. No necesita el emulador.
// Uso: `npm run test:concurrencia`.
import { ConflictoOrdenError, cambioMientrasAbierta, textoCambioDeOrden, ultimaAccion, verificarEstado } from '../src/utils/concurrencia.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const aprobada = { id: 'a', estado: 'FINALIZADO', historialEdiciones: [{ operador: 'creada' }, { operador: 'ana', fecha: '20/10/2026, 10:42', tipo: 'aprobado' }] };
const pre = { id: 'a', estado: 'PRE-FINALIZADO', historialEdiciones: [] };

check('la última acción dice quién y cuándo', ultimaAccion(aprobada), { por: 'ana', cuando: '20/10/2026, 10:42' });
check('sin historial no se inventa nada', ultimaAccion({ id: 'x' }), { por: '', cuando: '' });
check('si ya la finalizó otra persona, el texto dice quién y a qué hora', textoCambioDeOrden(aprobada, 'PRE-FINALIZADO'), 'Esta orden ya fue finalizada por ana (20/10/2026, 10:42). No se guardó tu cambio.');
check('sin saber quién, el texto no lo inventa', textoCambioDeOrden({ estado: 'FINALIZADO' }, 'PRE-FINALIZADO'), 'Esta orden ya fue finalizada. No se guardó tu cambio.');
check('cancelada', textoCambioDeOrden({ estado: 'CANCELADO' }).includes('ya fue cancelada'), true);
check('si el técnico la pre-finalizó mientras tanto, se le dice que la vuelva a abrir', textoCambioDeOrden(pre, 'PENDIENTE').includes('vuelve a abrirla'), true);
check('si la devolvieron al técnico mientras tanto', textoCambioDeOrden({ estado: 'PENDIENTE' }, 'PRE-FINALIZADO').includes('devuelta al técnico'), true);
check('una orden que ya no existe', textoCambioDeOrden(null).includes('ya no está disponible'), true);

// --- La verificación que va dentro de la transacción ---
const aprobar = verificarEstado(['PRE-FINALIZADO']);
check('aprobar: una orden todavía pre-finalizada pasa', aprobar(pre), null);
check('aprobar: si ya está finalizada, no pasa y dice por qué', aprobar(aprobada), 'Esta orden ya fue finalizada por ana (20/10/2026, 10:42). No se guardó tu cambio.');
check('aprobar: si ya no existe, no pasa', aprobar(null) !== null, true);
const finalizar = verificarEstado(['PENDIENTE'], (o) => !o.esperando);
check('finalizar: pendiente pasa; pendiente que espera a infraestructura no', [finalizar({ estado: 'PENDIENTE' }), finalizar({ estado: 'PENDIENTE', esperando: true }) !== null], [null, true]);
check('finalizar: si otra persona ya la finalizó, no pasa', finalizar(aprobada) !== null, true);

// --- Con la orden abierta en un modal ---
check('sin cambios no hay aviso', cambioMientrasAbierta(pre, { ...pre, observacion: 'otra cosa' }), null);
check('si otra persona la finaliza mientras está abierta, avisa', cambioMientrasAbierta(pre, aprobada).includes('ya fue finalizada por ana'), true);
check('si desaparece de la lista, avisa', cambioMientrasAbierta(pre, null).includes('ya no está disponible'), true);
check('sin orden abierta no hay nada que comparar', cambioMientrasAbierta(null, aprobada), null);
check('el error de conflicto lleva el texto y es reconocible', (() => { const e = new ConflictoOrdenError('x'); return [e instanceof ConflictoOrdenError, e instanceof Error, e.message]; })(), [true, true, 'x']);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
