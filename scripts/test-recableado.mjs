// Prueba el tipo de visita "Recableado" (src/utils/tipoVisita.js) y el consumo de materiales por
// técnico (src/utils/consumoMateriales.js). No necesita el emulador. Uso: `npm run test:recableado`.
import {
  TIPOS_VISITA, colorConectorExterno, colorConectorInterno, datosRecableado, etiquetaTipoVisita, generaCobro, parseMetros, partesRecableado, tieneDatosRecableado,
} from '../src/utils/tipoVisita.js';
import { consumoPorTecnico, esRecableadoFinalizado, esRecableadoPorAprobar, fechaDeUso, inicioPeriodo, totalConectores } from '../src/utils/consumoMateriales.js';

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
  datosRecableado('RECABLEADO', { metros: 35, conectorExterno: 'VERDE', conectorInterno: 'AZUL' }),
  { metrosCable: 35, conectorExterno: 'VERDE', conectorInterno: 'AZUL' });
check('recableado sin conectores (son opcionales)',
  datosRecableado('RECABLEADO', { metros: 20 }), { metrosCable: 20, conectorExterno: '', conectorInterno: '' });
check('un azul externo se descarta', datosRecableado('RECABLEADO', { metros: 20, conectorExterno: 'AZUL' }).conectorExterno, '');
check('fuera de un recableado todo se borra',
  datosRecableado('CONECTOR_EXTERNO', { metros: 35, conectorExterno: 'VERDE' }), { metrosCable: null, conectorExterno: '', conectorInterno: '' });
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
check('cuenta los conectores por tipo y color', todo.filas.find(f => f.tecnico === 'LUIS PEREZ'),
  { ...todo.filas.find(f => f.tecnico === 'LUIS PEREZ'), externoVerde: 1, internoVerde: 1, internoAzul: 1 });
check('totales de todos los técnicos', [todo.totales.ordenes, todo.totales.metros, todo.totales.externoVerde, todo.totales.internoVerde, todo.totales.internoAzul],
  [5, 110, 2, 1, 1]);
check('total de conectores', totalConectores(todo.totales), 4);
check('una orden repetida (activa y archivada) cuenta una sola vez', todo.filas.find(f => f.tecnico === 'LUIS PEREZ').detalle.filter(d => d.id === 'a').length, 1);
check('los pre-finalizados se informan aparte y no suman', todo.porAprobar, { ordenes: 1, metros: 8 });
check('las órdenes pendientes y las visitas de conector no cuentan', todo.filas.flatMap(f => f.detalle.map(d => d.id)).sort(), ['a', 'b', 'c', 'd', 'h']);
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
check('la fecha de uso cae a la de creación si no hay finalizadoEn', fechaDeUso({ createdAt: 5 }), 5);
check('clasificación de recableados', [esRecableadoFinalizado(ordenes[0]), esRecableadoPorAprobar(ordenes[4]), esRecableadoFinalizado(ordenes[5])], [true, true, false]);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
