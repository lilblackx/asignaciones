// Prueba que el nombre y la dirección de un cliente se guarden con mayúsculas uniformes sin romper nada: la función en sí, lo que se pega
// en la plantilla, lo que trae SmartOLT, lo que se guarda al crear y editar, y que lo ya pegado de la promotora quede intacto.
// No necesita el emulador. Uso: `npm run test:datos`.
import { readFileSync } from 'node:fs';
import { direccionCliente, nombrePersona } from '../src/utils/datosCliente.js';
import { parseInstalacionTemplate } from '../src/utils/whatsapp.js';
import { camposDeOnu, camposParaRellenar } from '../src/utils/clienteSmartolt.js';

let failures = 0;
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- Nombre ---
check('todo en mayúsculas, todo en minúsculas o mezclado: sale igual', ['ANGELA MARIA OSPINO BORGES', 'angela maria ospino borges', 'ANGELA maria OSPINO borges'].map(nombrePersona), Array(3).fill('Angela Maria Ospino Borges'));
check('lo que ya está bien no cambia', nombrePersona('Carlos Alberto Manjarres Dominguez'), 'Carlos Alberto Manjarres Dominguez');
check('las partículas van en minúscula, menos al principio', [nombrePersona('MARIA DE LOS ANGELES PEREZ'), nombrePersona('DE LA ROSA MARIA'), nombrePersona('luis del valle y soto')], ['Maria de los Angeles Perez', 'De la Rosa Maria', 'Luis del Valle y Soto']);
check('guion y apóstrofo se arreglan por partes, y las tildes y la eñe se respetan', [nombrePersona('PEREZ-GOMEZ'), nombrePersona("o'brien"), nombrePersona('ÁNGEL ÑÚÑEZ')], ['Perez-Gomez', "O'Brien", 'Ángel Ñúñez']);
check('una palabra con mayúscula en medio se respeta (McDonald)', nombrePersona('JOHN McDonald'), 'John McDonald');
check('siglas de empresa y números romanos se quedan en mayúsculas', [nombrePersona('INVERSIONES XYZ C.A.'), nombrePersona('servicios abc srl'), nombrePersona('JOSE LUIS II')], ['Inversiones Xyz C.A.', 'Servicios Abc SRL', 'Jose Luis II']);
check('espacios de más y vacíos', [nombrePersona('  luis   DE la CRUZ  '), nombrePersona(''), nombrePersona(null), nombrePersona(undefined)], ['Luis de la Cruz', '', '', '']);

// --- Dirección ---
check('la dirección sale con mayúsculas uniformes y lo que lleva números, en mayúsculas', [
  direccionCliente('BARRIO GUANIPAMATO AV 101D CASA 57 67 NAP B2'),
  direccionCliente('Barrio Villa Centenario de luz calle 98c casa 60-167'),
  direccionCliente('urbanizacion san miguel calle 96i casa 59-42'),
], ['Barrio Guanipamato Av 101D Casa 57 67 NAP B2', 'Barrio Villa Centenario de Luz Calle 98C Casa 60-167', 'Urbanizacion San Miguel Calle 96I Casa 59-42']);
check('los artículos son parte del lugar (El Centro) y los ordinales y abreviaturas se respetan', [
  direccionCliente('SECTOR EL CENTRO, FRENTE A LA PLAZA'),
  direccionCliente('urb. los samanes 2da etapa torre B'),
  direccionCliente('AV. PRINCIPAL C.C. LAS GALERIAS LOCAL 12'),
], ['Sector El Centro, Frente a La Plaza', 'Urb. Los Samanes 2da Etapa Torre B', 'Av. Principal C.C. Las Galerias Local 12']);
const direcciones = ['BARRIO GUANIPAMATO AV 101D CASA 57 67 NAP B2', 'la montanita segunda etapa , calle 94M , casa numero 5', 'CONJUNTO RESIDENCIAL EDIF. MIRANDA APT 4B', 'barrio san juan calle 100 / PRE-100', ''];
check('es idempotente (normalizar dos veces da lo mismo), en nombres y direcciones', [direcciones.every((d) => direccionCliente(direccionCliente(d)) === direccionCliente(d)), ['ANGELA MARIA', "o'BRIEN-PEREZ", 'INVERSIONES C.A.'].every((n) => nombrePersona(nombrePersona(n)) === nombrePersona(n))], [true, true]);

// --- Pegado de la plantilla de la promotora ---
const PLANTILLA = `*Nombres Completos:* ANGELA MARIA OSPINO BORGES
*Cédula:* 25.290.172
*Teléfono:* 0414-1234567
*Dirección completa:* BARRIO GUANIPAMATO AV 101D CASA 57 67 NAP B2
*NAP:* B2H01`;
const pegado = parseInstalacionTemplate(PLANTILLA);
check('al pegar la plantilla, el nombre y la dirección salen normalizados y lo demás (cédula, teléfono, NAP) no cambia',
  [pegado.nombre, pegado.direccion, pegado.cedula, pegado.telefono], ['Angela Maria Ospino Borges', 'Barrio Guanipamato Av 101D Casa 57 67 NAP B2', '25.290.172', '0414-1234567']);
check('lo pegado en minúsculas también', parseInstalacionTemplate('*Nombre completo:* carlos alberto\n*Dirección:* calle 5 casa 10b').nombre, 'Carlos Alberto');

// --- Lo que trae SmartOLT ---
const onu = { nombre: 'JUAN PEREZ C.I 12.345.678 (P150)', direccion: 'URB LOS SAMANES CASA 4b', telefono: '0414-1234567', nap: 'o10h37', puerto: '5' };
const campos = camposDeOnu(onu, '12345678');
check('SmartOLT: el nombre se limpia como antes (sin cédula ni códigos) y sale normalizado, igual que la dirección', [campos.nombre, campos.direccion, campos.nap], ['Juan Perez', 'Urb Los Samanes Casa 4B', 'O10H37 - Puerto 5']);
check('SmartOLT: no pisa lo que ya escribió quien crea la orden', camposParaRellenar(onu, '12345678', { nombre: 'Ya Escrito', direccion: '' }).campos.nombre, undefined);
check('SmartOLT: el valor que se aplica al formulario es el mismo que el normalizado (así "volver a buscar" no lo toma por editado)', camposParaRellenar(onu, '12345678', {}).campos.nombre, nombrePersona(campos.nombre));

// --- Al guardar ---
const tickets = leer('../src/hooks/useTickets.js');
check('al crear una orden se guarda el nombre y la dirección normalizados', /nombre: nombrePersona\(formData\.nombre\),\s*direccion: direccionCliente\(formData\.direccion\)/.test(tickets), true);
check('al editar una orden también', /nombre: nombrePersona\(editingTicket\.nombre\), direccion: direccionCliente\(editingTicket\.direccion\)/.test(tickets), true);
check('el resumen del historial del cierre automático (Worker) los normaliza', /nombre: \{ stringValue: nombrePersona\(f\.nombre\?\.stringValue\) \}/.test(leer('../cf-worker/src/index.js')) && /direccion: \{ stringValue: direccionCliente\(f\.direccion\?\.stringValue\) \}/.test(leer('../cf-worker/src/index.js')), true);
check('la plantilla de la promotora se guarda tal cual (no se normaliza lo pegado)', /plantillaOriginal:\s*direccionCliente|plantillaOriginal:\s*nombrePersona/.test(tickets), false);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
