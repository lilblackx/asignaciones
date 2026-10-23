// Prueba el tipo de visita "Recableado" (src/utils/tipoVisita.js) y el consumo de materiales por
// técnico (src/utils/consumoMateriales.js). No necesita el emulador. Uso: `npm run test:recableado`.
import {
  MAX_CONECTORES_POR_COLOR, TIPOS_VISITA, cantidadesConector, colorConectorExterno, conectorDeVisita, colorConectorInterno, datosConectores, errorCantidadesConector, esVisitaConector, parseCantidadesConector, textoCantidades, etiquetaTipoVisita, generaCobro, llevaConectores, parseMetros, partesRecableado, textoConectorVisita, tieneDatosRecableado,
} from '../src/utils/tipoVisita.js';
import { conectoresPorColor, consumoPorTecnico, esRecableadoFinalizado, esRecableadoPorAprobar, esCambioEquipoFinalizado, esCambioEquipoPorAprobar, esInstalacionFinalizada, esInstalacionPorAprobar, esVisitaConectorFinalizada, esVisitaConectorPorAprobar, fechaDeUso, inicioPeriodo, totalConectores } from '../src/utils/consumoMateriales.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

// --- Tipo de visita ---
check('el selector ofrece Ninguno, conector externo, conector interno, recableado, cambio de equipo y drop atenuado',
  TIPOS_VISITA.map(t => t.value), ['', 'CONECTOR_EXTERNO', 'CONECTOR_INTERNO', 'RECABLEADO', 'CAMBIO_EQUIPO', 'DROP_ATENUADO', 'CONFIG_ROUTER', 'FUENTE_AVERIADA']);
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
  { metrosCable: 35, conectorExterno: 'VERDE', conectorInterno: 'AZUL', conectoresUsados: null });
check('recableado sin conectores (son opcionales)',
  datosConectores('RECABLEADO', { metros: 20 }), { metrosCable: 20, conectorExterno: '', conectorInterno: '', conectoresUsados: null });
check('un azul externo se descarta', datosConectores('RECABLEADO', { metros: 20, conectorExterno: 'AZUL' }).conectorExterno, '');
check('sin tipo de visita (o con otro) todo se borra',
  ['', undefined, 'OTRO'].map(t => datosConectores(t, { metros: 35, conectorExterno: 'VERDE', conectorInterno: 'AZUL' })),
  [1, 2, 3].map(() => ({ metrosCable: null, conectorExterno: '', conectorInterno: '', conectoresUsados: null })));

// --- Visita de conector: el técnico indica cuántos conectores usó de cada color ---
check('visitas de conector', ['', 'CONECTOR_EXTERNO', 'CONECTOR_INTERNO', 'RECABLEADO'].map(esVisitaConector), [false, true, true, false]);
check('llevan conectores el recableado y las visitas de conector', ['', 'CONECTOR_EXTERNO', 'CONECTOR_INTERNO', 'RECABLEADO'].map(llevaConectores), [false, true, true, true]);
check('conector externo: siempre verde, con la cantidad escrita; los azules son internos opcionales',
  [{ verde: 3 }, { verde: 1, azul: 4 }].map(c => datosConectores('CONECTOR_EXTERNO', { metros: 35, conectorInterno: 'AZUL', conectores: c })),
  [{ metrosCable: null, conectorExterno: 'VERDE', conectorInterno: '', conectoresUsados: { verde: 3, azul: 0 } },
   { metrosCable: null, conectorExterno: 'VERDE', conectorInterno: 'AZUL', conectoresUsados: { verde: 1, azul: 4 } }]);
check('conector interno: guarda las cantidades; el color solo si se usó uno',
  [{ verde: 2, azul: 0 }, { verde: 0, azul: 3 }, { verde: 1, azul: 1 }].map(c => datosConectores('CONECTOR_INTERNO', { metros: 35, conectorExterno: 'VERDE', conectores: c })),
  [{ metrosCable: null, conectorExterno: '', conectorInterno: 'VERDE', conectoresUsados: { verde: 2, azul: 0 } },
   { metrosCable: null, conectorExterno: '', conectorInterno: 'AZUL', conectoresUsados: { verde: 0, azul: 3 } },
   { metrosCable: null, conectorExterno: '', conectorInterno: '', conectoresUsados: { verde: 1, azul: 1 } }]);
check('cantidades inválidas se guardan como 0 (la validación las frena antes)',
  datosConectores('CONECTOR_INTERNO', { conectores: { verde: -1, azul: 'x' } }).conectoresUsados, { verde: 0, azul: 0 });

// Lo que escribe el técnico (texto) y sus errores
const cant = (tipo, verde, azul) => { const r = parseCantidadesConector(tipo, { verde, azul }); return r.error ? [r.error, r.campo] : r.valor; };
check('externo: verdes, al menos 1; azules internos opcionales', [cant('CONECTOR_EXTERNO', '3', ''), cant('CONECTOR_EXTERNO', '1', '5'), cant('CONECTOR_EXTERNO', ' 2 ', '')], [{ verde: 3, azul: 0 }, { verde: 1, azul: 5 }, { verde: 2, azul: 0 }]);
check('externo: azul inválido o sobre el tope da error en el campo azul', [cant('CONECTOR_EXTERNO', '1', '11'), cant('CONECTOR_EXTERNO', '1', 'a')].map(r => r[1]), ['azul', 'azul']);
check('externo sin verdes: error', [cant('CONECTOR_EXTERNO', '', ''), cant('CONECTOR_EXTERNO', '0', '')], [['Indica cuántos conectores verdes usaste.', 'verde'], ['Indica cuántos conectores verdes usaste.', 'verde']]);
check('interno: verdes y/o azules, vacío cuenta como 0',
  [cant('CONECTOR_INTERNO', '2', ''), cant('CONECTOR_INTERNO', '', '3'), cant('CONECTOR_INTERNO', '1', '1'), cant('CONECTOR_INTERNO', '10', '10')],
  [{ verde: 2, azul: 0 }, { verde: 0, azul: 3 }, { verde: 1, azul: 1 }, { verde: 10, azul: 10 }]);
check('interno sin ninguno: error', [cant('CONECTOR_INTERNO', '', ''), cant('CONECTOR_INTERNO', '0', '0')], [['Indica cuántos conectores usaste: verdes, azules o ambos.', 'verde'], ['Indica cuántos conectores usaste: verdes, azules o ambos.', 'verde']]);
check('el tope es de 10 por color', [MAX_CONECTORES_POR_COLOR, cant('CONECTOR_INTERNO', '11', '1'), cant('CONECTOR_INTERNO', '1', '11'), cant('CONECTOR_EXTERNO', '11', '')],
  [10, ['Máximo 10 conectores verdes.', 'verde'], ['Máximo 10 conectores azules.', 'azul'], ['Máximo 10 conectores verdes.', 'verde']]);
check('solo números enteros', [cant('CONECTOR_INTERNO', '1.5', ''), cant('CONECTOR_INTERNO', '-1', ''), cant('CONECTOR_INTERNO', 'a', ''), cant('CONECTOR_INTERNO', '1', '2,5')].map(r => r[1]), ['verde', 'verde', 'verde', 'azul']);
check('los demás tipos de visita no piden cantidades', ['', 'RECABLEADO', 'CAMBIO_EQUIPO', 'DROP_ATENUADO', 'CONFIG_ROUTER', 'FUENTE_AVERIADA'].map(t => parseCantidadesConector(t, { verde: '', azul: '' })), [1, 2, 3, 4, 5, 6].map(() => ({ valor: null })));
check('segunda comprobación al guardar (cantidades ya numéricas)',
  [['CONECTOR_EXTERNO', { verde: 2 }], ['CONECTOR_EXTERNO', undefined], ['CONECTOR_INTERNO', { verde: 0, azul: 0 }], ['CONECTOR_INTERNO', { verde: 1, azul: 1 }], ['CONECTOR_INTERNO', { verde: 11, azul: 0 }], ['CONECTOR_INTERNO', { verde: 1.5, azul: 0 }], ['RECABLEADO', undefined]].map(([t, c]) => errorCantidadesConector(t, c)),
  ['', 'Indica cuántos conectores verdes usaste.', 'Indica cuántos conectores usaste: verdes, azules o ambos.', '', 'Máximo 10 conectores verdes.', 'Escribe la cantidad de conectores verdes como un número entero. Ejemplo: 2', '']);

// Cantidades de una visita: las escritas, o 1 del color en las visitas anteriores
check('cantidades de una visita con cantidades guardadas',
  [{ tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 2, azul: 1 } }, { tipoVisita: 'CONECTOR_EXTERNO', conectoresUsados: { verde: 3, azul: 2 } }].map(cantidadesConector),
  [{ verde: 2, azul: 1 }, { verde: 3, azul: 2 }]);
check('una visita anterior (solo el color) cuenta como 1 de ese color',
  [{ tipoVisita: 'CONECTOR_EXTERNO', conectorExterno: 'VERDE' }, { tipoVisita: 'CONECTOR_INTERNO', conectorInterno: 'AZUL' }, { tipoVisita: 'CONECTOR_INTERNO', conectorInterno: 'VERDE' }, { tipoVisita: 'CONECTOR_INTERNO' }].map(cantidadesConector),
  [{ verde: 1, azul: 0 }, { verde: 0, azul: 1 }, { verde: 1, azul: 0 }, { verde: 0, azul: 0 }]);
check('fuera de una visita de conector no aplica', [{ tipoVisita: 'RECABLEADO', conectorInterno: 'AZUL' }, null, undefined].map(cantidadesConector), [1, 2, 3].map(() => ({ verde: 0, azul: 0 })));
check('texto de cantidades', [{ verde: 1, azul: 0 }, { verde: 2, azul: 1 }, { verde: 0, azul: 3 }, { verde: 0, azul: 0 }].map(textoCantidades), ['1 verde', '2 verdes, 1 azul', '3 azules', '']);
check('nombre del conector de la visita: solo "Conector verde" o "Conector azul"',
  [{ tipoVisita: 'CONECTOR_INTERNO', conectorInterno: 'AZUL' }, { tipoVisita: 'CONECTOR_INTERNO', conectorInterno: 'VERDE' }, { tipoVisita: 'CONECTOR_EXTERNO', conectorExterno: 'VERDE' },
   { tipoVisita: 'CONECTOR_INTERNO' }, { tipoVisita: 'RECABLEADO', conectorInterno: 'AZUL' }, null].map(textoConectorVisita),
  ['Conector azul', 'Conector verde', 'Conector verde', '', '', '']);
check('texto del historial con cantidades',
  [{ tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 2, azul: 1 } }, { tipoVisita: 'CONECTOR_EXTERNO', conectoresUsados: { verde: 1, azul: 0 } }, { tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 0, azul: 0 } }].map(textoConectorVisita),
  ['Conectores: 2 verdes, 1 azul', 'Conectores: 1 verde', '']);
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
check('en una visita de conector cuentan las cantidades escritas',
  [{ tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 3, azul: 2 } }, { tipoVisita: 'CONECTOR_EXTERNO', conectoresUsados: { verde: 4, azul: 0 } }, { tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 0, azul: 5 }, conectorInterno: 'VERDE' }].map(conectoresPorColor),
  [{ verde: 3, azul: 2 }, { verde: 4, azul: 0 }, { verde: 0, azul: 5 }]);
check('conectores por técnico', todo.filas.find(f => f.tecnico === 'LUIS PEREZ'),
  { ...todo.filas.find(f => f.tecnico === 'LUIS PEREZ'), verde: 2, azul: 1 });
check('cada orden del detalle trae sus conectores por color', todo.filas.find(f => f.tecnico === 'LUIS PEREZ').detalle.map(d => [d.id, d.verde, d.azul]), [['a', 1, 1], ['b', 1, 0]]);
check('totales de todos los técnicos', [todo.totales.ordenes, todo.totales.metros, todo.totales.verde, todo.totales.azul],
  [5, 110, 3, 1]);
check('total de conectores', totalConectores(todo.totales), 4);
check('una orden repetida (activa y archivada) cuenta una sola vez', todo.filas.find(f => f.tecnico === 'LUIS PEREZ').detalle.filter(d => d.id === 'a').length, 1);
check('los pre-finalizados se informan aparte y no suman', todo.porAprobar, { ordenes: 1, instalaciones: 0, metros: 8, visitas: 0, cambiosEquipo: 0 });
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
  { tecnico: 'PEDRO RUIZ', ordenes: 0, instalaciones: 0, visitas: 0, cambiosEquipo: 0, metros: 0, verde: 0, azul: 0, detalle: [] });
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
check('visitas de conector: las pre-finalizadas se informan aparte, las pendientes y sin color no', soloVisitas.porAprobar, { ordenes: 0, instalaciones: 0, metros: 0, visitas: 1, cambiosEquipo: 0 });
const conTodo = consumoPorTecnico([...ordenes, ...visitas]);
check('recableados y visitas de conector juntos: los conectores se suman, los metros son solo de recableados',
  [conTodo.totales.ordenes, conTodo.totales.visitas, conTodo.totales.metros, conTodo.totales.verde, conTodo.totales.azul, totalConectores(conTodo.totales)], [5, 4, 110, 5, 3, 8]);
check('recableados y visitas juntos: renglones por técnico', conTodo.filas.map(f => [f.tecnico, f.ordenes, f.visitas, f.metros, totalConectores(f)]),
  [['MARIA GOMEZ', 2, 1, 60, 2], ['LUIS PEREZ', 2, 3, 45, 6], ['SIN TÉCNICO', 1, 0, 5, 0]]);
check('recableados y visitas juntos: lo que espera aprobación', conTodo.porAprobar, { ordenes: 1, instalaciones: 0, metros: 8, visitas: 1, cambiosEquipo: 0 });
check('quien solo hizo visitas de conector va antes que quien no gastó nada',
  consumoPorTecnico(visitas, { tecnicos: ['ZETA', 'MARIA GOMEZ'] }).filas.map(f => f.tecnico), ['LUIS PEREZ', 'MARIA GOMEZ', 'ZETA']);
check('clasificación de visitas de conector', [esVisitaConectorFinalizada(visitas[0]), esVisitaConectorFinalizada(visitas[3]), esVisitaConectorPorAprobar(visitas[4]), esVisitaConectorFinalizada(visitas[5]), esVisitaConectorFinalizada(ordenes[0])],
  [true, false, true, false, false]);
check('la fecha de uso cae a la de creación si no hay finalizadoEn', fechaDeUso({ createdAt: 5 }), 5);
check('clasificación de recableados', [esRecableadoFinalizado(ordenes[0]), esRecableadoPorAprobar(ordenes[4]), esRecableadoFinalizado(ordenes[5])], [true, true, false]);

// --- Instalaciones: el metraje de cable también se gasta ---
const instalacion = { tipoTrabajo: 'INSTALACIÓN', estado: 'FINALIZADO' };
const instalaciones = [
  { ...instalacion, id: 'i1', codigo: 'IS1', nombre: 'Iris', tecnico: 'LUIS PEREZ', instalacion: { metraje: 120 }, finalizadoEn: dia(13) },
  { ...instalacion, id: 'i2', codigo: 'IS2', nombre: 'Ismael', tecnico: 'MARIA GOMEZ', instalacion: { metraje: 80 }, finalizadoEn: dia(13) },
  { ...instalacion, id: 'i3', codigo: 'IS3', nombre: 'Ines', tecnico: 'LUIS PEREZ', finalizadoEn: dia(13) }, // anterior a pedir el metraje: no suma
  { ...instalacion, id: 'i4', codigo: 'IS4', nombre: 'Ivan', tecnico: 'LUIS PEREZ', instalacion: { metraje: 60 }, estado: 'PRE-FINALIZADO', createdAt: dia(13) },
  { ...instalacion, id: 'i5', codigo: 'IS5', nombre: 'Iker', tecnico: 'LUIS PEREZ', instalacion: { metraje: 90 }, estado: 'PENDIENTE', createdAt: dia(13) },
  { ...instalacion, id: 'i6', codigo: 'IS6', nombre: 'Irma', tecnico: 'LUIS PEREZ', instalacion: { metraje: 0 }, finalizadoEn: dia(13) },
  { ...instalacion, id: 'i7', codigo: 'IS7', nombre: 'Ivo', tecnico: 'LUIS PEREZ', instalacion: { metraje: 45 }, finalizadoEn: dia(2) },
];
const soloInstalaciones = consumoPorTecnico(instalaciones);
check('instalaciones: un renglón por técnico con sus metros y su cuenta de instalaciones',
  soloInstalaciones.filas.map(f => [f.tecnico, f.ordenes, f.instalaciones, f.visitas, f.metros, totalConectores(f)]), [['LUIS PEREZ', 0, 2, 0, 165, 0], ['MARIA GOMEZ', 0, 1, 0, 80, 0]]);
check('instalaciones: totales', [soloInstalaciones.totales.instalaciones, soloInstalaciones.totales.ordenes, soloInstalaciones.totales.visitas, soloInstalaciones.totales.metros], [3, 0, 0, 245]);
check('instalaciones: sin metraje (anteriores a pedirlo, en 0), pendientes y pre-finalizadas no suman',
  soloInstalaciones.filas.flatMap(f => f.detalle.map(d => d.id)).sort(), ['i1', 'i2', 'i7']);
check('instalaciones: las pre-finalizadas con metraje se informan aparte', soloInstalaciones.porAprobar, { ordenes: 0, instalaciones: 1, metros: 60, visitas: 0, cambiosEquipo: 0 });
check('instalaciones: el detalle trae la clase y sus metros, sin conectores',
  soloInstalaciones.filas[0].detalle.map(d => [d.id, d.clase, d.metros, d.verde, d.azul]), [['i1', 'INSTALACION', 120, 0, 0], ['i7', 'INSTALACION', 45, 0, 0]]);
check('el detalle distingue recableado, instalación y visita de conector',
  consumoPorTecnico([ordenes[0], instalaciones[0], visitas[0]]).filas.flatMap(f => f.detalle.map(d => [d.id, d.clase])).sort(), [['a', 'RECABLEADO'], ['i1', 'INSTALACION'], ['v1', 'VISITA']]);
const todoJunto = consumoPorTecnico([...ordenes, ...visitas, ...instalaciones]);
check('recableados, visitas e instalaciones juntos: los metros se suman y cada cosa se cuenta en su columna',
  [todoJunto.totales.ordenes, todoJunto.totales.instalaciones, todoJunto.totales.visitas, todoJunto.totales.metros], [5, 3, 4, 355]);
check('recableados, visitas e instalaciones juntos: lo que espera aprobación', todoJunto.porAprobar, { ordenes: 1, instalaciones: 1, metros: 68, visitas: 1, cambiosEquipo: 0 });
check('una instalación no cuenta como visita de conector', [esVisitaConectorFinalizada(instalaciones[0]), esVisitaConectorPorAprobar(instalaciones[3])], [false, false]);
check('clasificación de instalaciones', [esInstalacionFinalizada(instalaciones[0]), esInstalacionFinalizada(instalaciones[2]), esInstalacionPorAprobar(instalaciones[3]), esInstalacionFinalizada(instalaciones[4]), esInstalacionFinalizada(instalaciones[5]), esInstalacionFinalizada(ordenes[0])],
  [true, false, true, false, false, false]);
check('una instalación se filtra por el período como lo demás', consumoPorTecnico(instalaciones, { desde: inicioPeriodo('HOY', ahora) }).totales.metros, 200);

// --- Conectores de las instalaciones (externos e internos, solo por color en Materiales) ---
const conConectores = [
  { ...instalacion, id: 'k1', codigo: 'IK1', nombre: 'Karla', tecnico: 'LUIS PEREZ', instalacion: { metraje: 100, conectores: { externo: { verde: 1 }, interno: { verde: 1, azul: 1 } } }, finalizadoEn: dia(13) },
  { ...instalacion, id: 'k2', codigo: 'IK2', nombre: 'Kevin', tecnico: 'MARIA GOMEZ', instalacion: { metraje: 80, conectores: { externo: { verde: 0 }, interno: { verde: 0, azul: 2 } } }, finalizadoEn: dia(13) },
  { ...instalacion, id: 'k3', codigo: 'IK3', nombre: 'Kira', tecnico: 'LUIS PEREZ', instalacion: { metraje: 60 }, finalizadoEn: dia(13) }, // anterior a pedir los conectores: cuenta 0
  { ...instalacion, id: 'k4', codigo: 'IK4', nombre: 'Kurt', tecnico: 'LUIS PEREZ', instalacion: { metraje: 50, conectores: { externo: { verde: 1 }, interno: { verde: 0, azul: 0 } } }, estado: 'PRE-FINALIZADO', createdAt: dia(13) },
];
const conectoresInstalaciones = consumoPorTecnico(conConectores);
check('instalaciones con conectores: se suman por color (externo + interno), sin distinguir el tipo',
  [conectoresInstalaciones.totales.verde, conectoresInstalaciones.totales.azul, totalConectores(conectoresInstalaciones.totales)], [2, 3, 5]);
check('instalaciones con conectores: por técnico', conectoresInstalaciones.filas.map(f => [f.tecnico, f.verde, f.azul, f.instalaciones, f.metros]), [['LUIS PEREZ', 2, 1, 2, 160], ['MARIA GOMEZ', 0, 2, 1, 80]]);
check('instalaciones con conectores: el detalle trae los conectores de cada una y una anterior sale en 0',
  conectoresInstalaciones.filas[0].detalle.map(d => [d.id, d.clase, d.verde, d.azul]).sort(), [['k1', 'INSTALACION', 2, 1], ['k3', 'INSTALACION', 0, 0]]);
check('instalaciones con conectores: la pre-finalizada no suma conectores y se informa aparte', [conectoresInstalaciones.porAprobar.instalaciones, conectoresInstalaciones.totales.verde], [1, 2]);
check('conectoresPorColor: una instalación, una instalación sin el dato y un recableado cada uno con lo suyo',
  [conectoresPorColor(conConectores[0]), conectoresPorColor(instalaciones[0]), conectoresPorColor({ tipoTrabajo: 'INSTALACIÓN', tipoVisita: 'RECABLEADO', conectorExterno: 'VERDE', metrosCable: 5 })],
  [{ verde: 2, azul: 1 }, { verde: 0, azul: 0 }, { verde: 1, azul: 0 }]);

// --- Cambios de equipo e instalaciones con el serial del equipo ---
const cambio = { tipoTrabajo: 'VISITA', tipoVisita: 'CAMBIO_EQUIPO', estado: 'FINALIZADO' };
const conSerial = [
  { ...cambio, id: 'c1', codigo: 'CE1', nombre: 'Carla', tecnico: 'LUIS PEREZ', serialEquipo: 'HWTC1A2B3C4D', finalizadoEn: dia(13) },
  { ...cambio, id: 'c2', codigo: 'CE2', nombre: 'Cesar', tecnico: 'MARIA GOMEZ', serialEquipo: 'ZTEG99887766', finalizadoEn: dia(13) },
  { ...cambio, id: 'c3', codigo: 'CE3', nombre: 'Celia', tecnico: 'LUIS PEREZ', serialEquipo: 'HWTC0000AAAA', estado: 'PRE-FINALIZADO', createdAt: dia(13) },
  { ...cambio, id: 'c4', codigo: 'CE4', nombre: 'Cora', tecnico: 'LUIS PEREZ', serialEquipo: 'HWTC1111BBBB', estado: 'PENDIENTE', createdAt: dia(13) },
  { ...cambio, id: 'c5', codigo: 'CE5', nombre: 'Cruz', tecnico: 'LUIS PEREZ', finalizadoEn: dia(13) }, // anterior a pedir el serial: se lista sin él
  { ...instalacion, id: 'i8', codigo: 'IS8', nombre: 'Isabel', tecnico: 'LUIS PEREZ', instalacion: { metraje: 50, serial: 'FHTT55556666' }, finalizadoEn: dia(13) },
];
const conEquipos = consumoPorTecnico(conSerial);
check('cambios de equipo: se cuentan por técnico y en los totales, sin metros ni conectores',
  [conEquipos.filas.map(f => [f.tecnico, f.cambiosEquipo, f.instalaciones, f.metros, totalConectores(f)]), conEquipos.totales.cambiosEquipo], [[['LUIS PEREZ', 2, 1, 50, 0], ['MARIA GOMEZ', 1, 0, 0, 0]], 3]);
check('cambios de equipo: el pre-finalizado se informa aparte y el pendiente no cuenta', conEquipos.porAprobar, { ordenes: 0, instalaciones: 0, metros: 0, visitas: 0, cambiosEquipo: 1 });
check('el detalle de un cambio de equipo trae la clase, el serial del equipo nuevo y no gasta cable',
  conEquipos.filas[0].detalle.filter(d => d.clase === 'CAMBIO_EQUIPO').map(d => [d.id, d.serial, d.metros, d.verde, d.azul]).sort(), [['c1', 'HWTC1A2B3C4D', null, 0, 0], ['c5', '', null, 0, 0]]);
check('el detalle de una instalación trae el serial de la ONU',
  conEquipos.filas[0].detalle.filter(d => d.clase === 'INSTALACION').map(d => [d.id, d.serial, d.metros]), [['i8', 'FHTT55556666', 50]]);
check('una instalación anterior a guardar el serial sale con serial vacío', consumoPorTecnico([instalaciones[0]]).filas[0].detalle[0].serial, '');
check('un recableado y una visita de conector no llevan serial', consumoPorTecnico([ordenes[0], visitas[0]]).filas.flatMap(f => f.detalle.map(d => d.serial)), ['', '']);
check('un cambio de equipo no cuenta como instalación ni visita de conector', [esInstalacionFinalizada(conSerial[0]), esVisitaConectorFinalizada(conSerial[0]), esCambioEquipoFinalizado(conSerial[0]), esCambioEquipoPorAprobar(conSerial[2]), esCambioEquipoFinalizado(conSerial[3])], [false, false, true, true, false]);

// --- El conector de una visita, aparte del cobro ---
check('conector de una visita externa: tipo y color',
  conectorDeVisita({ tipoVisita: 'CONECTOR_EXTERNO', conectorExterno: 'VERDE' }), { tipo: 'Externo', color: 'VERDE', etiquetaColor: 'Verde', cantidades: { verde: 1, azul: 0 } });
check('conector de una visita interna: tipo y color',
  [conectorDeVisita({ tipoVisita: 'CONECTOR_INTERNO', conectorInterno: 'AZUL' }), conectorDeVisita({ tipoVisita: 'CONECTOR_INTERNO', conectorInterno: 'VERDE' })],
  [{ tipo: 'Interno', color: 'AZUL', etiquetaColor: 'Azul', cantidades: { verde: 0, azul: 1 } }, { tipo: 'Interno', color: 'VERDE', etiquetaColor: 'Verde', cantidades: { verde: 1, azul: 0 } }]);
check('en una visita solo cuenta el conector de esa visita (el externo no toma el color del interno)',
  conectorDeVisita({ tipoVisita: 'CONECTOR_EXTERNO', conectorExterno: 'VERDE', conectorInterno: 'AZUL' }).color, 'VERDE');
check('una visita anterior a pedir el color queda sin color, sin romperse',
  [conectorDeVisita({ tipoVisita: 'CONECTOR_EXTERNO' }), conectorDeVisita({ tipoVisita: 'CONECTOR_INTERNO', conectorInterno: 'ROJO' })],
  [{ tipo: 'Externo', color: '', etiquetaColor: '', cantidades: { verde: 0, azul: 0 } }, { tipo: 'Interno', color: '', etiquetaColor: '', cantidades: { verde: 0, azul: 0 } }]);
check('el conector de una visita trae las cantidades escritas',
  conectorDeVisita({ tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 2, azul: 1 } }),
  { tipo: 'Interno', color: '', etiquetaColor: '', cantidades: { verde: 2, azul: 1 } });
check('el color del externo (legado) no admite el azul', conectorDeVisita({ tipoVisita: 'CONECTOR_EXTERNO', conectorExterno: 'AZUL' }).color, '');
check('lo que no es una visita de conector no tiene conector aparte',
  [conectorDeVisita({ tipoVisita: 'RECABLEADO', conectorExterno: 'VERDE' }), conectorDeVisita({ tipoVisita: '' }), conectorDeVisita({ tipoVisita: 'CAMBIO_EQUIPO' }), conectorDeVisita(null), conectorDeVisita(undefined)],
  [null, null, null, null, null]);
check('texto de una visita externa con internos azules',
  textoConectorVisita({ tipoVisita: 'CONECTOR_EXTERNO', conectoresUsados: { verde: 1, azul: 2 } }), 'Conectores: 1 externo verde, 2 internos azules');
check('el texto del conector que ya se guardaba en el historial no cambia',
  [textoConectorVisita({ tipoVisita: 'CONECTOR_EXTERNO', conectorExterno: 'VERDE' }), textoConectorVisita({ tipoVisita: 'CONECTOR_INTERNO', conectorInterno: 'AZUL' })], ['Conector verde', 'Conector azul']);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
