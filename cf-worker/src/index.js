import { createRemoteJWKSet, jwtVerify, importPKCS8, SignJWT } from 'jose';
import { manejarApiMateriales } from './materiales-api.js';
import { listarTecnicosInventario, manejarInventario, reenviarNotificacion, reintentarPendientes } from './inventario.js';
import { USUARIOS_INVENTARIO } from '../../src/utils/accesoInventario.js';
import { direccionCliente, nombrePersona } from '../../src/utils/datosCliente.js';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let cachedFirebaseJwks = null;
let cachedGoogleToken = null; // { accessToken, expiresAt }
let tokenEnCurso = null; // la petición en marcha: las tareas del cron arrancan juntas y piden el token a la vez

function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

async function verifyIdToken(idToken, projectId) {
  if (!cachedFirebaseJwks) {
    cachedFirebaseJwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  }
  const { payload } = await jwtVerify(idToken, cachedFirebaseJwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  if (!payload.sub) throw new Error('Token sin sub');
  return payload; // payload.sub = uid del usuario que hace la llamada
}

// Una sola petición a la vez: sin esto, cada tarea del cron firmaba su propio JWT y pedía su propio token (tres por ejecución).
function getGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && cachedGoogleToken.expiresAt - 60 > now) {
    return Promise.resolve(cachedGoogleToken.accessToken);
  }
  tokenEnCurso ??= pedirGoogleAccessToken(env, now).finally(() => { tokenEnCurso = null; });
  return tokenEnCurso;
}

async function pedirGoogleAccessToken(env, now) {
  // replace: el secreto cargado desde PowerShell puede traer BOM (U+FEFF) al inicio y JSON.parse lo rechaza.
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON.replace(/^﻿/, ''));
  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');

  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/identitytoolkit',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience(TOKEN_ENDPOINT)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`No se pudo obtener access token de Google: ${await res.text()}`);
  const data = await res.json();
  cachedGoogleToken = { accessToken: data.access_token, expiresAt: now + data.expires_in };
  return data.access_token;
}

async function runQuery(env, accessToken, fieldPath, op, value, collectionId = 'users') {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/${env.APP_ID}/public/data:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op,
            value,
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Firestore runQuery falló: ${await res.text()}`);
  const rows = await res.json();
  return rows.filter((r) => r.document).map((r) => r.document);
}

function tokensFromDoc(doc) {
  const values = doc.fields?.fcmTokens?.arrayValue?.values || [];
  return values.map((v) => v.stringValue).filter(Boolean);
}

// Cada destino lleva el documento del usuario para poder quitarle el token si FCM
// lo rechaza por muerto (app desinstalada, permiso revocado).
function destinosDeDocs(docs) {
  return docs.flatMap((d) => [...new Set(tokensFromDoc(d))].map((token) => ({ token, docName: d.name })));
}

async function resolveTokens(env, accessToken, target) {
  let docs = [];
  if (target?.type === 'tecnico' && target.name) {
    docs = await runQuery(env, accessToken, 'tecnicoAsociado', 'EQUAL', { stringValue: target.name });
  } else if (target?.type === 'usuarios') {
    // Por nombre de usuario de la app (campo `username` del perfil).
    docs = (await Promise.all((target.usernames || []).map((u) => runQuery(env, accessToken, 'username', 'EQUAL', { stringValue: String(u) })))).flat();
  } else if (target?.type === 'oficina') {
    // Quien crea y atiende órdenes: ADMIN y USUARIO (p. ej. responder la consulta de cobro de un técnico).
    const oficina = await Promise.all(['ADMIN', 'USUARIO'].map((r) => runQuery(env, accessToken, 'role', 'EQUAL', { stringValue: r })));
    const seen = new Set();
    docs = oficina.flat().filter((d) => (seen.has(d.name) ? false : (seen.add(d.name), true)));
  } else if (target?.type === 'aprobadores') {
    const admins = await runQuery(env, accessToken, 'role', 'EQUAL', { stringValue: 'ADMIN' });
    const puedeCerrar = await runQuery(env, accessToken, 'puedeCerrar', 'EQUAL', { booleanValue: true });
    const seen = new Set();
    docs = [...admins, ...puedeCerrar].filter((d) => (seen.has(d.name) ? false : (seen.add(d.name), true)));
  } else {
    return [];
  }
  return destinosDeDocs(docs);
}

async function getUserDoc(env, accessToken, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/${env.APP_ID}/public/data/users/${encodeURIComponent(uid)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  return res.json();
}

// Un token válido de Firebase no basta: cualquiera puede crear una cuenta de Auth
// con la apiKey pública. Solo cuenta quien tiene perfil en "users" y no está
// deshabilitado. Devuelve el rol, o null si no es un usuario activo de la app.
async function rolActivo(env, accessToken, uid) {
  const perfil = await getUserDoc(env, accessToken, uid);
  if (!perfil || perfil.fields?.disabled?.booleanValue === true) return null;
  return perfil.fields?.role?.stringValue || null;
}

function passwordPolicyError(password) {
  if (typeof password !== 'string' || password.length < 8) return 'La clave debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'La clave debe incluir al menos una mayúscula.';
  if (!/[a-z]/.test(password)) return 'La clave debe incluir al menos una minúscula.';
  if (!/[0-9]/.test(password)) return 'La clave debe incluir al menos un número.';
  return '';
}

async function adminResetPassword(env, accessToken, targetUid, newPassword) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ localId: targetUid, password: newPassword, returnSecureToken: false }),
  });
  if (!res.ok) throw new Error(`No se pudo cambiar la clave: ${await res.text()}`);
}

async function handleResetPassword(request, env, headers, callerUid) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('JSON inválido', { status: 400, headers });
  }

  const { targetUserId, newPassword } = body || {};
  if (!targetUserId || !newPassword) {
    return new Response('Faltan campos: targetUserId, newPassword', { status: 400, headers });
  }
  const policyError = passwordPolicyError(newPassword);
  if (policyError) {
    return new Response(policyError, { status: 400, headers });
  }

  try {
    const accessToken = await getGoogleAccessToken(env);
    if (await rolActivo(env, accessToken, callerUid) !== 'ADMIN') {
      return new Response('Solo un administrador puede cambiar claves de otros usuarios.', { status: 403, headers });
    }

    const targetDoc = await getUserDoc(env, accessToken, targetUserId);
    if (!targetDoc) {
      return new Response('Usuario no encontrado.', { status: 404, headers });
    }

    await adminResetPassword(env, accessToken, targetUserId, newPassword);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(`Error cambiando clave: ${err.message}`, { status: 500, headers });
  }
}

// Alta de usuario hecha por un ADMIN: crea la cuenta de Auth y su perfil. Va por
// el Worker para poder cerrar el registro público de Firebase Auth (con el registro
// abierto, cualquiera con la apiKey pública podía crearse una cuenta).
const ROLES_VALIDOS = ['ADMIN', 'USUARIO', 'TECNICO', 'ALMACEN', 'PROMOTORA', 'FINANZAS', 'INFRAESTRUCTURA'];
const USERNAME_VALIDO = /^[a-z0-9._-]{1,40}$/;

async function crearCuentaAuth(env, accessToken, email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error?.message || `Auth respondió ${res.status}`);
    error.yaExiste = data?.error?.message === 'EMAIL_EXISTS';
    throw error;
  }
  return data.localId;
}

async function borrarCuentaAuth(env, accessToken, uid) {
  await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ localId: uid }),
  });
}

async function handleCreateUser(request, env, headers, callerUid) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('JSON inválido', { status: 400, headers });
  }

  const { email, password, username, nombre, role, tecnicoAsociado, puedeCerrar, promotoraNombres, verTodasInstalaciones, puedeCrearVentas, createdBy } = body || {};
  const nombreLimpio = String(nombre || '').trim();
  if (!USERNAME_VALIDO.test(username || '') || !email || !nombreLimpio || !ROLES_VALIDOS.includes(role)) {
    return new Response('Datos de usuario inválidos.', { status: 400, headers });
  }
  if (!email.startsWith(`${username}@`)) {
    return new Response('El email no corresponde al usuario.', { status: 400, headers });
  }
  // Una PROMOTORA solo ve las instalaciones de su promotora: sin al menos un nombre no vería nada, salvo el
  // perfil de ventas (verTodasInstalaciones), que ve las de todas y no necesita nombre.
  const veTodas = role === 'PROMOTORA' && verTodasInstalaciones === true;
  const nombresPromotora = role === 'PROMOTORA' ? parseNombresPromotora(promotoraNombres) : { nombres: [], claves: [] };
  if (role === 'PROMOTORA' && !veTodas && nombresPromotora.claves.length === 0) {
    return new Response('Escribe el nombre con que aparece el promotor en las plantillas.', { status: 400, headers });
  }
  const policyError = passwordPolicyError(password);
  if (policyError) return new Response(policyError, { status: 400, headers });

  try {
    const accessToken = await getGoogleAccessToken(env);
    if (await rolActivo(env, accessToken, callerUid) !== 'ADMIN') {
      return new Response('Solo un administrador puede crear usuarios.', { status: 403, headers });
    }

    let uid;
    try {
      uid = await crearCuentaAuth(env, accessToken, email, password);
    } catch (err) {
      if (err.yaExiste) return new Response('Ese usuario ya existe.', { status: 409, headers });
      throw err;
    }

    const perfil = {
      username: { stringValue: username },
      nombre: { stringValue: nombreLimpio.slice(0, 100) },
      role: { stringValue: role },
      tecnicoAsociado: role === 'TECNICO' ? { stringValue: String(tecnicoAsociado || '').trim() } : { nullValue: null },
      puedeCerrar: { booleanValue: puedeCerrar === true },
      promotoraNombres: { arrayValue: { values: nombresPromotora.nombres.map((n) => ({ stringValue: n })) } },
      promotoraClaves: { arrayValue: { values: nombresPromotora.claves.map((c) => ({ stringValue: c })) } },
      verTodasInstalaciones: { booleanValue: veTodas },
      puedeCrearVentas: { booleanValue: role === 'PROMOTORA' && puedeCrearVentas === true },
      disabled: { booleanValue: false },
      createdAt: { integerValue: String(Date.now()) },
      createdBy: { stringValue: String(createdBy || '') },
    };
    const nombreDoc = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${rutaDatos(env)}/users/${uid}`;
    try {
      await commitFirestore(env, accessToken, [{ update: { name: nombreDoc, fields: perfil }, currentDocument: { exists: false } }]);
    } catch (err) {
      // Sin perfil la cuenta no sirve para nada: se borra para no dejarla huérfana.
      await borrarCuentaAuth(env, accessToken, uid).catch(() => {});
      throw err;
    }
    return json({ ok: true, uid }, 200, headers);
  } catch (err) {
    console.error(err);
    return new Response('No se pudo crear el usuario.', { status: 500, headers });
  }
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

// Respuestas de FCM que significan "este token ya no sirve": se borra del usuario.
// Solo UNREGISTERED: INVALID_ARGUMENT también sale por un mensaje mal armado y borraría tokens buenos.
const FCM_TOKEN_MUERTO = ['UNREGISTERED'];

// Devuelve { ok, muerto }. Mensaje solo de datos (sin "notification"): el Service Worker
// decide cómo mostrarlo (onBackgroundMessage en src/sw.js) y no hay duplicados con el
// aviso automático de FCM. Urgency "high" y TTL corto: sin eso Android puede retrasar
// el aviso minutos con el teléfono quieto (Doze), y una orden asignada no puede esperar.
async function sendToToken(accessToken, projectId, token, title, body, extra = {}) {
  const data = { title: String(title || ''), body: String(body || '') };
  if (extra.tag) data.tag = String(extra.tag).slice(0, 100);
  if (extra.ticketId) data.ticketId = String(extra.ticketId).slice(0, 100);
  if (extra.tipo) data.tipo = String(extra.tipo).slice(0, 40);

  const enviar = (message) => fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ message }),
  });

  let res = await enviar({
    token,
    data,
    webpush: { headers: { Urgency: 'high', TTL: '3600' } },
    android: { priority: 'high', ttl: '3600s' },
  });
  let errText = '';
  if (!res.ok) {
    errText = await res.text();
    // Red de seguridad: si FCM rechazara las opciones de prioridad (INVALID_ARGUMENT), se
    // reintenta el mensaje simple de siempre para que el aviso salga igual.
    if (res.status === 400 && errText.includes('INVALID_ARGUMENT') && !errText.includes('UNREGISTERED')) {
      console.error(`FCM rechazó las opciones de prioridad, se reintenta simple: ${errText}`);
      res = await enviar({ token, data });
      errText = res.ok ? '' : await res.text();
    }
  }
  if (res.ok) return { ok: true, muerto: false };
  console.error(`FCM send falló para un token: ${errText}`);
  return { ok: false, muerto: FCM_TOKEN_MUERTO.some((c) => errText.includes(c)) };
}

// Quita de fcmTokens los tokens que FCM dio por muertos, para no seguir mandándoles
// ni acumularlos en el perfil.
async function limpiarTokensMuertos(env, accessToken, muertos) {
  if (muertos.length === 0) return;
  const writes = muertos.map(({ token, docName }) => ({
    transform: {
      document: docName,
      fieldTransforms: [{ fieldPath: 'fcmTokens', removeAllFromArray: { values: [{ stringValue: token }] } }],
    },
    // Si el perfil ya no existe, no se vuelve a crear solo por limpiar un token.
    currentDocument: { exists: true },
  }));
  await commitFirestore(env, accessToken, writes);
}

// Envía a todos los destinos y limpia los muertos. Devuelve cuántos salieron bien.
async function enviarADestinos(env, accessToken, destinos, title, body, extra) {
  const resultados = await Promise.all(
    destinos.map(async (d) => ({ d, r: await sendToToken(accessToken, env.FIREBASE_PROJECT_ID, d.token, title, body, extra).catch(() => ({ ok: false, muerto: false })) }))
  );
  await limpiarTokensMuertos(env, accessToken, resultados.filter(({ r }) => r.muerto).map(({ d }) => d))
    .catch((err) => console.error('No se pudieron limpiar tokens muertos:', err));
  return resultados.filter(({ r }) => r.ok).length;
}

// ---------------------------------------------------------------------------
// Cierre automático. Hace lo mismo que el botón "Ejecutar cierre" de Cierre
// (useReports.cerrarDia): archiva las órdenes FINALIZADO y CANCELADO en un solo
// reporte CIERRE, y borra esas órdenes de la tabla principal.
// La configuración (activo, hora, días) la edita un ADMIN en Reportes y vive en
// config/cierreAutomatico. El cron corre cada pocos minutos y ejecuta el cierre
// una vez por día cuando llega la hora configurada.
// ---------------------------------------------------------------------------

const ZONA_HORARIA = 'America/Caracas';
const OFFSET_ZONA = '-04:00'; // Venezuela no usa horario de verano
const GRACIA_CIERRE_MS = 6 * 60 * 60 * 1000; // pasado esto no se ejecuta (p. ej. tras una caída larga)
const MAX_ESCRITURAS_COMMIT = 450; // Firestore admite 500 por commit
const DIAS_SEMANA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function docsBase(env) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

function rutaDatos(env) {
  return `artifacts/${env.APP_ID}/public/data`;
}

// Fecha (YYYY-MM-DD) y día de la semana (0 = domingo) en Venezuela.
export function fechaCaracas(ahoraMs) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
      .formatToParts(new Date(ahoraMs))
      .map((p) => [p.type, p.value])
  );
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, dia: DIAS_SEMANA[partes.weekday] };
}

// ¿Toca ejecutar el cierre ahora? Devuelve { fecha } o null.
//  - activo, con hora HH:MM válida y el día de hoy entre los elegidos;
//  - ya pasó la hora de hoy, pero hace menos de GRACIA_CIERRE_MS;
//  - no se configuró después de la hora de hoy (activarlo a las 3 pm con hora 8 am
//    no dispara un cierre inmediato: corre mañana);
//  - hoy todavía no se ejecutó, ni automático ni a mano (cierreManualFecha la deja el cierre manual de la app).
export function debeEjecutar(config, ahoraMs) {
  if (!config?.activo || !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.hora || '')) return null;
  const { fecha, dia } = fechaCaracas(ahoraMs);
  if (!Array.isArray(config.dias) || !config.dias.includes(dia)) return null;
  const programadaMs = Date.parse(`${fecha}T${config.hora}:00${OFFSET_ZONA}`);
  if (ahoraMs < programadaMs || ahoraMs - programadaMs > GRACIA_CIERRE_MS) return null;
  if ((config.actualizadoEn || 0) > programadaMs) return null;
  if (config.ultimaEjecucion === fecha) return null;
  // Si hoy ya se hizo el cierre manual (lo deja marcado la app), el automático no corre ese día.
  if (config.cierreManualFecha === fecha) return null;
  return { fecha };
}

// Valor de Firestore (REST) -> JS, solo los tipos que usa la configuración.
function valorJs(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valorJs);
  return undefined;
}

// Documentos de config/ (cierreAutomatico, tasaBcv): lectura y escritura parcial.
async function leerConfig(env, accessToken, nombre) {
  const res = await fetch(`${docsBase(env)}/${rutaDatos(env)}/config/${nombre}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No se pudo leer config/${nombre}: ${await res.text()}`);
  const doc = await res.json();
  return Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, valorJs(v)]));
}

async function guardarConfig(env, accessToken, nombre, campos) {
  const mascara = Object.keys(campos).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const res = await fetch(`${docsBase(env)}/${rutaDatos(env)}/config/${nombre}?${mascara}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ fields: campos }),
  });
  if (!res.ok) throw new Error(`No se pudo guardar config/${nombre}: ${await res.text()}`);
}

const leerConfigCierre = (env, accessToken) => leerConfig(env, accessToken, 'cierreAutomatico');
const guardarConfigCierre = (env, accessToken, campos) => guardarConfig(env, accessToken, 'cierreAutomatico', campos);

async function commitFirestore(env, accessToken, writes) {
  const res = await fetch(`${docsBase(env)}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw new Error(`Firestore commit falló: ${await res.text()}`);
}

// Historial liviano de instalaciones cerradas (colección historialInstalaciones), igual que el de useReports del
// cliente: lo único que la promotora ve de una instalación cuando el cierre la saca de la lista. Mantener sincronizados
// los campos y los días con resumenInstalacion y RETENCION_DIAS_HISTORIAL_VENTAS de src/utils/estadoInstalacion.js (se conserva
// lo que ve ventas, que es lo más largo; cada pantalla descarta lo que le sobra).
const RETENCION_MS_HISTORIAL = 30 * 24 * 60 * 60 * 1000;
const TIPO_INSTALACION = 'INSTALACIÓN';
// Las averías LOS también pasan al historial: ventas las sigue junto con las instalaciones (esDeVentas en estadoInstalacion.js).
const esAveriaLosFirestore = (f) => f?.tipoTrabajo?.stringValue === 'AVERÍA' && f?.falla?.stringValue === 'LOS';

// --- La promotora de una instalación (misma lógica que src/utils/promotora.js y la lectura de la plantilla en
// src/utils/whatsapp.js; mantener sincronizadas: lo comprueba `npm run test:roles`) ---
const SIN_DATO_PROMOTORA = new Set(['', 'na', 'n a', 'no aplica', 'ninguno', 'ninguna', 'pendiente', 'por asignar', 'por definir', 'sin datos', 'sin dato', 'sin promotora', 'no tiene', 'xx', 'xxx']);
const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function claveNombre(texto) {
  const clave = sinTildes(texto).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return SIN_DATO_PROMOTORA.has(clave) ? '' : clave;
}

const PARTICULAS_NOMBRE = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
export function nombrePromotora(texto) {
  if (!claveNombre(texto)) return '';
  return String(texto).replace(/\s+/g, ' ').trim().slice(0, 100).toLowerCase().split(' ')
    .map((p, i) => (i > 0 && PARTICULAS_NOMBRE.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
}

export function parseNombresPromotora(texto) {
  const nombres = [];
  const claves = [];
  for (const parte of (Array.isArray(texto) ? texto : String(texto ?? '').split(/[,;\n]/))) {
    const clave = claveNombre(parte);
    if (!clave || claves.includes(clave)) continue;
    claves.push(clave);
    nombres.push(nombrePromotora(parte));
  }
  return { nombres: nombres.slice(0, 5), claves: claves.slice(0, 5) };
}

const limpiarLineaPlantilla = (l) => String(l).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/[*~]|```/g, '').replace(/[：﹕]/g, ':').trim();
const ETIQUETAS_PROMOTORA = new Set(['PROMOTORA', 'PROMOTOR', 'PROMOTOR A']);
const claveEtiquetaPlantilla = (t) => sinTildes(t).toUpperCase().replace(/\./g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// El nombre que dice la línea "Promotora:" / "Promotor:" de la plantilla ('' si no hay uno válido).
export function promotoraDePlantilla(plantilla) {
  const lineas = String(plantilla ?? '').split(/\r?\n|\r/).map(limpiarLineaPlantilla);
  for (let i = 0; i < lineas.length; i++) {
    const idx = lineas[i].indexOf(':');
    if (idx === -1 || !ETIQUETAS_PROMOTORA.has(claveEtiquetaPlantilla(lineas[i].slice(0, idx)))) continue;
    let valor = lineas[i].slice(idx + 1).trim();
    if (!valor) {
      let j = i + 1;
      while (j < lineas.length && !lineas[j]) j++;
      const sig = lineas[j] ?? '';
      const k = sig.indexOf(':');
      const esEtiqueta = k !== -1 && k <= 40 && !/\d/.test(sig.slice(0, k));
      if (j < lineas.length && !esEtiqueta) valor = sig;
    }
    const texto = valor.replace(/\s+/g, ' ').trim();
    if (!texto || texto.length > 100 || (texto.match(/\p{L}/gu) || []).length < 2 || /@|https?:|www\./i.test(texto) || /\d{7,}/.test(texto.replace(/(?<=\d)[\s.-](?=\d)/g, ''))) return '';
    return nombrePromotora(texto);
  }
  return '';
}

function resumenInstalacionFirestore(t, ahoraMs) {
  const f = t.fields || {};
  const promotora = nombrePromotora(f.promotora?.stringValue) || promotoraDePlantilla(f.plantillaOriginal?.stringValue);
  const texto = (k) => ({ stringValue: f[k]?.stringValue || '' });
  const numero = (k) => (f[k]?.integerValue !== undefined ? { integerValue: String(f[k].integerValue) } : { nullValue: null });
  return {
    codigo: texto('codigo'), nombre: { stringValue: nombrePersona(f.nombre?.stringValue) }, cedula: texto('cedula'), tipoDocumento: texto('tipoDocumento'),
    direccion: { stringValue: direccionCliente(f.direccion?.stringValue) }, tecnico: texto('tecnico'), estado: texto('estado'),
    tipoTrabajo: { stringValue: f.tipoTrabajo?.stringValue || TIPO_INSTALACION }, falla: { stringValue: esAveriaLosFirestore(f) ? 'LOS' : '' },
    promotora: { stringValue: promotora }, promotoraClave: { stringValue: claveNombre(promotora) },
    // La plantilla final se guarda en la orden al finalizarla (la app la arma); aquí solo se copia, sin repetir esa lógica.
    plantillaFinal: { stringValue: f.estado?.stringValue === 'FINALIZADO' && !esAveriaLosFirestore(f) ? (f.plantillaFinal?.stringValue || '') : '' },
    creadaEn: numero('createdAt'), finalizadoEn: numero('finalizadoEn'), canceladaEn: numero('canceladaEn'), archivadoEn: { integerValue: String(ahoraMs) },
    // Por qué se canceló (solo en las canceladas; igual que en resumenInstalacion de src/utils/estadoInstalacion.js): ventas lo ve en la tarjeta.
    motivoCancelacion: { stringValue: f.estado?.stringValue === 'CANCELADO' ? String(f.motivoCancelacion?.stringValue || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim() : '' },
  };
}

async function guardarHistorialInstalaciones(env, accessToken, tickets, ahoraMs) {
  const escrituras = tickets
    .filter((t) => t.fields?.tipoTrabajo?.stringValue === TIPO_INSTALACION || esAveriaLosFirestore(t.fields))
    .map((t) => ({
      update: {
        name: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${rutaDatos(env)}/historialInstalaciones/${t.name.split('/').pop()}`,
        fields: resumenInstalacionFirestore(t, ahoraMs),
      },
    }));
  for (let i = 0; i < escrituras.length; i += MAX_ESCRITURAS_COMMIT) {
    await commitFirestore(env, accessToken, escrituras.slice(i, i + MAX_ESCRITURAS_COMMIT));
  }
}

async function limpiarHistorialInstalaciones(env, accessToken, ahoraMs) {
  const vencidas = await runQuery(env, accessToken, 'archivadoEn', 'LESS_THAN', { integerValue: String(ahoraMs - RETENCION_MS_HISTORIAL) }, 'historialInstalaciones');
  const borrados = vencidas.map((d) => ({ delete: d.name }));
  for (let i = 0; i < borrados.length; i += MAX_ESCRITURAS_COMMIT) {
    await commitFirestore(env, accessToken, borrados.slice(i, i + MAX_ESCRITURAS_COMMIT));
  }
}

// --- Totales del mes (colección estadisticasMensuales, un documento por mes "2026-10") ---
// Ventas lleva la cuenta mensual de instalaciones y averías LOS finalizadas y canceladas. Se suman aquí, en el mismo commit que archiva
// las órdenes (todo o nada, y un cierre que se reintenta no cuenta dos veces), para que ventas lea un solo documento por mes en vez
// de todo el historial. Cada orden cuenta en el mes en que se finalizó; si no trae una fecha de finalización creíble (las canceladas no
// la tienen), en el mes del cierre. Lo mismo calcula scripts/calcular-totales-mensuales.mjs para los cierres de antes de que existiera.
const VENTANA_FINALIZACION_MS = 40 * 24 * 60 * 60 * 1000;

// La misma regla que fechaDeOrden de src/utils/fechaOrden.js: la fecha de finalización (o de cancelación, si se canceló), y sin una creíble, el día de cierre.
export function mesDeCierre(f, ahoraMs, diaCierreMs = ahoraMs, estado = 'FINALIZADO') {
  const fin = Number((estado === 'CANCELADO' ? f?.canceladaEn : f?.finalizadoEn)?.integerValue);
  const ms = fin > ahoraMs - VENTANA_FINALIZACION_MS && fin <= ahoraMs ? fin : diaCierreMs;
  return fechaCaracas(ms).fecha.slice(0, 7);
}

// { '2026-10': { instalacionesFinalizadas: 3, losResueltas: 1 }, ... } de las órdenes que se archivan con este estado.
export function incrementosMensuales(tickets, estado, ahoraMs, diaCierreMs = ahoraMs) {
  const porMes = {};
  for (const t of tickets) {
    const f = t.fields;
    const esLos = esAveriaLosFirestore(f);
    if (f?.tipoTrabajo?.stringValue !== TIPO_INSTALACION && !esLos) continue;
    const campo = estado === 'FINALIZADO' ? (esLos ? 'losResueltas' : 'instalacionesFinalizadas') : (esLos ? 'losCanceladas' : 'instalacionesCanceladas');
    const mes = mesDeCierre(f, ahoraMs, diaCierreMs, estado);
    porMes[mes] = { ...porMes[mes], [campo]: (porMes[mes]?.[campo] || 0) + 1 };
  }
  return porMes;
}

// Una escritura por mes: solo suma (documento nuevo si no existía; la máscara vacía deja intactos los demás campos).
function escriturasMensuales(env, porMes) {
  return Object.entries(porMes).map(([mes, campos]) => ({
    update: { name: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${rutaDatos(env)}/estadisticasMensuales/${mes}`, fields: {} },
    updateMask: { fieldPaths: [] },
    updateTransforms: Object.entries(campos).map(([fieldPath, n]) => ({ fieldPath, increment: { integerValue: String(n) } })),
  }));
}

// Los totales del mes de un cierre que archiva a la vez las finalizadas y las canceladas (como incrementosDeCierre de totalesMes.js).
function incrementosDeCierre(finalizadas, canceladas, ahoraMs, diaCierreMs = ahoraMs) {
  const porMes = {};
  for (const [tickets, estado] of [[finalizadas, 'FINALIZADO'], [canceladas, 'CANCELADO']]) {
    for (const [mes, campos] of Object.entries(incrementosMensuales(tickets, estado, ahoraMs, diaCierreMs))) porMes[mes] = { ...porMes[mes], ...campos };
  }
  return porMes;
}

// Equivalente a archivarCierre de useReports: un solo reporte con las órdenes finalizadas y las canceladas, y borra esas órdenes.
// El reporte y los primeros borrados van en un solo commit (atómico). Devuelve cuántas de cada una archivó.
async function archivarCierre(env, accessToken, ahoraMs, fecha) {
  const finalizadas = await runQuery(env, accessToken, 'estado', 'EQUAL', { stringValue: 'FINALIZADO' }, 'tickets');
  const canceladas = await runQuery(env, accessToken, 'estado', 'EQUAL', { stringValue: 'CANCELADO' }, 'tickets');
  const tickets = [...finalizadas, ...canceladas];
  if (tickets.length === 0) return { finalizadas: 0, canceladas: 0 };

  const desglose = {};
  for (const t of tickets) {
    const tipo = t.fields?.tipoTrabajo?.stringValue || 'OTRO';
    desglose[tipo] = (desglose[tipo] || 0) + 1;
  }
  const [anio, mes, dia] = fecha.split('-');
  const reportId = `${ahoraMs}-CIERRE`;
  const reporte = {
    id: { stringValue: reportId },
    fechaCierre: { stringValue: `${dia}/${mes}/${anio}` },
    horaCierre: { stringValue: new Date(ahoraMs).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: ZONA_HORARIA }) },
    operador: { stringValue: 'AUTOMÁTICO' },
    total: { integerValue: String(tickets.length) },
    finalizadas: { integerValue: String(finalizadas.length) },
    canceladas: { integerValue: String(canceladas.length) },
    desglose: { mapValue: { fields: Object.fromEntries(Object.entries(desglose).map(([k, n]) => [k, { integerValue: String(n) }])) } },
    ticketsDetalle: {
      arrayValue: {
        values: tickets.map((t) => ({ mapValue: { fields: { ...t.fields, id: { stringValue: t.name.split('/').pop() } } } })),
      },
    },
    tipoReporte: { stringValue: 'CIERRE' },
    createdAt: { integerValue: String(ahoraMs) },
  };

  const borrados = tickets.map((t) => ({ delete: t.name }));
  const reportName = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${rutaDatos(env)}/reports/${reportId}`;
  // Los totales del mes van con el reporte y los primeros borrados: o se archivó y se contó, o ninguna de las dos.
  // Sin fecha de finalización, cada orden cuenta en el mes del día que se cierra (`fecha`), no en el del instante en que corre el cierre.
  const totales = escriturasMensuales(env, incrementosDeCierre(finalizadas, canceladas, ahoraMs, Math.min(Date.parse(`${fecha}T12:00:00${OFFSET_ZONA}`), ahoraMs)));
  const enElPrimero = MAX_ESCRITURAS_COMMIT - 1 - totales.length;
  await commitFirestore(env, accessToken, [
    { update: { name: reportName, fields: reporte }, currentDocument: { exists: false } },
    ...totales,
    ...borrados.slice(0, enElPrimero),
  ]);
  for (let i = enElPrimero; i < borrados.length; i += MAX_ESCRITURAS_COMMIT) {
    await commitFirestore(env, accessToken, borrados.slice(i, i + MAX_ESCRITURAS_COMMIT));
  }
  // El cierre ya está hecho: si el historial falla no se reintenta el cierre (se archivaría dos veces), solo se avisa en el log.
  await guardarHistorialInstalaciones(env, accessToken, tickets, ahoraMs).catch((err) => console.error('No se pudo guardar el historial de instalaciones:', err));
  return { finalizadas: finalizadas.length, canceladas: canceladas.length };
}

async function avisarAprobadores(env, accessToken, title, body) {
  const destinos = await resolveTokens(env, accessToken, { type: 'aprobadores' });
  await enviarADestinos(env, accessToken, destinos, title, body, { tipo: 'cierreAutomatico', tag: 'cierreAutomatico' });
}

// Las alertas del envío al inventario solo les llegan a los usuarios de USUARIOS_INVENTARIO.
async function avisarInventario(env, accessToken, title, body, extra) {
  const destinos = await resolveTokens(env, accessToken, { type: 'usuarios', usernames: USUARIOS_INVENTARIO });
  await enviarADestinos(env, accessToken, destinos, title, body, extra);
}

// Lo que el envío al inventario (inventario.js) toma de este archivo; va aparte para no importarse en círculo.
export const depsInventario = { getGoogleAccessToken, commitFirestore, docsBase, rutaDatos, runQuery, getUserDoc, avisarInventario };

export async function cierreAutomatico(env, ahoraMs = Date.now()) {
  const accessToken = await getGoogleAccessToken(env);
  const config = await leerConfigCierre(env, accessToken);
  const toca = debeEjecutar(config, ahoraMs);
  if (!toca) return { ejecutado: false };

  try {
    const { finalizadas, canceladas } = await archivarCierre(env, accessToken, ahoraMs, toca.fecha);
    await limpiarHistorialInstalaciones(env, accessToken, ahoraMs).catch((err) => console.error('No se pudo limpiar el historial de instalaciones:', err));
    const resumen = finalizadas + canceladas === 0
      ? 'No había órdenes FINALIZADO ni CANCELADO para cerrar.'
      : `${finalizadas} finalizadas y ${canceladas} canceladas archivadas.`;
    await guardarConfigCierre(env, accessToken, {
      ultimaEjecucion: { stringValue: toca.fecha },
      ultimaEjecucionEn: { integerValue: String(ahoraMs) },
      ultimoResultado: { stringValue: resumen },
    });
    await avisarAprobadores(env, accessToken, 'Cierre automático', resumen).catch((err) => console.error('No se pudo avisar del cierre:', err));
    return { ejecutado: true, finalizadas, canceladas };
  } catch (err) {
    // No se marca como ejecutado: el próximo cron lo reintenta (dentro del plazo de
    // gracia). El aviso de error sale una sola vez por día para no repetirse.
    console.error('Cierre automático falló:', err);
    if (config.errorNotificado !== toca.fecha) {
      await guardarConfigCierre(env, accessToken, {
        errorNotificado: { stringValue: toca.fecha },
        ultimoResultado: { stringValue: `ERROR: ${String(err.message).slice(0, 200)}` },
      }).catch(() => {});
      await avisarAprobadores(env, accessToken, 'Cierre automático falló', 'No se pudo completar el cierre automático. Se reintentará; si persiste, haz el cierre manual.').catch(() => {});
    }
    return { ejecutado: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Tasa BCV (euro): se actualiza sola UNA vez al día, por la mañana. El cron corre
// cada pocos minutos; a partir de HORA_TASA (hora de Venezuela) toma la tasa de
// DolarAPI si la guardada no es de hoy. Si la API falla, el siguiente cron lo
// reintenta. Una tasa puesta a mano hoy cuenta como "ya actualizada": no se pisa.
// ---------------------------------------------------------------------------

const HORA_TASA = '07:00';
const API_TASA_EUR_BCV = 'https://ve.dolarapi.com/v1/euros/oficial';

// ¿Toca actualizar la tasa ahora? true si ya pasó la hora de hoy y la tasa
// guardada no es de hoy (o no existe).
export function debeActualizarTasa(config, ahoraMs) {
  const { fecha } = fechaCaracas(ahoraMs);
  if (ahoraMs < Date.parse(`${fecha}T${HORA_TASA}:00${OFFSET_ZONA}`)) return false;
  if (config?.tasa && config.actualizadoEn && fechaCaracas(config.actualizadoEn).fecha === fecha) return false;
  return true;
}

export async function actualizarTasaBcv(env, ahoraMs = Date.now()) {
  // Antes de la hora de la actualización no hay nada que revisar: ni token ni lectura de Firestore.
  if (ahoraMs < Date.parse(`${fechaCaracas(ahoraMs).fecha}T${HORA_TASA}:00${OFFSET_ZONA}`)) return { actualizada: false };
  const accessToken = await getGoogleAccessToken(env);
  const config = await leerConfig(env, accessToken, 'tasaBcv');
  if (!debeActualizarTasa(config, ahoraMs)) return { actualizada: false };

  const res = await fetch(API_TASA_EUR_BCV);
  if (!res.ok) throw new Error(`DolarAPI respondió ${res.status}`);
  const tasa = Number((await res.json())?.promedio);
  if (!Number.isFinite(tasa) || tasa <= 0) throw new Error('DolarAPI no trajo una tasa válida');

  await guardarConfig(env, accessToken, 'tasaBcv', {
    tasa: { doubleValue: Math.round(tasa * 100) / 100 },
    fuente: { stringValue: 'automatica' },
    actualizadoEn: { integerValue: String(ahoraMs) },
    // Si nunca hubo monto base, el mismo valor por defecto que usaba la app.
    ...(config?.montoBaseEUR ? {} : { montoBaseEUR: { integerValue: '1' } }),
  });
  return { actualizada: true, tasa };
}

export default {
  async fetch(request, env) {
    // API de Materiales para otra aplicación: se autentica con su propia llave, no con un usuario de Firebase.
    if (new URL(request.url).pathname === '/api/materiales') {
      return manejarApiMateriales(request, env, getGoogleAccessToken);
    }

    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(env, origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers });
    }

    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return new Response('Falta Authorization Bearer', { status: 401, headers });
    }

    let payload;
    try {
      payload = await verifyIdToken(idToken, env.FIREBASE_PROJECT_ID);
    } catch (err) {
      return new Response(`Token inválido: ${err.message}`, { status: 401, headers });
    }

    const { pathname } = new URL(request.url);
    if (pathname === '/admin/reset-password') {
      return handleResetPassword(request, env, headers, payload.sub);
    }
    if (pathname === '/admin/create-user') {
      return handleCreateUser(request, env, headers, payload.sub);
    }
    if (pathname === '/inventario/tecnicos') {
      return listarTecnicosInventario(env, headers, payload.sub, depsInventario);
    }
    if (pathname === '/inventario/notificar') {
      return reenviarNotificacion(request, env, headers, payload.sub, depsInventario);
    }
    if (pathname === '/inventario/enviar' || pathname === '/inventario/reintentar') {
      return manejarInventario(request, env, headers, payload.sub, depsInventario);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('JSON inválido', { status: 400, headers });
    }

    const { target, title, body: messageBody, tipo, ticketId } = body || {};
    if (!target || !title) {
      return new Response('Faltan campos: target, title', { status: 400, headers });
    }

    try {
      const accessToken = await getGoogleAccessToken(env);
      // Avisar a un técnico es de quien asigna (ADMIN/USUARIO); avisar a los
      // aprobadores lo hace también el TECNICO al pre-finalizar.
      const rol = await rolActivo(env, accessToken, payload.sub);
      // Una PROMOTORA solo avisa a la oficina de una venta nueva, y solo si el administrador le dio el permiso de crear ventas.
      // FINANZAS solo le avisa a un técnico que se le registró un pago o un adelanto.
      const permitido = rol === 'PROMOTORA'
        ? target.type === 'oficina' && tipo === 'nuevaVenta' && (await getUserDoc(env, accessToken, payload.sub))?.fields?.puedeCrearVentas?.booleanValue === true
        : rol === 'FINANZAS'
          ? target.type === 'tecnico' && ['pagoTecnico', 'adelantoTecnico'].includes(tipo)
          : target.type === 'tecnico' ? ['ADMIN', 'USUARIO'].includes(rol) : Boolean(rol);
      if (!permitido) return new Response('Sin permiso para enviar esta notificación.', { status: 403, headers });

      const destinos = await resolveTokens(env, accessToken, target);
      // `tag` evita avisos repetidos del mismo evento (un teléfono con dos tokens).
      const sent = await enviarADestinos(env, accessToken, destinos, String(title).slice(0, 100), String(messageBody || '').slice(0, 300), {
        tipo, ticketId, tag: `${tipo || 'aviso'}:${ticketId || String(title).slice(0, 40)}`,
      });
      return new Response(JSON.stringify({ sent, dispositivos: destinos.length }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error(err);
      return new Response(`Error enviando notificación: ${err.message}`, { status: 500, headers });
    }
  },

  // Cron (ver wrangler.toml): revisa si toca el cierre automático y la tasa del día.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cierreAutomatico(env).catch((err) => console.error('Cron de cierre automático:', err)));
    ctx.waitUntil(reintentarPendientes(env, depsInventario, event.scheduledTime).catch((err) => console.error('Cron de envíos al inventario:', err)));
    ctx.waitUntil(actualizarTasaBcv(env).catch((err) => console.error('Cron de tasa BCV:', err)));
  },
};
