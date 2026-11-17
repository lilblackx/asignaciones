// Los escenarios de la auditoría de diseño: un usuario del emulador (ver scripts/seed-emulator.mjs) y las pantallas que recorre, en orden.
// `preparar(n)` lleva la app a esa pantalla desde donde dejó la anterior; devuelve false si no pudo (faltan datos). Después de medir se pulsa Escape dos veces para cerrar lo que haya abierto, o se llama a `limpiar(n)`.
// Los pasos de un asistente comparten ventana: usan `seguir` como `limpiar` para no cerrarla entre uno y otro, y el último la cierra.
// Opcionales por pantalla: `espera` (ms antes de medir), `viewports` (['pc'], ['movil'], ['320']). Las acciones de `n` están en navegador.mjs.

const seguir = async () => {};

// Rellena campos de la ventana de encima por su placeholder.
const llenar = async (n, campos) => {
  for (const [ph, valor] of Object.entries(campos)) await n.escribir(`[role="dialog"] input[placeholder="${ph}"], [role="dialog"] textarea[placeholder="${ph}"]`, valor);
  await n.dormir(400);
};
const textarea = (n, valor) => n.escribir('[role="dialog"] textarea', valor);

// Abre el Pre-finalizar de la orden (AS1: avería de tecnico1; AS2: instalación de tecnico2). En celular el botón dice "Pre-finalizar" y en PC es un ícono con aria-label.
const abrirPreFinalizar = (codigo) => (n) => n.ev((c) => {
  const e = [...document.querySelectorAll('button')].find((x) => {
    const r = x.getBoundingClientRect();
    const a = x.getAttribute('aria-label') || '';
    const t = (x.innerText || '').trim();
    return r.width > 0 && r.height > 0 && !/whatsapp/i.test(a) && (new RegExp(`(pre-finalizar|borrador).*${c}`, 'i').test(a) || /^(pre-finalizar|continuar borrador)$/i.test(t));
  });
  if (!e) return false;
  e.click();
  return true;
}, codigo);
const siguiente = (n) => n.clic('siguiente', { dentro: true });
const elegirOpcion = (nombre) => (n) => n.ev((t) => { const o = [...document.querySelectorAll('[role="option"]')].find((e) => e.innerText.trim() === t); if (!o) return false; o.click(); return true; }, nombre);
const desplazarAbajo = (selector) => (n) => n.ev((s) => {
  const dentro = document.querySelector(s) || document.body;
  const sc = [dentro, ...dentro.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
  (sc || document.scrollingElement).scrollTop = 1e6;
  return true;
}, selector);
const cerrarAsistente = async (n) => { await n.clic('volver', { dentro: true }); await n.esc(); await n.esc(); };

// Pre-finalizar de una visita de recableado (tecnico1, orden AS1, avería): elige el tipo de visita y recorre sus cuatro pasos.
const preFinalizarVisita = [
  { id: 'pf-orden', preparar: abrirPreFinalizar('as1'), limpiar: seguir },
  { id: 'pf-tipos-de-visita', preparar: (n) => n.clic('elige el tipo de visita', { dentro: true }), limpiar: seguir },
  { id: 'pf-orden-recableado', preparar: elegirOpcion('Recableado'), limpiar: seguir },
  { id: 'pf-datos', preparar: siguiente, limpiar: seguir },
  { id: 'pf-datos-errores', preparar: siguiente, limpiar: seguir },
  { id: 'pf-datos-lleno', preparar: async (n) => { await llenar(n, { 'Ej. 500': '500', 'Ej. 620': '620', 'Ej. NAP 08': 'NAP 08', 'Ej. 3': '3' }); return true; }, limpiar: seguir },
  { id: 'pf-conectores', preparar: siguiente, limpiar: seguir },
  { id: 'pf-cierre', preparar: siguiente, limpiar: seguir },
  { id: 'pf-confirmar', preparar: async (n) => { await textarea(n, 'Visita de prueba para revisar el diseño.'); await n.dormir(300); return n.clic('confirmar', { dentro: true }); }, limpiar: cerrarAsistente },
];

// Pre-finalizar de una instalación (tecnico2, orden AS2): equipo, cable y cierre, con sus errores de validación.
const preFinalizarInstalacion = [
  { id: 'pf-orden', preparar: abrirPreFinalizar('as2'), limpiar: seguir },
  { id: 'pf-equipo', preparar: siguiente, limpiar: seguir },
  { id: 'pf-equipo-errores', preparar: siguiente, limpiar: seguir },
  { id: 'pf-equipo-lleno', preparar: async (n) => { await llenar(n, { 'Ej. HWTC1A2B3C4D': 'HWTC1A2B3C4D', 'Ej. 100': '100', 'Ej. NAP 08': 'NAP 08', 'Ej. 3': '3' }); return true; }, limpiar: seguir },
  { id: 'pf-cable', preparar: siguiente, limpiar: seguir },
  { id: 'pf-cable-errores', preparar: siguiente, limpiar: seguir },
  { id: 'pf-cable-lleno', preparar: async (n) => { await llenar(n, { 'Ej. 500': '500', 'Ej. 620': '620', 'Ej. DM SN N01B01': 'DM SN N01B01', 'Ej. 6': '6' }); await n.ev(() => [...document.querySelectorAll('[role="dialog"] button')].find((e) => e.innerText.trim() === '+')?.click()); return desplazarAbajo('[role="dialog"]')(n); }, limpiar: seguir },
  { id: 'pf-cierre', preparar: siguiente, limpiar: seguir },
  { id: 'pf-confirmar', preparar: async (n) => { await textarea(n, 'Instalación de prueba para revisar el diseño.'); await n.dormir(300); return n.clic('confirmar', { dentro: true }); }, limpiar: cerrarAsistente },
];

// Lo que comparten los técnicos antes de abrir una orden.
const inicioTecnico = [
  { id: 'lista', preparar: async () => true },
  // Con órdenes finalizadas por avisar, el técnico ve primero los avisos de cobro: "Hacerlo después" los pasa y deja ver las tarjetas.
  { id: 'tarjetas', preparar: async (n) => { for (let i = 0; i < 5; i += 1) { if (!(await n.clic('hacerlo después'))) break; await n.dormir(900); } return true; } },
  { id: 'lista-abajo', preparar: desplazarAbajo('body'), limpiar: async (n) => { await n.ev(() => { document.scrollingElement.scrollTop = 0; document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); }); } },
  { id: 'notificaciones', preparar: (n) => n.clicEtiqueta('^notificaciones$') },
  { id: 'cuenta', preparar: (n) => n.clicEtiqueta('mi cuenta') },
  { id: 'filtros', preparar: (n) => n.clicEtiqueta('^filtros$') },
];

// ¿Se está viendo la versión de celular? (solo ella tiene el botón "Abrir menú").
const esMovil = (n) => n.existe('button[aria-label="Abrir menú"]');
// Una acción de una orden de la lista: en PC está en el menú "Más acciones de la orden"; en celular son botones sueltos en la tarjeta.
const accionOrden = ({ pc, movil, movilMenu, codigo = 'as2' }) => async (n) => {
  // En celular, Editar y Finalizar son botones de la tarjeta; el resto (plantilla, escalar, cancelar) está en el menú "Más acciones de la orden".
  if (await esMovil(n)) {
    if (!movilMenu) return n.clic(movil);
    if (!(await n.clicEtiqueta(`^más acciones de la orden ${codigo}$`))) return false;
    await n.dormir(500);
    return n.clic(movilMenu, { en: '[role="menu"]' });
  }
  if (!(await n.clicEtiqueta(`^más acciones de orden ${codigo}$`))) return false;
  await n.dormir(500);
  return n.clic(pc, { en: '[role="menu"]' });
};
// Elige un reporte del selector de la pantalla Reportes.
const vistaReporte = (nombre) => async (n) => {
  await n.ev(() => document.querySelector('button[aria-haspopup="listbox"]')?.click());
  await n.dormir(500);
  return elegirOpcion(nombre)(n);
};

export default [
  {
    id: 'login',
    usuario: null,
    pantallas: [
      { id: 'formulario', preparar: async () => true },
      {
        id: 'error',
        preparar: async (n) => {
          await n.escribir('#login-usuario', 'nadie');
          await n.escribir('#login-clave', 'incorrecta');
          await n.clic('entrar');
          await n.dormir(2500);
          return n.existe('#login-error');
        },
      },
    ],
  },
  // El Panel principal del administrador y los modales de sus órdenes (AS2: instalación; AS1: avería).
  {
    id: 'admin-panel',
    usuario: 'admin',
    clave: 'Admin1234',
    pantallas: [
      { id: 'panel', preparar: (n) => n.irAModulo('Panel principal') },
      { id: 'filtros', preparar: (n) => n.clicEtiqueta('^filtros$'), limpiar: (n) => n.clicEtiqueta('^filtros$') },
      // En celular las píldoras de técnicos van plegadas en un resumen: se abre para ver la lista con sus interruptores.
      { id: 'tecnicos-lista', preparar: (n) => n.clic('técnicos ·'), limpiar: (n) => n.clic('técnicos ·') },
      // La campana de la oficina con sus avisos (el pre-finalizado de la siembra y los que genera la app).
      { id: 'notificaciones', preparar: (n) => n.clicEtiqueta('^notificaciones'), limpiar: (n) => n.esc() },
      { id: 'nueva-orden', preparar: (n) => n.clic('nueva orden'), limpiar: seguir },
      { id: 'nueva-orden-errores', preparar: (n) => n.clic('guardar', { dentro: true }) },
      { id: 'detalle', preparar: (n) => n.clicEtiqueta('^ver detalle de la orden as2$') },
      { id: 'editar', preparar: accionOrden({ pc: 'editar', movil: 'editar' }) },
      { id: 'historial-orden', viewports: ['pc'], preparar: accionOrden({ pc: 'historial', movil: '' }) },
      { id: 'cancelar-orden', preparar: accionOrden({ pc: 'cancelar orden', movilMenu: 'cancelar orden' }) },
      { id: 'escalar', preparar: accionOrden({ pc: 'escalar', movilMenu: 'escalar a infraestructura', codigo: 'as1' }) },
      { id: 'finalizar-datos', preparar: (n) => n.clic('finalizar'), limpiar: seguir },
      { id: 'finalizar-valores', preparar: (n) => n.clic('siguiente', { dentro: true }) },
    ],
  },
  // Los módulos de la oficina (Cierre, Historial, Revisión de órdenes, Técnicos, Usuarios, Tasa y pagos, Configuración).
  {
    id: 'admin-modulos',
    usuario: 'admin',
    clave: 'Admin1234',
    pantallas: [
      { id: 'cierre', preparar: (n) => n.irAModulo('Cierre') },
      { id: 'cierre-ejecutar', preparar: (n) => n.clic('ejecutar cierre') },
      { id: 'historial', preparar: (n) => n.irAModulo('Historial') },
      { id: 'historial-filtros', preparar: (n) => n.clicEtiqueta('^filtros$'), limpiar: (n) => n.clicEtiqueta('^filtros$') },
      { id: 'historial-fila', preparar: (n) => n.ev(() => { const b = [...document.querySelectorAll('button[aria-expanded="false"]')].find((e) => e.className.includes('text-left')); if (!b) return false; b.click(); return true; }) },
      { id: 'revision', preparar: (n) => n.irAModulo('Revisión de órdenes') },
      { id: 'revision-menu', preparar: (n) => n.ev(() => { const b = document.querySelector('button[aria-haspopup="menu"][aria-label^="Más acciones de la orden"]'); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; }) },
      { id: 'tecnicos', preparar: (n) => n.irAModulo('Técnicos') },
      { id: 'usuarios', preparar: (n) => n.irAModulo('Usuarios') },
      // El formulario de "Nuevo usuario" se abre con el botón rojo de la lista (a la derecha en PC; debajo en celular).
      { id: 'usuarios-nuevo', preparar: (n) => n.clic('nuevo usuario') },
      // Con el formulario de "Nuevo usuario" a la vista (en PC es la columna de la derecha; en celular, la ventana recién abierta).
      { id: 'usuarios-rol', preparar: (n) => n.ev(() => { const r = document.querySelector('#user-role'); if (!r) return false; r.click(); return true; }) },
      { id: 'tasa-y-pagos', preparar: (n) => n.irAModulo('Tasa y pagos') },
      { id: 'formas-de-pago', preparar: (n) => n.clic('formas de pago') },
      { id: 'configuracion', preparar: (n) => n.irAModulo('Configuración') },
    ],
  },
  // Reportes: las once vistas y sus menús.
  {
    id: 'admin-reportes',
    usuario: 'admin',
    clave: 'Admin1234',
    pantallas: [
      { id: 'resumen-ejecutivo', preparar: (n) => n.irAModulo('Reportes') },
      { id: 'exportar', preparar: (n) => n.clic('exportar'), limpiar: (n) => n.esc() },
      ...['Estadísticas', 'Registro de estadísticas', 'Causas de avería', 'Cobros y exoneraciones', 'Tendencia mensual', 'Tiempo de atención', 'Esperas del ciclo', 'Productividad', 'Calidad y reincidencias', 'Activación de técnicos']
        .map((nombre) => ({ id: nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ /g, '-'), preparar: vistaReporte(nombre), espera: 2200 })),
    ],
  },
  // Finanzas con su propio usuario: su pantalla de inicio con la barra de filtros.
  { id: 'finanzas', usuario: 'finanzas', clave: 'Finanzas1234', pantallas: [{ id: 'inicio', preparar: async () => true, espera: 2200 }] },
  // Administración (concilia los cobros de los clientes): la lista y su panel de filtros.
  { id: 'administracion', usuario: 'administracion', clave: 'Administracion1234', pantallas: [{ id: 'inicio', preparar: async () => true, espera: 2200 }, { id: 'filtros', preparar: (n) => n.clicEtiqueta('^filtros$'), limpiar: (n) => n.clicEtiqueta('^filtros$') }] },
  // Infraestructura (instalaciones realizadas): la lista y su panel de filtros.
  { id: 'infraestructura', usuario: 'infra', clave: 'Infra1234', pantallas: [{ id: 'inicio', preparar: async () => true, espera: 2200 }, { id: 'filtros', preparar: (n) => n.clicEtiqueta('^filtros$'), limpiar: (n) => n.clicEtiqueta('^filtros$') }] },
  // Las secciones de la vista propia de Finanzas y la pestaña Historial de Infraestructura (cada rol tiene su vista, distinta de la del administrador).
  { id: 'finanzas-secciones', usuario: 'finanzas', clave: 'Finanzas1234', pantallas: [
    { id: 'pagos-de-clientes', preparar: (n) => n.clic('pagos de clientes'), espera: 1800 },
    { id: 'tabulador', preparar: (n) => n.clic('tabulador de precios'), espera: 1800 },
    { id: 'reporte-de-pagos', preparar: (n) => n.clic('reporte de pagos'), espera: 1800 },
  ] },
  { id: 'infraestructura-historial', usuario: 'infra', clave: 'Infra1234', pantallas: [
    { id: 'historial', preparar: (n) => n.clic('historial'), espera: 1800 },
  ] },
  // Los demás roles en su propia vista: la cabecera de cada uno.
  { id: 'almacen', usuario: 'almacen', clave: 'Almacen1234', pantallas: [{ id: 'inicio', preparar: async () => true, espera: 2200 }] },
  { id: 'promotora', usuario: 'promotora', clave: 'Promotora1234', pantallas: [{ id: 'inicio', preparar: async () => true, espera: 2200 }] },
  { id: 'usuario', usuario: 'usuario', clave: 'Usuario1234', pantallas: [{ id: 'panel', preparar: async () => true, espera: 2200 }] },
  // Los módulos del administrador que no estaban: cada uno con su cabecera.
  {
    id: 'admin-resto',
    usuario: 'admin',
    clave: 'Admin1234',
    pantallas: ['Administración', 'Finanzas', 'Ubicación', 'Almacén', 'Envíos al inventario', 'Infraestructura', 'Ventas'].map((nombre) => ({ id: nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ /g, '-'), preparar: (n) => n.irAModulo(nombre), espera: 2200 })),
  },
  { id: 'tecnico1', usuario: 'tecnico1', clave: 'Tecnico1234', pantallas: [...inicioTecnico, ...preFinalizarVisita] },
  { id: 'tecnico2', usuario: 'tecnico2', clave: 'Tecnico1234', pantallas: [...inicioTecnico, ...preFinalizarInstalacion] },
];
