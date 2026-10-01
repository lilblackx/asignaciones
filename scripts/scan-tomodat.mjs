// Escanea el catálogo de Tomodat y verifica que cada caja se pueda encontrar con
// el flujo de la app: extraerCodigoNap(nombre) -> POST /nap del Worker (buscar).
// Reporta las cajas cuyo nombre la app no reconoce o no encuentra a sí misma.
//
// Uso (el token NO se guarda en el repo; mismo valor del secreto TOMODAT_TOKEN):
//   $env:TOMODAT_TOKEN = "<token>"; node scripts/scan-tomodat.mjs
import { readFileSync } from 'node:fs';
import { extraerCodigoNap } from '../src/utils/codigoNap.js';
import { buscar, normalizar } from '../cf-worker-tomodat/src/index.js';

const token = process.env.TOMODAT_TOKEN;
if (!token) {
  console.error('Falta la variable de entorno TOMODAT_TOKEN.');
  process.exit(1);
}

// Misma configuración que el Worker (cf-worker-tomodat/wrangler.toml).
const toml = readFileSync(new URL('../cf-worker-tomodat/wrangler.toml', import.meta.url), 'utf8');
const cfg = (k) => toml.match(new RegExp(`^${k}\\s*=\\s*"([^"]*)"`, 'm'))?.[1];
const [lat, lng] = cfg('TOMODAT_CENTRO').split(',').map((s) => s.trim());
const tipos = cfg('TOMODAT_TIPOS').split(',').map(Number);

const res = await fetch(`${cfg('TOMODAT_BASE_URL')}/access_points/${lat}/${lng}/${cfg('TOMODAT_RADIO')}`, {
  headers: { Authorization: token },
});
if (!res.ok) {
  console.error(`Tomodat respondió ${res.status}`);
  process.exit(1);
}
const data = await res.json();
const puntos = data
  .filter((p) => tipos.includes(Number(p.access_point_type_id)) && p.dot)
  .map((p) => ({
    nombre: String(p.name || ''),
    clave: normalizar(p.name),
    tipo: Number(p.access_point_type_id),
    lat: Number(p.dot.lat),
    lng: Number(p.dot.lng),
  }))
  .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

// Lo que hace la app: busca el código; si no hay resultados y termina en "-N", reintenta con la base.
const buscarComoApp = (codigo) => {
  let r = buscar(puntos, codigo);
  const base = codigo.replace(/-\d$/, '');
  if (r.length === 0 && base !== codigo) r = buscar(puntos, base);
  return r;
};

const sinCodigo = [];
const noEncontradas = [];
const ambiguas = [];
let ok = 0;
for (const p of puntos) {
  const codigo = extraerCodigoNap(p.nombre);
  if (!codigo) { sinCodigo.push(p); continue; }
  const r = buscarComoApp(codigo);
  // Cajas gemelas ("M03E01 - 2") o con el código embebido: la app muestra la
  // caja hermana, que está en el mismo sitio. Solo falla si no devuelve nada.
  if (r.length === 0) noEncontradas.push({ p, codigo });
  else if (r.length > 1) ambiguas.push({ p, codigo, n: r.length });
  else ok++;
}

console.log(`Cajas en Tomodat (tipos ${tipos.join(',')}): ${puntos.length}`);
console.log(`OK (única coincidencia): ${ok}`);
console.log(`Ambiguas (la app pide elegir): ${ambiguas.length}`);
console.log(`Nombre sin código reconocible: ${sinCodigo.length}`);
console.log(`Código reconocido pero no se encuentra a sí misma: ${noEncontradas.length}`);

const lista = (titulo, filas) => {
  if (filas.length === 0) return;
  console.log(`\n== ${titulo} ==`);
  for (const f of filas) console.log(f);
};
lista('SIN CÓDIGO RECONOCIBLE (la app no las detecta)', sinCodigo.map((p) => `  [tipo ${p.tipo}] ${p.nombre}`));
lista('NO SE ENCUENTRAN A SÍ MISMAS', noEncontradas.map(({ p, codigo }) => `  ${p.nombre}  (código extraído: ${codigo})`));
lista('AMBIGUAS', ambiguas.map(({ p, codigo, n }) => `  ${p.nombre}  (${codigo} -> ${n} resultados)`));

process.exit(sinCodigo.length + noEncontradas.length > 0 ? 2 : 0);
