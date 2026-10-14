// Prueba los datos con los que se autoriza una instalación en SmartOLT (src/utils/datosAutorizacion.js): qué
// datos salen, en qué orden, cuál es el texto de "Copiar todo" y cómo se lee el plan de la plantilla de la
// promotora. No necesita el emulador. Uso: `npm run test:autorizacion`.
import { datosAutorizacion, textoACopiar } from '../src/utils/datosAutorizacion.js';
import { formatCedula } from '../src/utils/cedula.js';
import { parseDatosClienteTemplate } from '../src/utils/whatsapp.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const PLANTILLA = `IO72
*Mac:*
*Vlan:*
*Nombres  Completos:*  Luis Gerardo Scandela García
*C.I:* 21.074.127
*NRO de teléfono:* +58 414-9681356 / 0424-5551234
*Correo electrónico:*  luis@example.com
*Dirección completa:* Barrio el prado Calle 95 R casa sin número
*Servicio a Contratar:* SM
*Condición:* Cliente nuevo
*Plan a contratar:* 200mg x 17$
*Drop:*
*Forma de pago:* Zelle 45$
*Promotora:* Sariana
*Fuente:*  Instagram
`;

const orden = {
  codigo: 'IO72', nombre: 'Luis Gerardo Scandela García', cedula: '21.074.127', tipoDocumento: 'V',
  telefono: '+58 414-9681356 / 0424-5551234', direccion: 'Barrio el prado Calle 95 R casa sin número',
  tipoTrabajo: 'INSTALACIÓN', falla: 'SM', plantillaOriginal: PLANTILLA, ubicacion: 'https://www.google.com/maps?q=10.6666,-71.6124',
  instalacion: { serial: 'VSOLGVSAVSAVSAVA', vlan: '1700', posteadura: ['m02p11', 'm02p12'], metraje: 120, nap: 'O02B12', puerto: '3', puertosDisponibles: '0' },
};
const claves = (lista) => lista.map(d => d.clave);
const porClave = (lista, clave) => lista.find(d => d.clave === clave);

// --- Plan de la plantilla ---
check('se lee el plan a contratar', parseDatosClienteTemplate(PLANTILLA), { plan: '200mg x 17$' });
check('el correo, la forma de pago, la condición, la promotora y la fuente no se leen', Object.keys(parseDatosClienteTemplate(PLANTILLA)), ['plan']);
check('el plan en la línea de abajo también se lee', parseDatosClienteTemplate('X1\n*Plan a contratar:*\n100mg x 12$\n*Drop:*').plan, '100mg x 12$');
check('un plan vacío (la siguiente línea es otra etiqueta) no se lee', parseDatosClienteTemplate('X1\n*Plan a contratar:*\n*Drop:*\n'), {});
check('un "no aplica" no cuenta como plan', parseDatosClienteTemplate('X1\n*Plan a contratar:* N/A'), {});
check('con la etiqueta "Plan" a secas también', parseDatosClienteTemplate('X1\nPlan: 50mg').plan, '50mg');
check('sin plantilla no hay nada', [parseDatosClienteTemplate(''), parseDatosClienteTemplate(null), parseDatosClienteTemplate(undefined)], [{}, {}, {}]);
check('un valor demasiado largo no es un plan', parseDatosClienteTemplate(`X1\n*Plan:* ${'a'.repeat(200)}`), {});

// --- Cédula ---
check('cédula: la V solo lleva puntos y el RIF su prefijo sin puntos', [formatCedula('21.074.127', 'V'), formatCedula('21.074.127', undefined), formatCedula('123.456.789', 'J'), formatCedula('', 'V')], ['21.074.127', '21.074.127', 'J-123456789', '']);

// --- Datos para autorizar ---
const d = datosAutorizacion(orden);
check('equipo: serial, VLAN, NAP, puerto, drop, posteadura y puertos disponibles, en ese orden',
  claves(d.equipo), ['serial', 'vlan', 'nap', 'puerto', 'drop', 'posteadura', 'puertosDisponibles']);
check('cliente: nombre, cédula, teléfonos, dirección, ubicación, servicio y plan, en ese orden',
  claves(d.cliente), ['nombre', 'cedula', 'telefono0', 'telefono1', 'direccion', 'ubicacion', 'servicio', 'plan']);
check('el drop se ve con la unidad y se copia solo el número', [porClave(d.equipo, 'drop').valor, textoACopiar(porClave(d.equipo, 'drop'))], ['120 m', '120']);
check('lo demás se copia tal como se ve', d.equipo.filter(x => x.clave !== 'drop').every(x => textoACopiar(x) === x.valor), true);
check('la posteadura junta los postes', porClave(d.equipo, 'posteadura').valor, 'm02p11, m02p12');
check('cada teléfono es un dato aparte, con su número', [porClave(d.cliente, 'telefono0'), porClave(d.cliente, 'telefono1')].map(x => [x.etiqueta, x.valor]), [['Teléfono 1', '+58 414-9681356'], ['Teléfono 2', '0424-5551234']]);
check('con un solo teléfono no se numera', datosAutorizacion({ ...orden, telefono: '04120000001' }).cliente.find(x => x.clave === 'telefono0').etiqueta, 'Teléfono');
check('la cédula y la ubicación llevan su tipo para mostrarse como enlace', [porClave(d.cliente, 'cedula').tipo, porClave(d.cliente, 'ubicacion').tipo], ['cedula', 'ubicacion']);
check('el plan sale de la plantilla', porClave(d.cliente, 'plan').valor, '200mg x 17$');
check('"Copiar todo": la orden, el cliente y, aparte, el equipo', d.texto, [
  'Orden IO72',
  'Nombre: Luis Gerardo Scandela García',
  'Cédula: 21.074.127',
  'Teléfono 1: +58 414-9681356',
  'Teléfono 2: 0424-5551234',
  'Dirección: Barrio el prado Calle 95 R casa sin número',
  'Ubicación: https://www.google.com/maps?q=10.6666,-71.6124',
  'Servicio: SM',
  'Plan: 200mg x 17$',
  '',
  'Serial / MAC: VSOLGVSAVSAVSAVA',
  'VLAN: 1700',
  'NAP: O02B12',
  'Puerto del cliente: 3',
  'Drop: 120 m',
  'Posteadura: m02p11, m02p12',
  'Puertos disponibles: 0',
].join('\n'));
check('el correo, la forma de pago y la venta no aparecen en ninguna parte', /example\.com|Zelle|Sariana|Instagram|Cliente nuevo/.test(d.texto), false);

// --- Casos con menos datos ---
check('un RIF se muestra con su prefijo', porClave(datosAutorizacion({ ...orden, cedula: '123.456.789', tipoDocumento: 'J' }).cliente, 'cedula').valor, 'J-123456789');
const sinPlantilla = datosAutorizacion({ ...orden, plantillaOriginal: '' });
check('sin plantilla no hay plan y lo demás se mantiene', [claves(sinPlantilla.cliente).includes('plan'), claves(sinPlantilla.cliente).length, claves(sinPlantilla.equipo).length], [false, 7, 7]);
check('el servicio de una instalación se llama "Servicio" y la falla de una avería, "Falla"',
  [porClave(d.cliente, 'servicio').etiqueta, porClave(datosAutorizacion({ codigo: 'AS1', nombre: 'Ana', tipoTrabajo: 'AVERÍA', falla: 'LOS' }).cliente, 'servicio').etiqueta], ['Servicio', 'Falla']);
check('sin falla distinta del tipo de trabajo no hay servicio', claves(datosAutorizacion({ ...orden, falla: 'INSTALACIÓN' }).cliente).includes('servicio'), false);
check('sin metraje (instalaciones anteriores) no hay drop y no se rompe', claves(datosAutorizacion({ ...orden, instalacion: { ...orden.instalacion, metraje: null } }).equipo).includes('drop'), false);
check('sin ubicación no hay enlace a Maps', claves(datosAutorizacion({ ...orden, ubicacion: '' }).cliente).includes('ubicacion'), false);
check('una ubicación que no es un enlace seguro se descarta', claves(datosAutorizacion({ ...orden, ubicacion: 'javascript:alert(1)' }).cliente).includes('ubicacion'), false);

// Visita con NAP y puerto en un solo texto (conector externo / cambio de equipo): no hay datos de instalación
const visita = datosAutorizacion({ codigo: 'AS9', nombre: 'Ana', tipoTrabajo: 'AVERÍA', falla: 'Sin señal', nap: 'O02B12 - Puerto 3', tipoVisita: 'CAMBIO_EQUIPO', serialEquipo: 'HWTC1A2B3C4D' });
check('cambio de equipo: serial del equipo nuevo y la NAP con su puerto', visita.equipo.map(x => [x.clave, x.valor]), [['serialEquipo', 'HWTC1A2B3C4D'], ['nap', 'O02B12 - Puerto 3']]);
check('una avería sin datos de equipo solo trae al cliente', datosAutorizacion({ codigo: 'AS1', nombre: 'Ana', tipoTrabajo: 'AVERÍA', falla: 'Sin señal' }).equipo, []);
check('sin orden no se rompe', [datosAutorizacion(null), datosAutorizacion(undefined)].map(x => [x.equipo.length, x.cliente.length, x.texto]), [[0, 0, 'Orden S/C'], [0, 0, 'Orden S/C']]);
check('los espacios de más se limpian', porClave(datosAutorizacion({ ...orden, nombre: '  Luis   Pérez ' }).cliente, 'nombre').valor, 'Luis Pérez');

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
