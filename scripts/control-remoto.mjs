// Control de emergencia de todas las sesiones abiertas de la app (config/app, lo lee src/hooks/useControlRemoto.js). Sin opciones solo muestra
// el estado; con una opción lo cambia:
//   --pausar     ninguna sesión hace escrituras automáticas (ver src/lib/escrituraAutomatica.js)
//   --reanudar   vuelven las escrituras automáticas
//   --recargar   toda página abierta hasta ahora se recarga una vez (con la versión publicada si hay una nueva)
// Lo mismo se puede hacer a mano en la consola de Firebase, en artifacts/default-app-id/public/data/config/app.
// Uso (con la llave de una cuenta de servicio, nunca dentro del repo):
//   node scripts/control-remoto.mjs C:\ruta\a\llave.json [--pausar | --reanudar | --recargar]
// Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const llave = args.find((a) => !a.startsWith('--'));
const opciones = ['--pausar', '--reanudar', '--recargar'].filter((o) => args.includes(o));
if (opciones.length > 1) { console.error('Usa una sola opción.'); process.exit(1); }

initializeApp({
  credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(),
  projectId: 'seguimientons-f2026',
});
const ref = getFirestore().doc(`artifacts/${process.env.APP_ID || 'default-app-id'}/public/data/config/app`);

const cambios = { '--pausar': { pausarAutomaticas: true }, '--reanudar': { pausarAutomaticas: false }, '--recargar': { recargarAntesDe: Date.now() } }[opciones[0]];
if (cambios) await ref.set({ ...cambios, actualizadoEn: Date.now(), actualizadoPor: 'scripts/control-remoto.mjs' }, { merge: true });

const datos = (await ref.get()).data() || {};
console.log(`Escrituras automáticas: ${datos.pausarAutomaticas ? 'PAUSADAS' : 'activas'}`);
console.log(`Última recarga forzada: ${datos.recargarAntesDe ? new Date(datos.recargarAntesDe).toLocaleString('es-VE', { timeZone: 'America/Caracas' }) : 'nunca'}`);
if (cambios) console.log('\nListo: las sesiones abiertas lo aplican en segundos.');
