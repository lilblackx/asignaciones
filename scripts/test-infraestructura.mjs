// Prueba "Escalar a infraestructura": cuándo una orden está esperando, la validación del motivo, la resolución y los avisos en la app
// (src/utils/infraestructura.js). No necesita el emulador.
// Uso: `npm run test:infraestructura`.
import {
  construirEscalada, construirResolucion, cambiosInfraestructura, cerradaComoTA, enInfraestructura, fueEscalada, mapaInfraestructura,
  parseMotivo, puedeEscalar, textoResueltaTecnico,
} from '../src/utils/infraestructura.js';
import { llevaCobro } from '../src/utils/cobro.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const T0 = 1800000000000;
const averia = { id: 'a', codigo: 'AO230', nombre: 'Javier', estado: 'PENDIENTE', tecnico: 'GERARDO', tipoTrabajo: 'AVERÍA' };
const escalada = (extra = {}) => ({ ...averia, infraestructura: construirEscalada({ motivo: 'Falta un poste', por: 'gerardo', origen: 'TECNICO', tecnico: 'GERARDO' }, T0), ...extra });

// --- Motivo ---
check('el motivo es obligatorio', parseMotivo('   ').error !== undefined, true);
check('el motivo se limpia de espacios', parseMotivo('  Falta   un poste  ').valor, 'Falta un poste');
check('un motivo larguísimo se rechaza', parseMotivo('x'.repeat(301)).error !== undefined, true);
check('trescientos caracteres justos valen', parseMotivo('x'.repeat(300)).valor?.length, 300);

// --- Cuándo se puede escalar y cuándo espera ---
check('una avería pendiente se puede escalar', puedeEscalar(averia), true);
check('una instalación no se escala', puedeEscalar({ ...averia, tipoTrabajo: 'INSTALACIÓN' }), false);
check('una orden pre-finalizada no se escala (se aprueba o se devuelve)', puedeEscalar({ ...averia, estado: 'PRE-FINALIZADO' }), false);
check('una orden que ya espera no se escala otra vez', puedeEscalar(escalada()), false);
check('la orden escalada espera', enInfraestructura(escalada()), true);
check('una orden sin escalar no espera', enInfraestructura(averia), false);
check('si la cancelan ya no espera, pero sigue escalada', [enInfraestructura(escalada({ estado: 'CANCELADO' })), fueEscalada(escalada({ estado: 'CANCELADO' }))], [false, true]);

// --- Resolución ---
const devuelta = { ...escalada(), infraestructura: construirResolucion(escalada().infraestructura, { resultado: 'DEVUELTA', por: 'ana', nota: '  Poste puesto ' }, T0 + 1000) };
check('devuelta: deja de esperar y queda a la vista como escalada', [enInfraestructura(devuelta), fueEscalada(devuelta)], [false, true]);
check('devuelta: guarda quién, cuándo y la nota', [devuelta.infraestructura.resueltaPor, devuelta.infraestructura.resueltaEn, devuelta.infraestructura.nota], ['ana', T0 + 1000, 'Poste puesto']);
check('devuelta: conserva el motivo y el origen', [devuelta.infraestructura.motivo, devuelta.infraestructura.origen], ['Falta un poste', 'TECNICO']);
const sinNota = construirResolucion(devuelta.infraestructura, { resultado: 'CERRADA', por: 'ana' }, T0 + 2000);
check('al resolver otra vez la nota anterior no se arrastra', 'nota' in sinNota, false);
const cerrada = { ...escalada(), estado: 'FINALIZADO', infraestructura: construirResolucion(escalada().infraestructura, { resultado: 'CERRADA', por: 'ana' }, T0 + 1000) };
check('cerrada como TA', cerradaComoTA(cerrada), true);
check('la devuelta no es TA cerrada', cerradaComoTA({ ...devuelta, estado: 'FINALIZADO' }), false);
check('un resultado desconocido cuenta como devuelta', construirResolucion({}, { resultado: 'X' }, T0).resultado, 'DEVUELTA');

// --- Cobro: un TA cerrado no lleva cobro; una devuelta que se completa sí ---
check('el TA cerrado no lleva cobro', llevaCobro(cerrada), false);
check('la orden devuelta y finalizada normal sí lleva cobro', llevaCobro({ ...devuelta, estado: 'FINALIZADO' }), true);
check('una avería común lleva cobro', llevaCobro(averia), true);

// --- Avisos ---
check('sin lectura anterior no hay avisos', cambiosInfraestructura([escalada()], null), { escaladas: [], resueltas: [] });
const antes = mapaInfraestructura([averia]);
check('una orden que empieza a esperar es una escalada nueva', cambiosInfraestructura([escalada()], antes).escaladas.map((t) => t.id), ['a']);
check('si ya esperaba no se avisa otra vez', cambiosInfraestructura([escalada()], mapaInfraestructura([escalada()])).escaladas, []);
check('al resolverla se avisa', cambiosInfraestructura([devuelta], mapaInfraestructura([escalada()])).resueltas.map((t) => t.id), ['a']);
check('una orden que nunca esperó no es resuelta', cambiosInfraestructura([averia], mapaInfraestructura([averia])).resueltas, []);
check('el aviso de devuelta lleva la nota', textoResueltaTecnico(devuelta).includes('Poste puesto'), true);
check('el aviso de cerrada lo dice', textoResueltaTecnico(cerrada).includes('se cerró'), true);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
