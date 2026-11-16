// Prueba el aviso para Finanzas de una orden pagada que se cancela o cambia de tipo (src/utils/avisoOrdenPagada.js). No necesita el emulador. Uso: `npm run test:avisoordenpagada`.
import { armarAviso, avisosVigentes, cambioQueAvisa, textoDelAviso, tipoDeOrden } from '../src/utils/avisoOrdenPagada.js';

let failures = 0;
function check(name, actual, esperado) {
  const ok = JSON.stringify(actual) === JSON.stringify(esperado);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log('      esperado:', JSON.stringify(esperado), '\n      recibido:', JSON.stringify(actual));
}

const fin = { id: 'o1', codigo: 'AN1', tecnico: 'JOSE', tipoTrabajo: 'AVERÍA', tipoVisita: 'VISITA_TECNICA', estado: 'FINALIZADO', finalizadoEn: 100, cobroBs: '5.696' };
check('el tipo de la orden junta el tipo de trabajo y el de visita', tipoDeOrden(fin), 'AVERÍA - VISITA_TECNICA');
check('exonerar la orden no avisa', cambioQueAvisa(fin, { ...fin, cobroTipo: 'EXONERADO', cobroBs: null }), null);
check('devolverla a pre-finalizada sin cambiar el tipo no avisa', cambioQueAvisa(fin, { ...fin, estado: 'PRE-FINALIZADO' }), null);
check('cancelar una orden finalizada avisa', cambioQueAvisa(fin, { ...fin, estado: 'CANCELADO' }), { tipo: 'CANCELADA', antes: 'FINALIZADO', despues: 'CANCELADO' });
check('cambiar el tipo de trabajo avisa', cambioQueAvisa(fin, { ...fin, tipoTrabajo: 'INSTALACIÓN' }), { tipo: 'TIPO', antes: 'AVERÍA - VISITA_TECNICA', despues: 'INSTALACIÓN - VISITA_TECNICA' });
check('cambiar el tipo de visita avisa', cambioQueAvisa(fin, { ...fin, tipoVisita: 'RECABLEADO' }).tipo, 'TIPO');
const devuelta = { ...fin, estado: 'PENDIENTE' };
check('una orden devuelta que ya se finalizó antes (finalizadoEn) sigue avisando al cancelarla', cambioQueAvisa(devuelta, { ...devuelta, estado: 'CANCELADO' })?.tipo, 'CANCELADA');
check('una orden que nunca se finalizó no avisa', [cambioQueAvisa({ ...fin, estado: 'PENDIENTE', finalizadoEn: undefined }, { ...fin, estado: 'CANCELADO', finalizadoEn: undefined }), cambioQueAvisa({ ...fin, estado: 'PENDIENTE', finalizadoEn: undefined }, { ...fin, estado: 'PENDIENTE', tipoTrabajo: 'MUDANZA', finalizadoEn: undefined })], [null, null]);
check('cancelar una ya cancelada no avisa otra vez', cambioQueAvisa({ ...fin, estado: 'CANCELADO' }, { ...fin, estado: 'CANCELADO' }), null);

const aviso = armarAviso(fin, { ...fin, estado: 'CANCELADO' }, { por: 'admin', ahora: 5000 });
check('el aviso trae la orden, el técnico, qué pasó, quién y cuándo', aviso, { ticketId: 'o1', clave: 'o1', codigo: 'AN1', tecnico: 'JOSE', tipo: 'CANCELADA', antes: 'FINALIZADO', despues: 'CANCELADO', por: 'admin', en: 5000, resuelto: false });
check('sin cambio que avisar no hay aviso', armarAviso(fin, fin, { por: 'a', ahora: 1 }), null);

// avisosVigentes: solo lo de órdenes ya pagadas cuando cambiaron, sin resolver
const a1 = { id: 'a1', clave: 'o1', tipo: 'CANCELADA', en: 5000, resuelto: false, codigo: 'AN1', tecnico: 'JOSE' };
check('pagada antes del cambio: se ve con su pago', avisosVigentes([a1], { o1: '4000-JOSE' }).map((a) => [a.id, a.pagoId]), [['a1', '4000-JOSE']]);
check('pagada después del cambio (ya se pagó con el tipo nuevo): no avisa', avisosVigentes([a1], { o1: '6000-JOSE' }), []);
check('sin pago vigente (nunca se pagó o se anuló el pago): no avisa', avisosVigentes([a1], {}), []);
check('un aviso resuelto no se muestra', avisosVigentes([{ ...a1, resuelto: true }], { o1: '4000-JOSE' }), []);
check('los más recientes primero', avisosVigentes([a1, { ...a1, id: 'a2', en: 9000 }], { o1: '4000-JOSE' }).map((a) => a.id), ['a2', 'a1']);
check('el texto dice qué pasó', [textoDelAviso(a1), textoDelAviso({ id: 'a3', tipo: 'TIPO', codigo: 'AN2', tecnico: 'EDGAR', antes: 'AVERÍA', despues: 'INSTALACIÓN' })], ['AN1 (JOSE) se canceló después de pagarse.', 'AN2 (EDGAR) cambió de tipo después de pagarse: «AVERÍA» → «INSTALACIÓN».']);

if (failures) { console.log(`\n${failures} pruebas fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
