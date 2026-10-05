// Prueba el flujo de asignar técnico (numeración de instalaciones) contra el emulador
// de Firestore, con las reglas reales y transacciones reales. No toca producción.
// Cubre guardarConNumeracion, que usan Editar, el botón Enviado y copiar WhatsApp.
// Requiere el emulador corriendo (`npm run emulators`). Uso: `npm run test:asignar`.
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { guardarConNumeracion, obtenerCodigoMes } from '../src/utils/correlativo.js';

const APP_ID = `test-asignar-${Date.now()}`;
const testEnv = await initializeTestEnvironment({
  projectId: 'seguimientons-f2026-rules-test',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await ctx.firestore().collection('artifacts').doc(APP_ID).collection('public').doc('data')
    .collection('users').doc('admin-uid').set({ role: 'ADMIN', disabled: false });
});

const compat = testEnv.authenticatedContext('admin-uid').firestore();
const db = compat._delegate ?? compat;

const ticketRef = (id) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'tickets', id);
const contadorRef = (prefijo) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'counters', `${prefijo}_${mes}_${anio}`);

const hoy = new Date();
const mes = obtenerCodigoMes(hoy);
const anio = hoy.getFullYear();
const base = `I${mes}`; // instalación sin número, ej. "IO"

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
const ultimoContador = async (prefijo) => {
  const snap = await getDoc(contadorRef(prefijo));
  return snap.exists() ? snap.data().ultimo : 0;
};

// Igual que Editar / Enviado: guardar el ticket con (o sin) técnico.
const asignar = (tickets, ticket, tecnico, extra = {}) =>
  guardarConNumeracion(db, APP_ID, tickets, ticket.id, ticket.codigo, ticket.tipoTrabajo, tecnico, hoy,
    (codigo) => ({ ...ticket, ...extra, codigo, tecnico }));
const leer = async (id) => (await getDoc(ticketRef(id))).data();
const nuevaInstalacion = async (id, extra = {}) => {
  const t = { id, codigo: base, tipoTrabajo: 'INSTALACIÓN', tecnico: '', estado: 'PENDIENTE', ...extra };
  await setDoc(ticketRef(id), t);
  return t;
};

await check('instalación sin técnico: se guarda sin número y no gasta contador', async () => {
  const t = await nuevaInstalacion('i1');
  const guardado = await asignar([], t, '');
  eq(guardado.codigo, base);
  eq((await leer('i1')).codigo, base);
  eq(await ultimoContador('I'), 0);
});

await check('técnico solo con espacios cuenta como sin técnico', async () => {
  const t = await nuevaInstalacion('i-espacios');
  eq((await asignar([], t, '   ')).codigo, base);
  eq(await ultimoContador('I'), 0);
});

await check('asignar técnico: la numera (IO1) y guarda técnico + número juntos', async () => {
  const t = await nuevaInstalacion('i2');
  const guardado = await asignar([], t, 'EDGAR');
  eq(guardado.codigo, `${base}1`);
  const enDb = await leer('i2');
  eq(enDb.codigo, `${base}1`);
  eq(enDb.tecnico, 'EDGAR');
  eq(await ultimoContador('I'), 1);
});

await check('la siguiente instalación asignada sale IO2', async () => {
  const t = await nuevaInstalacion('i3');
  eq((await asignar([], t, 'JOSE')).codigo, `${base}2`);
});

await check('ya numerada: reasignar a otro técnico conserva el número y no gasta otro', async () => {
  const t = (await leer('i2'));
  const guardado = await asignar([], { id: 'i2', ...t }, 'REINEL');
  eq(guardado.codigo, `${base}1`);
  eq((await leer('i2')).tecnico, 'REINEL');
  eq(await ultimoContador('I'), 2);
});

await check('quitar el técnico a una instalación numerada no le quita el número', async () => {
  const t = await leer('i3');
  const guardado = await asignar([], { id: 'i3', ...t }, '');
  eq(guardado.codigo, `${base}2`);
  eq(await ultimoContador('I'), 2);
});

await check('código manual con técnico: se respeta, no se renumera', async () => {
  const t = await nuevaInstalacion('i-manual', { codigo: `${base}77` });
  eq((await asignar([], t, 'ABRAHAM')).codigo, `${base}77`);
  eq(await ultimoContador('I'), 2);
});

await check('avería con técnico: el código no cambia y no usa el contador I', async () => {
  const t = { id: 'a1', codigo: `A${mes}9`, tipoTrabajo: 'AVERÍA', tecnico: '' };
  await setDoc(ticketRef('a1'), t);
  eq((await asignar([], t, 'JOSE')).codigo, `A${mes}9`);
  eq(await ultimoContador('I'), 2);
  eq(await ultimoContador('A'), 0);
});

await check('catch-up: respeta instalaciones existentes con número mayor al contador', async () => {
  const t = await nuevaInstalacion('i-catchup');
  const existentes = [{ codigo: `${base}10`, createdAt: hoy.getTime() }];
  eq((await asignar(existentes, t, 'EDGAR')).codigo, `${base}11`);
});

await check('doble clic (lista local desactualizada): mismo número y un solo número gastado', async () => {
  const antes = await ultimoContador('I');
  const t = await nuevaInstalacion('i-doble'); // ambos clics ven todavía "IO"
  const [a, b] = await Promise.all([asignar([], t, 'EDGAR'), asignar([], t, 'EDGAR')]);
  eq(a.codigo, b.codigo);
  eq((await leer('i-doble')).codigo, a.codigo);
  eq(await ultimoContador('I'), antes + 1);
});

await check('10 instalaciones asignadas a la vez: números distintos y consecutivos', async () => {
  const antes = await ultimoContador('I');
  const tickets = await Promise.all(Array.from({ length: 10 }, (_, i) => nuevaInstalacion(`i-par-${i}`)));
  const guardados = await Promise.all(tickets.map((t) => asignar([], t, 'JOSE')));
  const numeros = guardados.map((g) => parseInt(g.codigo.slice(base.length), 10)).sort((a, b) => a - b);
  eq(new Set(numeros).size, 10);
  eq(numeros[0], antes + 1);
  eq(numeros[9], antes + 10);
  for (let i = 0; i < 10; i++) eq((await leer(`i-par-${i}`)).codigo, guardados[i].codigo);
  eq(await ultimoContador('I'), antes + 10);
});

await check('si el guardado falla al asignar, el número NO se gasta y la orden queda intacta', async () => {
  const antes = await ultimoContador('I');
  const t = await nuevaInstalacion('i-falla');
  let fallo = false;
  try {
    await asignar([], t, 'EDGAR', { campoInvalido: undefined }); // undefined no es válido en Firestore
  } catch {
    fallo = true;
  }
  if (!fallo) throw new Error('debía fallar el guardado');
  eq(await ultimoContador('I'), antes);
  eq((await leer('i-falla')).codigo, base);
  const siguiente = await asignar([], await nuevaInstalacion('i-tras-falla'), 'EDGAR');
  eq(siguiente.codigo, `${base}${antes + 1}`); // sin hueco
});

await check('armarTicket recibe el código final y lo que devuelve es lo que se guardó', async () => {
  const t = await nuevaInstalacion('i-final');
  const vistos = [];
  const guardado = await guardarConNumeracion(db, APP_ID, [], t.id, t.codigo, t.tipoTrabajo, 'EDGAR', hoy, (codigo) => {
    vistos.push(codigo);
    return { ...t, codigo, tecnico: 'EDGAR', isAsignado: true };
  });
  eq(vistos[vistos.length - 1], guardado.codigo);
  const enDb = await leer('i-final');
  eq(enDb.codigo, guardado.codigo);
  eq(enDb.isAsignado, true);
});

await testEnv.cleanup();
console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
