// Cambia el nombre de usuario (el @usuario de Usuarios) de una cuenta: el correo de acceso de Firebase Auth, el campo `username`
// del perfil y el campo `creado` de las órdenes que esa cuenta cargó (las reglas lo comparan con el `username` del perfil).
// La clave, el rol y el uid no cambian. Por defecto solo muestra qué haría; con --aplicar lo hace.
//
// Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/renombrar-usuario.mjs C:\ruta\a\llave.json usuario-viejo usuario-nuevo [--aplicar]
// Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { AUTH_EMAIL_DOMAIN } from '../src/constants.js';
import { normalizeUsername } from '../src/utils/authEmail.js';

const [llave, viejo, nuevo] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const aplicar = process.argv.includes('--aplicar');
if (!llave || !viejo || !nuevo) { console.error('Uso: node scripts/renombrar-usuario.mjs <llave.json> <usuario-viejo> <usuario-nuevo> [--aplicar]'); process.exit(1); }
if (normalizeUsername(nuevo) !== nuevo || !/^[a-z0-9._-]{3,}$/.test(nuevo)) { console.error(`"${nuevo}" no es un usuario válido: solo letras minúsculas sin tilde, números, punto, guion y guion bajo.`); process.exit(1); }

initializeApp({ credential: cert(JSON.parse(readFileSync(llave, 'utf8'))), projectId: 'seguimientons-f2026' });
const appId = process.env.APP_ID || 'default-app-id';
const db = getFirestore();
const auth = getAuth();
const usuarios = db.collection(`artifacts/${appId}/public/data/users`);

const delViejo = await usuarios.where('username', '==', viejo).get();
const delNuevo = await usuarios.where('username', '==', nuevo).get();
if (delViejo.size !== 1) { console.error(`Se esperaba un perfil con username "${viejo}" y hay ${delViejo.size}.`); process.exit(1); }
if (!delNuevo.empty) { console.error(`Ya existe un perfil con username "${nuevo}".`); process.exit(1); }
const perfil = delViejo.docs[0];
const uid = perfil.id;
const emailViejo = `${viejo}@${AUTH_EMAIL_DOMAIN}`;
const emailNuevo = `${nuevo}@${AUTH_EMAIL_DOMAIN}`;

const cuenta = await auth.getUser(uid);
if (cuenta.email !== emailViejo) { console.error(`El correo de Auth de ese uid es ${cuenta.email}, no ${emailViejo}. No se toca nada.`); process.exit(1); }
const ocupado = await auth.getUserByEmail(emailNuevo).then(() => true, (e) => (e.code === 'auth/user-not-found' ? false : Promise.reject(e)));
if (ocupado) { console.error(`El correo ${emailNuevo} ya existe en Auth.`); process.exit(1); }

const ordenes = await db.collection(`artifacts/${appId}/public/data/tickets`).where('creado', '==', viejo).get();
const p = perfil.data();
console.log(`Perfil ${uid}: ${p.nombre} · rol ${p.role} · deshabilitado: ${Boolean(p.disabled)}`);
console.log(`Auth: ${emailViejo} -> ${emailNuevo}`);
console.log(`Perfil: username ${viejo} -> ${nuevo}`);
console.log(`Órdenes cargadas por esa cuenta (creado == "${viejo}"): ${ordenes.size}${ordenes.size ? ' -> pasan a "' + nuevo + '"' : ''}`);

if (!aplicar) { console.log('\nNo se cambió nada. Para aplicarlo, repite el comando con --aplicar.'); process.exit(0); }

// Primero el perfil y las órdenes (si algo falla aquí, el correo viejo sigue funcionando); el correo de acceso al final.
await perfil.ref.update({ username: nuevo });
for (let i = 0; i < ordenes.docs.length; i += 400) {
  const lote = db.batch();
  ordenes.docs.slice(i, i + 400).forEach((d) => lote.update(d.ref, { creado: nuevo }));
  await lote.commit();
}
try {
  await auth.updateUser(uid, { email: emailNuevo });
} catch (e) {
  await perfil.ref.update({ username: viejo });
  console.error('No se pudo cambiar el correo; se devolvió el perfil al usuario anterior.', e.message);
  process.exit(1);
}
const despues = await usuarios.doc(uid).get();
const cuentaDespues = await auth.getUser(uid);
console.log(`\nListo. Perfil: ${despues.data().username} · Auth: ${cuentaDespues.email}`);
