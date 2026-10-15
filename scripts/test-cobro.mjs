// Prueba el cobro que se informa al técnico al finalizar (src/utils/cobro.js): "Visita técnica"
// (el monto de siempre) u "Otro monto" (escrito a mano). No necesita el emulador.
// Uso: `npm run test:cobro`.
import { COBRO_EXONERADO, COBRO_INICIAL, COBRO_OTRO, COBRO_VISITA, ETIQUETA_COBRO, MONEDA_BS, MONEDA_USD, camposCobro, conceptoCobro, detalleCobro, estaExonerado, formatoMontoBs, llevaCobro, monedaDe, parseMontoBs, resolverCobro, textoMonto, tieneCobroFinal, valorCobro } from '../src/utils/cobro.js';
import { avisaCobroAlPreFinalizar, generaCobro } from '../src/utils/tipoVisita.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

// --- Monto escrito a mano ---
check('montos válidos', ['5000', '5000,5', '5000,50', '0,5', '123456789'].map(m => parseMontoBs(m).valor), [5000, 5000.5, 5000.5, 0.5, 123456789]);
check('vacío: hay que escribir el monto', parseMontoBs('  ').error, 'Escribe el monto a cobrar.');
check('cero no es válido', [parseMontoBs('0').error, parseMontoBs('0,00').error], ['El monto debe ser mayor a 0.', 'El monto debe ser mayor a 0.']);
check('puntos, letras, negativos, tres decimales o demasiadas cifras: no válidos',
  ['5.000', 'abc', '-5', '5,123', '1234567890', '5,'].map(m => Boolean(parseMontoBs(m).error)), [true, true, true, true, true, true]);

// --- Formato ---
check('formato con separador de miles y coma decimal', [formatoMontoBs(12345), formatoMontoBs(12345.5)], ['12.345', '12.345,5']);

// --- Qué cobro se guarda ---
check('"Visita técnica" usa el monto de siempre', resolverCobro({ modo: COBRO_VISITA, otro: '999' }, '5.696'), { cobroBs: '5.696', tipo: COBRO_VISITA, moneda: MONEDA_BS });
check('por defecto es la visita técnica', resolverCobro(COBRO_INICIAL, '5.696'), { cobroBs: '5.696', tipo: COBRO_VISITA, moneda: MONEDA_BS });
check('"Visita técnica" sin tasa configurada no lleva monto', resolverCobro(COBRO_INICIAL, null), { cobroBs: null, tipo: COBRO_VISITA, moneda: MONEDA_BS });
check('"Otro monto" usa el monto escrito', resolverCobro({ modo: COBRO_OTRO, otro: '12345' }, '5.696'), { cobroBs: '12.345', tipo: COBRO_OTRO, moneda: MONEDA_BS });
check('"Otro monto" con decimales', resolverCobro({ modo: COBRO_OTRO, otro: '12345,5' }, '5.696'), { cobroBs: '12.345,5', tipo: COBRO_OTRO, moneda: MONEDA_BS });
check('"Otro monto" sin escribir el monto es un error', resolverCobro({ modo: COBRO_OTRO, otro: '' }, '5.696'), { error: 'Escribe el monto a cobrar.' });
check('"Otro monto" inválido es un error y no cae al monto de siempre', Boolean(resolverCobro({ modo: COBRO_OTRO, otro: '5.000' }, '5.696').error), true);
check('"Exonerar" no lleva monto, aunque haya uno escrito', resolverCobro({ modo: COBRO_EXONERADO, otro: '12345' }, '5.696'), { cobroBs: null, tipo: COBRO_EXONERADO, moneda: MONEDA_BS });
check('"Exonerar" no exige escribir nada', Boolean(resolverCobro({ modo: COBRO_EXONERADO, otro: '' }, null).error), false);
check('etiquetas', [ETIQUETA_COBRO[COBRO_VISITA], ETIQUETA_COBRO[COBRO_OTRO], ETIQUETA_COBRO[COBRO_EXONERADO]], ['Visita técnica', 'Otro monto', 'Exonerar']);

// --- Cobro ya registrado en la orden ---
const conMonto = { tipoVisita: 'CONECTOR_EXTERNO', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA' };
const exonerada = { tipoVisita: 'CONECTOR_INTERNO', cobroTipo: 'EXONERADO' };
check('una orden exonerada se reconoce', [estaExonerado(exonerada), estaExonerado(conMonto), estaExonerado(null)], [true, false, false]);
check('hay aviso de cobro con monto o con exoneración, no sin ninguno de los dos',
  [conMonto, exonerada, { tipoVisita: 'CONECTOR_EXTERNO' }, { cobroBs: '5.696' }, { tipoVisita: 'RECABLEADO' }].map(tieneCobroFinal), [true, true, false, true, false]);
check('lo avisado es el monto o "EXONERADO"', [valorCobro(conMonto), valorCobro(exonerada), valorCobro({})], ['5.696', 'EXONERADO', '']);
check('pasar de monto a exonerado cambia lo avisado (se vuelve a avisar)', valorCobro(conMonto) !== valorCobro({ ...conMonto, cobroTipo: 'EXONERADO', cobroBs: null }), true);

// --- Cuándo ve el técnico el aviso ---
check('solo el conector interno avisa el cobro al pre-finalizar',
  ['', 'CONECTOR_EXTERNO', 'CONECTOR_INTERNO', 'RECABLEADO'].map(avisaCobroAlPreFinalizar), [false, false, true, false]);
check('lo que no genera cobro no lo avisa en ningún momento',
  ['', 'RECABLEADO'].map(t => generaCobro(t) || avisaCobroAlPreFinalizar(t)), [false, false]);

// --- Toda orden lleva cobro, menos las instalaciones: se elige al aprobar o finalizar, sin importar el tipo de visita ---
const instalacion = { tipoTrabajo: 'INSTALACIÓN', estado: 'FINALIZADO', cobroBs: '5.696' };
check('toda orden lleva cobro, menos las instalaciones (visitas de conector, recableado, averías...)',
  [{ tipoTrabajo: 'INSTALACIÓN' }, { tipoTrabajo: 'instalacion' }, { tipoTrabajo: 'AVERÍA', tipoVisita: 'CONECTOR_INTERNO' }, { tipoTrabajo: 'AVERÍA', tipoVisita: 'CONECTOR_EXTERNO' }, { tipoTrabajo: 'AVERÍA', tipoVisita: 'RECABLEADO' }, { tipoTrabajo: 'AVERÍA' }, null].map(llevaCobro),
  [false, false, true, true, true, true, false]);
check('una instalación nunca tiene cobro que avisar, ni con monto ni exonerada',
  [instalacion, { ...instalacion, cobroBs: null, cobroTipo: 'EXONERADO' }, { ...instalacion, cobroBs: undefined }].map(tieneCobroFinal), [false, false, false]);
check('lo avisado de una instalación es el monto o "EXONERADO"', [valorCobro(instalacion), valorCobro({ ...instalacion, cobroTipo: 'EXONERADO', cobroBs: null })], ['5.696', 'EXONERADO']);
check('cualquier orden finalizada con monto o exonerada tiene cobro que avisar',
  [{ tipoTrabajo: 'AVERÍA', cobroBs: '5.696' }, { tipoTrabajo: 'RECONEXIÓN', cobroBs: null, cobroTipo: 'EXONERADO' }, { tipoTrabajo: 'MUDANZA', tipoVisita: 'RECABLEADO', cobroBs: '12.345' }, { tipoTrabajo: 'AVERÍA' }].map(tieneCobroFinal),
  [true, true, true, false]);
check('nombre de lo que se cobra: el tipo de visita o, sin visita, el tipo de trabajo',
  [{ tipoTrabajo: 'INSTALACIÓN' }, { tipoVisita: 'CONECTOR_INTERNO' }, { tipoTrabajo: 'INSTALACIÓN', tipoVisita: 'CONECTOR_EXTERNO' }, { tipoTrabajo: 'AVERÍA', tipoVisita: 'RECABLEADO' }, { tipoTrabajo: 'AVERÍA' }, { tipoTrabajo: 'VALIDACION NAP' }, {}, null].map(conceptoCobro),
  ['Instalación', 'Conector interno', 'Conector externo', 'Recableado', 'Avería', 'Validacion nap', 'Orden', 'Orden']);

// --- Historial de la orden ---
check('el historial lleva el monto con su tipo', [detalleCobro('5.696', COBRO_VISITA, false), detalleCobro('12.345', COBRO_OTRO, false)],
  [' | Cobro resultante: 5.696 Bs (Visita técnica)', ' | Cobro resultante: 12.345 Bs (Otro monto)']);
check('el historial lleva la exoneración', detalleCobro(null, COBRO_EXONERADO, true), ' | Visita exonerada: sin cobro al cliente');
check('sin monto ni exoneración no se agrega nada (sin tasa, sin cobro)', [detalleCobro(null, COBRO_VISITA, false), detalleCobro('', undefined, false)], ['', '']);
check('un monto sin tipo conocido se registra sin etiqueta', detalleCobro('5.696', undefined, false), ' | Cobro resultante: 5.696 Bs');

// --- Moneda del cobro: solo "Otro monto" puede ir en dólares ---
check('"Otro monto" en dólares', resolverCobro({ modo: COBRO_OTRO, otro: '30', moneda: MONEDA_USD }, '5.696'), { cobroBs: '30', tipo: COBRO_OTRO, moneda: MONEDA_USD });
check('"Otro monto" sin moneda elegida es Bs', resolverCobro({ modo: COBRO_OTRO, otro: '30' }, '5.696').moneda, MONEDA_BS);
check('"Visita técnica" siempre en Bs, aunque haya $ elegido', resolverCobro({ modo: COBRO_VISITA, otro: '30', moneda: MONEDA_USD }, '5.696'), { cobroBs: '5.696', tipo: COBRO_VISITA, moneda: MONEDA_BS });
check('"Exonerar" no lleva moneda', resolverCobro({ modo: COBRO_EXONERADO, otro: '30', moneda: MONEDA_USD }, '5.696').moneda, MONEDA_BS);
check('moneda de una orden: sin campo (órdenes anteriores) es Bs', [monedaDe({}), monedaDe({ cobroMoneda: 'USD' }), monedaDe(null)], [MONEDA_BS, MONEDA_USD, MONEDA_BS]);
check('texto del monto', [textoMonto('5.696', MONEDA_BS), textoMonto('30', MONEDA_USD), textoMonto('5.696', undefined)], ['5.696 Bs', '30 $', '5.696 Bs']);
check('lo avisado en dólares es distinto del mismo número en Bs (se vuelve a avisar)', [valorCobro({ cobroBs: '30' }), valorCobro({ cobroBs: '30', cobroMoneda: 'USD' })], ['30', '30 $']);
check('el historial lleva la moneda', detalleCobro('30', COBRO_OTRO, false, MONEDA_USD), ' | Cobro resultante: 30 $ (Otro monto)');
check('campos que se guardan: $ queda marcado; Bs borra la moneda vieja; exonerar también',
  [camposCobro({ cobroBs: '30', cobroTipo: COBRO_OTRO, moneda: MONEDA_USD }), camposCobro({ cobroBs: '5.696', cobroTipo: COBRO_VISITA, moneda: MONEDA_BS }), camposCobro({ exonerado: true }), camposCobro({})],
  [{ cobroBs: '30', cobroTipo: COBRO_OTRO, cobroMoneda: MONEDA_USD }, { cobroBs: '5.696', cobroTipo: COBRO_VISITA, cobroMoneda: null }, { cobroTipo: COBRO_EXONERADO, cobroBs: null, cobroMoneda: null }, {}]);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
