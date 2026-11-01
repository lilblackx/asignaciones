// Prueba cuándo un aviso de la campana se da por atendido y se quita solo (src/utils/avisoAtendido.js). No necesita el emulador.
import { avisoAtendido } from '../src/utils/avisoAtendido.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

const aviso = (type, ticketId = 'a') => ({ id: 'n1', type, ticketId, text: 'x' });
const orden = (extra = {}) => ({ id: 'a', estado: 'PENDIENTE', tecnico: 'G', ...extra });

// --- Técnico ---
check('asignación: sigue pendiente, se queda', avisoAtendido(aviso('nuevaAsignacion'), orden(), false), false);
check('asignación: ya la mandó a aprobar, se quita', avisoAtendido(aviso('nuevaAsignacion'), orden({ estado: 'PRE-FINALIZADO' }), false), true);
check('asignación: ya se finalizó o canceló, se quita', ['FINALIZADO', 'CANCELADO'].map(estado => avisoAtendido(aviso('nuevaAsignacion'), orden({ estado }), false)), [true, true]);
check('asignación: la orden ya no está (la reasignaron), se quita', avisoAtendido(aviso('nuevaAsignacion'), undefined, false), true);
check('prioridad: sigue con prioridad alta, se queda', avisoAtendido(aviso('prioridad'), orden({ prioridadAlta: true }), false), false);
check('prioridad: le quitaron la prioridad, se quita', avisoAtendido(aviso('prioridad'), orden({ prioridadAlta: false }), false), true);
check('prioridad: ya la atendió, se quita', avisoAtendido(aviso('prioridad'), orden({ prioridadAlta: true, estado: 'PRE-FINALIZADO' }), false), true);
check('devuelta: sigue pendiente, se queda; ya la volvió a enviar, se quita',
  [orden(), orden({ estado: 'PRE-FINALIZADO' })].map(t => avisoAtendido(aviso('devuelto'), t, false)), [false, true]);
const consulta = { metros: 30, pedidaEn: 100 };
check('respuesta de cobro: orden pendiente se queda; orden ya cerrada se quita',
  [orden({ consultaCobro: consulta }), orden({ estado: 'FINALIZADO' })].map(t => avisoAtendido(aviso('respuestaCobro'), t, false)), [false, true]);

// --- Oficina ---
check('pre-finalizado: sigue esperando, se queda', avisoAtendido(aviso('prefinalizado'), orden({ estado: 'PRE-FINALIZADO' }), true), false);
check('pre-finalizado: ya se aprobó, se quita', avisoAtendido(aviso('prefinalizado'), orden({ estado: 'FINALIZADO' }), true), true);
check('pre-finalizado: ya se devolvió al técnico, se quita', avisoAtendido(aviso('prefinalizado'), orden({ estado: 'PENDIENTE' }), true), true);
check('nueva venta: sin técnico se queda; con técnico se quita',
  [orden({ tecnico: '' }), orden({ tecnico: 'Gabriel' })].map(t => avisoAtendido(aviso('nuevaVenta'), t, true)), [false, true]);
check('nueva venta: cancelada se quita', avisoAtendido(aviso('nuevaVenta'), orden({ tecnico: '', estado: 'CANCELADO' }), true), true);
check('consulta de cobro: sin responder se queda; respondida se quita',
  [orden({ consultaCobro: consulta }), orden({ consultaCobro: consulta, respuestaCobro: { en: 200, monto: 5 } })].map(t => avisoAtendido(aviso('consultaCobro'), t, true)), [false, true]);
check('en camino y llegada: pendiente se queda; ya cerrada se quita',
  ['encamino', 'llegada'].map(tipo => [orden(), orden({ estado: 'PRE-FINALIZADO' })].map(t => avisoAtendido(aviso(tipo), t, true))), [[false, true], [false, true]]);
const enInfra = { activa: true, en: 100, origen: 'TECNICO' };
check('infraestructura (oficina): esperando se queda; resuelta se quita',
  [orden({ infraestructura: enInfra }), orden({ infraestructura: { ...enInfra, activa: false } })].map(t => avisoAtendido(aviso('infraestructura'), t, true)), [false, true]);
check('infraestructura (técnico): nunca se quita solo', [orden({ infraestructura: enInfra }), orden(), undefined].map(t => avisoAtendido(aviso('infraestructura'), t, false)), [false, false, false]);

// --- Lo que nunca se quita solo ---
check('avisos que solo informan se quedan aunque la orden esté cerrada',
  ['cancelada', 'aprobado', 'desasignada', 'pagoTecnico', 'pagoCliente', 'cierreAutomatico', 'tecnicoStatus'].map(tipo => avisoAtendido(aviso(tipo), orden({ estado: 'FINALIZADO' }), true)),
  [false, false, false, false, false, false, false]);
check('avisos de varias órdenes (sin ticketId) se quedan', avisoAtendido({ id: 'n', type: 'prefinalizado', text: '3 órdenes' }, orden({ estado: 'FINALIZADO' }), true), false);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
