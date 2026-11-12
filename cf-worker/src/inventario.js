// Envío al inventario del otro sistema (Telecom) de lo que se usa en cada orden aprobada: el material (drop y
// conectores) y el serial del equipo instalado. Qué se envía y cómo lo decide src/utils/envioInventario.js (la misma
// lógica que usa la app); aquí solo está el envío.
//
//   POST /inventario/enviar     { ticketId }  la app lo llama al aprobar/finalizar una orden (ADMIN, USUARIO o quien cierra)
//   POST /inventario/reintentar { ticketId }  desde el módulo de la app, para quienes ven el módulo (todo ADMIN y los de USUARIOS_INVENTARIO)
//   POST /inventario/reenviar { ticketId }    lo mismo, pero también de una orden ya ENVIADA: se vuelve a enviar con lo que dice la orden ahora
//                                             (por ejemplo, con el serial corregido). Escribe lo mismo en las mismas filas (no duplica material).
//   POST /inventario/liberar    { ticketId }  una orden con la alerta "Ya instalado" cuyo equipo quedó ocupado por un envío anterior de otra orden del cliente que figura (que se corrigió a otro serial):
//                                             lo libera, devuelve ese material y reintenta la orden (solo si se comprueba; ver liberarEquipoInventario)
//   POST /inventario/notificar  { ticketId }  vuelve a escribir el aviso de una orden con alerta en syncNotifications, solo para quienes ven el módulo
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
// Las alertas y los avisos push son de quienes ven el módulo: todo ADMIN y los usuarios de USUARIOS_INVENTARIO (src/utils/accesoInventario.js). Además, cada
// alerta deja un documento en syncNotifications del otro sistema (notificarAlInventario) para su módulo de notificaciones.
// Sin los secretos configurados el envío está apagado: no escribe nada ni genera alertas.
import { ACCION_AVERIA, ACCION_INSTALACION, ESTADOS_CON_ALERTA, ESTADO_ENVIADO, ESTADO_PENDIENTE, TEXTO_ESTADO_ENVIO, payloadEnvioInventario } from '../../src/utils/envioInventario.js';
import { veEnviosInventario, vinculaTecnicosInventario } from '../../src/utils/accesoInventario.js';
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

// El id de la corrección de un registro ya escrito: el mismo número con el milisegundo siguiente (así es siempre el mismo para el mismo registro y no choca con él).
export const idCorreccion = (id) => Number(id) + 1;

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
    return { accion: 'Avería', detalle: `AVERÍA: '${p.cliente}'${p.motivo ? ` (${p.motivo})` : ''}${p.serial ? `. Equipo cambiado: Serial [${p.serial}]` : ''}. Téc: '${p.tecnico}'. ${consumo}` };
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

// El registro de material que ya hay con ese id, o null si no existe.
async function leerRegistroMaterial(env, id, ahoraMs) {
  try {
    const doc = await llamarTelecom(env, `${docsTelecom(env)}/${rutaTelecom(env)}/materialLogs/${id}`, null, ahoraMs);
    return camposAObjeto(doc.fields);
  } catch (err) {
    if (String(err.message).includes(' 404:')) return null;
    throw err;
  }
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

// --- Lo que ya quedó escrito en el almacén por una orden ---
// Cada envío correcto guarda en telecomEnvios lo que escribió (campos "escrito...") y los intentos que fallan después no lo borran: así, si la orden se reenvía con otro serial u
// otro material, se puede dejar el almacén como si el envío anterior no hubiera existido (ver limpiezaDelEnvioAnterior). Un envío ENVIADO de antes de este cambio no trae esos campos: se usa lo que tiene guardado.
export const camposEscrito = (p) => ({ escritoAccion: p.accion, escritoSerial: p.serial, escritoCliente: p.cliente, escritoTecnico: p.tecnico, escritoApc: p.apc, escritoUpc: p.upc, escritoDrop: p.dropMetros, escritoFinalizadoEn: p.finalizadoEn });

export function escritoDe(existente) {
  if (!existente) return null;
  if (existente.escritoAccion) {
    return {
      accion: existente.escritoAccion, serial: String(existente.escritoSerial || ''), cliente: String(existente.escritoCliente || ''), tecnico: String(existente.escritoTecnico || ''),
      apc: Number(existente.escritoApc) || 0, upc: Number(existente.escritoUpc) || 0, dropMetros: Number(existente.escritoDrop) || 0, finalizadoEn: Number(existente.escritoFinalizadoEn) || 0,
    };
  }
  if (existente.estado === ESTADO_ENVIADO && existente.accion) {
    return { accion: existente.accion, serial: String(existente.serial || ''), cliente: String(existente.cliente || ''), tecnico: String(existente.tecnico || ''), apc: Number(existente.apc) || 0, upc: Number(existente.upc) || 0, dropMetros: Number(existente.dropMetros) || 0, finalizadoEn: Number(existente.finalizadoEn) || 0 };
  }
  return null;
}

// ¿Lo que dice la orden ahora es distinto de lo que quedó escrito? No cuenta la hora en que se finalizó: aprobar otra vez la misma orden sin cambios no reenvía nada.
export function distintoDeLoEscrito(nuevo, escrito) {
  if (!escrito) return false;
  return nuevo.accion !== escrito.accion || nuevo.serial !== escrito.serial || normalizarNombre(nuevo.cliente) !== normalizarNombre(escrito.cliente) || normalizarNombre(nuevo.tecnico) !== normalizarNombre(escrito.tecnico)
    || Number(nuevo.apc) !== Number(escrito.apc) || Number(nuevo.upc) !== Number(escrito.upc) || Number(nuevo.dropMetros) !== Number(escrito.dropMetros);
}

// Al reenviar una orden que ya se había enviado con otros datos, lo anterior no puede quedarse en el almacén: el equipo del serial viejo (que sigue "Instalado" a este cliente) vuelve a
// "Con Técnico" y el material del registro viejo se devuelve con un registro de corrección (sus reglas solo dejan crear registros, no cambiarlos) y su línea de auditoría.
// Va en el mismo commit que el envío nuevo. Un equipo que ya no figura instalado a este cliente (otra persona lo cambió) no se toca.
// Devuelve { escrituras, auditorias, nota }: la nota cuenta lo que se limpió (queda en el mensaje del envío).
async function limpiezaDelEnvioAnterior(env, ticketId, previo, p, escribeMaterial, fechaHora, ahoraMs) {
  const resultado = { escrituras: [], auditorias: [], nota: '' };
  if (!previo) return resultado;
  const notas = [];
  const acciones = [];

  if (previo.serial && previo.serial !== p.serial) {
    const equipo = await buscarEquipo(env, previo.serial, ahoraMs);
    const actual = equipo ? camposAObjeto(equipo.fields) : null;
    if (actual && normalizarNombre(actual.estado) === ESTADO_INSTALADO && normalizarNombre(actual.cliente) === normalizarNombre(previo.cliente)) {
      // Vuelve a como estaba antes de instalarse: se quitan el cliente y las fechas que puso el envío.
      resultado.escrituras.push({
        update: { name: equipo.name, fields: campos({ estado: 'Con Técnico' }) },
        updateMask: { fieldPaths: ['estado', 'cliente', 'fechaInstalacion', 'fechaHoraInstalacion'] },
        currentDocument: { exists: true },
      });
      notas.push(`se liberó el equipo ${previo.serial} (figuraba instalado a ${previo.cliente || 'este cliente'})`);
      acciones.push(`el equipo [${previo.serial}] vuelve a "Con Técnico"`);
    } else if (actual) {
      notas.push(`el equipo ${previo.serial} del envío anterior ya no figura instalado a ${previo.cliente || 'este cliente'}: revísalo en el almacén`);
    }
  }

  const habiaMaterial = previo.accion === ACCION_AVERIA || previo.apc > 0 || previo.upc > 0 || previo.dropMetros > 0;
  if (habiaMaterial && previo.finalizadoEn > 0) {
    const idViejo = idRegistro(ticketId, previo.finalizadoEn);
    const idNuevo = escribeMaterial ? idRegistro(ticketId, p.finalizadoEn) : null;
    // Con el mismo id el envío nuevo sobrescribe al viejo; con otro (la orden se volvió a finalizar) el viejo seguiría descontando: se devuelve.
    if (idViejo !== idNuevo) {
      const id = idCorreccion(idViejo);
      const dropKm = Math.abs(previo.dropMetros) / 1000;
      resultado.escrituras.push({
        update: {
          name: `projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents/${rutaTelecom(env)}/materialLogs/${id}`,
          fields: { id: { doubleValue: id }, ...campos({
            fecha: fechaHora.slice(0, 10), fechaHora, tecnico: previo.tecnico,
            apc: Math.abs(previo.apc), upc: Math.abs(previo.upc), drop: dropKm,
            grapas: 'Corrección',
            cliente: `${previo.cliente} (Corrección: se devuelve el material del envío anterior de ${p.codigo || 'la orden'})`,
          }) },
        },
        currentDocument: { exists: false },
      });
      notas.push('se devolvió el material del envío anterior');
      acciones.push(`se devuelve el material del registro ${idViejo} (${Math.abs(previo.apc)} APC, ${Math.abs(previo.upc)} UPC, ${Number(Math.abs(previo.dropMetros).toFixed(2))}m Drop)`);
    }
  }

  if (acciones.length > 0) {
    const id = idCorreccion(idRegistro(ticketId, previo.finalizadoEn));
    resultado.auditorias.push({
      update: {
        name: `projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents/${rutaTelecom(env)}/auditLogs/${id}`,
        fields: { id: { doubleValue: id }, ...campos({ fechaHora, usuario: USUARIO_AUDITORIA, accion: 'Corrección de envío', detalle: `CORRECCIÓN DE ENVÍO: la orden ${p.codigo || 'S/C'} de '${p.cliente}' se reenvió con otros datos: ${acciones.join('; ')}.` }) },
      },
    });
  }
  resultado.nota = notas.length > 0 ? `${notas.join('; ').replace(/^./, (c) => c.toUpperCase())}.` : '';
  return resultado;
}

// Envía una orden. Devuelve { estado, mensaje }; si no se pudo llegar al otro sistema, lanza el error (queda PENDIENTE).
// `previo`: lo que ya quedó escrito en el almacén por esta orden (escritoDe), si se envió antes: se limpia en el mismo commit.
export async function enviarAlInventario(env, ticketId, orden, ahoraMs = Date.now(), previo = null) {
  // Una avería (recableado o conector interno) solo lleva equipo si se combinó con un cambio de equipo y trae el serial del equipo nuevo.
  const conEquipo = orden.accion !== ACCION_AVERIA || Boolean(orden.serial);
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
    // Un equipo que ya figura instalado a este cliente (un reenvío) no se vuelve a escribir: su sistema puede rechazar reescribir lo que ya está.
    if (estadoActual !== ESTADO_INSTALADO) {
      escrituras.push({
        update: { name: equipo.name, fields: campos({ estado: 'Instalado', cliente: p.cliente, fechaInstalacion: fecha, fechaHoraInstalacion: fechaHora }) },
        updateMask: { fieldPaths: ['estado', 'cliente', 'fechaInstalacion', 'fechaHoraInstalacion'] },
        currentDocument: { exists: true },
      });
    }
  }

  // Material usado, en negativo como lo guarda su sistema (el drop en km). En una instalación o un cambio de equipo solo
  // se registra si hubo material; una avería siempre lleva su registro, con el motivo pegado al nombre del cliente.
  const dropKm = Math.abs(p.dropMetros) / 1000;
  const escribeMaterial = p.accion === ACCION_AVERIA || !conEquipo || p.apc > 0 || p.upc > 0 || dropKm > 0;
  if (escribeMaterial) {
    const id = idRegistro(ticketId, p.finalizadoEn);
    const registro = {
      fecha, fechaHora, tecnico: p.tecnico,
      apc: -Math.abs(p.apc), upc: -Math.abs(p.upc), drop: -dropKm,
      grapas: p.accion === ACCION_AVERIA ? 'Avería' : p.accion === ACCION_INSTALACION ? 'Instalación Nueva' : 'Cambio de Equipo',
      ...(conEquipo ? { equipoSerial: p.serial } : {}),
      cliente: p.accion === ACCION_AVERIA && p.motivo ? `${p.cliente} (Incidente: ${p.motivo})` : p.cliente,
    };
    // Un registro que ya está escrito con lo mismo (un reenvío) no se vuelve a escribir: su sistema solo deja crear registros, y reescribir uno existente lo rechaza (403) y frena todo el envío.
    const escrito = await leerRegistroMaterial(env, id, ahoraMs);
    const igual = escrito && ['apc', 'upc', 'drop'].every((k) => Math.abs(Number(escrito[k]) - registro[k]) < 1e-9) && String(escrito.tecnico) === registro.tecnico && String(escrito.cliente) === registro.cliente;
    if (!igual) escrituras.push({ update: { name: `projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents/${rutaTelecom(env)}/materialLogs/${id}`, fields: { id: { doubleValue: id }, ...campos(registro) } } });
  }

  // Su historial de auditoría: una línea por orden enviada, aunque no hubiera material (el cambio de equipo no gasta). Va en el
  // mismo commit que el resto; si sus reglas no nos dejan escribirla (403), el descuento del inventario no se frena por eso.
  const limpieza = await limpiezaDelEnvioAnterior(env, ticketId, previo, p, escribeMaterial, fechaHora, ahoraMs);
  escrituras.push(...limpieza.escrituras);
  const auditorias = [escrituraAuditoria(env, ticketId, p, fechaHora), ...limpieza.auditorias];
  const url = `${docsTelecom(env)}:commit`;
  try {
    await llamarTelecom(env, url, { writes: [...escrituras, ...auditorias] }, ahoraMs);
  } catch (err) {
    if (!String(err.message).includes(' 403:')) throw err;
    console.error(`No se pudo escribir la auditoría de ${ticketId}; se envía sin ella:`, err);
    await llamarTelecom(env, url, { writes: escrituras }, ahoraMs);
  }
  return { estado: ESTADO_ENVIADO, mensaje: limpieza.nota };
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
  const previo = escritoDe(existente);
  try {
    ({ estado, mensaje } = await enviarAlInventario(env, ticketId, p, ahoraMs, previo));
  } catch (err) {
    console.error(`Envío al inventario de ${ticketId} falló (intento ${intentos}):`, err);
    estado = intentos >= MAX_INTENTOS ? 'ERROR' : ESTADO_PENDIENTE;
    mensaje = String(err.message || err).slice(0, 200);
  }
  const datos = {
    ticketId, estado, mensaje, intentos, ...camposPayload(p),
    creadoEn: existente?.creadoEn || ahoraMs, actualizadoEn: ahoraMs,
    ...(estado === ESTADO_ENVIADO ? { enviadoEn: ahoraMs, ...camposEscrito(p) } : previo ? camposEscrito(previo) : {}),
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

// `enviar`: quien aprueba o finaliza órdenes (ADMIN, USUARIO o con permiso de cierre). `gestionar`: los usuarios del módulo (todo ADMIN y la
// lista de utils/accesoInventario). `vincular`: quien elige el nombre de cada técnico en el inventario (solo la lista, no cualquier ADMIN).
async function permisos(env, deps, accessToken, uid) {
  const perfil = await deps.getUserDoc(env, accessToken, uid);
  if (!perfil || perfil.fields?.disabled?.booleanValue === true) return { enviar: false, gestionar: false, vincular: false };
  const rol = perfil.fields?.role?.stringValue;
  const username = perfil.fields?.username?.stringValue;
  const aprueba = rol === 'ADMIN' || rol === 'USUARIO' || perfil.fields?.puedeCerrar?.booleanValue === true;
  return { enviar: aprueba, gestionar: veEnviosInventario(username, rol), vincular: vinculaTecnicosInventario(username) };
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
    // Una orden ya ENVIADA que se aprueba otra vez (se devolvió, se corrigió y se volvió a finalizar): si lo que dice ahora es distinto de lo que quedó escrito en el almacén (otro serial, otro
    // material, otro cliente o técnico), se corrige allá solo, igual que al reenviar; si no cambió nada, no se toca. Reintentar una ENVIADA sigue sin hacer nada.
    let aEnviar = null;
    if (existente?.estado === ESTADO_ENVIADO && !reenvio) {
      if (reintento) return json({ estado: ESTADO_ENVIADO, repetido: true }, 200, headers);
      aEnviar = await payloadAEnviar(env, deps, accessToken, ticketId, existente, false);
      if (!aEnviar.payload || !distintoDeLoEscrito(camposPayloadDe(aEnviar.payload), escritoDe(existente))) return json({ estado: ESTADO_ENVIADO, repetido: true }, 200, headers);
    }
    const corrige = Boolean(aEnviar);

    if (reintento && !existente) return new Response('No hay un envío para reintentar.', { status: 404, headers });
    // Se envía lo que dice la orden ahora; solo si ya se archivó, reintentar usa lo que quedó guardado.
    aEnviar = aEnviar || await payloadAEnviar(env, deps, accessToken, ticketId, existente, reintento);
    if (aEnviar.archivada) return new Response('Orden no encontrada.', { status: 404, headers });
    if (aEnviar.omitir) {
      if (existente && !reenvio) await borrarEnvio(env, deps, accessToken, ticketId);
      return json({ estado: 'OMITIDO' }, 200, headers);
    }
    const payload = aEnviar.payload;
    const resultado = await procesar(env, deps, accessToken, ticketId, camposPayloadDe(payload), reintento || corrige ? { ...existente, intentos: 0 } : existente, ahoraMs);
    return json(resultado, 200, headers);
  } catch (err) {
    console.error(err);
    return new Response('No se pudo procesar el envío al inventario.', { status: 500, headers });
  }
}

//   POST /inventario/tecnicos   la lista de técnicos del inventario, para elegir con cuál se corresponde cada técnico de la app
//                               (solo los usuarios de USUARIOS_INVENTARIO: es parte de elegir el nombre de cada técnico, no de gestionar los envíos)
export async function listarTecnicosInventario(env, headers, uid, deps, ahoraMs = Date.now()) {
  try {
    const accessToken = await deps.getGoogleAccessToken(env);
    if (!(await permisos(env, deps, accessToken, uid)).vincular) return new Response('Sin permiso.', { status: 403, headers });
    if (!inventarioActivo(env)) return json({ estado: 'DESHABILITADO', tecnicos: [] }, 200, headers);
    return json({ tecnicos: (await leerTecnicosTelecom(env, ahoraMs)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) }, 200, headers);
  } catch (err) {
    console.error(err);
    return new Response('No se pudo leer la lista de técnicos del inventario.', { status: 500, headers });
  }
}

// --- Liberar un equipo que quedó "Instalado" por un envío anterior ---

// El serial que una orden dejó escrito en el almacén (el de su último envío correcto), o '' si no tiene.
const serialEscrito = (o) => o.escritoSerial || (o.estado === ESTADO_ENVIADO ? String(o.serial || '') : '');

async function documentoTelecomExiste(env, coleccion, id, ahoraMs) {
  try {
    await llamarTelecom(env, `${docsTelecom(env)}/${rutaTelecom(env)}/${coleccion}/${id}`, null, ahoraMs);
    return true;
  } catch (err) {
    if (String(err.message).includes(' 404:')) return false;
    throw err;
  }
}

// Los registros de material que llevan el serial de un equipo (el material de una instalación guarda el serial instalado).
async function registrosDeMaterialDelEquipo(env, serial, ahoraMs) {
  const filas = await llamarTelecom(env, `${docsTelecom(env)}/${rutaTelecom(env)}:runQuery`, {
    structuredQuery: { from: [{ collectionId: 'materialLogs' }], where: { fieldFilter: { field: { fieldPath: 'equipoSerial' }, op: 'EQUAL', value: { stringValue: serial } } }, limit: 20 },
  }, ahoraMs);
  return filas.filter((f) => f.document).map((f) => ({ ...camposAObjeto(f.document.fields), id: f.document.name.split('/').pop() }));
}

//   POST /inventario/liberar { ticketId }   para una orden con la alerta "Ya instalado": el equipo figura instalado a otro cliente porque un envío anterior de ESA orden (que después se corrigió a otro
//                                           serial) lo dejó así. Antes de tocar nada se comprueba que el otro cliente tiene un envío nuestro ya enviado con OTRO serial (y ninguno con este): si no se puede
//                                           comprobar, no se escribe nada. Si se comprueba, en un solo commit el equipo vuelve a "Con Técnico" (sin cliente ni fechas), el material de los registros viejos que
//                                           llevan ese serial y ese cliente se devuelve con registros de corrección (solo crear, nunca modificar) y queda una línea de auditoría; luego se reintenta la orden.
export async function liberarEquipoInventario(request, env, headers, uid, deps, ahoraMs = Date.now()) {
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
    const noLiberado = (mensaje) => json({ estado: 'NO_LIBERADO', mensaje }, 200, headers);

    if (existente.estado !== 'SERIAL_YA_INSTALADO') return noLiberado('Esta orden ya no tiene la alerta de equipo instalado a otro cliente. Usa Reintentar.');
    const serial = String(existente.serial || '');
    const equipo = serial ? await buscarEquipo(env, serial, ahoraMs) : null;
    if (!equipo) return noLiberado('El serial no existe en el inventario del almacén.');
    const actual = camposAObjeto(equipo.fields);
    if (normalizarNombre(actual.estado) !== ESTADO_INSTALADO) return noLiberado('El equipo ya no figura instalado: usa Reintentar.');
    if (normalizarNombre(actual.cliente) === normalizarNombre(existente.cliente)) return noLiberado('El equipo figura instalado a este mismo cliente: usa Reintentar.');
    const clienteActual = String(actual.cliente || '').trim();
    if (!clienteActual) return noLiberado('El equipo figura instalado sin cliente: revísalo en el almacén.');

    // La prueba de que es un resto: el cliente que figura tiene una orden nuestra ya enviada con otro serial, y ninguna con este.
    const otros = (await deps.runQuery(env, accessToken, 'cliente', 'EQUAL', { stringValue: clienteActual }, 'telecomEnvios'))
      .map((d) => ({ id: d.name.split('/').pop(), ...camposAObjeto(d.fields) }))
      .filter((o) => o.id !== ticketId);
    const delCliente = otros.filter((o) => o.estado === ESTADO_ENVIADO && o.accion !== ACCION_AVERIA && serialEscrito(o));
    if (delCliente.some((o) => serialEscrito(o) === serial)) return noLiberado(`El equipo es de ${clienteActual}: su orden ${delCliente.find((o) => serialEscrito(o) === serial).codigo || 's/c'} se envió con ese serial. No se libera.`);
    if (delCliente.length === 0) return noLiberado(`El equipo figura con ${clienteActual}, pero no encuentro una orden suya ya enviada con otro serial que lo explique, así que no puedo comprobar que sea un resto de un envío anterior. Revísalo en el almacén antes de liberarlo.`);
    const propia = delCliente[0];

    const { fecha, fechaHora } = fechaHoraCaracas(ahoraMs);
    const escrituras = [{
      update: { name: equipo.name, fields: campos({ estado: 'Con Técnico' }) },
      updateMask: { fieldPaths: ['estado', 'cliente', 'fechaInstalacion', 'fechaHoraInstalacion'] },
      currentDocument: { exists: true },
    }];
    const registros = (await registrosDeMaterialDelEquipo(env, serial, ahoraMs))
      .filter((l) => normalizarNombre(l.cliente) === normalizarNombre(clienteActual) && (Number(l.apc) < 0 || Number(l.upc) < 0 || Number(l.drop) < 0));
    let devueltos = 0;
    for (const registro of registros) {
      const id = idCorreccion(registro.id);
      if (await documentoTelecomExiste(env, 'materialLogs', id, ahoraMs)) continue;
      escrituras.push({
        update: {
          name: `projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents/${rutaTelecom(env)}/materialLogs/${id}`,
          fields: { id: { doubleValue: id }, ...campos({
            fecha, fechaHora, tecnico: String(registro.tecnico || ''),
            apc: Math.abs(Number(registro.apc) || 0), upc: Math.abs(Number(registro.upc) || 0), drop: Math.abs(Number(registro.drop) || 0),
            grapas: 'Corrección',
            cliente: `${registro.cliente} (Corrección: se devuelve el material de un envío anterior; el equipo ${serial} pasa a ${existente.cliente})`,
          }) },
        },
        currentDocument: { exists: false },
      });
      devueltos++;
    }

    const idAuditoria = idRegistro(`${ticketId}:liberar`, ahoraMs);
    const auditoria = {
      update: {
        name: `projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents/${rutaTelecom(env)}/auditLogs/${idAuditoria}`,
        fields: { id: { doubleValue: idAuditoria }, ...campos({ fechaHora, usuario: USUARIO_AUDITORIA, accion: 'Corrección de envío', detalle: `CORRECCIÓN DE ENVÍO: el equipo [${serial}] figuraba instalado a '${clienteActual}' por un envío anterior (su orden ${propia.codigo || 'S/C'} se envió después con el serial [${serialEscrito(propia)}]); vuelve a "Con Técnico" para la orden ${existente.codigo || 'S/C'} de '${existente.cliente}'.${devueltos > 0 ? ` Se devuelve el material de ${devueltos} registro${devueltos === 1 ? '' : 's'}.` : ''}` }) },
      },
    };
    const url = `${docsTelecom(env)}:commit`;
    try {
      await llamarTelecom(env, url, { writes: [...escrituras, auditoria] }, ahoraMs);
    } catch (err) {
      if (!String(err.message).includes(' 403:')) throw err;
      console.error(`No se pudo escribir la auditoría de la liberación de ${ticketId}; se libera sin ella:`, err);
      await llamarTelecom(env, url, { writes: escrituras }, ahoraMs);
    }
    const nota = `Se liberó el equipo ${serial} (figuraba con ${clienteActual})${devueltos > 0 ? ` y se devolvió el material de ${devueltos} registro${devueltos === 1 ? '' : 's'}` : ''}.`;

    // Ya liberado, se reintenta la orden con lo que dice ahora.
    const aEnviar = await payloadAEnviar(env, deps, accessToken, ticketId, existente, true);
    if (!aEnviar.payload) return json({ estado: 'LIBERADO', mensaje: `${nota} La orden ya no tiene nada que enviar.`, liberado: serial, devueltos }, 200, headers);
    const resultado = await procesar(env, deps, accessToken, ticketId, camposPayloadDe(aEnviar.payload), { ...existente, intentos: 0 }, ahoraMs);
    return json({ estado: resultado.estado, mensaje: resultado.estado === ESTADO_ENVIADO ? nota : `${nota} ${resultado.mensaje}`.trim(), liberado: serial, devueltos }, 200, headers);
  } catch (err) {
    console.error(err);
    return new Response('No se pudo liberar el equipo.', { status: 500, headers });
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
