// Envío al inventario del otro sistema (Telecom) de lo que se usa en cada orden aprobada: el material (drop y
// conectores) y el serial del equipo instalado. Qué se envía y cómo lo decide src/utils/envioInventario.js (la misma
// lógica que usa la app); aquí solo está el envío.
//
//   POST /inventario/enviar     { ticketId }  la app lo llama al aprobar/finalizar una orden (ADMIN, USUARIO o quien cierra)
//   POST /inventario/reintentar { ticketId }  desde el módulo de la app, solo para los usuarios de USUARIOS_INVENTARIO
//   cron                        envía lo PENDIENTE: lo que no se pudo enviar (red caída, clave rechazada...) y lo que la app
//                               marcó al aprobar pero no alcanzó a llamar al Worker; cada 15 minutos
// Al aprobar, la app deja en telecomEnvios/{id} una marca mínima { ticketId, estado: PENDIENTE, intentos: 0 } (sin datos
// de la orden). Lo que se envía lo lee siempre el Worker de la propia orden: una marca no puede inventar datos.
//
// El Worker entra al Firebase del otro sistema con un usuario propio (secretos TELECOM_EMAIL y TELECOM_PASSWORD) y
// escribe lo mismo que escribe su api-telecom.js: un registro en materialLogs (si hubo material), una línea en auditLogs
// y, si hay equipo, lo pasa a "Instalado" en inventory. Las escrituras van en un solo commit (todo o nada) y los ids son fijos por orden, así que reenviar nunca
// descuenta dos veces. Solo se descuenta (y pasa a "Instalado") el equipo que figura "Con Técnico" en su inventario. Si el
// serial no existe, o el equipo no está "Con Técnico" (p. ej. sigue "En Almacén"), no se envía nada de la orden: queda una
// alerta en la app y un aviso push. El estado de cada envío vive en telecomEnvios/{id de la orden} (nuestro Firestore).
//
// Las alertas y los avisos push son solo de los usuarios de USUARIOS_INVENTARIO (src/utils/accesoInventario.js).
// Sin los secretos configurados el envío está apagado: no escribe nada ni genera alertas.
import { ACCION_AVERIA, ACCION_INSTALACION, ESTADOS_CON_ALERTA, ESTADO_ENVIADO, ESTADO_PENDIENTE, TEXTO_ESTADO_ENVIO, payloadEnvioInventario } from '../../src/utils/envioInventario.js';
import { veEnviosInventario } from '../../src/utils/accesoInventario.js';
import { camposAObjeto } from './materiales-api.js';

const SIGNIN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const ZONA_HORARIA = 'America/Caracas';
export const MAX_INTENTOS = 4; // con el reintento cada 15 minutos, alrededor de una hora antes de pedir ayuda
const MAX_POR_CRON = 5; // el plan gratuito de Cloudflare admite 50 llamadas externas por ejecución
const MINUTOS_REINTENTO = 15;

export const inventarioActivo = (env) => Boolean(env.TELECOM_EMAIL && env.TELECOM_PASSWORD && env.TELECOM_API_KEY && env.TELECOM_PROJECT_ID && env.TELECOM_APP_ID);

// --- Fechas y ids con el formato del otro sistema ---

// Fecha "2026-10-15" y hora "14:05:09" en Venezuela (su módulo usa la hora del equipo que envía; aquí la de la orden).
export function fechaHoraCaracas(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const fecha = `${p.year}-${p.month}-${p.day}`;
  return { fecha, fechaHora: `${fecha} ${p.hour}:${p.minute}:${p.second}` };
}

// Su id de registro es un número con decimales (Date.now() + Math.random()). El nuestro tiene la misma forma pero sale de
// la orden: la hora en que se finalizó más tres decimales sacados del id de la orden. Así es siempre el mismo para la misma orden.
export function idRegistro(ticketId, finalizadoEn) {
  let h = 2166136261;
  for (const c of String(ticketId)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return Number(finalizadoEn) + (h % 1000) / 1000;
}

// Estado del equipo en su inventario cuando lo tiene asignado un técnico: el único del que se descuenta y pasa a "Instalado".
const ESTADO_INSTALADO = 'INSTALADO';
const ESTADO_CON_TECNICO = 'CON TECNICO';

// Para comparar nombres de cliente y estados: sin tildes, sin mayúsculas ni espacios de más (su inventario puede tenerlos escritos distinto).
const normalizarNombre = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

// Quién figura en su historial de auditoría: un valor fijo, no el técnico ni quien aprobó la orden.
export const USUARIO_AUDITORIA = 'Usuario Asignaciones';

// La acción y el detalle de su auditLogs, con el estilo de su propio módulo ("Instalación a Cliente", "INSTALACIÓN NUEVA: ...").
export function textoAuditoria(p) {
  const metros = Number(Math.abs(p.dropMetros).toFixed(2));
  const consumo = `(Consumo: ${Math.abs(p.apc)} APC, ${Math.abs(p.upc)} UPC, ${metros}m Drop).`;
  if (p.accion === ACCION_AVERIA) {
    return { accion: 'Avería', detalle: `AVERÍA: '${p.cliente}'${p.motivo ? ` (${p.motivo})` : ''}. Téc: '${p.tecnico}'. ${consumo}` };
  }
  if (p.accion === ACCION_INSTALACION) {
    return { accion: 'Instalación a Cliente', detalle: `INSTALACIÓN NUEVA: Serial [${p.serial}] a '${p.cliente}'. Téc: '${p.tecnico}'. ${consumo}` };
  }
  return { accion: 'Cambio de Equipo', detalle: `CAMBIO DE EQUIPO: Serial [${p.serial}] a '${p.cliente}'. Téc: '${p.tecnico}'.` };
}

// --- Valores de Firestore (REST) ---
const s = (v) => ({ stringValue: String(v ?? '') });
const num = (v) => (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v });
const campos = (objeto) => Object.fromEntries(Object.entries(objeto).map(([k, v]) => [k, typeof v === 'number' ? num(v) : s(v)]));

// --- El otro sistema ---

let sesion = null; // { idToken, hasta }
export const olvidarSesionInventario = () => { sesion = null; };

async function iniciarSesion(env, ahoraMs, renovar = false) {
  if (!renovar && sesion && sesion.hasta > ahoraMs) return sesion.idToken;
  const res = await fetch(`${SIGNIN_URL}?key=${encodeURIComponent(env.TELECOM_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.TELECOM_EMAIL, password: env.TELECOM_PASSWORD, returnSecureToken: true }),
  });
  if (!res.ok) {
    const detalle = (await res.json().catch(() => ({})))?.error?.message || res.status;
    throw new Error(`No se pudo iniciar sesión en el inventario (${detalle}).`);
  }
  const datos = await res.json();
  sesion = { idToken: datos.idToken, hasta: ahoraMs + Math.max(60, Number(datos.expiresIn) - 300) * 1000 };
  return sesion.idToken;
}

const docsTelecom = (env) => `https://firestore.googleapis.com/v1/projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents`;
const rutaTelecom = (env) => `artifacts/${env.TELECOM_APP_ID}/public/data`;

// La escritura de la línea de auditoría de una orden. El id sale de la orden, así que escribirla dos veces deja una sola línea
// (también la usa scripts/completar-auditoria.mjs para las órdenes que se enviaron antes de que existiera).
export function escrituraAuditoria(env, ticketId, p, fechaHora) {
  const id = idRegistro(ticketId, p.finalizadoEn);
  return {
    update: {
      name: `projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents/${rutaTelecom(env)}/auditLogs/${id}`,
      fields: { id: { doubleValue: id }, ...campos({ fechaHora, usuario: USUARIO_AUDITORIA, ...textoAuditoria(p) }) },
    },
  };
}

// Llamada a su Firestore con nuestra sesión; si la sesión venció se renueva una vez.
async function llamarTelecom(env, url, cuerpo, ahoraMs) {
  for (let intento = 0; intento < 2; intento++) {
    const idToken = await iniciarSesion(env, ahoraMs, intento > 0);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify(cuerpo) });
    if (res.status === 401 && intento === 0) continue;
    if (!res.ok) throw new Error(`El inventario respondió ${res.status}: ${(await res.text()).slice(0, 150)}`);
    return res.json();
  }
  throw new Error('El inventario rechazó la sesión.');
}

async function buscarEquipo(env, serial, ahoraMs) {
  const filas = await llamarTelecom(env, `${docsTelecom(env)}/${rutaTelecom(env)}:runQuery`, {
    structuredQuery: { from: [{ collectionId: 'inventory' }], where: { fieldFilter: { field: { fieldPath: 'serial' }, op: 'EQUAL', value: { stringValue: serial } } }, limit: 1 },
  }, ahoraMs);
  return filas.find((f) => f.document)?.document || null;
}

// Envía una orden. Devuelve { estado, mensaje }; si no se pudo llegar al otro sistema, lanza el error (queda PENDIENTE).
export async function enviarAlInventario(env, ticketId, p, ahoraMs = Date.now()) {
  const conEquipo = p.accion !== ACCION_AVERIA;
  const escrituras = [];
  const { fecha, fechaHora } = fechaHoraCaracas(p.finalizadoEn || ahoraMs);

  if (conEquipo) {
    if (!p.serial) return { estado: 'SIN_SERIAL', mensaje: TEXTO_ESTADO_ENVIO.SIN_SERIAL };
    const equipo = await buscarEquipo(env, p.serial, ahoraMs);
    if (!equipo) return { estado: 'SERIAL_NO_ENCONTRADO', mensaje: TEXTO_ESTADO_ENVIO.SERIAL_NO_ENCONTRADO };
    const actual = camposAObjeto(equipo.fields);
    const estadoActual = normalizarNombre(actual.estado);
    if (estadoActual === ESTADO_INSTALADO) {
      // Un equipo ya instalado a otro cliente no se pisa (reenviar la misma orden, o que ya lo hayan marcado con este mismo
      // cliente escrito distinto, sí es válido).
      if (normalizarNombre(actual.cliente) !== normalizarNombre(p.cliente)) {
        return { estado: 'SERIAL_YA_INSTALADO', mensaje: `${TEXTO_ESTADO_ENVIO.SERIAL_YA_INSTALADO} (figura con ${actual.cliente || 'otro cliente'}).` };
      }
    } else if (estadoActual !== ESTADO_CON_TECNICO) {
      // Solo se descuenta el equipo que ya tiene asignado un técnico ("Con Técnico"); uno que sigue en almacén no se toca.
      return { estado: 'EQUIPO_NO_ASIGNADO', mensaje: `El equipo figura "${actual.estado || 'sin estado'}" y no "Con Técnico" en el inventario: no se envió nada de esta orden.` };
    }
    escrituras.push({
      update: { name: equipo.name, fields: campos({ estado: 'Instalado', cliente: p.cliente, fechaInstalacion: fecha, fechaHoraInstalacion: fechaHora }) },
      updateMask: { fieldPaths: ['estado', 'cliente', 'fechaInstalacion', 'fechaHoraInstalacion'] },
      currentDocument: { exists: true },
    });
  }

  // Material usado, en negativo como lo guarda su sistema (el drop en km). En una instalación o un cambio de equipo solo
  // se registra si hubo material; una avería siempre lleva su registro, con el motivo pegado al nombre del cliente.
  const dropKm = Math.abs(p.dropMetros) / 1000;
  if (!conEquipo || p.apc > 0 || p.upc > 0 || dropKm > 0) {
    const id = idRegistro(ticketId, p.finalizadoEn);
    const registro = {
      fecha, fechaHora, tecnico: p.tecnico,
      apc: -Math.abs(p.apc), upc: -Math.abs(p.upc), drop: -dropKm,
      grapas: p.accion === ACCION_AVERIA ? 'Avería' : p.accion === ACCION_INSTALACION ? 'Instalación Nueva' : 'Cambio de Equipo',
      ...(conEquipo ? { equipoSerial: p.serial } : {}),
      cliente: p.accion === ACCION_AVERIA && p.motivo ? `${p.cliente} (Incidente: ${p.motivo})` : p.cliente,
    };
    escrituras.push({ update: { name: `projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents/${rutaTelecom(env)}/materialLogs/${id}`, fields: { id: { doubleValue: id }, ...campos(registro) } } });
  }

  // Su historial de auditoría: una línea por orden enviada, aunque no hubiera material (el cambio de equipo no gasta).
  escrituras.push(escrituraAuditoria(env, ticketId, p, fechaHora));

  await llamarTelecom(env, `${docsTelecom(env)}:commit`, { writes: escrituras }, ahoraMs);
  return { estado: ESTADO_ENVIADO, mensaje: '' };
}

// --- Estado de cada envío (nuestro Firestore) ---

// `deps` trae lo que ya tiene el Worker principal (token de Google, commit, rutas, avisos) para no repetirlo ni importarlo en círculo.
const urlDoc = (env, deps, coleccion, id) => `${deps.docsBase(env)}/${deps.rutaDatos(env)}/${coleccion}/${encodeURIComponent(id)}`;

async function leerDocumento(env, deps, accessToken, coleccion, id) {
  const res = await fetch(urlDoc(env, deps, coleccion, id), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No se pudo leer ${coleccion}/${id}: ${res.status}`);
  return camposAObjeto((await res.json()).fields);
}

async function guardarEnvio(env, deps, accessToken, ticketId, datos) {
  const nombre = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${deps.rutaDatos(env)}/telecomEnvios/${ticketId}`;
  await deps.commitFirestore(env, accessToken, [{ update: { name: nombre, fields: campos(datos) } }]);
}

// Lo que hay que enviar de una orden, leído de la propia orden (no de lo que mande la app): { payload } o, si la orden ya no está
// en la lista (el cierre del día la archivó), { archivada: true }; { payload: null } si no corresponde enviar nada.
async function payloadDeOrden(env, deps, accessToken, ticketId) {
  const ticket = await leerDocumento(env, deps, accessToken, 'tickets', ticketId);
  if (!ticket) return { archivada: true };
  return { payload: payloadEnvioInventario({ ...ticket, id: ticketId }) };
}

// Lo que hay que enviar ahora: lo que dice la orden en este momento (así lo que la oficina corrigió después de una alerta, como un
// serial mal escrito, llega al reintentar) o, si la orden ya se archivó y `usarGuardado`, lo que quedó guardado del envío.
//   { payload } | { omitir: true } (la orden ya no tiene nada que enviar) | { archivada: true } (no hay de dónde sacarlo)
async function payloadAEnviar(env, deps, accessToken, ticketId, existente, usarGuardado) {
  const orden = await payloadDeOrden(env, deps, accessToken, ticketId);
  if (orden.archivada) return usarGuardado && existente?.accion ? { payload: existente } : { archivada: true };
  return orden.payload ? { payload: orden.payload } : { omitir: true };
}

async function borrarEnvio(env, deps, accessToken, ticketId) {
  await deps.commitFirestore(env, accessToken, [{ delete: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${deps.rutaDatos(env)}/telecomEnvios/${ticketId}` }]);
}

// Una orden PENDIENTE que ya no se puede leer (se archivó antes de enviarse) pasa a ERROR con ese motivo: alguien debe revisarla.
const MENSAJE_ARCHIVADA = 'La orden ya no está en la lista (el cierre del día la archivó antes de enviarse). Revisa el reporte de cierre.';

const camposPayload = (p) => ({ accion: p.accion, codigo: p.codigo, tecnico: p.tecnico, cliente: p.cliente, serial: p.serial, apc: p.apc, upc: p.upc, dropMetros: p.dropMetros, motivo: p.motivo, finalizadoEn: p.finalizadoEn });

// Envía y deja el estado guardado. Avisa a los usuarios del módulo solo cuando una orden pasa a un estado de alerta (una vez por cambio).
async function procesar(env, deps, accessToken, ticketId, p, existente, ahoraMs) {
  const intentos = (existente?.intentos || 0) + 1;
  let estado;
  let mensaje = '';
  try {
    ({ estado, mensaje } = await enviarAlInventario(env, ticketId, p, ahoraMs));
  } catch (err) {
    console.error(`Envío al inventario de ${ticketId} falló (intento ${intentos}):`, err);
    estado = intentos >= MAX_INTENTOS ? 'ERROR' : ESTADO_PENDIENTE;
    mensaje = String(err.message || err).slice(0, 200);
  }
  const datos = {
    ticketId, estado, mensaje, intentos, ...camposPayload(p),
    creadoEn: existente?.creadoEn || ahoraMs, actualizadoEn: ahoraMs,
    ...(estado === ESTADO_ENVIADO ? { enviadoEn: ahoraMs } : {}),
  };
  await guardarEnvio(env, deps, accessToken, ticketId, datos);
  if (ESTADOS_CON_ALERTA.includes(estado) && existente?.estado !== estado) {
    const detalle = `${p.codigo || 'S/C'}${p.serial ? ` · ${p.serial}` : ''}: ${mensaje || TEXTO_ESTADO_ENVIO[estado]}`;
    await deps.avisarInventario(env, accessToken, 'Orden no enviada al inventario', detalle, { tipo: 'inventario', tag: `inventario:${ticketId}` })
      .catch((err) => console.error('No se pudo avisar del envío al inventario:', err));
  }
  return { estado, mensaje };
}

// --- Rutas ---

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

// `enviar`: quien aprueba o finaliza órdenes (ADMIN, USUARIO o con permiso de cierre). `gestionar`: solo los usuarios del módulo.
async function permisos(env, deps, accessToken, uid) {
  const perfil = await deps.getUserDoc(env, accessToken, uid);
  if (!perfil || perfil.fields?.disabled?.booleanValue === true) return { enviar: false, gestionar: false };
  const rol = perfil.fields?.role?.stringValue;
  const aprueba = rol === 'ADMIN' || rol === 'USUARIO' || perfil.fields?.puedeCerrar?.booleanValue === true;
  return { enviar: aprueba, gestionar: veEnviosInventario(perfil.fields?.username?.stringValue) };
}

export async function manejarInventario(request, env, headers, uid, deps, ahoraMs = Date.now()) {
  let body;
  try { body = await request.json(); } catch { return new Response('JSON inválido', { status: 400, headers }); }
  const ticketId = String(body?.ticketId || '');
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(ticketId)) return new Response('Falta ticketId.', { status: 400, headers });

  try {
    const accessToken = await deps.getGoogleAccessToken(env);
    const { enviar, gestionar } = await permisos(env, deps, accessToken, uid);
    const reintento = new URL(request.url).pathname === '/inventario/reintentar';
    if (!(reintento ? gestionar : enviar)) return new Response('Sin permiso.', { status: 403, headers });
    if (!inventarioActivo(env)) return json({ estado: 'DESHABILITADO' }, 200, headers);

    const existente = await leerDocumento(env, deps, accessToken, 'telecomEnvios', ticketId);
    if (existente?.estado === ESTADO_ENVIADO) return json({ estado: ESTADO_ENVIADO, repetido: true }, 200, headers);

    if (reintento && !existente) return new Response('No hay un envío para reintentar.', { status: 404, headers });
    // Se envía lo que dice la orden ahora; solo si ya se archivó, reintentar usa lo que quedó guardado.
    const aEnviar = await payloadAEnviar(env, deps, accessToken, ticketId, existente, reintento);
    if (aEnviar.archivada) return new Response('Orden no encontrada.', { status: 404, headers });
    if (aEnviar.omitir) {
      if (existente) await borrarEnvio(env, deps, accessToken, ticketId);
      return json({ estado: 'OMITIDO' }, 200, headers);
    }
    const payload = aEnviar.payload;
    const resultado = await procesar(env, deps, accessToken, ticketId, camposPayloadDe(payload), reintento ? { ...existente, intentos: 0 } : existente, ahoraMs);
    return json(resultado, 200, headers);
  } catch (err) {
    console.error(err);
    return new Response('No se pudo procesar el envío al inventario.', { status: 500, headers });
  }
}

// De un documento guardado (o del payload) a { accion, codigo, ... } con los tipos que espera el envío.
const camposPayloadDe = (d) => ({
  accion: d.accion, codigo: String(d.codigo || ''), tecnico: String(d.tecnico || ''), cliente: String(d.cliente || ''), serial: String(d.serial || ''),
  apc: Number(d.apc) || 0, upc: Number(d.upc) || 0, dropMetros: Number(d.dropMetros) || 0, motivo: String(d.motivo || ''), finalizadoEn: Number(d.finalizadoEn) || 0,
});

// Cron: reintenta lo PENDIENTE, cada 15 minutos y de a pocos por vez.
export async function reintentarPendientes(env, deps, ahoraMs = Date.now()) {
  if (!inventarioActivo(env) || new Date(ahoraMs).getUTCMinutes() % MINUTOS_REINTENTO >= 5) return { reintentados: 0 };
  const accessToken = await deps.getGoogleAccessToken(env);
  const pendientes = await deps.runQuery(env, accessToken, 'estado', 'EQUAL', { stringValue: ESTADO_PENDIENTE }, 'telecomEnvios');
  let reintentados = 0;
  for (const doc of pendientes.slice(0, MAX_POR_CRON)) {
    const ticketId = doc.name.split('/').pop();
    const existente = camposAObjeto(doc.fields);
    const aEnviar = await payloadAEnviar(env, deps, accessToken, ticketId, existente, true);
    if (aEnviar.archivada) {
      await guardarEnvio(env, deps, accessToken, ticketId, { ticketId, estado: 'ERROR', mensaje: MENSAJE_ARCHIVADA, intentos: existente.intentos || 0, creadoEn: existente.creadoEn || ahoraMs, actualizadoEn: ahoraMs });
      await deps.avisarInventario(env, accessToken, 'Orden no enviada al inventario', MENSAJE_ARCHIVADA, { tipo: 'inventario', tag: `inventario:${ticketId}` }).catch(() => {});
      continue;
    }
    if (aEnviar.omitir) { await borrarEnvio(env, deps, accessToken, ticketId); continue; }
    await procesar(env, deps, accessToken, ticketId, camposPayloadDe(aEnviar.payload), existente, ahoraMs);
    reintentados++;
  }
  return { reintentados };
}
