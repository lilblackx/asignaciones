// Mide el rendimiento de la app en modo celular con Lighthouse, con una ventana de Chrome visible, ya con la sesión iniciada.
//   - Producción (con los datos reales): pasa la dirección de la app. La ventana se abre en la pantalla de acceso: inicia sesión tú mismo (el script no
//     pide ni guarda claves) y en cuanto entres empieza a medir. Solo lee; la medición abre la app dos veces (unas pocas miles de lecturas) y aparece
//     como una estación más en Estaciones.
//   - Local (emuladores): sin dirección usa http://localhost:4173 e inicia sesión solo con admin / Admin1234 (o el usuario y la clave que pases).
//
// Antes (una sola vez, no cambia package.json):   npm i --no-save lighthouse@12 puppeteer-core@23
// Producción:   node scripts/medir-rendimiento.mjs https://TU-DIRECCION
// Local:        npm run emulators; node scripts/seed-emulator.mjs; npx vite build --mode development --outDir dist-prueba --emptyOutDir;
//               npx vite preview --outDir dist-prueba --port 4173; node scripts/medir-rendimiento.mjs http://localhost:4173 [usuario] [clave]
import { existsSync } from 'node:fs';

const [url = 'http://localhost:4173', usuario = 'admin', clave = 'Admin1234'] = process.argv.slice(2);
if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)) { console.error('La dirección debe empezar con https:// (o ser http://localhost).'); process.exit(1); }
const local = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);
if (!CHROME) { console.error('No encontré Chrome. Ajusta la ruta CHROME en el script.'); process.exit(1); }

let puppeteer, lighthouse;
try {
  puppeteer = (await import('puppeteer-core')).default;
  lighthouse = (await import('lighthouse')).default;
} catch {
  console.error('Faltan los paquetes. Corre: npm i --no-save lighthouse@12 puppeteer-core@23');
  process.exit(1);
}

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: false, defaultViewport: null, args: ['--window-size=420,900'] });
try {
  const pagina = await navegador.newPage();
  await pagina.goto(url, { waitUntil: 'networkidle2' });
  await pagina.waitForSelector('#login-usuario', { timeout: 20000 });
  if (local) {
    await pagina.type('#login-usuario', usuario);
    await pagina.type('#login-clave', clave);
    await pagina.keyboard.press('Enter');
  } else {
    console.log('Inicia sesión en la ventana de Chrome (tienes 5 minutos). Cuando entres, la medición empieza sola.');
  }
  await pagina.waitForSelector('#login-usuario', { hidden: true, timeout: local ? 30000 : 300000 });
  await new Promise((r) => setTimeout(r, 8000)); // deja que lleguen las órdenes y los oyentes antes de medir
  console.log('Sesión iniciada. Midiendo (la ventana se recarga sola, no la toques)...');

  const { lhr } = await lighthouse(url, {
    port: Number(new URL(navegador.wsEndpoint()).port),
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance'],
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
    disableStorageReset: true, // conserva la sesión iniciada
  });

  const a = lhr.audits;
  const ms = (id) => `${Math.round(a[id].numericValue)} ms`;
  console.log('\nPuntaje de rendimiento:', Math.round(lhr.categories.performance.score * 100), '/ 100');
  console.log('Primer contenido (FCP):      ', ms('first-contentful-paint'));
  console.log('Contenido principal (LCP):   ', ms('largest-contentful-paint'));
  console.log('Tiempo de bloqueo total (TBT):', ms('total-blocking-time'));
  console.log('Cambios de diseño (CLS):     ', a['cumulative-layout-shift'].numericValue.toFixed(3));
  console.log('Índice de velocidad:         ', ms('speed-index'));
  console.log('Peso total descargado:       ', `${Math.round(a['total-byte-weight'].numericValue / 1024)} KB`);
  console.log('Tiempo de ejecución de JS:   ', ms('bootup-time'));
  const pesados = (a['bootup-time'].details?.items || []).slice(0, 5);
  if (pesados.length) {
    console.log('\nScripts que más CPU gastan:');
    pesados.forEach((i) => console.log(`  ${Math.round(i.total)} ms  ${i.url.split('/').pop() || i.url}`));
  }
} finally {
  await navegador.close();
}
