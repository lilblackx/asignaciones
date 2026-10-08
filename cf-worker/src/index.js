import { createRemoteJWKSet, jwtVerify, importPKCS8, SignJWT } from 'jose';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let cachedFirebaseJwks = null;
let cachedGoogleToken = null; // { accessToken, expiresAt }

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

async function getGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && cachedGoogleToken.expiresAt - 60 > now) {
    return cachedGoogleToken.accessToken;
  }

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

async function resolveTokens(env, accessToken, target) {
  let docs = [];
  if (target?.type === 'tecnico' && target.name) {
    docs = await runQuery(env, accessToken, 'tecnicoAsociado', 'EQUAL', { stringValue: target.name });
  } else if (target?.type === 'aprobadores') {
    const admins = await runQuery(env, accessToken, 'role', 'EQUAL', { stringValue: 'ADMIN' });
    const puedeCerrar = await runQuery(env, accessToken, 'puedeCerrar', 'EQUAL', { booleanValue: true });
    const seen = new Set();
    docs = [...admins, ...puedeCerrar].filter((d) => (seen.has(d.name) ? false : (seen.add(d.name), true)));
  } else {
    return [];
  }
  return docs.flatMap(tokensFromDoc);
}

async function getUserDoc(env, accessToken, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/${env.APP_ID}/public/data/users/${uid}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  return res.json();
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
    const callerDoc = await getUserDoc(env, accessToken, callerUid);
    const callerRole = callerDoc?.fields?.role?.stringValue;
    if (callerRole !== 'ADMIN') {
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

async function sendToToken(accessToken, projectId, token, title, body) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      message: {
        token,
        // data-only (no "notification"): el Service Worker decide cómo mostrarla
        // (onBackgroundMessage en src/sw.js) — evita duplicados con el display
        // automático que hace FCM cuando el mensaje trae "notification".
        data: { title: String(title || ''), body: String(body || '') },
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`FCM send falló para un token: ${errText}`);
  }
}

// ---------------------------------------------------------------------------
// Cierre automático. Hace lo mismo que el botón "Ejecutar cierre" de Reportes
// (useReports.cerrarDia): archiva las órdenes FINALIZADO en un reporte CIERRE y
// las CANCELADO en uno CANCELADOS, y borra esas órdenes de la tabla principal.
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
//  - hoy todavía no se ejecutó.
export function debeEjecutar(config, ahoraMs) {
  if (!config?.activo || !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.hora || '')) return null;
  const { fecha, dia } = fechaCaracas(ahoraMs);
  if (!Array.isArray(config.dias) || !config.dias.includes(dia)) return null;
  const programadaMs = Date.parse(`${fecha}T${config.hora}:00${OFFSET_ZONA}`);
  if (ahoraMs < programadaMs || ahoraMs - programadaMs > GRACIA_CIERRE_MS) return null;
  if ((config.actualizadoEn || 0) > programadaMs) return null;
  if (config.ultimaEjecucion === fecha) return null;
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

async function leerConfigCierre(env, accessToken) {
  const res = await fetch(`${docsBase(env)}/${rutaDatos(env)}/config/cierreAutomatico`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No se pudo leer la configuración del cierre: ${await res.text()}`);
  const doc = await res.json();
  return Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, valorJs(v)]));
}

async function guardarConfigCierre(env, accessToken, campos) {
  const mascara = Object.keys(campos).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const res = await fetch(`${docsBase(env)}/${rutaDatos(env)}/config/cierreAutomatico?${mascara}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ fields: campos }),
  });
  if (!res.ok) throw new Error(`No se pudo guardar el estado del cierre: ${await res.text()}`);
}

async function commitFirestore(env, accessToken, writes) {
  const res = await fetch(`${docsBase(env)}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw new Error(`Firestore commit falló: ${await res.text()}`);
}

// Equivalente a archiveByEstado de useReports: crea el reporte y borra las
// órdenes. El reporte y los primeros borrados van en un solo commit (atómico).
async function archivarPorEstado(env, accessToken, estado, tipoReporte, ahoraMs, fecha) {
  const tickets = await runQuery(env, accessToken, 'estado', 'EQUAL', { stringValue: estado }, 'tickets');
  if (tickets.length === 0) return 0;

  const desglose = {};
  for (const t of tickets) {
    const tipo = t.fields?.tipoTrabajo?.stringValue || 'OTRO';
    desglose[tipo] = (desglose[tipo] || 0) + 1;
  }
  const [anio, mes, dia] = fecha.split('-');
  const reportId = `${ahoraMs}-${tipoReporte}`;
  const reporte = {
    id: { stringValue: reportId },
    fechaCierre: { stringValue: `${dia}/${mes}/${anio}` },
    horaCierre: { stringValue: new Date(ahoraMs).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: ZONA_HORARIA }) },
    operador: { stringValue: 'AUTOMÁTICO' },
    total: { integerValue: String(tickets.length) },
    desglose: { mapValue: { fields: Object.fromEntries(Object.entries(desglose).map(([k, n]) => [k, { integerValue: String(n) }])) } },
    ticketsDetalle: {
      arrayValue: {
        values: tickets.map((t) => ({ mapValue: { fields: { ...t.fields, id: { stringValue: t.name.split('/').pop() } } } })),
      },
    },
    tipoReporte: { stringValue: tipoReporte },
    createdAt: { integerValue: String(ahoraMs) },
  };

  const borrados = tickets.map((t) => ({ delete: t.name }));
  const reportName = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${rutaDatos(env)}/reports/${reportId}`;
  await commitFirestore(env, accessToken, [
    { update: { name: reportName, fields: reporte }, currentDocument: { exists: false } },
    ...borrados.slice(0, MAX_ESCRITURAS_COMMIT),
  ]);
  for (let i = MAX_ESCRITURAS_COMMIT; i < borrados.length; i += MAX_ESCRITURAS_COMMIT) {
    await commitFirestore(env, accessToken, borrados.slice(i, i + MAX_ESCRITURAS_COMMIT));
  }
  return tickets.length;
}

async function avisarAprobadores(env, accessToken, title, body) {
  const tokens = await resolveTokens(env, accessToken, { type: 'aprobadores' });
  await Promise.all([...new Set(tokens)].map((t) => sendToToken(accessToken, env.FIREBASE_PROJECT_ID, t, title, body)));
}

export async function cierreAutomatico(env, ahoraMs = Date.now()) {
  const accessToken = await getGoogleAccessToken(env);
  const config = await leerConfigCierre(env, accessToken);
  const toca = debeEjecutar(config, ahoraMs);
  if (!toca) return { ejecutado: false };

  try {
    const finalizadas = await archivarPorEstado(env, accessToken, 'FINALIZADO', 'CIERRE', ahoraMs, toca.fecha);
    const canceladas = await archivarPorEstado(env, accessToken, 'CANCELADO', 'CANCELADOS', ahoraMs, toca.fecha);
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

export default {
  async fetch(request, env) {
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

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('JSON inválido', { status: 400, headers });
    }

    const { target, title, body: messageBody } = body || {};
    if (!target || !title) {
      return new Response('Faltan campos: target, title', { status: 400, headers });
    }

    try {
      const accessToken = await getGoogleAccessToken(env);
      const tokens = await resolveTokens(env, accessToken, target);
      await Promise.all(tokens.map((t) => sendToToken(accessToken, env.FIREBASE_PROJECT_ID, t, title, messageBody)));
      return new Response(JSON.stringify({ sent: tokens.length }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error(err);
      return new Response(`Error enviando notificación: ${err.message}`, { status: 500, headers });
    }
  },

  // Cron (ver wrangler.toml): revisa si toca el cierre automático.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(cierreAutomatico(env).catch((err) => console.error('Cron de cierre automático:', err)));
  },
};
