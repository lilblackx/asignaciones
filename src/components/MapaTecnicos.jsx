import { useEffect, useRef, useState } from 'react';

// El mapa de la ubicación de los técnicos: OpenStreetMap con Leaflet (la librería y su hoja de estilos se bajan solo al abrir el módulo Ubicación). Dibuja un punto con el nombre de cada técnico que
// tiene posición (rojo en vivo, gris sin señal reciente, azul la última ubicación conocida de una acción) y un círculo del tamaño de la precisión del GPS. `puntos`: [{ id, nombre, lat, lng, precision, tipo }],
// con `tipo`: 'vivo' | 'sin-senal' | 'ultima' y `color` (el del técnico, en el borde de su etiqueta). `rutas` (opcional): [{ id, nombre, color, desde: { lat, lng } | null, paradas: [{ id, codigo, lat, lng, n, prioridad }] }]
// dibuja la ruta de cada técnico en línea recta, de donde está hoy a sus paradas numeradas en orden (borde amarillo: prioridad alta).
// Al aparecer los primeros puntos se encuadra a todos; después el mapa lo maneja la persona (arrastrar, zoom) y solo se mueve con `centrarVez` (centrar en todos) o `enfocarVez` + `enfocarId`
// (ir a un técnico). Los puntos se actualizan sin mover el mapa.
const CENTRO_INICIAL = [10.65, -71.64];
const URL_TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

// Un punto con su nombre encima. Se arma con elementos (no con texto HTML): el nombre nunca se interpreta como código.
const COLOR_PUNTO = { vivo: '#dc2626', 'sin-senal': '#71717a', ultima: '#2563eb' };
function crearIcono(L, { nombre, tipo, color }) {
  const raiz = document.createElement('div');
  raiz.style.cssText = 'position:relative;width:0;height:0';
  const punto = document.createElement('span');
  punto.style.cssText = `position:absolute;left:-8px;top:-8px;width:16px;height:16px;border-radius:9999px;background:${COLOR_PUNTO[tipo] || COLOR_PUNTO['sin-senal']};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.55)`;
  const etiqueta = document.createElement('span');
  etiqueta.textContent = tipo === 'ultima' ? `${nombre} · última` : nombre;
  etiqueta.style.cssText = 'position:absolute;left:0;bottom:12px;transform:translateX(-50%);white-space:nowrap;padding:2px 7px;border-radius:8px;background:rgba(0,0,0,.85);color:#fff;font:700 11px/1.3 system-ui,sans-serif' + (color ? `;border-left:4px solid ${color}` : '');
  raiz.append(punto, etiqueta);
  return L.divIcon({ html: raiz, className: '', iconSize: [0, 0] });
}

// Una parada de la ruta: un círculo con su número, del color del técnico; el código y el nombre del cliente salen al pasar el cursor.
function crearParada(L, { n, prioridad }, color) {
  const raiz = document.createElement('div');
  raiz.style.cssText = `width:22px;height:22px;border-radius:9999px;background:${color};color:#fff;border:${prioridad ? '3px solid #facc15' : '2px solid #fff'};box-shadow:0 1px 4px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font:800 11px/1 system-ui,sans-serif;transform:translate(-50%,-50%)`;
  raiz.textContent = String(n);
  return L.divIcon({ html: raiz, className: '', iconSize: [0, 0] });
}

export default function MapaTecnicos({ puntos, rutas = [], enfocarId = null, enfocarVez = 0, centrarVez = 0, nombre = 'Mapa de la ubicación de los técnicos' }) {
  const contenedor = useRef(null);
  const interno = useRef({ L: null, mapa: null, marcadores: new Map(), capaRutas: null, encuadrado: false });
  const ultimos = useRef(puntos);
  const ultimasRutas = useRef(rutas);
  const [listo, setListo] = useState(false);

  useEffect(() => { ultimos.current = puntos; ultimasRutas.current = rutas; }, [puntos, rutas]);

  useEffect(() => {
    let cancelado = false;
    let observador = null;
    const estado = interno.current;
    (async () => {
      const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
      if (cancelado || !contenedor.current) return;
      const mapa = L.map(contenedor.current, { center: CENTRO_INICIAL, zoom: 12 });
      mapa.attributionControl.setPrefix(false);
      L.tileLayer(URL_TESELAS, { maxZoom: 19, attribution: ATRIBUCION, referrerPolicy: 'strict-origin-when-cross-origin' }).addTo(mapa);
      estado.L = L;
      estado.mapa = mapa;
      estado.capaRutas = L.layerGroup().addTo(mapa);
      // El contenedor cambia de tamaño (menú que se contrae, giro del teléfono): el mapa lo recalcula.
      if (typeof ResizeObserver !== 'undefined') { observador = new ResizeObserver(() => mapa.invalidateSize()); observador.observe(contenedor.current); }
      setListo(true);
    })();
    return () => {
      cancelado = true;
      observador?.disconnect();
      estado.mapa?.remove();
      Object.assign(estado, { L: null, mapa: null, marcadores: new Map(), capaRutas: null, encuadrado: false });
    };
  }, []);

  const encuadrar = () => {
    const { L, mapa } = interno.current;
    // Se encuadran los técnicos y, si se están viendo, también las paradas de sus rutas.
    const lista = [...ultimos.current, ...ultimasRutas.current.flatMap((r) => r.paradas)];
    if (!mapa || lista.length === 0) return;
    if (lista.length === 1) mapa.setView([lista[0].lat, lista[0].lng], 16);
    else mapa.fitBounds(L.latLngBounds(lista.map((p) => [p.lat, p.lng])), { padding: [70, 70], maxZoom: 17 });
  };

  useEffect(() => {
    if (!listo) return;
    const estado = interno.current;
    const { L, mapa, marcadores } = estado;
    const vistos = new Set();
    for (const p of puntos) {
      vistos.add(p.id);
      const icono = crearIcono(L, p);
      let m = marcadores.get(p.id);
      if (!m) { m = { marcador: L.marker([p.lat, p.lng], { icon: icono, keyboard: false, title: p.nombre }).addTo(mapa), circulo: null }; marcadores.set(p.id, m); }
      else { m.marcador.setLatLng([p.lat, p.lng]); m.marcador.setIcon(icono); }
      if (p.precision > 0) {
        if (m.circulo) m.circulo.setLatLng([p.lat, p.lng]).setRadius(p.precision);
        else m.circulo = L.circle([p.lat, p.lng], { radius: p.precision, color: '#0ea5e9', weight: 1, fillColor: '#0ea5e9', fillOpacity: 0.15, interactive: false }).addTo(mapa);
      } else if (m.circulo) { m.circulo.remove(); m.circulo = null; }
    }
    for (const [id, m] of marcadores) if (!vistos.has(id)) { m.marcador.remove(); m.circulo?.remove(); marcadores.delete(id); }
    if (puntos.length === 0) estado.encuadrado = false;
    else if (!estado.encuadrado) { estado.encuadrado = true; encuadrar(); }
  }, [listo, puntos]);

  // Las rutas se redibujan enteras cuando cambian (son pocas líneas y pocas paradas).
  useEffect(() => {
    if (!listo) return;
    const { L, capaRutas } = interno.current;
    capaRutas.clearLayers();
    for (const ruta of rutas) {
      const camino = [...(ruta.desde ? [[ruta.desde.lat, ruta.desde.lng]] : []), ...ruta.paradas.map((p) => [p.lat, p.lng])];
      if (camino.length > 1) L.polyline(camino, { color: ruta.color, weight: 3, opacity: 0.85, dashArray: '8 8', interactive: false }).addTo(capaRutas);
      for (const p of ruta.paradas) {
        const texto = document.createElement('span');
        texto.textContent = `${p.n}. ${p.codigo}${p.nombre ? ` · ${p.nombre}` : ''} (${ruta.nombre})`;
        L.marker([p.lat, p.lng], { icon: crearParada(L, p, ruta.color), keyboard: false, title: `${p.codigo} (${ruta.nombre})` }).bindTooltip(texto, { direction: 'top', offset: [0, -12] }).addTo(capaRutas);
      }
    }
  }, [listo, rutas]);

  useEffect(() => {
    if (!listo || !centrarVez) return;
    encuadrar();
  }, [centrarVez]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const { mapa } = interno.current;
    const p = ultimos.current.find((x) => x.id === enfocarId);
    if (!listo || !enfocarVez || !mapa || !p) return;
    mapa.flyTo([p.lat, p.lng], Math.max(mapa.getZoom(), 16), { duration: 0.8 });
  }, [enfocarVez]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={contenedor} role="region" aria-label={nombre} className="w-full h-full rounded-campo overflow-hidden bg-zinc-200 dark:bg-zinc-800" />;
}
