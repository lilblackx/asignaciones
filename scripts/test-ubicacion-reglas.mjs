// Prueba las reglas de la ubicación de los técnicos contra el emulador local (`npm run emulators` en otra terminal): quién pide la ubicación (solo el ADMIN, y solo con la función encendida),
// quién la detiene, quién escribe la posición (solo el técnico de esa solicitud, mientras esté vigente y con datos válidos) y quién la lee (solo la oficina). Los documentos se arman con las mismas
// funciones que usa la app (utils/ubicacionTecnico), así se comprueba que lo que la app escribe es lo que las reglas aceptan. Uso: `node scripts/test-ubicacion-reglas.mjs`.
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { conSesionReciente } from './sesion-prueba.mjs';
import { armarPosicion, armarProblema, armarPunto, detencion, nuevaSolicitud } from '../src/utils/ubicacionTecnico.js';

const APP_ID = 'default-app-id';
const testEnv = await initializeTestEnvironment({ projectId: 'seguimientons-f2026', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
conSesionReciente(testEnv);

let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`PASS  ${name}`); } catch (err) { failures++; console.log(`FAIL  ${name}`); console.log(`      ${err.message.split('\n')[0]}`); }
}
const base = (ctx) => ctx.firestore().collection('artifacts').doc(APP_ID).collection('public').doc('data');
const como = (uid) => testEnv.authenticatedContext(uid);
const solicitud = (ctx, id) => base(ctx).collection('solicitudesUbicacion').doc(id);
const ubicacion = (ctx, id) => base(ctx).collection('ubicaciones').doc(id);
const REINEL = 'REINEL BRAVO';
const GERARDO = 'GERARDO MOLERO';

const sembrar = async ({ encendida = true } = {}) => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const b = base(ctx);
    await b.collection('users').doc('admin-uid').set({ role: 'ADMIN', disabled: false, username: 'admin' });
    await b.collection('users').doc('usuario-uid').set({ role: 'USUARIO', disabled: false, username: 'usuario' });
    // El nombre del perfil puede estar en minúsculas: el id del documento es el nombre en mayúsculas.
    await b.collection('users').doc('reinel-uid').set({ role: 'TECNICO', tecnicoAsociado: 'Reinel Bravo', disabled: false, username: 'reinel' });
    await b.collection('users').doc('gerardo-uid').set({ role: 'TECNICO', tecnicoAsociado: GERARDO, disabled: false, username: 'gerardo' });
    await b.collection('users').doc('gerardo-off-uid').set({ role: 'TECNICO', tecnicoAsociado: GERARDO, disabled: true, username: 'gerardo-off' });
    await b.collection('users').doc('finanzas-uid').set({ role: 'FINANZAS', disabled: false, username: 'fina' });
    await b.collection('users').doc('promotora-uid').set({ role: 'PROMOTORA', disabled: false, username: 'promo' });
    await b.collection('users').doc('infra-uid').set({ role: 'INFRAESTRUCTURA', disabled: false, username: 'infra' });
    await b.collection('config').doc('funciones').set({ ubicacionActiva: encendida });
  });
};
// Lo que escribió la oficina (withSecurityRulesDisabled no devuelve valores: se guarda desde dentro).
const pedidaDe = async (id) => { let valor = null; await testEnv.withSecurityRulesDisabled(async (ctx) => { valor = (await solicitud(ctx, id).get()).data().pedidaEn; }); return valor; };
const sembrarSolicitud = (id, extra = {}) => testEnv.withSecurityRulesDisabled((ctx) => solicitud(ctx, id).set({ ...nuevaSolicitud('admin'), ...extra }));

const GPS = { latitude: 10.6454794, longitude: -71.6695485, accuracy: 18 };

await sembrar();

// --- Pedir la ubicación ---
await check('el ADMIN pide la ubicación de un técnico (con la función encendida)', () => assertSucceeds(solicitud(como('admin-uid'), REINEL).set(nuevaSolicitud('admin'))));
await check('el USUARIO no puede: el módulo es solo del ADMIN', () => assertFails(solicitud(como('usuario-uid'), GERARDO).set(nuevaSolicitud('usuario'))));
await check('pedirla otra vez reemplaza la solicitud anterior', () => assertSucceeds(solicitud(como('admin-uid'), REINEL).set(nuevaSolicitud('admin'))));
await check('el técnico no puede pedir su propia ubicación ni la de otro', async () => {
  await assertFails(solicitud(como('reinel-uid'), REINEL).set(nuevaSolicitud('reinel')));
  await assertFails(solicitud(como('reinel-uid'), GERARDO).set(nuevaSolicitud('reinel')));
});
await check('FINANZAS, PROMOTORA e INFRAESTRUCTURA no pueden pedirla', async () => {
  await assertFails(solicitud(como('finanzas-uid'), REINEL).set(nuevaSolicitud('fina')));
  await assertFails(solicitud(como('promotora-uid'), REINEL).set(nuevaSolicitud('promo')));
  await assertFails(solicitud(como('infra-uid'), REINEL).set(nuevaSolicitud('infra')));
});
await check('sin sesión no se puede', () => assertFails(solicitud(testEnv.unauthenticatedContext(), REINEL).set(nuevaSolicitud('admin'))));
await check('la solicitud tiene que ir a nombre de quien la pide', () => assertFails(solicitud(como('admin-uid'), REINEL).set(nuevaSolicitud('otro'))));
await check('dura exactamente 30 minutos: ni más ni menos', async () => {
  const s = nuevaSolicitud('admin');
  await assertFails(solicitud(como('admin-uid'), REINEL).set({ ...s, venceEn: s.pedidaEn + 3600000 }));
  await assertFails(solicitud(como('admin-uid'), REINEL).set({ ...s, venceEn: s.pedidaEn + 600000 }));
});
await check('la hora de la solicitud tiene que ser la de ahora (no una vieja ni del futuro)', async () => {
  await assertFails(solicitud(como('admin-uid'), REINEL).set(nuevaSolicitud('admin', Date.now() - 3600000)));
  await assertFails(solicitud(como('admin-uid'), REINEL).set(nuevaSolicitud('admin', Date.now() + 3600000)));
});
await check('no se aceptan campos de más ni una solicitud ya detenida', async () => {
  await assertFails(solicitud(como('admin-uid'), REINEL).set({ ...nuevaSolicitud('admin'), extra: 1 }));
  await assertFails(solicitud(como('admin-uid'), REINEL).set({ ...nuevaSolicitud('admin'), detenidaEn: Date.now() }));
});

// --- Función apagada ---
await sembrar({ encendida: false });
await check('con la función apagada nadie puede pedir la ubicación', async () => {
  await assertFails(solicitud(como('admin-uid'), REINEL).set(nuevaSolicitud('admin')));
  await assertFails(solicitud(como('usuario-uid'), REINEL).set(nuevaSolicitud('usuario')));
});
await sembrar();

// --- Leer y detener ---
await sembrarSolicitud(REINEL);
await sembrarSolicitud(GERARDO);
await check('el ADMIN lee las solicitudes; cada técnico solo la suya', async () => {
  await assertSucceeds(solicitud(como('admin-uid'), REINEL).get());
  await assertSucceeds(solicitud(como('admin-uid'), GERARDO).get());
  await assertFails(solicitud(como('usuario-uid'), GERARDO).get());
  await assertSucceeds(solicitud(como('reinel-uid'), REINEL).get());
  await assertFails(solicitud(como('reinel-uid'), GERARDO).get());
  await assertFails(solicitud(como('finanzas-uid'), REINEL).get());
});
await check('el ADMIN puede listar todas las solicitudes; un técnico no', async () => {
  await assertSucceeds(base(como('admin-uid')).collection('solicitudesUbicacion').get());
  await assertFails(base(como('reinel-uid')).collection('solicitudesUbicacion').get());
});
await check('la oficina detiene la solicitud (solo cambia detenidaEn y detenidaPor)', () => assertSucceeds(solicitud(como('admin-uid'), REINEL).update(detencion('OFICINA'))));
await check('el propio técnico también puede detenerla, pero no la de otro', async () => {
  await assertSucceeds(solicitud(como('gerardo-uid'), GERARDO).update(detencion('TECNICO')));
  await sembrarSolicitud(REINEL);
  await assertFails(solicitud(como('gerardo-uid'), REINEL).update(detencion('TECNICO')));
});
await check('detener no sirve para cambiar otros campos (alargar el plazo, cambiar quién la pidió)', async () => {
  await assertFails(solicitud(como('admin-uid'), REINEL).update({ ...detencion('OFICINA'), venceEn: Date.now() + 9999999 }));
  await assertFails(solicitud(como('reinel-uid'), REINEL).update({ venceEn: Date.now() + 9999999 }));
  await assertFails(solicitud(como('admin-uid'), REINEL).update({ detenidaEn: 0, detenidaPor: 'x' }));
});
await check('borrar una solicitud es solo del ADMIN', async () => {
  await assertFails(solicitud(como('usuario-uid'), REINEL).delete());
  await assertSucceeds(solicitud(como('admin-uid'), REINEL).delete());
});

// --- Escribir la posición ---
await sembrar();
await sembrarSolicitud(REINEL);
const pedida = await pedidaDe(REINEL);
const posicion = (extra = {}) => ({ ...armarPosicion(GPS, pedida), ...extra });
await check('el técnico envía su posición mientras la solicitud está vigente (nombre del perfil en minúsculas, id en mayúsculas)', () => assertSucceeds(ubicacion(como('reinel-uid'), REINEL).set(posicion())));
await check('puede enviarla otra vez (cada 30 s)', () => assertSucceeds(ubicacion(como('reinel-uid'), REINEL).set(posicion())));
await check('si no pudo leer el GPS, avisa el problema (denegado o sin GPS)', async () => {
  await assertSucceeds(ubicacion(como('reinel-uid'), REINEL).set(armarProblema('denegado', pedida)));
  await assertSucceeds(ubicacion(como('reinel-uid'), REINEL).set(armarProblema('sin-gps', pedida)));
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set({ ...armarProblema('denegado', pedida), problema: 'cualquier cosa' }));
});
await check('un técnico no escribe la posición de otro', async () => {
  await sembrarSolicitud(GERARDO);
  const deGerardo = await pedidaDe(GERARDO);
  await assertFails(ubicacion(como('reinel-uid'), GERARDO).set(armarPosicion(GPS, deGerardo)));
  await assertSucceeds(ubicacion(como('gerardo-uid'), GERARDO).set(armarPosicion(GPS, deGerardo)));
});
await check('un técnico con la cuenta deshabilitada, la oficina y otros roles no la escriben', async () => {
  await assertFails(ubicacion(como('gerardo-off-uid'), GERARDO).set(armarPosicion(GPS, 1)));
  await assertFails(ubicacion(como('admin-uid'), REINEL).set(posicion()));
  await assertFails(ubicacion(como('usuario-uid'), REINEL).set(posicion()));
  await assertFails(ubicacion(como('finanzas-uid'), REINEL).set(posicion()));
});
await check('sin solicitud vigente no se puede enviar: no hay solicitud, vencida, detenida o de otra vez', async () => {
  await sembrar();
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set(armarPosicion(GPS, Date.now())));
  const vieja = Date.now() - 31 * 60 * 1000;
  await testEnv.withSecurityRulesDisabled((ctx) => solicitud(ctx, REINEL).set({ pedidaPor: 'admin', pedidaEn: vieja, venceEn: vieja + 1800000, detenidaEn: 0 }));
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set(armarPosicion(GPS, vieja)));
  await sembrarSolicitud(REINEL, { detenidaEn: Date.now(), detenidaPor: 'OFICINA' });
  const detenida = await pedidaDe(REINEL);
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set(armarPosicion(GPS, detenida)));
  await sembrarSolicitud(REINEL);
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set(armarPosicion(GPS, detenida - 5000)));
});
await check('datos inválidos: latitud o longitud fuera de rango, precisión negativa, hora vieja o campos de más', async () => {
  await sembrar();
  await sembrarSolicitud(REINEL);
  const p = await pedidaDe(REINEL);
  const buena = armarPosicion(GPS, p);
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set({ ...buena, lat: 95 }));
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set({ ...buena, lng: -181 }));
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set({ ...buena, precision: -1 }));
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set({ ...buena, lat: '10.6' }));
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set({ ...buena, en: Date.now() - 3600000 }));
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set({ ...buena, extra: 1 }));
  const { lat, ...sinLat } = buena;
  await assertFails(ubicacion(como('reinel-uid'), REINEL).set(sinLat));
});

// --- Leer y borrar la posición ---
await sembrar();
await sembrarSolicitud(REINEL);
const pedidaR = await pedidaDe(REINEL);
await assertSucceeds(ubicacion(como('reinel-uid'), REINEL).set(armarPosicion(GPS, pedidaR)));
await check('solo el ADMIN lee la posición (ni el propio técnico, ni el USUARIO ni otros roles)', async () => {
  await assertSucceeds(ubicacion(como('admin-uid'), REINEL).get());
  await assertFails(ubicacion(como('usuario-uid'), REINEL).get());
  await assertSucceeds(base(como('admin-uid')).collection('ubicaciones').get());
  await assertFails(ubicacion(como('reinel-uid'), REINEL).get());
  await assertFails(ubicacion(como('gerardo-uid'), REINEL).get());
  await assertFails(ubicacion(como('finanzas-uid'), REINEL).get());
  await assertFails(ubicacion(como('infra-uid'), REINEL).get());
  await assertFails(ubicacion(testEnv.unauthenticatedContext(), REINEL).get());
});
await check('el técnico borra su posición al terminar (aun con la solicitud ya vencida); otro técnico no', async () => {
  await assertFails(ubicacion(como('gerardo-uid'), REINEL).delete());
  await assertSucceeds(ubicacion(como('reinel-uid'), REINEL).delete());
});
await check('la oficina (USUARIO) no borra posiciones; el ADMIN sí', async () => {
  await assertSucceeds(ubicacion(como('reinel-uid'), REINEL).set(armarPosicion(GPS, pedidaR)));
  await assertFails(ubicacion(como('usuario-uid'), REINEL).delete());
  await assertSucceeds(ubicacion(como('admin-uid'), REINEL).delete());
});

// --- La última ubicación (un punto al marcar En camino, Llegué o pre-finalizar) ---
const ultima = (ctx, id) => base(ctx).collection('ultimaUbicacion').doc(id);
const punto = (motivo = 'llegada', codigo = 'AS2') => armarPunto(GPS, motivo, codigo);
await sembrar();
await check('el técnico guarda su punto con la función encendida (los tres motivos, con o sin orden)', async () => {
  for (const motivo of ['camino', 'llegada', 'prefinalizar']) await assertSucceeds(ultima(como('reinel-uid'), REINEL).set(punto(motivo)));
  await assertSucceeds(ultima(como('reinel-uid'), REINEL).set(armarPunto(GPS, 'camino', '')));
});
await check('no hace falta una solicitud: es un punto de lo que el técnico ya hace', () => assertSucceeds(ultima(como('gerardo-uid'), GERARDO).set(punto())));
await check('el técnico no guarda el punto de otro técnico', () => assertFails(ultima(como('reinel-uid'), GERARDO).set(punto())));
await check('la oficina, el USUARIO y otros roles no lo escriben', async () => {
  for (const uid of ['admin-uid', 'usuario-uid', 'finanzas-uid', 'promotora-uid', 'infra-uid']) await assertFails(ultima(como(uid), REINEL).set(punto()));
  await assertFails(ultima(testEnv.unauthenticatedContext(), REINEL).set(punto()));
});
await check('un técnico con la cuenta deshabilitada no lo escribe', () => assertFails(ultima(como('gerardo-off-uid'), GERARDO).set(punto())));
await check('datos inválidos: motivo que no existe, fuera de rango, campos de más, hora vieja, código largo o sin los campos', async () => {
  const buena = punto();
  await assertFails(ultima(como('reinel-uid'), REINEL).set({ ...buena, motivo: 'otro' }));
  await assertFails(ultima(como('reinel-uid'), REINEL).set({ ...buena, lat: 95 }));
  await assertFails(ultima(como('reinel-uid'), REINEL).set({ ...buena, lng: 181 }));
  await assertFails(ultima(como('reinel-uid'), REINEL).set({ ...buena, precision: -1 }));
  await assertFails(ultima(como('reinel-uid'), REINEL).set({ ...buena, en: Date.now() - 3600000 }));
  await assertFails(ultima(como('reinel-uid'), REINEL).set({ ...buena, extra: 1 }));
  await assertFails(ultima(como('reinel-uid'), REINEL).set({ ...buena, codigo: 'x'.repeat(41) }));
  await assertFails(ultima(como('reinel-uid'), REINEL).set({ ...buena, codigo: 7 }));
  const { motivo, ...sinMotivo } = buena;
  await assertFails(ultima(como('reinel-uid'), REINEL).set(sinMotivo));
});
await check('con la función apagada el técnico tampoco guarda su punto', async () => {
  await sembrar({ encendida: false });
  await assertFails(ultima(como('reinel-uid'), REINEL).set(punto()));
  await sembrar();
});
await check('solo el ADMIN lee las últimas ubicaciones (ni el propio técnico, ni el USUARIO ni otros roles)', async () => {
  await assertSucceeds(ultima(como('reinel-uid'), REINEL).set(punto()));
  await assertSucceeds(ultima(como('admin-uid'), REINEL).get());
  await assertSucceeds(base(como('admin-uid')).collection('ultimaUbicacion').get());
  for (const uid of ['reinel-uid', 'gerardo-uid', 'usuario-uid', 'finanzas-uid', 'infra-uid']) await assertFails(ultima(como(uid), REINEL).get());
});
await check('el técnico borra la suya; el ADMIN borra cualquiera (los de más de 24 horas); el USUARIO y otro técnico no', async () => {
  await assertFails(ultima(como('gerardo-uid'), REINEL).delete());
  await assertFails(ultima(como('usuario-uid'), REINEL).delete());
  await assertSucceeds(ultima(como('admin-uid'), REINEL).delete());
  await assertSucceeds(ultima(como('reinel-uid'), REINEL).set(punto()));
  await assertSucceeds(ultima(como('reinel-uid'), REINEL).delete());
});

await testEnv.cleanup();
if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
