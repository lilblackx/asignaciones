// Prueba la consulta del cobro de un recableado (src/utils/consultaCobro.js): el técnico pregunta con los metros, la oficina
// responde un monto (Bs o $) o exonera, y esa respuesta llega ya elegida al aprobar. No necesita el emulador.
// Uso: `npm run test:consultacobro`.
import { cobroPrecargado, construirConsulta, construirRespuesta, consultaCobroDe, consultaPendiente, consultasNuevas, mapaConsultas, respuestaVigente, textoAvisoConsulta, textoAvisoRespuesta, textoRespuesta } from '../src/utils/consultaCobro.js';
import { COBRO_EXONERADO, COBRO_OTRO, MONEDA_BS, MONEDA_USD, resolverCobro } from '../src/utils/cobro.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

const T0 = 1_000_000;
const orden = (extra = {}) => ({ id: 'a', estado: 'PENDIENTE', tecnico: 'GERARDO', ...extra });

// --- La consulta del técnico ---
check('la consulta guarda los metros, la hora y quién la pidió', construirConsulta(250, 'GERARDO', T0), { metros: 250, pedidaEn: T0, pedidaPor: 'GERARDO' });
check('sin consulta no hay nada pendiente', [consultaCobroDe(orden()), consultaPendiente(orden())], [null, false]);
check('una consulta mal formada se ignora', consultaCobroDe(orden({ consultaCobro: { metros: '250' } })), null);
const consultada = orden({ consultaCobro: construirConsulta(250, 'GERARDO', T0) });
check('consultada y sin respuesta: pendiente', [consultaPendiente(consultada), respuestaVigente(consultada)], [true, null]);

// --- La respuesta de la oficina ---
const monto = construirRespuesta(consultada.consultaCobro, { exonerado: false, otro: '5000,5', moneda: MONEDA_BS }, 'LUIS', T0 + 60000);
check('un monto en Bs', monto.respuesta, { metros: 250, por: 'LUIS', en: T0 + 60000, exonerado: false, valor: 5000.5, monto: '5.000,5', moneda: MONEDA_BS });
const dolares = construirRespuesta(consultada.consultaCobro, { exonerado: false, otro: '30', moneda: MONEDA_USD }, 'LUIS', T0 + 60000);
check('un monto en dólares', [dolares.respuesta.monto, dolares.respuesta.moneda], ['30', MONEDA_USD]);
const exonerada = construirRespuesta(consultada.consultaCobro, { exonerado: true, otro: '999' }, 'LUIS', T0 + 60000);
check('exonerar no lleva monto, aunque haya uno escrito', [exonerada.respuesta.exonerado, exonerada.respuesta.valor, exonerada.respuesta.monto], [true, null, null]);
check('un monto vacío o inválido es un error', [construirRespuesta(consultada.consultaCobro, { otro: '' }).error, Boolean(construirRespuesta(consultada.consultaCobro, { otro: '5.000' }).error), Boolean(construirRespuesta(consultada.consultaCobro, { otro: '0' }).error)],
  ['Escribe el monto a cobrar.', true, true]);
check('sin consulta no se puede responder', construirRespuesta(null, { otro: '5000' }).error, 'La consulta ya no está disponible.');
check('el texto que ve el técnico', [textoRespuesta(monto.respuesta), textoRespuesta(dolares.respuesta), textoRespuesta(exonerada.respuesta)], ['5.000,5 Bs', '30 $', 'Exonerado, sin cobro']);

// --- Estado de la consulta ---
const respondida = { ...consultada, respuestaCobro: monto.respuesta };
check('respondida: ya no está pendiente y la respuesta vale', [consultaPendiente(respondida), respuestaVigente(respondida)?.monto], [false, '5.000,5']);
const reconsultada = { ...respondida, consultaCobro: construirConsulta(300, 'GERARDO', T0 + 120000) };
check('una consulta nueva (otros metros) deja sin vigencia la respuesta anterior', [consultaPendiente(reconsultada), respuestaVigente(reconsultada)], [true, null]);
const recordatorio = { ...respondida, consultaCobro: construirConsulta(250, 'GERARDO', T0 + 120000) };
check('un recordatorio también la deja pendiente (la oficina responde de nuevo)', [consultaPendiente(recordatorio), respuestaVigente(recordatorio)], [true, null]);

// --- Al aprobar: la respuesta llega elegida ---
check('un monto llega como "Otro monto" con su moneda', cobroPrecargado(respondida), { modo: COBRO_OTRO, otro: '5000,5', moneda: MONEDA_BS });
check('el monto precargado se puede confirmar tal cual', resolverCobro(cobroPrecargado(respondida), null), { cobroBs: '5.000,5', tipo: COBRO_OTRO, moneda: MONEDA_BS });
check('en dólares llega en dólares', resolverCobro(cobroPrecargado({ ...consultada, respuestaCobro: dolares.respuesta }), null), { cobroBs: '30', tipo: COBRO_OTRO, moneda: MONEDA_USD });
check('una exoneración llega como "Exonerar"', cobroPrecargado({ ...consultada, respuestaCobro: exonerada.respuesta }), { modo: COBRO_EXONERADO, otro: '', moneda: MONEDA_BS });
check('con los mismos metros que se consultaron se precarga', cobroPrecargado({ ...respondida, metrosCable: 250 })?.modo, COBRO_OTRO);
check('si el técnico terminó usando otros metros, no se precarga (la oficina elige)', cobroPrecargado({ ...respondida, metrosCable: 300 }), null);
check('sin respuesta vigente no se precarga', [cobroPrecargado(consultada), cobroPrecargado(reconsultada), cobroPrecargado(orden())], [null, null, null]);

// --- Avisos en la app abierta ---
const otra = orden({ id: 'b' });
const ids = (lista) => lista.map((t) => t.id);
check('al abrir la app (sin lectura anterior) no se avisa de lo que ya estaba', consultasNuevas([consultada], null), { consultas: [], respuestas: [] });
check('la oficina se entera de una consulta nueva', ids(consultasNuevas([consultada, otra], mapaConsultas([orden(), otra])).consultas), ['a']);
check('y no se repite si nada cambió', consultasNuevas([consultada], mapaConsultas([consultada])), { consultas: [], respuestas: [] });
check('una orden nueva que llega ya con consulta también se avisa', ids(consultasNuevas([consultada, otra], mapaConsultas([otra])).consultas), ['a']);
check('un recordatorio (consulta más reciente) se vuelve a avisar', ids(consultasNuevas([recordatorio], mapaConsultas([consultada])).consultas), ['a']);
check('una consulta ya respondida no se avisa a la oficina', consultasNuevas([respondida], mapaConsultas([orden()])).consultas, []);
check('el técnico se entera de la respuesta', ids(consultasNuevas([respondida], mapaConsultas([consultada])).respuestas), ['a']);
check('y no se repite', consultasNuevas([respondida], mapaConsultas([respondida])).respuestas, []);
check('una respuesta que cambia (la oficina corrige el monto) se avisa de nuevo', ids(consultasNuevas([{ ...respondida, respuestaCobro: { ...monto.respuesta, en: T0 + 90000 } }], mapaConsultas([respondida])).respuestas), ['a']);
check('el texto del aviso a la oficina', textoAvisoConsulta({ ...consultada, codigo: 'AS1' }), 'GERARDO pregunta el cobro del recableado de AS1 (250 m).');
check('el texto del aviso al técnico', textoAvisoRespuesta({ ...respondida, codigo: 'AS1' }), 'AS1 (250 m): 5.000,5 Bs.');

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
