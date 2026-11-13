// Prueba la pantalla "Instala la app para continuar" (src/components/InstallGate.jsx): en producción la barrera de instalación del celular sigue exigiéndose (solo se omite con import.meta.env.DEV, que en la versión compilada es
// siempre false), se puede volver a exigir en local con VITE_EXIGIR_INSTALACION=true, y el botón "Ya la instalé, continuar" ya no se queda mudo: avisa que hay que abrir la app desde su ícono. No necesita el emulador.
// Uso: `npm run test:instalarapp`.
import { readFileSync } from 'node:fs';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const gate = readFileSync('src/components/InstallGate.jsx', 'utf8');

check('la barrera solo se omite en desarrollo (import.meta.env.DEV) y se puede volver a exigir con VITE_EXIGIR_INSTALACION', [
  gate.includes("Boolean(import.meta.env?.DEV) && import.meta.env?.VITE_EXIGIR_INSTALACION !== 'true'"),
  gate.includes('if (SIN_INSTALAR_EN_LOCAL || !isMobileUA() || standalone) return children;'),
], [true, true]);
check('en producción sigue exigiéndose en el celular: la regla de siempre (UA móvil y fuera de la app instalada) no cambió', [gate.includes('const isMobileUA = () =>'), gate.includes("window.matchMedia('(display-mode: standalone)').matches"), gate.includes('Instala la app para continuar')], [true, true, true]);
check('"Ya la instalé, continuar" avisa por qué no avanza cuando todavía está en el navegador', [gate.includes('const instalada = isStandalone();'), gate.includes('Todavía estás en el navegador, no en la app instalada'), gate.includes('role="alert"')], [true, true, true]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
