// Prueba el tipo de visita "Recableado" (src/utils/tipoVisita.js) y el consumo de materiales por
// técnico (src/utils/consumoMateriales.js). No necesita el emulador. Uso: `npm run test:recableado`.
import {
  TIPOS_VISITA, colorConectorExterno, colorConectorInterno, coloresConectorVisita, datosConectores, errorColorConector, esVisitaConector, etiquetaTipoVisita, generaCobro, llevaConectores, parseMetros, partesRecableado, textoConectorVisita, tieneDatosRecableado,
} from '../src/utils/tipoVisita.js';
import { conectoresPorColor, consumoPorTecnico, esRecableadoFinalizado, esRecableadoPorAprobar, esVisitaConectorFinalizada, esVisitaConectorPorAprobar, fechaDeUso, inicioPeriodo, totalConectores } from '../src/utils/consumoMateriales.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

// --- Tipo de visita ---
check('el selector ofrece Ninguno, conector externo, conector interno y recableado',
  TIPOS_VISITA.map(t => t.value), ['', 'CONECTOR_EXTERNO', 'CONECTOR_INTERNO', 'RECABLEADO']);
check('solo las visitas de conector generan cobro',
  ['', 'CONECTOR_EXTERNO', 'CONECTOR_INTERNO', 'RECABLEADO'].map(generaCobro), [false, true, true, false]);
check('etiqueta del recableado', etiquetaTipoVisita('RECABLEADO'), 'Recableado');

// --- Metros ---
check('metros válidos', ['35', ' 7 ', '0012', '9999'].map(m => parseMetros(m).valor), [35, 7, 12, 9999]);
check('metros vacíos: obligatorio', parseMetros('').error, 'Indica los metros de cable que usaste.');
check('metros con decimales, letras o más de 4 cifras: no válidos',
  ['12.5', '12,5', 'abc', '-5', '10000'].map(m => Boolean(parseMetros(m).error)), [true, true, true, true, true]);
check('cero metros no es válido', parseMetros('0').error, 'Los metros de cable deben ser mayores a 0.');

// --- Colores: el externo solo es verde; el interno, verde o azul ---
check('conector externo: solo verde', ['VERDE', 'AZUL', '', 'ROJO'].map(colorConectorExterno), ['VERDE', '', '', '']);
check('conector interno: verde o azul', ['VERDE', 'AZUL', '', 'ROJO'].map(colorConectorInterno), ['VERDE', 'AZUL', '', '']);

// --- Datos que se guardan ---
check('recableado con ambos conectores',
  datosConectores('RECABLEADO', { metros: 35, conectorExterno: 'VERDE', conectorInterno: 'AZUL' }),
  { metrosCable: 35, conectorExterno: 'VERDE', conectorInterno: 'AZUL' });
check('recableado sin conectores (son opcionales)',
  datosConectores('RECABLEADO', { metros: 20 }), { metrosCable: 20, conectorExterno: '', conectorInterno: '' });
check('un azul externo se descarta', datosConectores('RECABLEADO', { metros: 20, conectorExterno: 'AZUL' }).conectorExterno, '');
check('sin tipo de visita (o con otro) todo se borra',
  ['', undefined, 'OTRO'].map(t => datosConectores(t, { metros: 35, conectorExterno: 'VERDE', conectorInterno: 'AZUL' })),
  [1, 2, 3].map(() => ({ metrosCable: null, conectorExterno: '', conectorInterno: '' })));

// --- Visita de conector: el técnico indica el color del conector colocado ---
check('visitas de conector', ['', 'CONECTOR_EXTERNO', 'CONECTOR_INTERNO', 'RECABLEADO'].map(esVisitaConector), [false, true, true, false]);
check('llevan conectores el recableado y las visitas de conector', ['', 'CONECTOR_EXTERNO', 'CONECTOR_INTERNO', 'RECABLEADO'].map(llevaConectores), [false, true, true, true]);
check('colores que se pueden elegir: el externo solo verde, el interno verde o azul',
  ['CONECTOR_EXTERNO', 'CONECTOR_INTERNO', 'RECABLEADO', ''].map(coloresConectorVisita), [['VERDE'], ['VERDE', 'AZUL'], [], []]);
check('conector externo: siempre verde, aunque llegue otro color o ninguno',
  ['AZUL', '', 'VERDE'].map(c => datosConectores('CONECTOR_EXTERNO', { metros: 35, conectorExterno: c, conectorInterno: 'AZUL' })),
  [1, 2, 3].map(() => ({ metrosCable: null, conectorExterno: 'VERDE', conectorInterno: '' })));
check('conector interno: guarda el color elegido (verde o azul) y descarta lo inválido',
  ['VERDE', 'AZUL', '', 'ROJO'].map(c => datosConectores('CONECTOR_INTERNO', { metros: 35, conectorExterno: 'VERDE', conectorInterno: c })),
  [{ metrosCable: null, conectorExterno: '', conectorInterno: 'VERDE' }, { metrosCable: null, conectorExterno: '', conectorInterno: 'AZUL' },
   { metrosCable: null, conectorExterno: '', conectorInterno: '' }, { metrosCable: null, conectorExterno: '', conectorInterno: '' }]);
check('el conector interno exige elegir el color; los demás tipos no',
  [['CONECTOR_INTERNO', ''], ['CONECTOR_INTERNO', 'AZUL'], ['CONECTOR_INTERNO', 'ROJO'], ['CONECTOR_EXTERNO', ''], ['RECABLEADO', ''], ['', '']].map(([t, c]) => errorColorConector(t, c)),
  ['Elige el tipo de conector: verde o azul.', '', 'Elige el tipo de conector: verde o azul.', '', '', '']);
check('nombre del conector de la visita: solo "Conector verde" o "Conector azul"',
  [{ tipoVisita: 'CONECTOR_INTERNO', conectorInterno: 'AZUL' }, { tipoVisita: 'CONECTOR_INTERNO', conectorInterno: 'VERDE' }, { tipoVisita: 'CONECTOR_EXTERNO', conectorExterno: 'VERDE' },
   { tipoVisita: 'CONECTOR_INTERNO' }, { tipoVisita: 'RECABLEADO', conectorInterno: 'AZUL' }, null].map(textoConectorVisita),
  ['Conector azul', 'Conector verde', 'Conector verde', '', '', '']);
check('hay datos de recableado', [{ metrosCable: 5 }, { conectorInterno: 'AZUL' }, {}, null].map(tieneDatosRecableado), [true, true, false, false]);
check('partes legibles', partesRecableado({ metrosCable: 35, conectorExterno: 'VERDE', conectorInterno: 'AZUL' }),
  ['35 m de cable', 'Conector externo: Verde', 'Conector interno: Azul']);
check('partes sin conectores', partesRecableado({ metrosCable: 12 }), ['12 m de cable']);

// --- Consumo por técnico ---
const dia = (d, h = 12) => new Date(2026, 9, d, h).getTime(); // octubre 2026
const base = { tipoVisita: 'RECABLEADO', estado: 'FINALIZADO' };
const ordenes = [
  { ...base, id: 'a', codigo: 'AS1', nombre: 'Ana', tecnico: 'LUIS PEREZ', metrosCable: 30, conectorExterno: 'VERDE', conectorInterno: 'AZUL', finalizadoEn: dia(13) },
  { ...base, id: 'b', codigo: 'AS2', nombre: 'Beto', tecnico: 'LUIS PEREZ', metrosCable: 15, conectorInterno: 'VERDE', finalizadoEn: dia(12) },
  { ...base, id: 'c', codigo: 'AS3', nombre: 'Carla', tecnico: 'MARIA GOMEZ', metrosCable: 50, conectorExterno: 'VERDE', finalizadoEn: dia(13) },
  { ...base, id: 'd', codigo: 'AS4', nombre: 'Dani', tecnico: 'maria gomez', metrosCable: 10, finalizadoEn: dia(2) },
  { ...base, id: 'e', codigo: 'AS5', nombre: 'Eva', tecnico: 'LUIS PEREZ', metrosCable: 8, estado: 'PRE-FINALIZADO', createdAt: dia(13) },
  { ...base, id: 'f', codigo: 'AS6', nombre: 'Fran', tecnico: 'LUIS PEREZ', metrosCable: 99, estado: 'PENDIENTE', createdAt: dia(13) },
  { id: 'g', codigo: 'AS7', tecnico: 'LUIS PEREZ', tipoVisita: 'CONECTOR_EXTERNO', estado: 'FINALIZADO', finalizadoEn: dia(13) },
  { ...base, id: 'h', codigo: 'AS8', nombre: 'Hugo', metrosCable: 5, tecnico: '', finalizadoEn: dia(13) },
  { ...base, id: 'a', codigo: 'AS1', nombre: 'Ana (copia archivada)', tecnico: 'LUIS PEREZ', metrosCable: 30, conectorExterno: 'VERDE', conectorInterno: 'AZUL', finalizadoEn: dia(13) },
];
const todo = consumoPorTecnico(ordenes);
check('un renglón por técnico (sin distinguir mayúsculas), de más a menos metros',
  todo.filas.map(f => [f.tecnico, f.ordenes, f.metros]), [['MARIA GOMEZ', 2, 60], ['LUIS PEREZ', 2, 45], ['SIN TÉCNICO', 1, 5]]);
check('los conectores se cuentan solo por color, sin distinguir externo de interno',
  [{}, { conectorExterno: 'VERDE' }, { conectorInterno: 'VERDE' }, { conectorInterno: 'AZUL' }, { conectorExterno: 'VERDE', conectorInterno: 'VERDE' }, { conectorExterno: 'VERDE', conectorInterno: 'AZUL' },
   { tipoVisita: 'CONECTOR_INTERNO', conectorExterno: 'VERDE', conectorInterno: 'AZUL' }, { tipoVisita: 'CONECTOR_EXTERNO', conectorExterno: 'VERDE', conectorInterno: 'AZUL' }].map(conectoresPorColor),
  [{ verde: 0, azul: 0 }, { verde: 1, azul: 0 }, { verde: 1, azul: 0 }, { verde: 0, azul: 1 }, { verde: 2, azul: 0 }, { verde: 1, azul: 1 }, { verde: 0, azul: 1 }, { verde: 1, azul: 0 }]);
check('conectores por técnico', todo.filas.find(f => f.tecnico === 'LUIS PEREZ'),
  { ...todo.filas.find(f => f.tecnico === 'LUIS PEREZ'), verde: 2, azul: 1 });
check('cada orden del detalle trae sus conectores por color', todo.filas.find(f => f.tecnico === 'LUIS PEREZ').detalle.map(d => [d.id, d.verde, d.azul]), [['a', 1, 1], ['b', 1, 0]]);
check('totales de todos los técnicos', [todo.totales.ordenes, todo.totales.metros, todo.totales.verde, todo.totales.azul],
  [5, 110, 3, 1]);
check('total de conectores', totalConectores(todo.totales), 4);
check('una orden repetida (activa y archivada) cuenta una sola vez', todo.filas.find(f => f.tecnico === 'LUIS PEREZ').detalle.filter(d => d.id === 'a').length, 1);
check('los pre-finalizados se informan aparte y no suman', todo.porAprobar, { ordenes: 1, metros: 8, visitas: 0 });
check('las órdenes pendientes y las visitas de conector sin color no cuentan', todo.filas.flatMap(f => f.detalle.map(d => d.id)).sort(), ['a', 'b', 'c', 'd', 'h']);
check('el detalle va de más reciente a más antiguo', todo.filas.find(f => f.tecnico === 'LUIS PEREZ').detalle.map(d => d.id), ['a', 'b']);

const ahora = new Date(2026, 9, 13, 15);
check('inicio de "hoy"', new Date(inicioPeriodo('HOY', ahora)).getDate(), 13);
check('inicio de "7 días" incluye hoy y los 6 días anteriores', new Date(inicioPeriodo('SEMANA', ahora)).getDate(), 7);
check('inicio de "este mes"', new Date(inicioPeriodo('MES', ahora)).getDate(), 1);
check('"todo" no tiene límite', inicioPeriodo('TODO', ahora), 0);
const hoy = consumoPorTecnico(ordenes, { desde: inicioPeriodo('HOY', ahora) });
check('filtrado por hoy', hoy.filas.map(f => [f.tecnico, f.metros]), [['MARIA GOMEZ', 50], ['LUIS PEREZ', 30], ['SIN TÉCNICO', 5]]);
const semana = consumoPorTecnico(ordenes, { desde: inicioPeriodo('SEMANA', ahora) });
check('filtrado por 7 días deja fuera lo del día 2', semana.filas.map(f => [f.tecnico, f.metros]), [['MARIA GOMEZ', 50], ['LUIS PEREZ', 45], ['SIN TÉCNICO', 5]]);
check('sin recableados no hay renglones', consumoPorTecnico([{ id: 'x', estado: 'FINALIZADO' }]).filas, []);

// Los técnicos registrados salen siempre, aunque no hayan usado material en el período.
const registrados = ['LUIS PEREZ', 'Maria Gomez', 'PEDRO RUIZ', 'ANA SOTO', '  ', ''];
const conRegistrados = consumoPorTecnico(ordenes, { desde: inicioPeriodo('HOY', ahora), tecnicos: registrados });
check('los registrados sin consumo salen al final, por nombre; sin técnico solo si tiene consumo',
  conRegistrados.filas.map(f => [f.tecnico, f.metros]), [['Maria Gomez', 50], ['LUIS PEREZ', 30], ['SIN TÉCNICO', 5], ['ANA SOTO', 0], ['PEDRO RUIZ', 0]]);
check('un técnico sin consumo sale en cero y sin detalle', conRegistrados.filas.find(f => f.tecnico === 'PEDRO RUIZ'),
  { tecnico: 'PEDRO RUIZ', ordenes: 0, visitas: 0, metros: 0, verde: 0, azul: 0, detalle: [] });
check('los registrados no cambian los totales', conRegistrados.totales, hoy.totales);
check('con técnicos registrados y sin recableados salen todos en cero',
  consumoPorTecnico([], { tecnicos: ['B', 'A'] }).filas.map(f => [f.tecnico, f.metros]), [['A', 0], ['B', 0]]);
// --- Visitas de conector: también gastan un conector (solo cuenta el color) ---
const visita = { tipoVisita: 'CONECTOR_INTERNO', estado: 'FINALIZADO' };
const visitas = [
  { ...visita, id: 'v1', codigo: 'V1', nombre: 'Val', tecnico: 'LUIS PEREZ', conectorInterno: 'AZUL', finalizadoEn: dia(13) },
  { ...visita, id: 'v2', codigo: 'V2', nombre: 'Vera', tecnico: 'LUIS PEREZ', tipoVisita: 'CONECTOR_EXTERNO', conectorExterno: 'VERDE', finalizadoEn: dia(12) },
  { ...visita, id: 'v3', codigo: 'V3', nombre: 'Vito', tecnico: 'MARIA GOMEZ', conectorInterno: 'VERDE', finalizadoEn: dia(13) },
  { ...visita, id: 'v4', codigo: 'V4', nombre: 'Vana', tecnico: 'MARIA GOMEZ', finalizadoEn: dia(13) }, // anterior a pedir el color: no suma
  { ...visita, id: 'v5', codigo: 'V5', nombre: 'Vera', tecnico: 'LUIS PEREZ', estado: 'PRE-FINALIZADO', conectorInterno: 'VERDE', createdAt: dia(13) },
  { ...visita, id: 'v6', codigo: 'V6', nombre: 'Vico', tecnico: 'LUIS PEREZ', estado: 'PENDIENTE', conectorInterno: 'VERDE', createdAt: dia(13) },
  { ...visita, id: 'v7', codigo: 'V7', nombre: 'Vera', tecnico: 'LUIS PEREZ', conectorExterno: 'VERDE', conectorInterno: 'AZUL', finalizadoEn: dia(13) }, // interno: solo cuenta el interno
];
const soloVisitas = consumoPorTecnico(visitas);
check('visitas de conector: un renglón por técnico con sus conectores por color',
  soloVisitas.filas.map(f => [f.tecnico, f.ordenes, f.visitas, f.metros, f.verde, f.azul]), [['LUIS PEREZ', 0, 3, 0, 1, 2], ['MARIA GOMEZ', 0, 1, 0, 1, 0]]);
check('visitas de conector: totales', [soloVisitas.totales.ordenes, soloVisitas.totales.visitas, soloVisitas.totales.metros, soloVisitas.totales.verde, soloVisitas.totales.azul], [0, 4, 0, 2, 2]);
check('visitas de conector: el detalle trae el tipo y no trae metros',
  soloVisitas.filas[0].detalle.map(d => [d.id, d.tipo, d.metros, d.verde, d.azul]),
  [['v1', 'CONECTOR_INTERNO', null, 0, 1], ['v7', 'CONECTOR_INTERNO', null, 0, 1], ['v2', 'CONECTOR_EXTERNO', null, 1, 0]]);
check('visitas de conector: las pre-finalizadas se informan aparte, las pendientes y sin color no', soloVisitas.porAprobar, { ordenes: 0, metros: 0, visitas: 1 });
const conTodo = consumoPorTecnico([...ordenes, ...visitas]);
check('recableados y visitas de conector juntos: los conectores se suman, los metros son solo de recableados',
  [conTodo.totales.ordenes, conTodo.totales.visitas, conTodo.totales.metros, conTodo.totales.verde, conTodo.totales.azul, totalConectores(conTodo.totales)], [5, 4, 110, 5, 3, 8]);
check('recableados y visitas juntos: renglones por técnico', conTodo.filas.map(f => [f.tecnico, f.ordenes, f.visitas, f.metros, totalConectores(f)]),
  [['MARIA GOMEZ', 2, 1, 60, 2], ['LUIS PEREZ', 2, 3, 45, 6], ['SIN TÉCNICO', 1, 0, 5, 0]]);
check('recableados y visitas juntos: lo que espera aprobación', conTodo.porAprobar, { ordenes: 1, metros: 8, visitas: 1 });
check('quien solo hizo visitas de conector va antes que quien no gastó nada',
  consumoPorTecnico(visitas, { tecnicos: ['ZETA', 'MARIA GOMEZ'] }).filas.map(f => f.tecnico), ['LUIS PEREZ', 'MARIA GOMEZ', 'ZETA']);
check('clasificación de visitas de conector', [esVisitaConectorFinalizada(visitas[0]), esVisitaConectorFinalizada(visitas[3]), esVisitaConectorPorAprobar(visitas[4]), esVisitaConectorFinalizada(visitas[5]), esVisitaConectorFinalizada(ordenes[0])],
  [true, false, true, false, false]);
check('la fecha de uso cae a la de creación si no hay finalizadoEn', fechaDeUso({ createdAt: 5 }), 5);
check('clasificación de recableados', [esRecableadoFinalizado(ordenes[0]), esRecableadoPorAprobar(ordenes[4]), esRecableadoFinalizado(ordenes[5])], [true, true, false]);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
