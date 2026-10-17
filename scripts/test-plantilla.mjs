// Prueba la lectura de la plantilla de la promotora (parseInstalacionTemplate en
// src/utils/whatsapp.js), sobre todo la cédula: debe aceptar los formatos reales
// (con puntos, espacios, V/E/J) y NO inventar datos cuando el valor es dudoso.
// No necesita el emulador. Uso: `npm run test:plantilla`.
import { parseInstalacionTemplate } from '../src/utils/whatsapp.js';

let failures = 0;
function check(name, plantilla, esperado) {
  const campos = parseInstalacionTemplate(plantilla);
  const actual = Object.fromEntries(Object.keys(esperado).map(k => [k, campos[k]]));
  if (JSON.stringify(actual) === JSON.stringify(esperado)) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}\n      esperado ${JSON.stringify(esperado)}, llegó ${JSON.stringify(actual)}`);
  }
}
// Un campo que no se pudo leer queda sin definir (undefined): se llena a mano.
const sinCedula = { cedula: undefined, tipoDocumento: undefined };

const PLANTILLA_REAL = `I000000
*Mac:*
*Vlan:*
*Posteadura:*
*Nap:*

*Cliente conecta en el puerto N°:*

*PUERTOS DISPONIBLES:*

*Nombres  Completos:*
Ricardo Jose Gonzalez Viloria
*C.I* 34.250.195
*NRO de teléfono:*
0412-0665119
*Correo electrónico:*
darguinurdaneta692@gmail.com
*Dirección completa:*
Ezequiel Zamora calle 96E
*Servicio a Contratar:*
SM
*Condición*
*Plan a contratar:*
200 mg por 17$ mensual
*Nota:* Se puede hacer del N02H05 a 140m con 1 puerto libre`;

// --- Plantilla real que no se leía (etiqueta en negrita sin dos puntos) ---
check('plantilla real: cédula con "*C.I*" sin dos puntos', PLANTILLA_REAL, {
  nombre: 'Ricardo Jose Gonzalez Viloria', cedula: '34.250.195', telefono: '0412-0665119',
  direccion: 'Ezequiel Zamora Calle 96E', falla: 'SM', nap: 'N02H05',
});

// --- Formatos válidos de la cédula ---
check('con puntos', '*C.I:* 34.250.195', { cedula: '34.250.195', tipoDocumento: undefined });
check('seguidos, sin separadores', '*C.I:* 34250195', { cedula: '34.250.195' });
check('con espacios', '*C.I:* 34 250 195', { cedula: '34.250.195' });
check('con espacios y sin dos puntos', '*C.I* 34 250 195', { cedula: '34.250.195' });
check('con comas', '*C.I:* 34,250,195', { cedula: '34.250.195' });
check('V con guion', '*C.I:* V-11.297.749', { tipoDocumento: 'V', cedula: '11.297.749' });
check('V con espacios', '*C.I:* V 11 297 749', { tipoDocumento: 'V', cedula: '11.297.749' });
check('V pegada', '*C.I:* V11297749', { tipoDocumento: 'V', cedula: '11.297.749' });
check('minúscula', '*C.I:* v-11297749', { tipoDocumento: 'V', cedula: '11.297.749' });
check('extranjero E', '*Cédula:* E-81234567', { tipoDocumento: 'E', cedula: '81.234.567' });
check('RIF con dígito verificador (se descarta el dígito)', '*RIF:* J-30123456-7', { tipoDocumento: 'J', cedula: '30.123.456' });
check('7 dígitos (cédula antigua)', '*C.I:* 1.234.567', { cedula: '1.234.567' });
check('con nota sin números al final', '*C.I:* V-11.297.749 (titular)', { tipoDocumento: 'V', cedula: '11.297.749' });
check('punto final suelto', '*C.I:* 11.297.749.', { cedula: '11.297.749' });
check('espacio duro de WhatsApp entre grupos', '*C.I:* 34 250 195', { cedula: '34.250.195' });
check('valor en la línea de abajo', '*C.I:*\n34 250 195', { cedula: '34.250.195' });

// --- Datos dudosos: NO se autocompleta (queda para llenar a mano) ---
check('cédula + teléfono en la misma línea', '*C.I:* 34.250.195 tlf 0412-0665119', sinCedula);
check('cédula + teléfono sin texto entre ambos', '*C.I:* 34 250 195 0412 0665119', sinCedula);
check('sin dos puntos y con teléfono al lado', '*C.I* 34.250.195 tlf 0412-0665119', sinCedula);
check('dos cédulas', '*C.I:* 11.297.749 y 12.345.678', sinCedula);
check('un teléfono en el campo de la cédula', '*C.I:* 0412-0665119', sinCedula);
check('teléfono seguido en el campo de la cédula', '*C.I:* 04120665119', sinCedula);
check('demasiado corta (5 dígitos)', '*C.I:* 12345', sinCedula);
check('demasiado larga (10 dígitos)', '*C.I:* 1234567890', sinCedula);
check('separadores mezclados', '*C.I:* 34.250 195', sinCedula);
check('grupo de miles incompleto', '*C.I:* 34 250 19', sinCedula);
check('grupos de miles de más', '*C.I:* 1 234 567 890', sinCedula);
check('empieza en cero', '*C.I:* 034250195', sinCedula);
check('texto sin número', '*C.I:* pendiente', sinCedula);
check('pasaporte', '*C.I:* P-123456', sinCedula);
check('letra de más antes del número', '*C.I:* VE-11297749', sinCedula);
check('dígito verificador de más', '*C.I:* J-30123456-78', sinCedula);

// --- Una palabra en negrita sin dos puntos no se toma por un campo ---
check('"*Cliente* conecta..." no es el nombre y no bloquea el nombre real',
  '*Cliente* conecta en el puerto 3\n*Nombres Completos:*\nRicardo Gonzalez', { nombre: 'Ricardo Gonzalez' });
check('"*Nap* disponible" sin dos puntos no se toma como NAP', '*Nap* disponible el lunes', { nap: undefined });
check('"*Dirección* ..." sin dos puntos no se toma como dirección', '*Dirección* Calle 5 casa 10', { direccion: undefined });
check('una cédula inválida no bloquea otra válida más abajo',
  '*C.I:* 0412-0665119\n*Cédula:* V-11.297.749', { tipoDocumento: 'V', cedula: '11.297.749' });

// =========================== TELÉFONO ===========================
// Mismo criterio que el formulario (utils/telefono) y, para números venezolanos, 02/04.
const tel = (valor) => `*NRO de teléfono:* ${valor}`;
const sinTelefono = { telefono: undefined };

check('teléfono con guion', tel('0412-0665119'), { telefono: '0412-0665119' });
check('teléfono seguido', tel('04120665119'), { telefono: '04120665119' });
check('teléfono con +58 y espacios', tel('+58 412 0665119'), { telefono: '+58 412 0665119' });
check('teléfono sin el 0 inicial', tel('4120665119'), { telefono: '4120665119' });
check('teléfono fijo', tel('0261-7123456'), { telefono: '0261-7123456' });
check('teléfono extranjero con +', tel('+1 305 555 1234'), { telefono: '+1 305 555 1234' });
check('teléfono con paréntesis en el código de área', tel('(0412) 066-5119'), { telefono: '(0412) 066-5119' });
check('dos teléfonos con "/"', tel('0412-0665119 / 0414-1234567'), { telefono: '0412-0665119 / 0414-1234567' });
check('dos teléfonos con "y"', tel('0412-0665119 y 0414-1234567'), { telefono: '0412-0665119 / 0414-1234567' });
check('dos teléfonos con coma', tel('0412-0665119, 0414-1234567'), { telefono: '0412-0665119 / 0414-1234567' });
check('teléfono repetido se junta', tel('0412-0665119 / 04120665119'), { telefono: '0412-0665119' });
check('teléfono con el nombre al lado', tel('0412-0665119 (Mariana)'), { telefono: '0412-0665119' });
check('teléfono en la línea de abajo', '*NRO de teléfono:*\n0412-0665119', { telefono: '0412-0665119' });

check('teléfono: 10 dígitos que empiezan en 0', tel('0412-066511'), sinTelefono);
check('teléfono: 12 dígitos que empiezan en 0', tel('0412-06651190'), sinTelefono);
check('teléfono: dos números pegados sin separador', tel('0412-0665119 0414-1234567'), sinTelefono);
check('teléfono: uno bueno y uno malo (todo o nada)', tel('0412-0665119 / 123'), sinTelefono);
check('teléfono: parece una cédula', tel('1234567890'), sinTelefono);
check('teléfono: es una cédula con puntos', tel('34.250.195'), sinTelefono);
check('teléfono: texto sin número', tel('no tiene'), sinTelefono);
check('teléfono: letra en medio del número (typo)', tel('04l2-0665119'), sinTelefono);
check('teléfono: correo con dígitos al lado', tel('0412-0665119 juan123@gmail.com'), sinTelefono);
check('teléfono: un correo', tel('juan@gmail.com'), sinTelefono);
check('teléfono: más de 3 números', tel('0412-0665119 / 0414-1234567 / 0424-7654321 / 0416-1112233'), sinTelefono);
check('teléfono: símbolos raros', tel('0412#0665119'), sinTelefono);
check('teléfono: espacios repetidos se juntan', tel('0412   -   066   -   5119'), { telefono: '0412 - 066 - 5119' });
check('teléfono: más largo que el campo (20)', tel('+58 ( 412 ) 066 - 5119'), sinTelefono);
check('teléfono: paréntesis sin cerrar', tel('(0412 066-5119'), sinTelefono);
check('teléfono vacío seguido de otra etiqueta con valor', '*NRO de teléfono:*\n*C.I* 34.250.195', { telefono: undefined, cedula: '34.250.195' });

// WhatsApp escribe los números con un guion "no separable" (U+2011) que no es el "-" normal, y otros programas con
// rayas o el signo menos: se leen igual y el número se guarda con un guion normal. Lo demás sigue igual de estricto.
check('teléfono con el guion no separable de WhatsApp (U+2011)', tel('+58 414\u20113505086'), { telefono: '+58 414-3505086' });
check('teléfono con guion (U+2010)', tel('0412\u20100665119'), { telefono: '0412-0665119' });
check('teléfono con guion de figura (U+2012)', tel('0412\u20120665119'), { telefono: '0412-0665119' });
check('teléfono con raya corta (U+2013)', tel('0412\u20130665119'), { telefono: '0412-0665119' });
check('teléfono con raya larga (U+2014)', tel('0412\u20140665119'), { telefono: '0412-0665119' });
check('teléfono con signo menos (U+2212)', tel('0412\u22120665119'), { telefono: '0412-0665119' });
check('dos teléfonos con el guion no separable', tel('0412\u20110665119 / 0414\u20111234567'), { telefono: '0412-0665119 / 0414-1234567' });
check('teléfono: el guion raro no vuelve válido un número incompleto', tel('0412\u2011066511'), sinTelefono);
check('teléfono: una raya entre dos números no los lee a medias', tel('0412-0665119 \u2014 0414-1234567'), sinTelefono);

// ========================== PROMOTORA ==========================
// La que vendió la instalación (línea "Promotora:" / "Promotor:"): con su mayúscula, sin espacios de más; "N/A" no cuenta.
const sinPromotora = { promotora: undefined };
check('promotora en minúscula', '*Promotora:* sariana', { promotora: 'Sariana' });
check('promotor con tilde y eñe', 'Promotor: Alexis Añez', { promotora: 'Alexis Añez' });
check('promotor/a', '*Promotor/a:* maria de los angeles', { promotora: 'Maria de los Angeles' });
check('todo en mayúsculas y con espacios de más', '*PROMOTORA:*   ALEXIS   AÑEZ ', { promotora: 'Alexis Añez' });
check('el nombre en la línea de abajo', '*Promotora:*\nLuisa Pérez\n*Fuente:* Instagram', { promotora: 'Luisa Pérez' });
check('promotora vacía seguida de otra etiqueta', '*Promotora:*\n*Fuente:* Sariana', sinPromotora);
check('promotora "N/A" no cuenta', '*Promotora:* N/A', sinPromotora);
check('promotora "no aplica" no cuenta', '*Promotora:* no aplica', sinPromotora);
check('promotora "pendiente" no cuenta', '*Promotora:* pendiente', sinPromotora);
check('un correo no es una promotora', '*Promotora:* sariana@gmail.com', sinPromotora);
check('un teléfono no es una promotora', '*Promotora:* 04141234567', sinPromotora);
check('sin línea de promotora', '*Nap:* N02H05', sinPromotora);
check('la promotora no se confunde con la fuente', '*Promotora:* sariana\n*Fuente:* Instagram', { promotora: 'Sariana' });
check('la plantilla real trae su promotora', PLANTILLA_REAL + '\n*Promotora:* sariana', { promotora: 'Sariana', telefono: '0412-0665119' });

// ============================== NAP ==============================
const sinNap = { nap: undefined };

check('NAP con código', '*Nap:* N02H05', { nap: 'N02H05' });
check('NAP en minúscula', '*Nap:* n02h05', { nap: 'N02H05' });
check('NAP con texto alrededor', '*Nap:* N02H05 a 140m', { nap: 'N02H05' });
check('NAP con sufijo de caja gemela', '*Nap:* N02H05-2', { nap: 'N02H05-2' });
check('NAP por zona (SN)', '*Nap:* DM-SN-01', { nap: 'DM-SN-01' });
check('NAP vacío y código con la palabra NAP en la nota', '*Nap:*\n*Nota:* se puede hacer del NAP O10H37 a 240m', { nap: 'O10H37' });
check('NAP vacío y código suelto en la nota', '*Nap:*\n*Nota:* Se puede hacer del N02H05 a 140m', { nap: 'N02H05' });
check('NAP sin código en su línea y código en la nota', '*Nap:* por asignar\n*Nota:* se puede hacer del O02E13', { nap: 'O02E13' });

check('NAP: dos códigos distintos en su línea', '*Nap:* N02H05 / N02H06', sinNap);
check('NAP: dos códigos en su línea y uno más en la nota', '*Nap:* N02H05 / N02H06\n*Nota:* se puede hacer del N02H05', sinNap);
check('NAP: dos códigos distintos en la nota', '*Nap:*\n*Nota:* se puede hacer del N02H05 o del N02H06', sinNap);
check('NAP: dos códigos con la palabra NAP en el texto', '*Nap:*\n*Observación:* NAP N02H05 lleno, NAP N02H06 libre', sinNap);
check('NAP: texto sin código y sin nota', '*Nap:* disponible', sinNap);
check('NAP: la MAC no se toma por código', '*Mac:* A1B2C3D4E5F6\n*Nap:*', sinNap);

// ===================== NOMBRE Y DIRECCIÓN =====================
const nom = (valor) => `*Nombres Completos:* ${valor}`;
const dir = (valor) => `*Dirección completa:* ${valor}`;
const sinNombre = { nombre: undefined };
const sinDireccion = { direccion: undefined };

check('nombre normal', nom('Ricardo Jose Gonzalez Viloria'), { nombre: 'Ricardo Jose Gonzalez Viloria' });
check('nombre: junta espacios repetidos', nom('  Ricardo   Jose  Gonzalez '), { nombre: 'Ricardo Jose Gonzalez' });
check('nombre de empresa con números', nom('Inversiones 2020 C.A.'), { nombre: 'Inversiones 2020 C.A.' });
check('nombre de exactamente 100 caracteres', nom('a'.repeat(100)), { nombre: 'A' + 'a'.repeat(99) });
check('nombre: más largo que el campo (101)', nom('a'.repeat(101)), sinNombre);
check('nombre: "N/A"', nom('N/A'), sinNombre);
check('nombre: "Pendiente"', nom('Pendiente'), sinNombre);
check('nombre: solo números', nom('123'), sinNombre);
check('nombre: con una cédula pegada', nom('Ricardo Gonzalez 34.250.195'), sinNombre);
check('nombre: con un teléfono pegado', nom('Ricardo 0412-0665119'), sinNombre);
check('nombre: un correo', nom('juan@gmail.com'), sinNombre);
check('nombre: un enlace', nom('https://wa.me/584120665119'), sinNombre);
check('nombre vacío seguido de otra etiqueta con valor', '*Nombres Completos:*\n*C.I* 34.250.195', { nombre: undefined, cedula: '34.250.195' });

check('dirección normal', dir('Ezequiel Zamora calle 96E'), { direccion: 'Ezequiel Zamora Calle 96E' });
check('dirección con números y guion', dir('Urb. Los Olivos, casa 25-B'), { direccion: 'Urb. Los Olivos, Casa 25-B' });
check('dirección con números sueltos', dir('Av. 15 Delicias con calle 72'), { direccion: 'Av. 15 Delicias con Calle 72' });
check('dirección de exactamente 200 caracteres', dir('a'.repeat(200)), { direccion: 'A' + 'a'.repeat(199) });
check('dirección: más larga que el campo (201)', dir('a'.repeat(201)), sinDireccion);
check('dirección: con un teléfono pegado', dir('Calle 5 casa 10 tlf 04120665119'), sinDireccion);
check('dirección: un correo', dir('darguinurdaneta692@gmail.com'), sinDireccion);
check('dirección: "No aplica"', dir('No aplica'), sinDireccion);
check('dirección vacía seguida de un correo', '*Dirección completa:*\ndarguinurdaneta692@gmail.com', sinDireccion);
check('dirección vacía seguida de otra etiqueta sin dos puntos', '*Dirección completa:*\nTeléfono', sinDireccion);
check('dirección vacía seguida de una etiqueta en negrita con valor', '*Dirección completa:*\n*Nombre* Ricardo Gonzalez', { direccion: undefined, nombre: undefined });

// ====== Plantilla real cuyo teléfono no se completaba (traía el guion de WhatsApp) ======
check('plantilla real con el teléfono de WhatsApp (guion no separable)', `I000000
*Mac:*
*Vlan:*
*Posteadura:*
*Nap:*


*Cliente conecta en el puerto N°:*

*PUERTOS DISPONIBLES:*

*Nombres  Completos:*  Marielvis Chiquinquirá jayares Vargas
*C.I:*  30.419.134
*NRO de teléfono:* +58 414\u20113505086
*Correo electrónico:*  Karenvalentinamarquezjayares@gmail.com
*Dirección completa:*  barrio el despertar av 73 calle 98 casa 98-1-22
*Servicio a Contratar:* SM
*Condición*
*Plan a contratar:* 200mg x 17$
*Drop:*
*Forma de pago:* 25$
*Promotora:* sariana
*Fuente:*  Sariana
*Instalador:* Abraham
*Observación:* La clienta cancela 25$ Por la Instalación, le toca Cancelar Nuevamente Entre los Primeros 5 días del mes de Noviembre  17$
*NOTA:* Se puede hacer del M04F07 a 280m con 4 puertos libres`, {
  nombre: 'Marielvis Chiquinquirá Jayares Vargas', cedula: '30.419.134', telefono: '+58 414-3505086',
  direccion: 'Barrio El Despertar Av 73 Calle 98 Casa 98-1-22', falla: 'SM', instalador: 'Abraham', nap: 'M04F07',
});

// ============ La plantilla real completa (con la observación) ============
check('plantilla real completa', `${PLANTILLA_REAL}
*Drop:*
*Forma de pago:* 25$ o
21,919.75 bs
*Promotora:* Mariana salas
*Fuente:* Mariana salas
*Instalador:*
*Observación:* cancela 25$ o
21,919.75 bs por instalación y vuelve a cancelar los primeros 5 días mes de noviembre 17$ de mensualidad.`, {
  nombre: 'Ricardo Jose Gonzalez Viloria', cedula: '34.250.195', telefono: '0412-0665119',
  direccion: 'Ezequiel Zamora Calle 96E', falla: 'SM', nap: 'N02H05',
});

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
