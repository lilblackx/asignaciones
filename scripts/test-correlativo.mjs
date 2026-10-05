// Prueba el correlativo (src/utils/correlativo.js) contra el emulador de Firestore,
// con las reglas reales (firestore.rules) y transacciones reales. No toca producción.
// Requiere el emulador corriendo (`npm run emulators`). Uso: `npm run test:correlativo`.
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  generarCorrelativo,
  detectarSaltoManual,
  sincronizarCorrelativoManual,
  esCodigoSinNumero,
  maxNumeroExistente,
  obtenerCodigoMes,
} from '../src/utils/correlativo.js';

const APP_ID = `test-correlativo-${Date.now()}`;
const testEnv = await initializeTestEnvironment({
  projectId: 'seguimientons-f2026-rules-test',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await ctx.firestore().collection('artifacts').doc(APP_ID).collection('public').doc('data')
    .collection('users').doc('admin-uid').set({ role: 'ADMIN', disabled: false });
});

// El contexto autenticado devuelve Firestore "compat"; las funciones modulares
// del código necesitan el delegado modular que hay debajo.
const compat = testEnv.authenticatedContext('admin-uid').firestore();
const db = compat._delegate ?? compat;

const ticketRef = (id) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'tickets', id);
const contadorRef = (id) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'counters', id);

const hoy = new Date();
const mes = obtenerCodigoMes(hoy);
const anio = hoy.getFullYear();

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message.split('\n')[0]}`);
  }
}
const eq = (actual, esperado) => {
  if (actual !== esperado) throw new Error(`esperado ${JSON.stringify(esperado)}, llegó ${JSON.stringify(actual)}`);
};

await check('genera AO1, AO2, AO3 en secuencia', async () => {
  eq(await generarCorrelativo(db, APP_ID, 'AVERÍA', hoy), `A${mes}1`);
  eq(await generarCorrelativo(db, APP_ID, 'AVERÍA', hoy), `A${mes}2`);
  eq(await generarCorrelativo(db, APP_ID, 'RECONEXIÓN', hoy), `A${mes}3`); // misma serie A
});

await check('visitas (V) e instalaciones (I) llevan contador propio', async () => {
  eq(await generarCorrelativo(db, APP_ID, 'MUDANZA', hoy), `V${mes}1`);
  eq(await generarCorrelativo(db, APP_ID, 'RETIRO EQUIPO', hoy), `V${mes}2`);
  eq(await generarCorrelativo(db, APP_ID, 'INSTALACIÓN', hoy), `I${mes}1`);
});

await check('20 creaciones concurrentes: sin repetidos ni saltos', async () => {
  const codigos = await Promise.all(Array.from({ length: 20 }, () => generarCorrelativo(db, APP_ID, 'GARANTIA', hoy)));
  const numeros = codigos.map(c => parseInt(c.slice(`A${mes}`.length), 10)).sort((a, b) => a - b);
  eq(new Set(numeros).size, 20);
  eq(numeros[0], 4);
  eq(numeros[19], 23);
});

await check('con alReservar: la orden y el número se guardan juntos', async () => {
  const codigo = await generarCorrelativo(db, APP_ID, 'AVERÍA', hoy, 0, (tx, cod) => {
    tx.set(ticketRef('t-atomico'), { codigo: cod, estado: 'PENDIENTE' });
  });
  eq(codigo, `A${mes}24`);
  eq((await getDoc(ticketRef('t-atomico'))).data().codigo, codigo);
});

await check('si el guardado de la orden falla, el número NO se gasta', async () => {
  const antes = (await getDoc(contadorRef(`A_${mes}_${anio}`))).data().ultimo;
  let fallo = false;
  try {
    await generarCorrelativo(db, APP_ID, 'AVERÍA', hoy, 0, (tx, cod) => {
      // Campo no válido en Firestore: hace fallar la escritura de la orden.
      tx.set(ticketRef('t-fallido'), { codigo: cod, roto: undefined });
    });
  } catch {
    fallo = true;
  }
  if (!fallo) throw new Error('debía fallar el guardado');
  eq((await getDoc(contadorRef(`A_${mes}_${anio}`))).data().ultimo, antes);
  eq(await generarCorrelativo(db, APP_ID, 'AVERÍA', hoy), `A${mes}${antes + 1}`); // sin hueco
});

await check('instalación sin número: doble numeración reutiliza el mismo código', async () => {
  await setDoc(ticketRef('t-inst'), { codigo: `I${mes}`, tipoTrabajo: 'INSTALACIÓN' });
  const numerar = () => generarCorrelativo(db, APP_ID, 'INSTALACIÓN', hoy, 0, (tx, cod) => {
    tx.set(ticketRef('t-inst'), { codigo: cod, tipoTrabajo: 'INSTALACIÓN' });
  }, ticketRef('t-inst'));
  const [a, b] = await Promise.all([numerar(), numerar()]);
  eq(a, b);
  eq(a, `I${mes}2`);
  eq((await getDoc(contadorRef(`I_${mes}_${anio}`))).data().ultimo, 2); // un solo número gastado
  eq(await numerar(), `I${mes}2`); // un tercer intento tampoco gasta otro
});

await check('catch-up: respeta órdenes existentes con número mayor al contador', async () => {
  eq(await generarCorrelativo(db, APP_ID, 'MUDANZA', hoy, 40), `V${mes}41`);
});

await check('maxNumeroExistente cuenta papelera, ignora otro mes/año y otros prefijos', () => {
  const tickets = [
    { codigo: `A${mes}15`, createdAt: hoy.getTime() },
    { codigo: `A${mes}16`, createdAt: hoy.getTime(), estado: 'ELIMINADO' },
    { codigo: `A${mes}99`, createdAt: new Date(anio - 1, 0, 1).getTime() },
    { codigo: `V${mes}50`, createdAt: hoy.getTime() },
  ];
  eq(maxNumeroExistente(tickets, 'A', mes, anio), 16);
});

await check('esCodigoSinNumero', () => {
  eq(esCodigoSinNumero('IS'), true);
  eq(esCodigoSinNumero('IMZ'), true);
  eq(esCodigoSinNumero('IS12'), false);
  eq(esCodigoSinNumero('AS'), false);
  eq(esCodigoSinNumero(''), false);
});

await check('detectarSaltoManual: avisa solo cuando se salta números', async () => {
  const ultimo = (await getDoc(contadorRef(`A_${mes}_${anio}`))).data().ultimo;
  eq(await detectarSaltoManual(db, APP_ID, [], 'AVERÍA', `A${mes}${ultimo + 1}`, hoy), null); // el siguiente
  eq(await detectarSaltoManual(db, APP_ID, [], 'AVERÍA', `A${mes}${ultimo}`, hoy), null);     // reuso
  eq(await detectarSaltoManual(db, APP_ID, [], 'AVERÍA', `A${mes}3`, hoy), null);             // menor
  eq(await detectarSaltoManual(db, APP_ID, [], 'AVERÍA', 'XYZ1', hoy), null);                 // otro patrón
  eq(await detectarSaltoManual(db, APP_ID, [], 'AVERÍA', `V${mes}999`, hoy), null);           // otro prefijo
  const salto = await detectarSaltoManual(db, APP_ID, [], 'AVERÍA', `a${mes}150`, hoy);       // minúsculas
  eq(salto?.codigo, `A${mes}150`);
  eq(salto?.ultimo, ultimo);
  eq(salto?.esperado, ultimo + 1);
});

await check('detectarSaltoManual: también cuenta órdenes existentes aunque el contador esté atrasado', async () => {
  const tickets = [{ codigo: `V${mes}300`, createdAt: hoy.getTime() }];
  const salto = await detectarSaltoManual(db, APP_ID, tickets, 'MUDANZA', `V${mes}305`, hoy);
  eq(salto?.esperado, 301);
});

await check('sincronizarCorrelativoManual: sube el contador y nunca lo baja', async () => {
  await sincronizarCorrelativoManual(db, APP_ID, 'RETIRO EQUIPO', `V${mes}500`, hoy);
  eq((await getDoc(contadorRef(`V_${mes}_${anio}`))).data().ultimo, 500);
  await sincronizarCorrelativoManual(db, APP_ID, 'RETIRO EQUIPO', `V${mes}7`, hoy);
  eq((await getDoc(contadorRef(`V_${mes}_${anio}`))).data().ultimo, 500);
  eq(await generarCorrelativo(db, APP_ID, 'MUDANZA', hoy), `V${mes}501`);
});

await testEnv.cleanup();
console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
