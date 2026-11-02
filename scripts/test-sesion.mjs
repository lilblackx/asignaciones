// Prueba la regla de la sesión (src/utils/sesion.js): 24 horas para todos y 7 días para los técnicos. No necesita el emulador.
import { MARGEN_SERVIDOR_MS, SESION_MAX_MS, SESION_TECNICO_MAX_MS, duracionDeSesion, inicioDeSesionVigente, msParaVencer, sesionVencida, vencimientoDeSesion } from '../src/utils/sesion.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

const H = 3600000;
const D = 24 * H;
const T0 = Date.parse('2026-11-02T08:00:00Z');

check('24 horas para todos, 7 días para los técnicos y 10 minutos de margen del servidor', [SESION_MAX_MS, SESION_TECNICO_MAX_MS, MARGEN_SERVIDOR_MS], [24 * H, 7 * D, 10 * 60000]);
check('la duración depende del rol; sin rol conocido, la corta',
  ['TECNICO', 'ADMIN', 'USUARIO', 'FINANZAS', 'ADMINISTRACION', 'PROMOTORA', 'ALMACEN', 'INFRAESTRUCTURA', undefined, null].map(duracionDeSesion),
  [7 * D, D, D, D, D, D, D, D, D, D]);
check('vence a las 24 h del inicio (texto de fecha o milisegundos) y a los 7 días para el técnico',
  [vencimientoDeSesion('2026-11-02T08:00:00Z', 'ADMIN'), vencimientoDeSesion(T0, 'ADMIN'), vencimientoDeSesion(T0, 'TECNICO')], [T0 + D, T0 + D, T0 + 7 * D]);
check('hora de inicio ilegible: no se conoce el vencimiento', [vencimientoDeSesion('no es fecha', 'ADMIN'), vencimientoDeSesion(undefined, 'ADMIN'), vencimientoDeSesion(null, 'TECNICO')], [null, null, null]);
check('oficina: a las 23 h 59 min no ha vencido; a las 24 h en punto sí', [sesionVencida(T0, 'ADMIN', T0 + D - 60000), sesionVencida(T0, 'ADMIN', T0 + D), sesionVencida(T0, 'USUARIO', T0 + 30 * H)], [false, true, true]);
check('técnico: a los 3 días no ha vencido; a los 6 días y 23 h tampoco; a los 7 días sí',
  [sesionVencida(T0, 'TECNICO', T0 + 3 * D), sesionVencida(T0, 'TECNICO', T0 + 7 * D - H), sesionVencida(T0, 'TECNICO', T0 + 7 * D), sesionVencida(T0, 'TECNICO', T0 + 8 * D)], [false, false, true, true]);
check('sin hora de inicio conocida no se da por vencida (lo decide el servidor)', [sesionVencida(undefined, 'ADMIN', T0), sesionVencida('basura', 'TECNICO', T0)], [false, false]);
check('cuánto falta para que venza',
  [msParaVencer(T0, 'ADMIN', T0), msParaVencer(T0, 'ADMIN', T0 + 23 * H), msParaVencer(T0, 'ADMIN', T0 + 25 * H), msParaVencer(T0, 'TECNICO', T0 + 6 * D), msParaVencer(undefined, 'ADMIN', T0)], [D, H, 0, D, null]);
const segundos = (ms) => Math.floor(ms / 1000);
check('servidor, oficina: a las 24 h y 5 min aún vale; a las 24 h y 11 min ya no',
  [inicioDeSesionVigente(segundos(T0), 'ADMIN', T0 + D + 5 * 60000), inicioDeSesionVigente(segundos(T0), 'ADMIN', T0 + D + 11 * 60000)], [true, false]);
check('servidor, técnico: a los 3 días vale; a los 7 días y 5 min aún; a los 7 días y 11 min ya no; sin rol, nada pasa de 24 h',
  [inicioDeSesionVigente(segundos(T0), 'TECNICO', T0 + 3 * D), inicioDeSesionVigente(segundos(T0), 'TECNICO', T0 + 7 * D + 5 * 60000), inicioDeSesionVigente(segundos(T0), 'TECNICO', T0 + 7 * D + 11 * 60000), inicioDeSesionVigente(segundos(T0), undefined, T0 + 3 * D)],
  [true, true, false, false]);
check('servidor: un token sin hora de inicio de sesión se rechaza', [inicioDeSesionVigente(undefined, 'TECNICO', T0), inicioDeSesionVigente(null, 'ADMIN', T0), inicioDeSesionVigente(NaN, 'TECNICO', T0)], [false, false, false]);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
