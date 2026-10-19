// Corrige con asientos compensatorios lo que se envió al inventario con el nombre corto del técnico ("EDGAR") en vez del que tiene
// su lista de técnicos ("EDGAR MONTERO"), para cuando las reglas del otro sistema no dejan modificar registros (solo crear).
// Por cada registro de materialLogs con nombre corto crea, en un solo commit (todo o nada):
//   1. un registro con el nombre corto y las cantidades al revés (devuelve el material a esa cuenta, que queda en cero),
//   2. una copia del registro original con el nombre completo (descuenta el material al técnico correcto), y
//   3. una línea en auditLogs que explica la corrección.
// El original no se toca. Los ids salen del original (el mismo número con el milisegundo siguiente), así que correrlo dos veces no
// duplica nada: lo que ya existe se salta. El nombre corto se corrige solo si coincide con la PRIMERA palabra de uno solo de los
// técnicos de la lista. Por defecto NO escribe nada, solo lista; con --aplicar escribe. Con --registro=ARCHIVO.json guarda lo creado.
// Uso: igual que scripts/corregir-tecnico-inventario.mjs (TELECOM_EMAIL, TELECOM_PASSWORD, TELECOM_API_KEY, TELECOM_PROJECT_ID, TELECOM_APP_ID).
import { writeFileSync } from 'node:fs';

const aplicar = process.argv.includes('--aplicar');
const archivoRegistro = process.argv.find((a) => a.startsWith('--registro='))?.slice('--registro='.length);
const env = Object.fromEntries(['TELECOM_EMAIL', 'TELECOM_PASSWORD', 'TELECOM_API_KEY', 'TELECOM_PROJECT_ID', 'TELECOM_APP_ID'].map((k) => [k, process.env[k]]));
const faltan = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
if (faltan.length) { console.error(`Faltan estas variables: ${faltan.join(', ')}.`); process.exit(1); }

const sesion = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.TELECOM_API_KEY)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.TELECOM_EMAIL, password: env.TELECOM_PASSWORD, returnSecureToken: true }),
})).json();
if (!sesion.idToken) { console.error(`No se pudo iniciar sesión en el inventario (${sesion.error?.message || 'sin detalle'}).`); process.exit(1); }

const raiz = `projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents`;
const ruta = `artifacts/${env.TELECOM_APP_ID}/public/data`;
const cabeceras = { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.idToken}` };
const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

const lista = await (await fetch(`https://firestore.googleapis.com/v1/${raiz}/${ruta}/tecnicos?pageSize=300`, { headers: cabeceras })).json();
const oficiales = (lista.documents || []).map((d) => d.fields?.nombre?.stringValue).filter(Boolean);
const nombreOficial = (corto) => {
  const c = norm(corto);
  if (oficiales.some((o) => norm(o) === c)) return null;
  const posibles = oficiales.filter((o) => norm(o).split(' ')[0] === c);
  return posibles.length === 1 ? posibles[0] : undefined;
};

// Todos los registros de material, para saber qué nombres hay y cuáles ya tienen su compensación.
const registros = [];
let pagina = '';
do {
  const r = await (await fetch(`https://firestore.googleapis.com/v1/${raiz}/${ruta}/materialLogs?pageSize=300${pagina ? `&pageToken=${pagina}` : ''}`, { headers: cabeceras })).json();
  registros.push(...(r.documents || []));
  pagina = r.nextPageToken || '';
} while (pagina);
const idDe = (d) => d.name.split('/').pop();
const ids = new Set(registros.map(idDe));

// El mismo id con el milisegundo siguiente (la parte decimal se conserva): 1792104027992.509 -> 1792104027993.509
const idSiguiente = (id, suma) => { const [entero, decimal] = id.split('.'); return `${Number(entero) + suma}${decimal ? `.${decimal}` : ''}`; };

// Un número de Firestore al revés, conservando su tipo; el cero queda como está.
const alReves = (v) => {
  if ('integerValue' in v) return Number(v.integerValue) === 0 ? v : { integerValue: String(-Number(v.integerValue)) };
  if ('doubleValue' in v) return v.doubleValue === 0 ? v : { doubleValue: -v.doubleValue };
  return v;
};
const cantidad = (v) => Number(v?.integerValue ?? v?.doubleValue ?? 0);

const { fechaHora } = (() => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { fechaHora: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}` };
})();

const trabajos = [];
for (const d of registros) {
  const corto = d.fields?.tecnico?.stringValue;
  const destino = corto ? nombreOficial(corto) : null;
  if (!destino) continue;
  const id = idDe(d);
  const idReverso = idSiguiente(id, 1);
  const idCopia = idSiguiente(id, 2);
  if (ids.has(idReverso) || ids.has(idCopia)) continue; // ya se compensó
  const f = d.fields;
  const cliente = f.cliente?.stringValue || '';
  const nuevoId = (valor) => ({ doubleValue: Number(valor) });
  const { equipoSerial, ...sinSerial } = f; // el registro de devolución no repite el serial del equipo
  const reverso = {
    ...sinSerial,
    id: nuevoId(idReverso), tecnico: { stringValue: corto },
    apc: alReves(f.apc), upc: alReves(f.upc), drop: alReves(f.drop),
    cliente: { stringValue: `${cliente} (Corrección de nombre: se devuelve a ${corto})` },
  };
  const copia = { ...f, id: nuevoId(idCopia), tecnico: { stringValue: destino } };
  const apc = Math.abs(cantidad(f.apc));
  const upc = Math.abs(cantidad(f.upc));
  const metros = Math.round(Math.abs(cantidad(f.drop)) * 1000);
  const auditoria = {
    id: nuevoId(idReverso),
    fechaHora: { stringValue: fechaHora },
    usuario: { stringValue: 'Usuario Asignaciones' },
    accion: { stringValue: 'Corrección de técnico' },
    detalle: { stringValue: `CORRECCIÓN DE TÉCNICO: el material de '${cliente}' (${apc} APC, ${upc} UPC, ${metros}m Drop; registro ${id}) se registró a nombre de '${corto}' y pasa a '${destino}'.` },
  };
  const doc = (coleccion, idDoc, fields) => ({ update: { name: `${raiz}/${ruta}/${coleccion}/${idDoc}`, fields }, currentDocument: { exists: false } });
  trabajos.push({ id, corto, destino, cliente, fechaHora: f.fechaHora?.stringValue, escrituras: [doc('materialLogs', idReverso, reverso), doc('materialLogs', idCopia, copia), doc('auditLogs', idReverso, auditoria)], creados: { materialLogs: [idReverso, idCopia], auditLogs: [idReverso] } });
}

const porTecnico = {};
for (const t of trabajos) porTecnico[`${t.corto} -> ${t.destino}`] = (porTecnico[`${t.corto} -> ${t.destino}`] || 0) + 1;
console.log(`Por compensar: ${trabajos.length} registro(s) de material.`);
for (const [k, n] of Object.entries(porTecnico)) console.log(`  ${k}: ${n}`);
for (const t of trabajos) console.log(`  ${t.fechaHora}  ${t.corto} -> ${t.destino}  ${t.cliente}`);
if (!trabajos.length) process.exit(0);
if (!aplicar) {
  console.log('\nNo se escribió nada. Corre de nuevo con --aplicar para crear las compensaciones.');
  process.exit(0);
}

let hechos = 0;
const creados = [];
for (const t of trabajos) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${raiz}:commit`, { method: 'POST', headers: cabeceras, body: JSON.stringify({ writes: t.escrituras }) });
  if (res.ok) { hechos++; creados.push({ original: t.id, ...t.creados }); continue; }
  console.error(`  ${t.id} (${t.cliente}): ${res.status} ${(await res.json().catch(() => ({})))?.error?.status || ''}`);
}
console.log(`Compensados: ${hechos} de ${trabajos.length}.`);
if (archivoRegistro) {
  writeFileSync(archivoRegistro, JSON.stringify({ creadoEn: new Date().toISOString(), creados }, null, 1));
  console.log(`Registro de lo creado: ${archivoRegistro}.`);
}
