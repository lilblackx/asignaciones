// Envío al inventario del otro sistema (Telecom) de lo que se usa en cada orden aprobada: el material (drop y
// conectores) y el serial del equipo instalado. Qué se envía y cómo lo decide src/utils/envioInventario.js (la misma
// lógica que usa la app); aquí solo está el envío.
//
//   POST /inventario/enviar     { ticketId }  la app lo llama al aprobar/finalizar una orden (ADMIN, USUARIO o quien cierra)
//   POST /inventario/reintentar { ticketId }  desde el módulo de la app, solo para los usuarios de USUARIOS_INVENTARIO
//   POST /inventario/reenviar { ticketId }    lo mismo, pero también de una orden ya ENVIADA: se vuelve a enviar con lo que dice la orden ahora
//                                             (por ejemplo, con el serial corregido). Escribe lo mismo en las mismas filas (no duplica material).
//   POST /inventario/notificar  { ticketId }  vuelve a escribir el aviso de una orden con alerta en syncNotifications, solo para USUARIOS_INVENTARIO
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
// Las alertas y los avisos push son solo de los usuarios de USUARIOS_INVENTARIO (src/utils/accesoInventario.js). Además, cada
// alerta deja un documento en syncNotifications del otro sistema (notificarAlInventario) para su módulo de notificaciones.
// Sin los secretos configurados el envío está apagado: no escribe nada ni genera alertas.
import { ACCION_AVERIA, ACCION_INSTALACION, ESTADOS_CON_ALERTA, ESTADO_ENVIADO, ESTADO_PENDIENTE, TEXTO_ESTADO_ENVIO, payloadEnvioInventario } from '../../src/utils/envioInventario.js';
import { veEnviosInventario } from '../../src/utils/accesoInventario.js';
import { serialParaOlt } from '../../src/utils/serialOlt.js';
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

// Aviso para el módulo de notificaciones del otro sistema: un documento en su colección syncNotifications con el formato de su
// módulo { id, fechaHora, tipo, mensaje, estado: 'Pendiente' }. Cada aviso es un documento nuevo (su id lleva la hora del aviso).
export const TIPO_NOTIFICACION = 'Error de Descuento';
export const ESTADO_NOTIFICACION = 'Pendiente';

export function textoNotificacion(p, mensaje) {
  const orden = `${p.codigo || 'S/C'}${p.cliente ? ` (${p.cliente})` : ''}`;
  const tecnico = p.tecnico || p.tecnicoOrden;
  return `Fallo al descontar material de la orden ${orden}.${tecnico ? ` Técnico '${tecnico}'.` : ''}${p.serial ? ` Serial ${p.serial}.` : ''} ${mensaje}`.trim();
}

// Escribe el aviso; si no se puede (sus reglas, red) lanza el error.
async function escribirNotificacion(env, ticketId, estado, p, mensaje, ahoraMs) {
  const id = idRegistro(`${ticketId}:${estado}`, ahoraMs);
  const notificacion = { fechaHora: fechaHoraCaracas(ahoraMs).fechaHora, tipo: TIPO_NOTIFICACION, mensaje: textoNotificacion(p, mensaje), estado: ESTADO_NOTIFICACION };
  const name = `projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents/${rutaTelecom(env)}/syncNotifications/${id}`;
  await llamarTelecom(env, `${docsTelecom(env)}:commit`, { writes: [{ update: { name, fields: { id: { doubleValue: id }, ...campos(notificacion) } } }] }, ahoraMs);
}

// Al pasar una orden a alerta: no frena nada si falla, la alerta de la app ya salió.
async function notificarAlInventario(env, ticketId, estado, p, mensaje, ahoraMs) {
  if (!inventarioActivo(env)) return;
  try {
    await escribirNotificacion(env, ticketId, estado, p, mensaje, ahoraMs);
  } catch (err) {
    console.error(`No se pudo escribir la notificación de ${ticketId} en el inventario:`, err);
  }
}

// Llamada a su Firestore con nuestra sesión; si la sesión venció se renueva una vez.
async function llamarTelecom(env, url, cuerpo, ahoraMs) {
  for (let intento = 0; intento < 2; intento++) {
    const idToken = await iniciarSesion(env, ahoraMs, intento > 0);
    const res = await fetch(url, {
      method: cuerpo ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    });
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

// Los técnicos que tiene el inventario del otro sistema (su colección "tecnicos"): la lista oficial de nombres. Todo lo que se
// escribe a nombre de un técnico (material, auditoría) debe llevar uno de estos nombres tal cual, porque su pantalla suma el
// stock de cada técnico por ese nombre: uno distinto ("EDGAR" en vez de "EDGAR MONTERO") cae en una cuenta que nadie ve.
// Cada uno con su estado ("Activo" o no): un técnico que no está activo allá no recibe descuentos.
export async function leerTecnicosTelecom(env, ahoraMs = Date.now()) {
  const res = await llamarTelecom(env, `${docsTelecom(env)}/${rutaTelecom(env)}/tecnicos?pageSize=300`, null, ahoraMs);
  return (res.documents || []).map((d) => {
    const f = camposAObjeto(d.fields);
    return { nombre: String(f.nombre || '').trim(), activo: normalizarNombre(f.estado) === 'ACTIVO', estado: String(f.estado || '') };
  }).filter((t) => t.nombre);
}

// El técnico tal como lo tiene el inventario ({ nombre, activo, estado }), o null si no está en su lista (se compara sin tildes ni mayúsculas).
async function buscarTecnicoTelecom(env, nombre, ahoraMs) {
  const buscado = normalizarNombre(nombre);
  return (await leerTecnicosTelecom(env, ahoraMs)).find((t) => normalizarNombre(t.nombre) === buscado) || null;
}

// Envía una orden. Devuelve { estado, mensaje }; si no se pudo llegar al otro sistema, lanza el error (queda PENDIENTE).
export async function enviarAlInventario(env, ticketId, orden, ahoraMs = Date.now()) {
  const conEquipo = orden.accion !== ACCION_AVERIA;
  const escrituras = [];
  const { fecha, fechaHora } = fechaHoraCaracas(orden.finalizadoEn || ahoraMs);

  // El técnico va primero: sin su nombre del inventario no se escribe nada, ni siquiera el equipo.
  if (!orden.tecnico) return { estado: 'TECNICO_NO_VINCULADO', mensaje: `${TEXTO_ESTADO_ENVIO.TECNICO_NO_VINCULADO}${orden.tecnicoOrden ? ` (técnico de la orden: ${orden.tecnicoOrden}).` : ''}` };
  const tecnicoInventario = await buscarTecnicoTelecom(env, orden.tecnico, ahoraMs);
  if (!tecnicoInventario) return { estado: 'TECNICO_NO_ENCONTRADO', mensaje: `${TEXTO_ESTADO_ENVIO.TECNICO_NO_ENCONTRADO} (elegido: ${orden.tecnico}).` };
  // Activo aquí pero no allá: no se envía nada hasta que se confirme (activarlo en el inventario o elegir otro técnico) y se reintente.
  if (!tecnicoInventario.activo) return { estado: 'TECNICO_INACTIVO', mensaje: `${TEXTO_ESTADO_ENVIO.TECNICO_INACTIVO} (${tecnicoInventario.nombre}: ${tecnicoInventario.estado || 'sin estado'}).` };
  const p = { ...orden, tecnico: tecnicoInventario.nombre };

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
    // El equipo debe ser del técnico de la orden. Si el equipo no trae técnico (o trae "-") no hay con qué comparar.
    const tecnicoEquipo = normalizarNombre(actual.tecnico);
    if (tecnicoEquipo && tecnicoEquipo !== '-' && tecnicoEquipo !== normalizarNombre(p.tecnico)) {
      return { estado: 'EQUIPO_OTRO_TECNICO', mensaje: `${TEXTO_ESTADO_ENVIO.EQUIPO_OTRO_TECNICO} (el equipo figura con ${actual.tecnico} y la orden es de ${p.tecnico}).` };
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

  // Su historial de auditoría: una línea por orden enviada, aunque no hubiera material (el cambio de equipo no gasta). Va en el
  // mismo commit que el resto; si sus reglas no nos dejan escribirla (403), el descuento del inventario no se frena por eso.
  const url = `${docsTelecom(env)}:commit`;
  try {
    await llamarTelecom(env, url, { writes: [...escrituras, escrituraAuditoria(env, ticketId, p, fechaHora)] }, ahoraMs);
  } catch (err) {
    if (!String(err.message).includes(' 403:')) throw err;
    console.error(`No se pudo escribir la auditoría de ${ticketId}; se envía sin ella:`, err);
    await llamarTelecom(env, url, { writes: escrituras }, ahoraMs);
  }
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

// La orden ya cerrada, tal como quedó en su reporte de cierre (las órdenes archivadas viven en `ticketsDetalle` de un reporte). El cierre
// se hace el día de la orden o poco después, así que se miran solo los primeros reportes creados desde que se finalizó.
const REPORTES_A_MIRAR = 6;
async function leerOrdenArchivada(env, deps, accessToken, ticketId, desdeMs) {
  if (!(desdeMs > 0)) return null;
  const res = await fetch(`${deps.docsBase(env)}/${deps.rutaDatos(env)}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'reports' }],
      where: { fieldFilter: { field: { fieldPath: 'createdAt' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(Math.floor(desdeMs)) } } },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }],
      limit: REPORTES_A_MIRAR,
    } }),
  });
  if (!res.ok) throw new Error(`No se pudo leer los reportes de cierre: ${res.status}`);
  for (const fila of await res.json()) {
    if (!fila.document) continue;
    const detalle = camposAObjeto(fila.document.fields).ticketsDetalle;
    const orden = Array.isArray(detalle) ? detalle.find((t) => String(t?.id) === String(ticketId)) : null;
    if (orden) return orden;
  }
  return null;
}

// Lo que hay que enviar de una orden, leído de la propia orden (no de lo que mande la app): { payload } o, si la orden ya no está
// ni en la lista ni en un reporte de cierre, { archivada: true }; { payload: null } si no corresponde enviar nada.
// `desdeMs`: cuándo se finalizó (para buscarla en los reportes de cierre).
async function payloadDeOrden(env, deps, accessToken, ticketId, desdeMs = 0) {
  const ticket = await leerDocumento(env, deps, accessToken, 'tickets', ticketId) || await leerOrdenArchivada(env, deps, accessToken, ticketId, desdeMs);
  if (!ticket) return { archivada: true };
  return { payload: payloadEnvioInventario({ ...ticket, id: ticketId }) };
}

// Pone en el payload el nombre con que el inventario conoce al técnico: el que se eligió en Asignaciones (campo
// tecnicoInventario del técnico), no el nombre corto de la orden. `tecnicoOrden` queda con el de la orden. Sin elección, `tecnico`
// queda vacío y el envío no sale. Un envío guardado que ya traía su nombre (orden archivada) lo conserva si el técnico ya no existe.
async function conTecnicoInventario(env, deps, accessToken, p) {
  const tecnicoOrden = String(p.tecnicoOrden || p.tecnico || '').trim();
  const ficha = tecnicoOrden ? await leerDocumento(env, deps, accessToken, 'technicians', tecnicoOrden.toUpperCase()) : null;
  const elegido = String(ficha?.tecnicoInventario || '').trim();
  return { ...p, tecnicoOrden, tecnico: elegido || (p.tecnicoOrden ? String(p.tecnico || '') : '') };
}

// Lo que hay que enviar ahora: lo que dice la orden en este momento (así lo que la oficina corrigió después de una alerta, como un
// serial mal escrito, llega al reintentar) o, si la orden ya se archivó y `usarGuardado`, lo que quedó guardado del envío.
//   { payload } | { omitir: true } (la orden ya no tiene nada que enviar) | { archivada: true } (no hay de dónde sacarlo)
async function payloadAEnviar(env, deps, accessToken, ticketId, existente, usarGuardado) {
  const orden = await payloadDeOrden(env, deps, accessToken, ticketId, Number(existente?.finalizadoEn) || 0);
  // El envío guardado puede traer un serial de antes de una corrección de serialParaOlt (p. ej. TPLH... sin la G): se vuelve a convertir.
  if (orden.archivada) return usarGuardado && existente?.accion ? { payload: await conTecnicoInventario(env, deps, accessToken, { ...existente, serial: serialParaOlt(existente.serial) }) } : { archivada: true };
  return orden.payload ? { payload: await conTecnicoInventario(env, deps, accessToken, orden.payload) } : { omitir: true };
}

async function borrarEnvio(env, deps, accessToken, ticketId) {
  await deps.commitFirestore(env, accessToken, [{ delete: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${deps.rutaDatos(env)}/telecomEnvios/${ticketId}` }]);
}

// Una orden PENDIENTE que ya no se puede leer (se archivó antes de enviarse) pasa a ERROR con ese motivo: alguien debe revisarla.
const MENSAJE_ARCHIVADA = 'La orden ya no está en la lista (el cierre del día la archivó antes de enviarse). Revisa el reporte de cierre.';

const camposPayload = (p) => ({ accion: p.accion, codigo: p.codigo, tecnico: p.tecnico, tecnicoOrden: p.tecnicoOrden, cliente: p.cliente, serial: p.serial, apc: p.apc, upc: p.upc, dropMetros: p.dropMetros, motivo: p.motivo, finalizadoEn: p.finalizadoEn });

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
    await notificarAlInventario(env, ticketId, estado, p, mensaje || TEXTO_ESTADO_ENVIO[estado], ahoraMs);
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
    const ruta = new URL(request.url).pathname;
    // "Reenviar" es un reintento que también vale para una orden ya ENVIADA (se corrigió algo de la orden y hay que mandarlo otra vez).
    const reenvio = ruta === '/inventario/reenviar';
    const reintento = reenvio || ruta === '/inventario/reintentar';
    if (!(reintento ? gestionar : enviar)) return new Response('Sin permiso.', { status: 403, headers });
    if (!inventarioActivo(env)) return json({ estado: 'DESHABILITADO' }, 200, headers);

    const existente = await leerDocumento(env, deps, accessToken, 'telecomEnvios', ticketId);
    if (existente?.estado === ESTADO_ENVIADO && !reenvio) return json({ estado: ESTADO_ENVIADO, repetido: true }, 200, headers);

    if (reintento && !existente) return new Response('No hay un envío para reintentar.', { status: 404, headers });
    // Se envía lo que dice la orden ahora; solo si ya se archivó, reintentar usa lo que quedó guardado.
    const aEnviar = await payloadAEnviar(env, deps, accessToken, ticketId, existente, reintento);
    if (aEnviar.archivada) return new Response('Orden no encontrada.', { status: 404, headers });
    if (aEnviar.omitir) {
      if (existente && !reenvio) await borrarEnvio(env, deps, accessToken, ticketId);
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

//   POST /inventario/tecnicos   la lista de técnicos del inventario, para elegir con cuál se corresponde cada técnico de la app
//                               (solo los usuarios de USUARIOS_INVENTARIO)
export async function listarTecnicosInventario(env, headers, uid, deps, ahoraMs = Date.now()) {
  try {
    const accessToken = await deps.getGoogleAccessToken(env);
    if (!(await permisos(env, deps, accessToken, uid)).gestionar) return new Response('Sin permiso.', { status: 403, headers });
    if (!inventarioActivo(env)) return json({ estado: 'DESHABILITADO', tecnicos: [] }, 200, headers);
    return json({ tecnicos: (await leerTecnicosTelecom(env, ahoraMs)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) }, 200, headers);
  } catch (err) {
    console.error(err);
    return new Response('No se pudo leer la lista de técnicos del inventario.', { status: 500, headers });
  }
}

// Vuelve a avisar al otro sistema de una orden que sigue con alerta (el botón "Reenviar aviso" del módulo). Solo para los usuarios
// del módulo. A diferencia del aviso automático, aquí sí se le dice a quien lo pidió si no se pudo escribir.
export async function reenviarNotificacion(request, env, headers, uid, deps, ahoraMs = Date.now()) {
  let body;
  try { body = await request.json(); } catch { return new Response('JSON inválido', { status: 400, headers }); }
  const ticketId = String(body?.ticketId || '');
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(ticketId)) return new Response('Falta ticketId.', { status: 400, headers });
  try {
    const accessToken = await deps.getGoogleAccessToken(env);
    if (!(await permisos(env, deps, accessToken, uid)).gestionar) return new Response('Sin permiso.', { status: 403, headers });
    if (!inventarioActivo(env)) return json({ estado: 'DESHABILITADO' }, 200, headers);
    const existente = await leerDocumento(env, deps, accessToken, 'telecomEnvios', ticketId);
    if (!existente) return new Response('No hay un envío con ese id.', { status: 404, headers });
    if (!ESTADOS_CON_ALERTA.includes(existente.estado)) return json({ estado: 'SIN_ALERTA' }, 200, headers);
    try {
      await escribirNotificacion(env, ticketId, existente.estado, camposPayloadDe(existente), existente.mensaje || TEXTO_ESTADO_ENVIO[existente.estado], ahoraMs);
    } catch (err) {
      console.error(`No se pudo reenviar la notificación de ${ticketId}:`, err);
      return json({ estado: 'NO_ENVIADA', mensaje: String(err.message || err).slice(0, 200) }, 200, headers);
    }
    return json({ estado: 'NOTIFICADA' }, 200, headers);
  } catch (err) {
    console.error(err);
    return new Response('No se pudo reenviar la notificación.', { status: 500, headers });
  }
}

// De un documento guardado (o del payload) a { accion, codigo, ... } con los tipos que espera el envío.
const camposPayloadDe = (d) => ({
  accion: d.accion, codigo: String(d.codigo || ''), tecnico: String(d.tecnico || ''), tecnicoOrden: String(d.tecnicoOrden || ''), cliente: String(d.cliente || ''), serial: String(d.serial || ''),
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
      await notificarAlInventario(env, ticketId, 'ERROR', existente, MENSAJE_ARCHIVADA, ahoraMs);
      continue;
    }
    if (aEnviar.omitir) { await borrarEnvio(env, deps, accessToken, ticketId); continue; }
    await procesar(env, deps, accessToken, ticketId, camposPayloadDe(aEnviar.payload), existente, ahoraMs);
    reintentados++;
  }
  return { reintentados };
}
