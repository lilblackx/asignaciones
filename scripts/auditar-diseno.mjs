// Audita el diseño de la app pantalla por pantalla: contraste, tamaño mínimo de texto, desborde horizontal, áreas táctiles de 44 px (celular), controles y ventanas sin nombre.
// Cada escenario (scripts/auditoria-diseno/escenarios.mjs) entra con un usuario del emulador y recorre sus pantallas; se repite en PC y en celular, en claro y en oscuro.
// Requiere el servidor (`npm run dev`) y los emuladores con sus datos (`npm run emulators` y `npm run seed:emulator`). NUNCA toca producción: el modo local usa solo los emuladores.
//
//   npm run auditar:diseno                                  todo
//   npm run auditar:diseno -- --escenario tecnico1          un escenario (o varios, separados por coma)
//   npm run auditar:diseno -- --escenario tecnico1 --pantalla lista --viewport movil --tema oscuro
//   opciones: --url http://localhost:5173  --puerto 9333  --salida <carpeta>  --oculto (sin ventana)  --detalle (siempre muestra el detalle)  --lista (solo muestra los escenarios)
// Las capturas y informe.json se guardan en la carpeta de salida (por defecto, la temporal del sistema). El perfil del navegador se borra al terminar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador, abrirPestana, entrar } from './auditoria-diseno/navegador.mjs';
import { medirPantalla } from './auditoria-diseno/medidas.mjs';
import ESCENARIOS from './auditoria-diseno/escenarios.mjs';

const VIEWPORTS = {
  pc: { ancho: 1440, alto: 900, movil: false, minPx: 11 },
  movil: { ancho: 390, alto: 844, movil: true, minPx: 12 },
  320: { ancho: 320, alto: 640, movil: true, minPx: 12 },
};
const TEMAS = { claro: false, oscuro: true };

const opciones = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (!argv[i].startsWith('--')) continue;
  const clave = argv[i].slice(2);
  const valor = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : true;
  opciones[clave] = valor;
}
const lista = (v, todos) => (v && v !== true ? String(v).split(',').map((x) => x.trim()) : todos);

if (opciones.lista) {
  ESCENARIOS.forEach((e) => console.log(`${e.id.padEnd(16)} ${e.usuario ? `${e.usuario}` : '(sin sesión)'}  ${e.pantallas.map((p) => p.id).join(', ')}`));
  process.exit(0);
}

const url = opciones.url && opciones.url !== true ? opciones.url : 'http://localhost:5173';
const puerto = Number(opciones.puerto) || 9333;
const salida = opciones.salida && opciones.salida !== true ? opciones.salida : path.join(os.tmpdir(), 'auditoria-diseno');
const viewports = lista(opciones.viewport, Object.keys(VIEWPORTS));
const temas = lista(opciones.tema, Object.keys(TEMAS));
const escenarios = ESCENARIOS.filter((e) => lista(opciones.escenario, ESCENARIOS.map((x) => x.id)).includes(e.id));
const soloPantallas = opciones.pantalla && opciones.pantalla !== true ? String(opciones.pantalla).split(',') : null;
if (!escenarios.length) { console.error('Ningún escenario coincide. Usa --lista para verlos.'); process.exit(2); }
for (const v of viewports) if (!VIEWPORTS[v]) { console.error(`Viewport desconocido: ${v}`); process.exit(2); }
for (const t of temas) if (!(t in TEMAS)) { console.error(`Tema desconocido: ${t}`); process.exit(2); }
fs.mkdirSync(path.join(salida, 'capturas'), { recursive: true });

const navegador = await abrirNavegador({ puerto, oculto: Boolean(opciones.oculto) });
const informe = [];
let conProblemas = 0;
let revisadas = 0;
let n;
try {
  n = await abrirPestana({ puerto, url });
  for (const esc of escenarios) {
    for (const vp of viewports) {
      for (const tema of temas) {
        const v = VIEWPORTS[vp];
        await n.viewport(v);
        await entrar(n, { usuario: esc.usuario, clave: esc.clave, oscuro: TEMAS[tema] });
        for (const pan of esc.pantallas) {
          if (soloPantallas && !soloPantallas.includes(pan.id)) continue;
          if (pan.viewports && !pan.viewports.includes(vp)) continue;
          const etiqueta = `${vp}/${tema} ${esc.id}/${pan.id}`;
          let r;
          try {
            if (pan.preparar) {
              const ok = await pan.preparar(n);
              if (ok === false) { console.log(`ATENCIÓN  ${etiqueta}: no se pudo llegar a la pantalla (¿faltan datos en el emulador?)`); informe.push({ etiqueta, error: 'no se pudo llegar' }); conProblemas += 1; continue; }
            }
            await n.dormir(pan.espera ?? 1600);
            r = await n.ev(medirPantalla, { minPx: v.minPx, movil: v.movil });
            await n.foto(path.join(salida, 'capturas', `${vp}-${tema}-${esc.id}-${pan.id}.png`));
          } catch (e) {
            console.log(`ERROR  ${etiqueta}: ${e.message}`);
            informe.push({ etiqueta, error: e.message });
            conProblemas += 1;
            continue;
          } finally {
            if (pan.limpiar) { try { await pan.limpiar(n); } catch { /* sigue con la siguiente */ } } else { await n.esc(); await n.esc(); }
          }
          revisadas += 1;
          const solo320 = vp === '320';
          const problemas = {
            contraste: r.contraste.fallos.length + r.contraste.sinMedir,
            texto: r.textoChico.length,
            desborde: r.desborde.hay ? 1 : 0,
            sinNombre: r.sinNombre.length + r.dialogosSinNombre,
            tactiles: solo320 ? 0 : r.totalTactiles,
          };
          const total = Object.values(problemas).reduce((a, b) => a + b, 0);
          if (total) conProblemas += 1;
          informe.push({ etiqueta, problemas, ...r });
          const resumen = `contraste ${problemas.contraste} | texto<${v.minPx}px ${problemas.texto} | desborde ${problemas.desborde} | sin nombre ${problemas.sinNombre}${v.movil ? ` | táctiles<44px ${problemas.tactiles}` : ''}`;
          console.log(`${total ? 'REVISAR' : 'OK     '}  ${etiqueta.padEnd(46)} ${resumen}  (${r.contraste.textos} textos, ${r.interactivos} controles, ${r.contraste.inactivos} inactivos)`);
          if (total || opciones.detalle) {
            r.contraste.fallos.forEach((f) => console.log(`            contraste ${f.razon} ${f.px}px "${f.texto}"  texto ${f.fg} sobre ${f.bg}`));
            if (r.contraste.sinMedir) console.log(`            ${r.contraste.sinMedir} textos sin poder medir`);
            r.textoChico.slice(0, 8).forEach((t) => console.log(`            texto de ${t.px}px: "${t.texto}"`));
            if (r.desborde.hay) { console.log(`            desborde: la página mide ${r.desborde.scrollWidth}px y la pantalla ${r.desborde.ancho}px`); r.desborde.elementos.forEach((x) => console.log(`              ${x.el} termina en ${x.derecha}px "${x.texto}"`)); }
            r.sinNombre.forEach((s) => console.log(`            sin nombre: ${s}`));
            if (r.dialogosSinNombre) console.log(`            ${r.dialogosSinNombre} ventana(s) sin nombre accesible`);
            if (!solo320) r.tactiles.slice(0, 12).forEach((t) => console.log(`            táctil ${t.w}x${t.h}: ${t.el}`));
            if (!solo320 && r.totalTactiles > 12) console.log(`            ... y ${r.totalTactiles - 12} más`);
          }
        }
      }
    }
  }
} finally {
  if (n) await n.cerrar();
  if (!opciones.mantener) await navegador.cerrar();
}
fs.writeFileSync(path.join(salida, 'informe.json'), JSON.stringify(informe, null, 2));
console.log(`\n${revisadas} pantallas revisadas, ${conProblemas} con algo que revisar. Capturas e informe: ${salida}`);
process.exit(conProblemas ? 1 : 0);
