// Prueba las utilidades pequeñas que no tenían prueba propia: la política de claves, el usuario que se vuelve correo de Firebase Auth, el filtro de emojis, el periodo de los reportes,
// el límite de espera al guardar, el grupo de cada tipo de trabajo, los campos que cambian al editar una orden y la fecha legible. No necesita el emulador.
// Uso: `npm run test:utilidades`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { arrayUnion } from 'firebase/firestore';
import { AUTH_EMAIL_DOMAIN } from '../src/constants.js';
import { normalizeUsername, usernameToAuthEmail } from '../src/utils/authEmail.js';
import { cambiosDeTicket } from '../src/utils/cambiosTicket.js';
import { buscaEnCerradas, buscarCerradas, esCerrada } from '../src/utils/ordenesCerradas.js';
import { fechaHoraLegible } from '../src/utils/formatoFecha.js';
import { getPasswordPolicyError } from '../src/utils/passwordPolicy.js';
import { diaLegible, enRango, etiquetaRango, rangoDe } from '../src/utils/periodoReporte.js';
import { stripEmojis } from '../src/utils/sanitizeInput.js';
import { esperarConLimite } from '../src/utils/tiempoLimite.js';
import { grupoDeTrabajo, normalizarTipo } from '../src/utils/tiposDeTrabajo.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- Política de claves ---
check('clave corta', getPasswordPolicyError('Ab1'), 'La clave debe tener al menos 8 caracteres.');
check('clave sin mayúscula', getPasswordPolicyError('abcdefg1'), 'La clave debe incluir al menos una mayúscula.');
check('clave sin minúscula', getPasswordPolicyError('ABCDEFG1'), 'La clave debe incluir al menos una minúscula.');
check('clave sin número', getPasswordPolicyError('Abcdefgh'), 'La clave debe incluir al menos un número.');
check('clave válida', getPasswordPolicyError('Admin1234'), '');
check('exactamente 8 caracteres sirve', getPasswordPolicyError('Abcdef12'), '');

// --- Usuario → correo ficticio de Firebase Auth ---
check('minúsculas y espacios como punto', normalizeUsername('  Luis Perez '), 'luis.perez');
check('quita comillas, punto y coma y emojis', normalizeUsername("A'; DROP\u{1F600}"), 'a.drop');
check('conserva punto, guion y guion bajo', normalizeUsername('t_1-a.b'), 't_1-a.b');
check('el correo lleva el dominio interno', usernameToAuthEmail('Tecnico1'), `tecnico1@${AUTH_EMAIL_DOMAIN}`);
check('dos escrituras del mismo usuario dan el mismo correo', usernameToAuthEmail(' ADMIN '), usernameToAuthEmail('admin'));

// --- Emojis ---
check('quita emojis y deja el texto', stripEmojis('\u{1F527} Hola ✅'), ' Hola ');
check('quita banderas y el conector de emojis compuestos', stripEmojis('a\u{1F1FB}\u{1F1EA}b\u{1F468}‍\u{1F469}c'), 'abc');
check('conserva las flechas de texto', stripEmojis('A → B ← C'), 'A → B ← C');
check('conserva tildes, eñes y símbolos normales', stripEmojis('Año: 5% – ¿Sí? #12'), 'Año: 5% – ¿Sí? #12');
check('lo que no es texto pasa igual', [stripEmojis(undefined), stripEmojis(7), stripEmojis(null)], [undefined, 7, null]);

// --- Periodo de los reportes (días de Caracas) ---
const AHORA = Date.parse('2026-10-22T12:00:00-04:00');
check('hoy', rangoDe('HOY', null, AHORA), { desde: '2026-10-22', hasta: '2026-10-22' });
check('7 días incluye hoy y los 6 anteriores', rangoDe('7_DIAS', null, AHORA), { desde: '2026-10-16', hasta: '2026-10-22' });
check('este mes empieza el día 1', rangoDe('MES', null, AHORA), { desde: '2026-10-01', hasta: '2026-10-22' });
check('a las 9 pm de Caracas del 31 sigue siendo el 31 (en UTC ya es noviembre)', rangoDe('HOY', null, Date.parse('2026-11-01T01:00:00Z')), { desde: '2026-10-31', hasta: '2026-10-31' });
check('rango escrito a mano', rangoDe('RANGO', { desde: '2026-10-01', hasta: '2026-10-10' }, AHORA), { desde: '2026-10-01', hasta: '2026-10-10' });
check('rango invertido no se invierte: queda como se escribió', rangoDe('RANGO', { desde: '2026-10-10', hasta: '2026-10-01' }, AHORA), { desde: '2026-10-10', hasta: '2026-10-01' });
check('rango con una sola fecha usa esa en las dos', rangoDe('RANGO', { desde: '2026-10-05', hasta: '' }, AHORA), { desde: '2026-10-05', hasta: '2026-10-05' });
check('rango sin fechas cae en hoy', rangoDe('RANGO', null, AHORA), { desde: '2026-10-22', hasta: '2026-10-22' });
check('día legible', diaLegible('2026-10-19'), '19/10/2026');
check('etiqueta de un rango y de un solo día', [etiquetaRango({ desde: '2026-10-19', hasta: '2026-10-25' }), etiquetaRango({ desde: '2026-10-19', hasta: '2026-10-19' })], ['19/10 – 25/10/2026', '19/10/2026']);
check('enRango incluye los dos extremos', ['2026-10-01', '2026-10-10', '2026-09-30', '2026-10-11'].map((d) => enRango(d, { desde: '2026-10-01', hasta: '2026-10-10' })), [true, true, false, false]);

// --- Límite de espera al guardar ---
check('una escritura que termina a tiempo da true', await esperarConLimite(Promise.resolve('ok'), 200), true);
check('una escritura sin respuesta da false pasado el límite', await esperarConLimite(new Promise(() => {}), 30), false);
let rechazo = 'no llegó';
try { await esperarConLimite(Promise.reject(new Error('sin permiso')), 200); } catch (e) { rechazo = e.message; }
check('un error real de la escritura no se disfraza de falta de respuesta', rechazo, 'sin permiso');

// --- Grupo de cada tipo de trabajo ---
const grupo = (tipoTrabajo) => grupoDeTrabajo({ tipoTrabajo });
check('instalaciones', [grupo('INSTALACIÓN'), grupo('Instalacion')], ['INSTALACION', 'INSTALACION']);
check('averías, reconexiones, low signal y cambios de equipo', [grupo('AVERÍA'), grupo('RECONEXIÓN'), grupo('LOW SIGNAL'), grupo('Cambio de equipo')], ['AVERIA', 'AVERIA', 'AVERIA', 'AVERIA']);
check('mudanzas, retiros, garantías y validaciones de NAP', [grupo('MUDANZA'), grupo('RETIRO EQUIPO'), grupo('GARANTÍA'), grupo('VALIDACIÓN NAP')], ['VISITA', 'VISITA', 'VISITA', 'VISITA']);
check('un tipo desconocido cae en OTRO y no se pierde', [grupo('INVENTADO'), grupoDeTrabajo(null)], ['OTRO', 'OTRO']);
check('normalizarTipo quita tildes y mayúsculas', normalizarTipo('  Reconexión '), 'RECONEXION');

// --- Qué campos escribe una edición (no pisa lo que otro cambió) ---
const e1 = { por: 'a', campo: 'x' };
const e2 = { por: 'b', campo: 'y' };
const base = { id: 'T1', nombre: 'Ana', direccion: { calle: 'Uno' }, historialEdiciones: [e1] };
check('lo que no cambió no se escribe, ni el id', Object.keys(cambiosDeTicket(base, { id: 'T1', nombre: 'Ana', direccion: { calle: 'Uno' } })), []);
check('un campo distinto sí', cambiosDeTicket(base, { nombre: 'Ana María' }), { nombre: 'Ana María' });
check('un objeto con el mismo contenido no cuenta como cambio', Object.keys(cambiosDeTicket(base, { direccion: { calle: 'Uno' } })), []);
check('un valor undefined no se escribe', Object.keys(cambiosDeTicket(base, { telefono: undefined })), []);
check('una entrada nueva del historial va con arrayUnion', JSON.stringify(cambiosDeTicket(base, { historialEdiciones: [e1, e2] }).historialEdiciones), JSON.stringify(arrayUnion(e2)));
check('si el historial no es el anterior más entradas, se escribe tal cual', cambiosDeTicket(base, { historialEdiciones: [e2] }).historialEdiciones, [e2]);

// --- Fecha legible en hora de Caracas ---
check('fecha y hora de Caracas', fechaHoraLegible(Date.parse('2026-10-19T11:35:00-04:00')), '19/10/2026 11:35');
check('la hora no depende de la zona de la máquina (UTC de madrugada sigue siendo el día anterior en Caracas)', fechaHoraLegible(Date.parse('2026-10-20T03:30:00Z')), '19/10/2026 23:30');

// --- Cerradas en la búsqueda del dashboard ---
const T = Date.parse('2026-10-20T15:00:00Z');
const vivas = [
  { id: 'v1', codigo: 'AO1', estado: 'PENDIENTE', tipoTrabajo: 'AVERÍA', tecnico: 'ANA', createdAt: T },
  { id: 'v2', codigo: 'AO2', estado: 'FINALIZADO', tipoTrabajo: 'AVERÍA', tecnico: 'ANA', finalizadoEn: T, createdAt: T - 1000 },
];
const archivadas = [
  { id: 'v2', codigo: 'AO2', estado: 'FINALIZADO', tipoTrabajo: 'AVERÍA', tecnico: 'ANA', finalizadoEn: T },
  { id: 'a1', codigo: 'AO3', estado: 'FINALIZADO', tipoTrabajo: 'INSTALACIÓN', tecnico: 'LUIS', finalizadoEn: T - 5 * 86400000, archivadoEn: T - 4 * 86400000 },
  { id: 'a2', codigo: 'AO4', estado: 'CANCELADO', tipoTrabajo: 'AVERÍA', tecnico: 'ANA', canceladaEn: T - 2 * 86400000, archivadoEn: T - 86400000 },
  { id: 'a1', codigo: 'AO3', estado: 'FINALIZADO', tipoTrabajo: 'INSTALACIÓN', tecnico: 'LUIS', finalizadoEn: T - 5 * 86400000 },
  { id: 'a3', codigo: 'AO5', estado: 'PENDIENTE', createdAt: T },
];
const todas = () => true;
const cerr = buscarCerradas({ vivas, archivadas, coincide: todas });
check('sale la de hoy y las archivadas, la más reciente primero, sin repetir ni abiertas', cerr.map((t) => t.codigo), ['AO2', 'AO4', 'AO3']);
check('la viva va tal cual y las archivadas llevan marca', cerr.map((t) => Boolean(t._archivada)), [false, true, true]);
check('las claves de las archivadas no se repiten', new Set(cerr.map((t) => t._clave || t.id)).size, 3);
check('filtra por tipo de trabajo', buscarCerradas({ vivas, archivadas, coincide: todas, tipo: 'INSTALACIÓN' }).map((t) => t.codigo), ['AO3']);
check('filtra por técnico', buscarCerradas({ vivas, archivadas, coincide: todas, tecnico: 'LUIS' }).map((t) => t.codigo), ['AO3']);
check('aplica la prueba del buscador', buscarCerradas({ vivas, archivadas, coincide: (t) => t.codigo === 'AO4' }).map((t) => t.codigo), ['AO4']);
check('no toca las órdenes vivas', vivas.some((t) => '_archivada' in t || '_clave' in t), false);
check('esCerrada: finalizada y cancelada sí, pendiente y pre-finalizada no', [esCerrada({ estado: 'FINALIZADO' }), esCerrada({ estado: 'CANCELADO' }), esCerrada({ estado: 'PENDIENTE' }), esCerrada({ estado: 'PRE-FINALIZADO' })], [true, true, false, false]);
check('se busca en cerradas desde 3 letras (sin contar espacios de los lados)', [buscaEnCerradas('ab'), buscaEnCerradas('  ab '), buscaEnCerradas('AO1'), buscaEnCerradas('')], [false, false, true, false]);

// --- El aviso de "cargar cierres anteriores" se redacta en un solo archivo (AvisoCargarAnteriores): ningún otro pinta el texto ni un enlace "cargar más" suelto ---
const archivosJsx = (dir) => readdirSync(dir).flatMap((n) => { const r = join(dir, n); return statSync(r).isDirectory() ? archivosJsx(r) : r.endsWith('.jsx') ? [r] : []; });
const conAvisoPropio = archivosJsx(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).filter((r) => !r.endsWith('AvisoCargarAnteriores.jsx') && /más antiguos sin cargar|'cargar más'|Cargar reportes anteriores/.test(readFileSync(r, 'utf8')));
check('el aviso de cargar cierres anteriores sale solo de AvisoCargarAnteriores', conAvisoPropio, []);

if (failures > 0) { console.error(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
