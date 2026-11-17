// Lo que se mide en cada pantalla. `medirPantalla` se ejecuta DENTRO de la página (el ejecutor la envía como texto), así que no puede usar nada de este archivo: solo `document`, `window` y lo que recibe por `opciones`.
// Mide lo que pide DESIGN.md: contraste AA (4.5:1 texto, 3:1 texto grande), tamaño mínimo de texto, desborde horizontal, áreas táctiles de 44 px en celular, controles sin nombre y ventanas sin nombre.
// Si hay una ventana abierta, mide solo la de encima (la última con role="dialog"); si no, toda la página.
export function medirPantalla(opciones) {
  const { minPx, movil, tactil = 44 } = opciones;
  const raiz = [...document.querySelectorAll('[role="dialog"]')].pop() || document.body;
  const visible = (el) => {
    if (!el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const corto = (t, n = 48) => (t || '').split('\n').join(' ').trim().slice(0, n);

  // Colores: el navegador los entrega en oklab y otros formatos modernos; un canvas 2D los convierte siempre a rgba (leerlos a mano da NaN).
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 1;
  const cx = lienzo.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const mezcla = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
  const lum = (c) => { const s = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; };
  const razon = (a, b) => { const l1 = lum(a); const l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  // Pinta las capas de fondo desde la raíz hasta el elemento. La opacidad de un ancestro afecta a su fondo y a todo lo que contiene.
  const pintar = (el) => {
    const cadena = [];
    for (let e = el; e; e = e.parentElement) cadena.unshift(e);
    let pix = [255, 255, 255];
    let acum = 1;
    for (const a of cadena) {
      const cs = getComputedStyle(a);
      acum *= Number(cs.opacity);
      const bg = rgba(cs.backgroundColor);
      if (bg[3] > 0) pix = mezcla([bg[0], bg[1], bg[2], bg[3] * acum], pix);
    }
    return { fondo: pix, opacidad: acum };
  };

  const contraste = { textos: 0, fallos: [], inactivos: 0, sinMedir: 0 };
  const textoChico = [];
  const vistosContraste = new Set();
  const vistosChico = new Set();
  const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let nodo = caminante.nextNode(); nodo; nodo = caminante.nextNode()) {
    const t = nodo.textContent.trim();
    const el = nodo.parentElement;
    if (!t || !el || !visible(el) || el.closest('script,style,noscript')) continue;
    const cs = getComputedStyle(el);
    const px = parseFloat(cs.fontSize);
    const peso = Number(cs.fontWeight);
    const { fondo, opacidad } = pintar(el);
    const fg = rgba(cs.color);
    fg[3] *= opacidad;
    if (fg[3] === 0) continue;
    const r = razon(mezcla(fg, fondo), fondo);
    if (Number.isNaN(r)) { contraste.sinMedir += 1; continue; }
    contraste.textos += 1;
    const grande = px >= 24 || (px >= 18.66 && peso >= 700);
    const inactivo = Boolean(el.closest('button:disabled, input:disabled, select:disabled, textarea:disabled, fieldset:disabled, [aria-disabled="true"]'));
    if (inactivo) contraste.inactivos += 1;
    const clave = `${t.slice(0, 30)}|${r.toFixed(2)}`;
    if (!inactivo && !(r >= (grande ? 3 : 4.5)) && !vistosContraste.has(clave)) {
      vistosContraste.add(clave);
      contraste.fallos.push({ texto: corto(t, 40), razon: Number(r.toFixed(2)), px, fg: mezcla(fg, fondo).map(Math.round).join(','), bg: fondo.map(Math.round).join(',') });
    }
    if (px < minPx - 0.01 && !vistosChico.has(`${t.slice(0, 30)}|${px}`)) {
      vistosChico.add(`${t.slice(0, 30)}|${px}`);
      textoChico.push({ texto: corto(t, 40), px });
    }
  }

  // Desborde horizontal: la página no debe poder desplazarse de lado. Se listan los elementos que se salen, salvo los que van dentro de un contenedor que ya se desplaza (tablas, carruseles).
  const ancho = window.innerWidth;
  const desborde = { scrollWidth: document.documentElement.scrollWidth, ancho, hay: document.documentElement.scrollWidth > ancho + 1, elementos: [] };
  if (desborde.hay) {
    for (const el of document.body.querySelectorAll('*')) {
      if (desborde.elementos.length >= 8) break;
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right <= ancho + 1) continue;
      let dentroDeScroll = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX) && p.getBoundingClientRect().right <= ancho + 1) { dentroDeScroll = true; break; }
      }
      if (!dentroDeScroll) desborde.elementos.push({ el: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ').slice(0, 2).join('.')}` : ''}`, derecha: Math.round(r.right), texto: corto(el.innerText, 30) });
    }
  }

  // Nombre accesible (aproximado): aria-label, aria-labelledby, texto, title, alt de una imagen, o la etiqueta del campo.
  const nombreDe = (el) => {
    const al = el.getAttribute('aria-label');
    if (al && al.trim()) return al.trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const t = lb.split(' ').map((id) => document.getElementById(id)?.textContent || '').join(' ').trim(); if (t) return t; }
    if (el.labels && el.labels.length) { const t = [...el.labels].map((l) => l.textContent).join(' ').trim(); if (t) return t; }
    const txt = (el.innerText || el.textContent || '').trim();
    if (txt) return txt;
    const img = el.querySelector('img[alt]');
    if (img && img.alt.trim()) return img.alt.trim();
    return (el.getAttribute('title') || '').trim();
  };
  // Los controles con aria-hidden (por ejemplo el botón "Continuar" invisible que deja enviar un formulario con Enter) no son un blanco para el dedo ni cuentan para los lectores de pantalla.
  const interactivos = [...raiz.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"]')].filter((el) => visible(el) && !el.closest('[aria-hidden="true"]'));
  const sinNombre = interactivos.filter((el) => !nombreDe(el)).slice(0, 10).map((el) => corto(el.outerHTML, 90));

  // Áreas táctiles (solo celular). Cuenta la zona ampliada con ::after (la app la usa en los íconos pequeños) y no cuenta los enlaces dentro de un texto ni los campos ocultos.
  const tactiles = [];
  if (movil) {
    for (const el of interactivos) {
      if (el.disabled) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' && el.closest('p, li, span, label')) continue;
      if ((el.type === 'checkbox' || el.type === 'radio') && el.labels?.length) continue;
      if (el.classList.contains('sr-only')) continue; // los campos de archivo ocultos que abre un botón: no se tocan
      const r = el.getBoundingClientRect();
      let w = r.width;
      let h = r.height;
      const pse = getComputedStyle(el, '::after');
      if (pse && pse.content !== 'none' && pse.position === 'absolute') { w = Math.max(w, parseFloat(pse.width) || 0); h = Math.max(h, parseFloat(pse.height) || 0); }
      if (w < tactil - 0.5 || h < tactil - 0.5) tactiles.push({ el: corto(nombreDe(el) || el.tagName, 34), w: Math.round(w), h: Math.round(h) });
    }
  }

  const ventanas = [...document.querySelectorAll('[role="dialog"]')];
  const dialogosSinNombre = ventanas.filter((d) => !nombreDe(d) || (!d.getAttribute('aria-label') && !d.getAttribute('aria-labelledby'))).length;

  return { contraste, textoChico, desborde, sinNombre, tactiles: tactiles.slice(0, 40), totalTactiles: tactiles.length, ventanasAbiertas: ventanas.length, dialogosSinNombre, interactivos: interactivos.length };
}
