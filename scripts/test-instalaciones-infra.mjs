// Prueba el módulo de Infraestructura (las instalaciones realizadas con su NAP y puerto): qué órdenes entran, de dónde sale la NAP y el puerto, el período y el buscador, y que la
// pantalla no use hooks de edición. No necesita el emulador. Uso: `npm run test:instalacionesinfra`.
import { readFileSync } from 'node:fs';
import { ROLES } from '../src/constants.js';
import { desdePeriodo, filaInstalacion, filtrarInstalaciones, filtrarPorAnotada, instalacionesRealizadas, limitesRango, mesDeMarcas, mesesDeMarcas } from '../src/utils/instalacionesInfra.js';

let failures = 0;
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date('2026-10-21T15:00:00-04:00').getTime();
const orden = (id, extra = {}) => ({ id, codigo: `IO${id}`, nombre: `Cliente ${id}`, direccion: `Calle ${id}`, tecnico: 'GERARDO MOLERO', tipoTrabajo: 'INSTALACIÓN', estado: 'FINALIZADO', finalizadoEn: AHORA - 60000, ...extra });

check('el rol existe', ROLES.INFRAESTRUCTURA, 'INFRAESTRUCTURA');

// --- Qué entra ---
const vivas = [
  orden('1', { nap: 'NAP O02D10 - Puerto 3', instalacion: { puertosDisponibles: '5' } }),
  orden('2', { estado: 'PRE-FINALIZADO' }),
  orden('3', { tipoTrabajo: 'AVERÍA' }),
  orden('4', { estado: 'CANCELADO' }),
];
const cierre = { createdAt: AHORA - 2 * DIA, ticketsDetalle: [orden('1', { finalizadoEn: AHORA - 2 * DIA }), orden('5', { finalizadoEn: AHORA - 2 * DIA, instalacion: { nap: 'N10D14', puerto: '7', puertosDisponibles: '0' } }), orden('6', { tipoTrabajo: 'MUDANZA' })] };
const todas = instalacionesRealizadas(vivas, [cierre]);
check('solo instalaciones finalizadas, vivas y archivadas, sin repetir', todas.map((f) => f.id), ['1', '5']);
check('si una orden está viva y archivada, vale la viva', todas[0].fecha, AHORA - 60000);
check('de la más reciente a la más vieja', instalacionesRealizadas([orden('a', { finalizadoEn: 1000 }), orden('b', { finalizadoEn: 3000 }), orden('c', { finalizadoEn: 2000 })], []).map((f) => f.id), ['b', 'c', 'a']);

// --- NAP y puerto ---
check('NAP y puerto del texto de la orden', [todas[0].nap, todas[0].puerto, todas[0].puertosDisponibles], ['NAP O02D10', '3', '5']);
check('NAP y puerto sueltos de la instalación', [todas[1].nap, todas[1].puerto, todas[1].puertosDisponibles], ['N10D14', '7', '0']);
check('sin NAP queda vacío (la pantalla muestra -)', [filaInstalacion(orden('9')).nap, filaInstalacion(orden('9')).puerto], ['', '']);
check('la fecha de una archivada sin fecha propia es la del cierre', filaInstalacion({ ...orden('7'), finalizadoEn: undefined, _cierreEn: 5 }).fecha, 5);

// --- Período ---
check('"Hoy" cuenta desde las 12 de la noche', new Date(desdePeriodo('HOY', AHORA)).getHours(), 0);
check('"7 días" incluye hoy y los 6 anteriores', Math.round((desdePeriodo('HOY', AHORA) - desdePeriodo('7', AHORA)) / DIA), 6);
check('"30 días" incluye hoy y los 29 anteriores', Math.round((desdePeriodo('HOY', AHORA) - desdePeriodo('30', AHORA)) / DIA), 29);
const lista = [orden('h', { finalizadoEn: AHORA }), orden('s', { finalizadoEn: AHORA - 5 * DIA }), orden('m', { finalizadoEn: AHORA - 20 * DIA }), orden('v', { finalizadoEn: AHORA - 45 * DIA })].map(filaInstalacion);
check('filtra por período', ['HOY', '7', '30'].map((p) => filtrarInstalaciones(lista, { periodo: p, ahora: AHORA }).map((f) => f.id)), [['h'], ['h', 's'], ['h', 's', 'm']]);

// --- Plantilla final ---
check('sin plantilla de la promotora la fila no trae plantilla', filaInstalacion(orden('p1')).plantilla, '');
check('con plantilla guardada al finalizar la fila la trae', filaInstalacion(orden('p2', { plantillaFinal: 'TEXTO DE LA PLANTILLA' })).plantilla, 'TEXTO DE LA PLANTILLA');
check('la pantalla ofrece ver la plantilla', /PlantillaFinalModal/.test(leer('../src/components/InfraestructuraApp.jsx')), true);

// --- Rango de fechas ---
const rangoIds = (desde, hasta, extra = {}) => filtrarInstalaciones(lista, { periodo: 'RANGO', desde, hasta, ahora: AHORA, ...extra }).map((f) => f.id);
const iso = (dias) => { const d = new Date(AHORA - dias * DIA); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
check('rango: los dos días cuentan completos (desde y hasta incluidos)', rangoIds(iso(5), iso(0)), ['h', 's']);
check('rango de un solo día', rangoIds(iso(5), iso(5)), ['s']);
check('rango que deja fuera lo de hoy', rangoIds(iso(25), iso(10)), ['m']);
check('rango al revés se toma en el orden correcto', rangoIds(iso(0), iso(5)), ['h', 's']);
check('rango sin "hasta" llega hasta hoy', rangoIds(iso(10), ''), ['h', 's']);
check('rango sin "desde" cuenta desde el límite de 30 días', rangoIds('', iso(10)), ['m']);
check('rango vacío entre días sin instalaciones', rangoIds(iso(15), iso(10)), []);
check('rango junto con el buscador', rangoIds(iso(25), iso(0), { busqueda: 'IOm' }), ['m']);
check('los límites del rango son hace 29 días y hoy', [limitesRango(AHORA).min, limitesRango(AHORA).max], [iso(29), iso(0)]);

// --- Buscador ---
const filas = [
  filaInstalacion(orden('1', { nombre: 'María Pérez', nap: 'NAP O02D10 - Puerto 3' })),
  filaInstalacion(orden('2', { nombre: 'José Díaz', tecnico: 'REINEL BRAVO', nap: 'N10D14 - Puerto 1' })),
];
const buscar = (busqueda) => filtrarInstalaciones(filas, { busqueda, ahora: AHORA }).map((f) => f.id);
check('busca por cliente sin importar tildes ni mayúsculas', buscar('maria perez'), ['1']);
check('busca por NAP', buscar('n10d14'), ['2']);
check('busca por técnico', buscar('reinel'), ['2']);
check('busca por código', buscar('io1'), ['1']);
check('todas las palabras deben aparecer', buscar('maria reinel'), []);
check('sin texto devuelve todas', buscar('   '), ['1', '2']);

// --- Aislamiento ---
const hook = leer('../src/hooks/useInstalacionesInfra.js');
check('el hook no usa listeners en vivo', !/onSnapshot/.test(hook) && /getDocs/.test(hook), true);
check('el hook pide lo que exigen las reglas (tipo y estado de la orden; tipo de reporte)', /where\('tipoTrabajo', '==', 'INSTALACIÓN'\)/.test(hook) && /where\('estado', '==', 'FINALIZADO'\)/.test(hook) && /where\('tipoReporte', '==', 'CIERRE'\)/.test(hook), true);
check('la pantalla no importa hooks de edición', /useTickets'|usePushToken|useUsers/.test(leer('../src/components/InfraestructuraApp.jsx')), false);
check('Root manda el rol a su pantalla y el administrador la abre desde el menú', /\[ROLES\.INFRAESTRUCTURA\]: InfraestructuraApp/.test(leer('../src/Root.jsx')) && /INFRAESTRUCTURA: InfraestructuraApp/.test(leer('../src/Root.jsx')), true);
// Lo único que escribe el rol es su marca de "ya la anoté" (infraAnotadas); en el resto de las reglas no tiene escritura.
const reglasSinMarcas = leer('../firestore.rules').replace(/match \/artifacts\/\{appId\}\/public\/data\/infraAnotadas\/\{mes\} \{[\s\S]*?\r?\n    \}\r?\n/, '');
check('las reglas no dan escritura al rol, salvo las marcas de anotadas', /allow (create|update|delete|write)[^;]*isInfraestructuraRole/.test(reglasSinMarcas), false);
check('las marcas sí tienen su bloque de reglas', /infraAnotadas/.test(reglasSinMarcas), false);

// --- Marcas de "ya la anoté" ---
const filasM = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const marcasM = { b: { por: 'infra', en: 1 } };
check('Todas no filtra', filtrarPorAnotada(filasM, marcasM, 'TODAS').map((f) => f.id), ['a', 'b', 'c']);
check('Por anotar deja las que no tienen marca', filtrarPorAnotada(filasM, marcasM, 'POR_ANOTAR').map((f) => f.id), ['a', 'c']);
check('Anotadas deja las marcadas', filtrarPorAnotada(filasM, marcasM, 'ANOTADAS').map((f) => f.id), ['b']);
check('sin marcas, todas están por anotar', filtrarPorAnotada(filasM, undefined, 'POR_ANOTAR').length, 3);
check('el mes de la marca sale de la fecha de la instalación (hora local)', mesDeMarcas(new Date(2026, 9, 21, 15).getTime()), '2026-10');
check('el mes de la marca de un 1 de enero', mesDeMarcas(new Date(2027, 0, 1, 0, 5).getTime()), '2027-01');
check('se leen el mes actual y el de hace 30 días', mesesDeMarcas(new Date(2026, 9, 21, 15).getTime()), ['2026-09', '2026-10']);
check('a mitad de mes basta un solo documento', mesesDeMarcas(new Date(2026, 9, 31, 15).getTime()), ['2026-10']);
check('el hook lee las marcas en un documento por mes y escribe con merge', /getDoc\(doc\(datos\('infraAnotadas'\)/.test(hook) && /merge: true/.test(hook), true);
check('el Worker acepta el rol al crear usuarios', /ROLES_VALIDOS = \[[^\]]*'INFRAESTRUCTURA'\]/.test(leer('../cf-worker/src/index.js')), true);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
