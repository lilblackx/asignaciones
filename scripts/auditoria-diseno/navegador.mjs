// Abre un navegador (Brave, Chrome o Edge) con depuración remota y un perfil temporal, y lo controla por CDP con el WebSocket nativo de Node. Sin dependencias.
// El perfil va en la carpeta temporal del sistema y se borra al cerrar: las pruebas con Chrome ya llegaron a dejar el disco C: sin espacio.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATOS = {
  win32: [
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  linux: ['/usr/bin/brave-browser', '/usr/bin/google-chrome', '/usr/bin/chromium'],
};

const puertoAbierto = async (puerto) => {
  try { return (await fetch(`http://127.0.0.1:${puerto}/json/version`)).ok; } catch { return false; }
};

// Si ya hay un navegador escuchando en el puerto lo usa y no lo cierra al terminar; si no, lanza uno.
export async function abrirNavegador({ puerto = 9333, oculto = false } = {}) {
  if (await puertoAbierto(puerto)) return { lanzado: false, cerrar: async () => {} };
  const exe = process.env.NAVEGADOR_AUDITORIA || (CANDIDATOS[process.platform] || []).find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No encuentro Brave, Chrome ni Edge. Indica la ruta con la variable NAVEGADOR_AUDITORIA.');
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'auditoria-diseno-perfil-'));
  const args = [`--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--window-size=1440,900', ...(oculto ? ['--headless=new'] : []), 'about:blank'];
  const hijo = spawn(exe, args, { stdio: 'ignore', detached: false });
  for (let i = 0; i < 60 && !(await puertoAbierto(puerto)); i += 1) await dormir(500);
  if (!(await puertoAbierto(puerto))) { hijo.kill(); throw new Error(`El navegador no abrió el puerto ${puerto}. Si ya tienes ese navegador abierto, ciérralo o usa otro --puerto.`); }
  return {
    lanzado: true,
    cerrar: async () => {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' });
      else hijo.kill();
      await dormir(1500);
      for (let i = 0; i < 5; i += 1) { try { fs.rmSync(perfil, { recursive: true, force: true }); break; } catch { await dormir(1000); } }
    },
  };
}

// Una pestaña propia, con las acciones que usan los escenarios.
export async function abrirPestana({ puerto = 9333, url }) {
  const origen = new URL(url).origin;
  const pestana = await (await fetch(`http://127.0.0.1:${puerto}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(pestana.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const esperando = new Map();
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && esperando.has(d.id)) { esperando.get(d.id)(d); esperando.delete(d.id); }
  });
  const cmd = (method, params = {}) => new Promise((res, rej) => {
    id += 1;
    esperando.set(id, (d) => (d.error ? rej(new Error(`${method}: ${JSON.stringify(d.error)}`)) : res(d.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  // `fn` es una función de este archivo o de un escenario: se envía como texto y se ejecuta en la página.
  const ev = async (fn, ...args) => {
    const expresion = typeof fn === 'function' ? `(${fn.toString()})(...${JSON.stringify(args)})` : fn;
    const r = await cmd('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'error en la página');
    return r.result.value;
  };

  const n = { cmd, ev, dormir, origen };
  n.ir = async (ruta = '/') => { await cmd('Page.navigate', { url: origen + ruta }); await dormir(1800); };
  n.foto = async (archivo) => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(archivo, Buffer.from(r.data, 'base64')); };
  n.viewport = async ({ ancho, alto, movil }) => {
    await cmd('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: movil });
    await cmd('Emulation.setTouchEmulationEnabled', { enabled: movil });
  };
  n.limpiarSitio = () => cmd('Storage.clearDataForOrigin', { origin: origen, storageTypes: 'all' });
  n.esc = async () => { for (const type of ['keyDown', 'keyUp']) await cmd('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await dormir(500); };
  // Escribe en un campo de React (valor nativo y evento input).
  n.escribir = (selector, valor) => ev((s, v) => {
    const el = document.querySelector(s);
    if (!el) return false;
    Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, selector, valor);
  // Clic en el primer control visible cuyo texto o aria-label contenga `texto`. Con `dentro`, solo entre los controles de la ventana de encima; con `en`, solo dentro del último elemento que cumpla ese selector (un menú, un panel).
  n.clic = (texto, { dentro = false, en = null } = {}) => ev((t, d, s) => {
    const raiz = s ? ([...document.querySelectorAll(s)].pop() || document) : d ? ([...document.querySelectorAll('[role="dialog"]')].pop() || document) : document;
    const el = [...raiz.querySelectorAll('button, a, [role="button"], [role="tab"], [role="menuitem"], [role="option"], summary')].find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && `${e.innerText || ''} ${e.getAttribute('aria-label') || ''}`.toLowerCase().includes(t.toLowerCase());
    });
    if (!el) return false;
    el.click();
    return true;
  }, texto, dentro, en);
  // Clic en el primer control visible cuyo aria-label cumpla la expresión (sin distinguir mayúsculas).
  n.clicEtiqueta = (patron) => ev((p) => {
    const re = new RegExp(p, 'i');
    const el = [...document.querySelectorAll('button, a, [role="button"]')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && re.test(e.getAttribute('aria-label') || ''); });
    if (!el) return false;
    el.click();
    return true;
  }, patron);
  // Va a un módulo del menú lateral por su nombre exacto ("Panel principal", "Cierre"...). En celular el menú es un panel: primero lo abre con "Abrir menú".
  n.irAModulo = async (nombre) => {
    if (await n.clicEtiqueta('^abrir menú$')) await dormir(700);
    const ok = await ev((t) => {
      const el = [...document.querySelectorAll('aside[aria-label="Módulos"] nav button')].find((e) => (e.innerText || '').trim().toLowerCase() === t.toLowerCase());
      if (!el) return false;
      el.click();
      return true;
    }, nombre);
    await dormir(1500);
    return ok;
  };
  n.existe = (selector) => ev((s) => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, selector);
  n.textoDe = (selector) => ev((s) => (document.querySelector(s)?.innerText || '').split('\n').join(' / ').slice(0, 1500), selector);
  n.cerrar = async () => { ws.close(); try { await fetch(`http://127.0.0.1:${puerto}/json/close/${pestana.id}`); } catch { /* el navegador ya se cerró */ } };
  return n;
}

// Sesión limpia con el tema ya fijado. El tema NO sigue al sistema: la app lo guarda por usuario en localStorage (true = oscuro; sin valor, oscuro).
export async function entrar(n, { usuario, clave, oscuro }) {
  await n.limpiarSitio();
  await n.ir('/');
  await n.ev((u, o) => { ['', u].forEach((k) => localStorage.setItem(`asignaciones:preferencia:tema:${k}`, String(o))); }, usuario || '', oscuro);
  await n.ir('/');
  if (!usuario) return;
  await n.escribir('#login-usuario', usuario);
  await n.escribir('#login-clave', clave);
  await n.clic('entrar');
  for (let i = 0; i < 20 && !(await n.ev(() => !document.querySelector('#login-usuario'))); i += 1) await dormir(500);
  await dormir(2500);
}
