// Corrige en el inventario del otro sistema lo que se envió con el nombre corto del técnico ("EDGAR") en vez del que ese
// inventario tiene en su lista de técnicos ("EDGAR MONTERO"): su pantalla suma el stock de cada técnico por nombre, así que
// esos descuentos caen en una cuenta que nadie ve. Cambia solo el campo `tecnico` de los registros de materialLogs, y el
// "Téc: '...'" del detalle de las líneas de auditLogs que escribió "Usuario Asignaciones".
//
// Un nombre corto se corrige solo si coincide con la PRIMERA palabra de uno solo de los técnicos de la lista; si coincide con
// varios (dos "JOSE") se deja como está y se avisa. Por defecto NO escribe nada: solo cuenta y lista. Con --aplicar guarda.
// Antes de aplicar se guarda un respaldo con los documentos tal como están (--respaldo=archivo.json, obligatorio con --aplicar;
// guárdalo fuera del repo: lleva nombres de clientes). Con --restaurar=archivo.json se devuelven esos documentos a como estaban.
// Uso (los datos de acceso al inventario del otro sistema):
//   set TELECOM_EMAIL=...&& set TELECOM_PASSWORD=...&& set TELECOM_API_KEY=...&& set TELECOM_PROJECT_ID=almaceninventario&& set TELECOM_APP_ID=app-telecom
//   node scripts/corregir-tecnico-inventario.mjs --respaldo=ARCHIVO.json            (guarda el respaldo, no cambia nada)
//   node scripts/corregir-tecnico-inventario.mjs --respaldo=ARCHIVO.json --aplicar
//   node scripts/corregir-tecnico-inventario.mjs --restaurar=ARCHIVO.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const aplicar = process.argv.includes('--aplicar');
const archivoRespaldo = process.argv.find((a) => a.startsWith('--respaldo='))?.slice('--respaldo='.length);
const archivoRestaurar = process.argv.find((a) => a.startsWith('--restaurar='))?.slice('--restaurar='.length);
if (aplicar && !archivoRespaldo) { console.error('Para aplicar hace falta --respaldo=archivo.json (se guarda antes de escribir).'); process.exit(1); }
const env = Object.fromEntries(['TELECOM_EMAIL', 'TELECOM_PASSWORD', 'TELECOM_API_KEY', 'TELECOM_PROJECT_ID', 'TELECOM_APP_ID'].map((k) => [k, process.env[k]]));
const faltan = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
if (faltan.length) { console.error(`Faltan estas variables: ${faltan.join(', ')}.`); process.exit(1); }

const sesion = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.TELECOM_API_KEY)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.TELECOM_EMAIL, password: env.TELECOM_PASSWORD, returnSecureToken: true }),
})).json();
if (!sesion.idToken) { console.error(`No se pudo iniciar sesión en el inventario (${sesion.error?.message || 'sin detalle'}).`); process.exit(1); }

const docs = `https://firestore.googleapis.com/v1/projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents`;
const ruta = `artifacts/${env.TELECOM_APP_ID}/public/data`;
const cabeceras = { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.idToken}` };
const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

// Restaurar: devuelve a cada documento el valor que tenía en el respaldo (solo ese campo).
if (archivoRestaurar) {
  const { documentos } = JSON.parse(readFileSync(archivoRestaurar, 'utf8'));
  let hechas = 0;
  for (const d of documentos) {
    const res = await fetch(`${docs}:commit`, {
      method: 'POST', headers: cabeceras,
      body: JSON.stringify({ writes: [{ update: { name: d.name, fields: d.original }, updateMask: { fieldPaths: [d.campoCorregido] }, currentDocument: { exists: true } }] }),
    });
    if (res.ok) hechas++; else console.error(`  ${d.name.split('/').pop()}: ${res.status}`);
  }
  console.log(`Restauradas: ${hechas} de ${documentos.length}.`);
  process.exit(0);
}

const lista = await (await fetch(`${docs}/${ruta}/tecnicos?pageSize=300`, { headers: cabeceras })).json();
const oficiales = (lista.documents || []).map((d) => d.fields?.nombre?.stringValue).filter(Boolean);
console.log(`Técnicos del inventario: ${oficiales.join(', ')}.`);
const nombreOficial = (corto) => {
  const c = norm(corto);
  if (oficiales.some((o) => norm(o) === c)) return null; // ya está bien escrito
  const posibles = oficiales.filter((o) => norm(o).split(' ')[0] === c);
  return posibles.length === 1 ? posibles[0] : undefined; // undefined: no se puede decidir
};

async function consulta(coleccion, campo, valor) {
  const res = await fetch(`${docs}/${ruta}:runQuery`, {
    method: 'POST', headers: cabeceras,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: coleccion }], where: { fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: { stringValue: valor } } }, limit: 1000 } }),
  });
  return (await res.json()).filter((x) => x.document).map((x) => x.document);
}

// 1) materialLogs: todos los nombres distintos que hay y no están en la lista
const todos = [];
let pagina = '';
do {
  const r = await (await fetch(`${docs}/${ruta}/materialLogs?pageSize=300&mask.fieldPaths=tecnico${pagina ? `&pageToken=${pagina}` : ''}`, { headers: cabeceras })).json();
  todos.push(...(r.documents || []));
  pagina = r.nextPageToken || '';
} while (pagina);
const nombresEnUso = [...new Set(todos.map((d) => d.fields?.tecnico?.stringValue).filter(Boolean))];
const porCorregir = [];
for (const nombre of nombresEnUso) {
  const destino = nombreOficial(nombre);
  if (destino === null) continue;
  if (destino === undefined) { console.log(`  "${nombre}": no coincide con un solo técnico de la lista, se deja como está.`); continue; }
  const registros = todos.filter((d) => d.fields?.tecnico?.stringValue === nombre);
  console.log(`  "${nombre}" -> "${destino}": ${registros.length} registro(s) de material.`);
  porCorregir.push(...registros.map((d) => ({ coleccion: 'materialLogs', name: d.name, campos: { tecnico: { stringValue: destino } }, mascara: ['tecnico'], original: { tecnico: d.fields.tecnico } })));
  // 2) su línea de auditoría: el detalle con "Téc: 'EDGAR'"
  for (const a of (await consulta('auditLogs', 'usuario', 'Usuario Asignaciones')).filter((x) => String(x.fields?.detalle?.stringValue || '').includes(`Téc: '${nombre}'`))) {
    porCorregir.push({ coleccion: 'auditLogs', name: a.name, campos: { detalle: { stringValue: a.fields.detalle.stringValue.replace(`Téc: '${nombre}'`, `Téc: '${destino}'`) } }, mascara: ['detalle'], original: { detalle: a.fields.detalle } });
  }
}
const resumen = (c) => porCorregir.filter((x) => x.coleccion === c).length;
console.log(`\nPor corregir: ${resumen('materialLogs')} registro(s) de material y ${resumen('auditLogs')} línea(s) de auditoría.`);
if (!porCorregir.length) process.exit(0);

// Respaldo: el documento completo de cada registro que se va a tocar, tal como está ahora.
if (archivoRespaldo) {
  if (existsSync(archivoRespaldo)) { console.error(`${archivoRespaldo} ya existe: no se pisa. Elige otro nombre.`); process.exit(1); }
  const completos = [];
  for (const c of porCorregir) {
    const res = await fetch(`https://firestore.googleapis.com/v1/${c.name}`, { headers: cabeceras });
    if (!res.ok) { console.error(`No se pudo leer ${c.name} para el respaldo (${res.status}). No se escribió nada.`); process.exit(1); }
    completos.push({ coleccion: c.coleccion, ...(await res.json()), campoCorregido: c.mascara[0], original: c.original, corregido: c.campos });
  }
  writeFileSync(archivoRespaldo, JSON.stringify({ creadoEn: new Date().toISOString(), proyecto: env.TELECOM_PROJECT_ID, documentos: completos }, null, 1));
  console.log(`Respaldo guardado: ${completos.length} documentos en ${archivoRespaldo}.`);
}
if (!aplicar) {
  console.log('No se escribió nada. Corre de nuevo con --aplicar para guardar.');
  process.exit(0);
}

// Una por una, solo ese campo y solo si el documento existe: si sus reglas no dejan modificar una colección se ve cuál.
let hechas = 0;
for (const c of porCorregir) {
  const res = await fetch(`${docs}:commit`, {
    method: 'POST', headers: cabeceras,
    body: JSON.stringify({ writes: [{ update: { name: c.name, fields: c.campos }, updateMask: { fieldPaths: c.mascara }, currentDocument: { exists: true } }] }),
  });
  if (res.ok) { hechas++; continue; }
  console.error(`  ${c.coleccion}/${c.name.split('/').pop()}: ${res.status} ${(await res.json().catch(() => ({})))?.error?.status || ''}`);
}
console.log(`Corregidas: ${hechas} de ${porCorregir.length}.`);
