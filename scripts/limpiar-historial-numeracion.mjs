// Quita del historial de las órdenes las líneas repetidas "Cód: X | Venta cargada por ..., asignada a ...". Antes, cada sesión
// de la oficina que veía una venta de promotora sin número intentaba numerarla y todas dejaban su línea, aunque solo una
// puso el número. Se conserva la primera línea de cada texto (la que numeró) y se borran las repetidas; ninguna otra línea
// del historial se toca. Revisa `tickets` y `historialInstalaciones`.
//
// Por defecto NO escribe nada: solo cuenta y lista. Con --aplicar guarda, y entonces hace falta --respaldo=archivo.json (se
// guarda antes de escribir, fuera del repo: lleva nombres de clientes). Con --restaurar=archivo.json se devuelve el historial
// de esas órdenes a como estaba.
// Acceso: la sesión de Firebase CLI de esta computadora (firebase login); no hace falta ninguna llave.
// Uso:
//   node scripts/limpiar-historial-numeracion.mjs
//   node scripts/limpiar-historial-numeracion.mjs --respaldo=ARCHIVO.json --aplicar
//   node scripts/limpiar-historial-numeracion.mjs --restaurar=ARCHIVO.json
// Opcional: APP_ID (por defecto "default-app-id").
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

const aplicar = process.argv.includes('--aplicar');
const archivoRespaldo = process.argv.find((a) => a.startsWith('--respaldo='))?.slice('--respaldo='.length);
const archivoRestaurar = process.argv.find((a) => a.startsWith('--restaurar='))?.slice('--restaurar='.length);
if (aplicar && !archivoRespaldo) { console.error('Para aplicar hace falta --respaldo=archivo.json (se guarda antes de escribir).'); process.exit(1); }

const config = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'));
const refresco = config.tokens?.refresh_token;
if (!refresco) { console.error('No hay sesión de Firebase CLI: corre "firebase login".'); process.exit(1); }
const acceso = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: refresco,
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  }),
})).json();
if (!acceso.access_token) { console.error(`No se pudo renovar la sesión de Firebase CLI (${acceso.error || 'sin detalle'}).`); process.exit(1); }

const proyecto = 'seguimientons-f2026';
const docs = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents`;
const ruta = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;
const cabeceras = { 'Content-Type': 'application/json', Authorization: `Bearer ${acceso.access_token}` };

// Escribe solo el historial, y solo si el documento sigue como se leyó (si alguien lo editó en medio, se salta y se avisa).
async function escribirHistorial(name, historial, updateTime) {
  const res = await fetch(`${docs}:commit`, {
    method: 'POST', headers: cabeceras,
    body: JSON.stringify({ writes: [{ update: { name, fields: { historialEdiciones: historial } }, updateMask: { fieldPaths: ['historialEdiciones'] }, currentDocument: { updateTime } }] }),
  });
  if (!res.ok) console.error(`  ${name.split('/').slice(-2).join('/')}: ${res.status} ${(await res.json().catch(() => ({})))?.error?.status || ''}`);
  return res.ok;
}

if (archivoRestaurar) {
  const { documentos } = JSON.parse(readFileSync(archivoRestaurar, 'utf8'));
  let hechas = 0;
  for (const d of documentos) {
    const res = await fetch(`${docs}:commit`, {
      method: 'POST', headers: cabeceras,
      body: JSON.stringify({ writes: [{ update: { name: d.name, fields: { historialEdiciones: d.original } }, updateMask: { fieldPaths: ['historialEdiciones'] }, currentDocument: { exists: true } }] }),
    });
    if (res.ok) hechas++; else console.error(`  ${d.name.split('/').pop()}: ${res.status}`);
  }
  console.log(`Restauradas: ${hechas} de ${documentos.length}.`);
  process.exit(0);
}

const detalleDe = (e) => e.mapValue?.fields?.detalle?.stringValue || '';
const esLineaDeNumeracion = (e) => /\| Venta cargada por .+, asignada a /.test(detalleDe(e));

const porLimpiar = [];
for (const coleccion of ['tickets', 'historialInstalaciones']) {
  let pagina = '';
  do {
    const r = await (await fetch(`${docs}/${ruta}/${coleccion}?pageSize=300&mask.fieldPaths=historialEdiciones&mask.fieldPaths=codigo&mask.fieldPaths=nombre${pagina ? `&pageToken=${pagina}` : ''}`, { headers: cabeceras })).json();
    if (r.error) { console.error(`No se pudo leer ${coleccion}: ${r.error.message}`); process.exit(1); }
    for (const d of r.documents || []) {
      const lista = d.fields?.historialEdiciones?.arrayValue?.values || [];
      const vistas = new Set();
      const limpia = lista.filter((e) => {
        if (!esLineaDeNumeracion(e)) return true;
        if (vistas.has(detalleDe(e))) return false;
        vistas.add(detalleDe(e));
        return true;
      });
      if (limpia.length === lista.length) continue;
      porLimpiar.push({ coleccion, name: d.name, updateTime: d.updateTime, original: d.fields.historialEdiciones, limpio: { arrayValue: { values: limpia } }, quitadas: lista.length - limpia.length, etiqueta: `${d.fields.codigo?.stringValue || d.name.split('/').pop()} — ${d.fields.nombre?.stringValue || 'sin nombre'}` });
    }
    pagina = r.nextPageToken || '';
  } while (pagina);
}

for (const c of porLimpiar) console.log(`  ${c.coleccion}: ${c.etiqueta} — ${c.quitadas} línea(s) repetida(s).`);
console.log(`\nÓrdenes con líneas repetidas: ${porLimpiar.length}. Líneas por quitar: ${porLimpiar.reduce((n, c) => n + c.quitadas, 0)}.`);
if (!porLimpiar.length) process.exit(0);

if (archivoRespaldo) {
  if (existsSync(archivoRespaldo)) { console.error(`${archivoRespaldo} ya existe: no se pisa. Elige otro nombre.`); process.exit(1); }
  writeFileSync(archivoRespaldo, JSON.stringify({ creadoEn: new Date().toISOString(), proyecto, documentos: porLimpiar.map(({ coleccion, name, original }) => ({ coleccion, name, original })) }, null, 1));
  console.log(`Respaldo guardado: ${porLimpiar.length} documentos en ${archivoRespaldo}.`);
}
if (!aplicar) {
  console.log('No se escribió nada. Corre de nuevo con --aplicar para guardar.');
  process.exit(0);
}

let hechas = 0;
for (const c of porLimpiar) if (await escribirHistorial(c.name, c.limpio, c.updateTime)) hechas++;
console.log(`Limpiadas: ${hechas} de ${porLimpiar.length}.`);
