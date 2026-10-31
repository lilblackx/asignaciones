// Registro de estaciones: cada navegador abierto con la app (una "estación") reporta cada 10 minutos quién lo usa, desde qué equipo y todo lo
// que puede afectar a producción desde ese navegador: cuánto lee y escribe en Firestore, qué le rechaza el servidor y por qué, cuántos
// escuchadores tiene abiertos (y si se vuelven a suscribir sin parar), errores de la app y cómo le va a las escrituras automáticas. Así se sabe
// desde dónde viene un problema si se repite algo como el pico de lecturas del 31/10/2026. Lo guarda hooks/useEstacion en estaciones/{estacionId};
// solo lo ven los usuarios de USUARIOS_ESTACIONES (lo hacen cumplir las reglas de Firestore: mantener esta lista igual a la de la función
// veEstaciones de firestore.rules). Funciones puras: las usan la app y scripts/test-estaciones.mjs.

export const USUARIOS_ESTACIONES = ['lfernandez'];
export const veEstaciones = (username) => USUARIOS_ESTACIONES.includes(String(username ?? '').trim().toLowerCase());

export const INTERVALO_REPORTE_MS = 10 * 60 * 1000;
// Entre dos reportes, aunque haya una anomalía nueva: así un problema no se convierte en otro (escribir sin parar).
export const MIN_ENTRE_REPORTES_MS = 2 * 60 * 1000;
// Una estación que no reporta en este tiempo se muestra desconectada (pestaña cerrada, equipo apagado o sin conexión).
export const EN_LINEA_MS = 15 * 60 * 1000;
export const VENTANA_ANOMALIA_MS = 5 * 60 * 1000;

// Cuánto es anómalo en 5 minutos desde una sola estación (el uso normal queda muy por debajo; abrir la app o un módulo grande lee unos cientos
// de una vez). El bucle del 31/10 leía ~1.800 en 5 minutos.
export const UMBRALES = {
  lecturas: 1000,
  escrituras: 150,
  rechazadas: 5,
  erroresEscucha: 10,
  sinPermiso: 3,
  suscripciones: 150,
  erroresApp: 5,
  // Escuchadores abiertos a la vez (no por 5 minutos): una fuga los acumula sin cerrarlos.
  escuchadoresActivos: 80,
  // Escrituras automáticas fallidas desde el último reporte.
  automaticasFallidas: 3,
  // Diferencia entre el reloj del equipo y el del servidor que ya cambia lo que la app calcula (vencimientos, días, "hace cuánto").
  relojMinutos: 5,
};

const SERIES = ['lecturas', 'escrituras', 'rechazadas', 'erroresEscucha', 'suscripciones', 'erroresApp'];
const ceros = () => Object.fromEntries(SERIES.map((s) => [s, 0]));
const MAX_COLECCIONES = 6;
const MAX_CODIGOS = 6;
const CUBO_MS = 10 * 1000;
const sumarEn = (mapa, clave, n) => { mapa[clave] = (mapa[clave] || 0) + n; };

// Cuenta lo que hace la sesión con Firestore: el total de la sesión, lo que va desde el último reporte (la "ventana") y los últimos minutos
// (para notar un pico sin esperar al reporte). `ahora` va por parámetro para poder probarlo.
export function crearMedidor() {
  let total = ceros();
  let ventana = { ...ceros(), porColeccion: {}, escriturasPorColeccion: {}, errores: {} };
  let cubos = []; // [{ t, serie: { lecturas, ... } }] de 10 s
  let activos = 0;
  let ultimoError = '';

  const anotar = (serie, n, ahora) => {
    if (!(n > 0)) return;
    total[serie] += n;
    ventana[serie] += n;
    const t = Math.floor(ahora / CUBO_MS) * CUBO_MS;
    let cubo = cubos[cubos.length - 1];
    if (!cubo || cubo.t !== t) { cubo = { t, ...ceros() }; cubos.push(cubo); }
    cubo[serie] += n;
    cubos = cubos.filter((c) => ahora - c.t < VENTANA_ANOMALIA_MS + CUBO_MS);
  };

  return {
    // Lecturas que llegaron del servidor.
    sumar(coleccion, n, ahora) {
      if (!(n > 0)) return;
      anotar('lecturas', n, ahora);
      sumarEn(ventana.porColeccion, coleccion, n);
    },
    escritura(coleccion, n, ahora) {
      if (!(n > 0)) return;
      anotar('escrituras', n, ahora);
      sumarEn(ventana.escriturasPorColeccion, coleccion, n);
    },
    // Una escritura que el servidor rechazó (`codigo`: permission-denied, resource-exhausted...).
    rechazo(codigo, ahora) {
      anotar('rechazadas', 1, ahora);
      sumarEn(ventana.errores, `escritura:${codigo || 'desconocido'}`, 1);
    },
    // Un escuchador o una lectura que falló.
    errorLectura(codigo, ahora) {
      anotar('erroresEscucha', 1, ahora);
      sumarEn(ventana.errores, `lectura:${codigo || 'desconocido'}`, 1);
    },
    suscrito(ahora) { activos++; anotar('suscripciones', 1, ahora); },
    desuscrito() { activos = Math.max(0, activos - 1); },
    errorApp(mensaje, ahora) {
      anotar('erroresApp', 1, ahora);
      ultimoError = String(mensaje || 'Error sin mensaje').replace(/\s+/g, ' ').trim().slice(0, 200);
    },
    // Lo de la serie en los últimos `ms`.
    recientes(ahora, ms = VENTANA_ANOMALIA_MS, serie = 'lecturas') {
      return cubos.filter((c) => ahora - c.t < ms).reduce((s, c) => s + c[serie], 0);
    },
    // Las series de los últimos 5 minutos, todas juntas (para buscar anomalías).
    ultimos5(ahora) {
      return Object.fromEntries(SERIES.map((s) => [s, this.recientes(ahora, VENTANA_ANOMALIA_MS, s)]));
    },
    // Errores de lectura por código en los últimos minutos no se guardan por cubo: se usa la ventana.
    erroresVentana: () => ({ ...ventana.errores }),
    total: () => total.lecturas,
    totales: () => ({ ...total }),
    activos: () => activos,
    ultimoError: () => ultimoError,
    ventana: () => ({ ...ventana, porColeccion: { ...ventana.porColeccion }, escriturasPorColeccion: { ...ventana.escriturasPorColeccion }, errores: { ...ventana.errores } }),
    // Devuelve la ventana y empieza otra (al reportar).
    cortar() {
      const v = this.ventana();
      ventana = { ...ceros(), porColeccion: {}, escriturasPorColeccion: {}, errores: {} };
      return v;
    },
  };
}

// Las claves con más cantidad, de mayor a menor (las demás se suman en "otras").
export function principales(mapa, max = MAX_COLECCIONES) {
  const lista = Object.entries(mapa || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const arriba = Object.fromEntries(lista.slice(0, max).map(([c, n]) => [String(c).slice(0, 40), n]));
  const resto = lista.slice(max).reduce((s, [, n]) => s + n, 0);
  return resto > 0 ? { ...arriba, otras: resto } : arriba;
}

// "Windows · Edge", "Android · Chrome" (móvil)...
export function describirEquipo(userAgent = '', { ancho = 0, alto = 0, instalada = false } = {}) {
  const ua = String(userAgent);
  const sistema = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : 'Otro';
  const navegador = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Otro';
  return { sistema, navegador, movil: /Mobi|Android|iPhone|iPad|iPod/i.test(ua), pantalla: ancho && alto ? `${ancho}x${alto}` : '', instalada: Boolean(instalada) };
}

const cuantas = (n, una, varias) => `${n} ${n === 1 ? una : varias}`;

// Lo que anda mal en una estación, del más grave al menos: [texto]. Vacío si todo está normal.
//   ultimos5: las series de los últimos 5 minutos (crearMedidor().ultimos5); errores: { 'lectura:permission-denied': n, ... } desde el último reporte.
export function alertasDe({ ultimos5 = {}, errores = {}, escuchadoresActivos = 0, fallidasVentana = 0, cortacircuitos = false } = {}) {
  const u = { ...ceros(), ...ultimos5 };
  const de = (prefijo, codigo) => Number(errores[`${prefijo}:${codigo}`]) || 0;
  const alertas = [];
  const cuota = de('lectura', 'resource-exhausted') + de('escritura', 'resource-exhausted');
  if (cuota > 0) alertas.push(`Firestore rechazó ${cuantas(cuota, 'operación', 'operaciones')} por cuota agotada`);
  if (cortacircuitos) alertas.push('Se activó el freno de escrituras automáticas (demasiadas fallaron seguidas)');
  if (u.lecturas > UMBRALES.lecturas) alertas.push(`Lee demasiado: ${u.lecturas} lecturas en 5 minutos`);
  if (u.escrituras > UMBRALES.escrituras) alertas.push(`Escribe demasiado: ${u.escrituras} escrituras en 5 minutos`);
  if (u.rechazadas >= UMBRALES.rechazadas) alertas.push(`El servidor le rechazó ${u.rechazadas} escrituras en 5 minutos (un bucle o un permiso que falta)`);
  if (u.suscripciones > UMBRALES.suscripciones) alertas.push(`Se vuelve a suscribir demasiado: ${u.suscripciones} veces en 5 minutos (relee todo cada vez)`);
  if (escuchadoresActivos > UMBRALES.escuchadoresActivos) alertas.push(`Demasiados escuchadores abiertos a la vez: ${escuchadoresActivos} (posible fuga)`);
  const sinPermiso = de('lectura', 'permission-denied');
  if (sinPermiso >= UMBRALES.sinPermiso) alertas.push(`${cuantas(sinPermiso, 'lectura rechazada', 'lecturas rechazadas')} por falta de permiso`);
  else if (u.erroresEscucha >= UMBRALES.erroresEscucha) alertas.push(`${u.erroresEscucha} lecturas fallidas en 5 minutos`);
  if (fallidasVentana >= UMBRALES.automaticasFallidas) alertas.push(`${fallidasVentana} escrituras automáticas fallidas desde el último reporte`);
  if (u.erroresApp >= UMBRALES.erroresApp) alertas.push(`${u.erroresApp} errores de la app en 5 minutos`);
  return alertas;
}

// Lo mismo, en un solo texto (lo que se guarda en la estación).
export const anomaliaDe = (datos) => alertasDe(datos).join(' · ').slice(0, 600);

// El documento que guarda la estación (mismos campos que valida firestore.rules, estaciones). `reloj` lo pone quien llama (la hora del servidor).
export function armarReporte({ estacionId, uid, usuario, nombre, rol, equipo, build, abiertaEn, ahora, visible, conectada = true, ventana, desde, totales, escuchadoresActivos = 0, ultimoError = '', automaticas, cortacircuitos, pausadas, anomalia }) {
  const t = { ...ceros(), ...totales };
  return {
    estacionId,
    uid,
    usuario: String(usuario || ''),
    nombre: String(nombre || '').slice(0, 100),
    rol: String(rol || '').slice(0, 30),
    equipo,
    build: String(build || '').slice(0, 60),
    abiertaEn,
    ultimaSenal: ahora,
    visible: Boolean(visible),
    conectada: Boolean(conectada),
    ventana: {
      desde, hasta: ahora,
      lecturas: ventana.lecturas || 0, porColeccion: principales(ventana.porColeccion),
      escrituras: ventana.escrituras || 0, escriturasPorColeccion: principales(ventana.escriturasPorColeccion),
      rechazadas: ventana.rechazadas || 0, erroresEscucha: ventana.erroresEscucha || 0, errores: principales(ventana.errores, MAX_CODIGOS),
      suscripciones: ventana.suscripciones || 0, erroresApp: ventana.erroresApp || 0,
      automaticasIntentadas: automaticas.ventanaIntentadas, automaticasFallidas: automaticas.ventanaFallidas,
    },
    total: {
      lecturas: t.lecturas, escrituras: t.escrituras, rechazadas: t.rechazadas, erroresEscucha: t.erroresEscucha, suscripciones: t.suscripciones, erroresApp: t.erroresApp,
      automaticasIntentadas: automaticas.intentadas, automaticasFallidas: automaticas.fallidas,
    },
    escuchadoresActivos: Math.max(0, Math.round(Number(escuchadoresActivos) || 0)),
    ultimoError: String(ultimoError || '').slice(0, 200),
    cortacircuitos: Boolean(cortacircuitos),
    automaticasPausadas: Boolean(pausadas),
    anomalia: String(anomalia || '').slice(0, 600),
  };
}

// --- Para la pantalla ---

export const enLinea = (e, ahora) => ahora - (Number(e?.ultimaSenal) || 0) < EN_LINEA_MS;

// Minutos que el reloj del equipo va adelantado (+) o atrasado (−) respecto del servidor, con lo que guardó el último reporte. null si no se sabe.
export function desfaseReloj(e) {
  const servidor = typeof e?.reloj?.toMillis === 'function' ? e.reloj.toMillis() : Number(e?.reloj?.seconds) * 1000 || null;
  if (!servidor || !Number(e?.ultimaSenal)) return null;
  return Math.round((Number(e.ultimaSenal) - servidor) / 60000);
}

// Lo que se ve en la pantalla además de lo que reportó la estación: el reloj desfasado, una versión vieja de la app y que esté sin conexión.
export function avisosDePantalla(e, buildActual) {
  const avisos = [];
  const desfase = desfaseReloj(e);
  if (desfase !== null && Math.abs(desfase) >= UMBRALES.relojMinutos) avisos.push(`El reloj del equipo va ${Math.abs(desfase)} min ${desfase > 0 ? 'adelantado' : 'atrasado'}: cambia vencimientos y fechas que calcula la app`);
  if (e?.build && buildActual && e.build !== buildActual) avisos.push('Usa una versión anterior de la app (no ha recargado desde la última publicación)');
  if (e?.conectada === false) avisos.push('Estaba sin conexión al reportar');
  return avisos;
}

// Primero las que tienen una anomalía, después las en línea, después las demás; dentro de cada grupo, la señal más reciente primero.
export const ordenarEstaciones = (lista, ahora) => [...lista].sort((a, b) => {
  const peso = (e) => (e.anomalia && enLinea(e, ahora) ? 0 : e.anomalia ? 1 : enLinea(e, ahora) ? 2 : 3);
  return peso(a) - peso(b) || (Number(b.ultimaSenal) || 0) - (Number(a.ultimaSenal) || 0);
});

// "hace 3 min", "hace 2 h", "hace 4 d".
export function haceCuanto(ms, ahora) {
  const min = Math.max(0, Math.round((ahora - ms) / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}
