// Prueba el cobro acordado con el cliente al crear la orden (src/utils/cobroAcordado.js): se guarda, se preselecciona al finalizar y avisa
// en las garantías y cuando el técnico cambió el trabajo. No necesita el emulador.
// Uso: `npm run test:cobroacordado`.
import { COBRO_EXONERADO, COBRO_OTRO, COBRO_VISITA } from '../src/utils/cobro.js';
import {
  COBRO_SEL_INICIAL, avisoCambioDeTrabajo, cobroAcordadoDe, cobroInicialDeOrden, formularioCobroAcordado, mismoCobroAcordado, resolverCobroAcordado, sellarCobroAcordado,
  sugiereExonerar, textoCobroAcordado,
} from '../src/utils/cobroAcordado.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

// --- Del formulario a lo que se guarda ---
check('sin elegir nada ni escribir nota no se guarda nada', resolverCobroAcordado(COBRO_SEL_INICIAL), { valor: null });
check('solo una nota (sin definir) se guarda con la nota', resolverCobroAcordado({ ...COBRO_SEL_INICIAL, nota: '  revisión   de equipos ' }), { valor: { modo: '', monto: '', moneda: 'BS', nota: 'revisión de equipos' } });
check('visita técnica', resolverCobroAcordado({ ...COBRO_SEL_INICIAL, modo: COBRO_VISITA }), { valor: { modo: COBRO_VISITA, monto: '', moneda: 'BS', nota: '' } });
check('exonerada con su motivo', resolverCobroAcordado({ ...COBRO_SEL_INICIAL, modo: COBRO_EXONERADO, nota: 'cliente antiguo' }), { valor: { modo: COBRO_EXONERADO, monto: '', moneda: 'BS', nota: 'cliente antiguo' } });
check('otro monto en dólares', resolverCobroAcordado({ modo: COBRO_OTRO, otro: '30,00', moneda: 'USD', nota: '' }), { valor: { modo: COBRO_OTRO, monto: '30', moneda: 'USD', nota: '' } });
check('otro monto en bolívares con decimales', resolverCobroAcordado({ modo: COBRO_OTRO, otro: '5.696,50', moneda: 'BS', nota: '' }).valor.monto, '5.696,5');
check('otro monto sin escribir o en cero es un error', [resolverCobroAcordado({ modo: COBRO_OTRO, otro: '', moneda: 'BS' }).error, resolverCobroAcordado({ modo: COBRO_OTRO, otro: '0,00', moneda: 'BS' }).error], ['Escribe el monto a cobrar.', 'El monto debe ser mayor a 0.']);
check('un modo desconocido se trata como sin definir', resolverCobroAcordado({ modo: 'XX', nota: '' }), { valor: null });
check('la nota se corta a 200 letras', resolverCobroAcordado({ modo: '', nota: 'a'.repeat(300) }).valor.nota.length, 200);

// --- De la orden al formulario y de vuelta ---
const orden = (cobroAcordado, extra = {}) => ({ tipoTrabajo: 'AVERÍA', cobroAcordado, ...extra });
check('sin cobro acordado el formulario va vacío', formularioCobroAcordado(orden(undefined)), COBRO_SEL_INICIAL);
check('"otro monto" se muestra como lo escribe la calculadora', formularioCobroAcordado(orden({ modo: COBRO_OTRO, monto: '5.696,5', moneda: 'BS', nota: 'x' })), { modo: COBRO_OTRO, otro: '5.696,50', moneda: 'BS', nota: 'x' });
const ida = resolverCobroAcordado(formularioCobroAcordado(orden({ modo: COBRO_OTRO, monto: '30', moneda: 'USD', nota: '' }))).valor;
check('ida y vuelta no cambia el cobro', mismoCobroAcordado(ida, { modo: COBRO_OTRO, monto: '30', moneda: 'USD', nota: '' }), true);
check('cobroAcordadoDe ignora lo que no es válido', [cobroAcordadoDe({}), cobroAcordadoDe({ cobroAcordado: null }), cobroAcordadoDe({ cobroAcordado: 'x' }), cobroAcordadoDe({ cobroAcordado: { modo: 'XX', nota: '' } })], [null, null, null, null]);

// --- Quién lo anotó y cuándo ---
const previo = { modo: COBRO_EXONERADO, monto: '', moneda: 'BS', nota: '', por: 'rcova', en: 1000 };
check('sin cambios se conserva quién y cuándo', sellarCobroAcordado({ modo: COBRO_EXONERADO, monto: '', moneda: 'BS', nota: '' }, previo, { por: 'otro', en: 2000 }), previo);
check('si cambia se sella de nuevo', sellarCobroAcordado({ modo: COBRO_VISITA, monto: '', moneda: 'BS', nota: '' }, previo, { por: 'otro', en: 2000 }), { modo: COBRO_VISITA, monto: '', moneda: 'BS', nota: '', por: 'otro', en: 2000 });
check('quitar lo acordado lo borra', sellarCobroAcordado(null, previo, { por: 'otro' }), null);
check('dos "sin nada" son iguales', mismoCobroAcordado(null, undefined), true);

// --- Textos ---
check('texto del cobro acordado', [
  textoCobroAcordado(cobroAcordadoDe(orden({ modo: COBRO_EXONERADO, nota: 'revisión de equipos' }))),
  textoCobroAcordado(cobroAcordadoDe(orden({ modo: COBRO_OTRO, monto: '30', moneda: 'USD', nota: '' }))),
  textoCobroAcordado(cobroAcordadoDe(orden({ modo: COBRO_VISITA }))),
  textoCobroAcordado(cobroAcordadoDe(orden({ modo: '', nota: 'preguntar al cliente' }))),
  textoCobroAcordado(null),
], ['Exonerada · revisión de equipos', '30 $', 'Visita técnica', 'preguntar al cliente', '']);

// --- Al finalizar: el selector viene con lo acordado ---
check('sin lo acordado, el selector abre como siempre (visita técnica)', cobroInicialDeOrden(orden(undefined)), { modo: COBRO_VISITA, otro: '', moneda: 'BS' });
check('con solo una nota, igual que siempre', cobroInicialDeOrden(orden({ modo: '', nota: 'algo' })).modo, COBRO_VISITA);
check('exonerada viene elegida', cobroInicialDeOrden(orden({ modo: COBRO_EXONERADO })), { modo: COBRO_EXONERADO, otro: '', moneda: 'BS' });
check('otro monto viene con el monto y la moneda', cobroInicialDeOrden(orden({ modo: COBRO_OTRO, monto: '30', moneda: 'USD' })), { modo: COBRO_OTRO, otro: '30,00', moneda: 'USD' });

// --- Garantías y cambio de trabajo ---
check('la garantía sugiere no cobrar; los demás trabajos no', ['GARANTIA', 'garantía', 'AVERÍA', 'RECONEXIÓN'].map((tipoTrabajo) => sugiereExonerar({ tipoTrabajo })), [true, true, false, false]);
check('aviso cuando el técnico reportó otro trabajo y había cobro acordado', avisoCambioDeTrabajo(orden({ modo: COBRO_VISITA }, { tipoVisita: 'RECABLEADO' })), 'El técnico reportó "Recableado". Confirma que lo acordado (Visita técnica) sigue aplicando para este trabajo.');
check('sin cobro acordado, sin modo o sin tipo de visita no hay aviso', [avisoCambioDeTrabajo(orden(undefined, { tipoVisita: 'RECABLEADO' })), avisoCambioDeTrabajo(orden({ modo: '', nota: 'x' }, { tipoVisita: 'RECABLEADO' })), avisoCambioDeTrabajo(orden({ modo: COBRO_VISITA }))], ['', '', '']);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
