// Prueba la búsqueda de cliente en SmartOLT desde tu PC, con tu llave, sin pasar por
// el Worker ni por la app. Muestra cómo vienen los datos de la ONU y qué campos
// de la orden se llenarían.
//
//   SMARTOLT_API_KEY=tu_llave node scripts/probe-smartolt.mjs 12345678
//
// (PowerShell:  $env:SMARTOLT_API_KEY="tu_llave"; node scripts/probe-smartolt.mjs 12345678)
// Solo lee. La llave no se imprime. Ojo: la API de SmartOLT puede limitar por IP.
import { buscarOnus } from '../cf-worker-tomodat/src/index.js';

const cedula = process.argv[2];
const env = {
  SMARTOLT_API_KEY: process.env.SMARTOLT_API_KEY,
  SMARTOLT_BASE_URL: process.env.SMARTOLT_BASE_URL || 'https://networkspeed.smartolt.com',
};
if (!env.SMARTOLT_API_KEY || !cedula) {
  console.error('Uso: SMARTOLT_API_KEY=... node scripts/probe-smartolt.mjs <cedula>');
  process.exit(1);
}

try {
  const resultados = await buscarOnus(env, cedula);
  console.log(`ONU con la cédula ${cedula}: ${resultados.length}`);
  resultados.forEach((r, i) => console.log(`\n#${i + 1}`, r));
  if (resultados.length === 0) console.log('\nNo hubo coincidencias. Revisa cómo guarda SmartOLT el documento (nombre o ID externo).');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
