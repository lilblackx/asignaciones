// Prueba la corrección de negritas de plantillas de la promotora (src/utils/negritas.js).
// No necesita el emulador. Uso: `npm run test:negritas`.
import { normalizarNegritas } from '../src/utils/negritas.js';

let failures = 0;
function check(name, entrada, esperado) {
  const actual = normalizarNegritas(entrada);
  if (actual === esperado) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}\n      esperado ${JSON.stringify(esperado)}, llegó ${JSON.stringify(actual)}`);
  }
}

check('"*Condición*" sin dos puntos queda "*Condición:*"', 'IO11\n*Condición*\n*Plan a contratar:* 200', 'IO11\n*Condición:*\n*Plan a contratar:* 200');
check('tolera mayúsculas, sin tilde y espacios', 'IO1\n *CONDICION* ', 'IO1\n *CONDICION:*');
check('un énfasis suelto como "*URGENTE*" no se toca', 'IO1\n*URGENTE*', 'IO1\n*URGENTE*');
check('"*Fuente*: valor" se corrige', 'IO1\n*Fuente*: oficina', 'IO1\n*Fuente:* oficina');
check('"*Instalador:*JOSE" pegado: se agrega espacio para que WhatsApp cierre la negrita', 'IO1\n*Instalador:*JOSE', 'IO1\n*Instalador:* JOSE');
check('"*Instalador:* JOSE" ya correcto queda igual', 'IO1\n*Instalador:* JOSE', 'IO1\n*Instalador:* JOSE');
check('etiqueta vacía "*Mac:*" queda igual', 'IO1\n*Mac:*', 'IO1\n*Mac:*');
check('valor pegado tras "*Fuente*:" también se separa', 'IO1\n*Fuente*:oficina', 'IO1\n*Fuente:* oficina');
check('asterisco de apertura sin cierre', 'IO1\n*Fuente: oficina', 'IO1\n*Fuente:* oficina');
check('la primera línea (código) no se toca', '*IO1*\n*Condición*', '*IO1*\n*Condición:*');
check('es idempotente', normalizarNegritas('IO1\n*Condición*'), 'IO1\n*Condición:*');

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
