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

  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
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

async function runQuery(env, accessToken, fieldPath, op, value) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/${env.APP_ID}/public/data:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
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
};
