// La "Ruta del día" del técnico: sus órdenes pendientes de hoy como paradas de un solo recorrido en Google Maps.
//
// Qué órdenes entran: las PENDIENTES del técnico que no esperan a infraestructura y no están programadas para otro día (las de hoy,
// las vencidas y las sin fecha). Cada una necesita un punto: la ubicación del cliente y, si no la tiene, las coordenadas de la NAP.
// Las que no tienen ninguna de las dos no entran en la ruta y se avisan aparte.
//
// En qué orden: primero las de prioridad alta y luego las demás; en cada grupo, de la más cercana a la más lejana (vecino más cercano
// encadenado: cada parada se escoge desde la anterior), partiendo de donde está el técnico. La distancia es en línea recta, no por
// calles. Sin la ubicación del técnico, cada grupo parte de su primera orden en el orden de la lista.
//
// El enlace de Google Maps no lleva origen: Maps sale de donde esté el técnico al abrirlo (así aparece "Iniciar"). Una ruta larga
// se parte en tandas (el enlace admite pocas paradas); desde la segunda tanda el origen es la última parada de la anterior.
import { categoriaProgramada } from './programada.js';
import { enInfraestructura } from './infraestructura.js';
import { esPrioritaria } from './prioridad.js';
import { coordenadasDeNap, coordenadasDeUbicacion } from './ubicacion.js';

// Paradas por enlace (la última es el destino y las demás van como puntos intermedios). Google documenta un tope de puntos intermedios
// en los enlaces; se queda por debajo para que el enlace nunca se rechace.
export const MAX_PARADAS_POR_RUTA = 9;

export const FUENTE_CLIENTE = 'cliente';
export const FUENTE_NAP = 'nap';

const valida = (p) => Boolean(p) && Number.isFinite(p.lat) && Number.isFinite(p.lng);

// Distancia en línea recta entre dos puntos { lat, lng }, en km (fórmula del semiverseno).
export function distanciaKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// { lat, lng, fuente } donde ir en una orden: la casa del cliente o, si no hay, la NAP. null si no tiene ninguno.
export function puntoDeOrden(t) {
  const cliente = coordenadasDeUbicacion(t?.ubicacion);
  if (valida(cliente)) return { ...cliente, fuente: FUENTE_CLIENTE };
  const nap = coordenadasDeNap(t?.napCoordenadas);
  if (valida(nap)) return { ...nap, fuente: FUENTE_NAP };
  return null;
}

// Las órdenes que cuentan para la ruta de hoy (con o sin punto).
export const ordenesDeRuta = (tickets, ahora = new Date()) => (tickets || []).filter((t) => t?.estado === 'PENDIENTE'
  && !enInfraestructura(t) && categoriaProgramada(t.fechaProgramada, ahora) !== 'futura');

// { paradas, sinPunto }: las órdenes de la ruta con su punto, y las que no se pueden ubicar.
export function paradasDeRuta(tickets, ahora = new Date()) {
  const paradas = [];
  const sinPunto = [];
  for (const t of ordenesDeRuta(tickets, ahora)) {
    const punto = puntoDeOrden(t);
    const datos = { id: t.id, codigo: t.codigo || 'S/C', nombre: t.nombre || '', tipoTrabajo: t.tipoTrabajo || '', prioridad: esPrioritaria(t) };
    if (punto) paradas.push({ ...datos, punto });
    else sinPunto.push(datos);
  }
  return { paradas, sinPunto };
}

// Vecino más cercano encadenado: cada parada se escoge desde la anterior. Sin `desde`, parte de la primera de la lista.
function encadenar(lista, desde) {
  const resto = [...lista];
  const orden = [];
  let actual = valida(desde) ? desde : null;
  while (resto.length) {
    let mejor = 0;
    if (actual) {
      let menor = Infinity;
      resto.forEach((p, i) => {
        const d = distanciaKm(actual, p.punto);
        if (d < menor) { menor = d; mejor = i; }
      });
    }
    const [elegida] = resto.splice(mejor, 1);
    orden.push(elegida);
    actual = elegida.punto;
  }
  return orden;
}

// El orden sugerido: las de prioridad alta primero y el resto después, cada grupo de la más cercana a la más lejana. `posicion`: { lat, lng }
// del técnico, o null si no se sabe.
export function ordenSugerido(paradas, posicion = null) {
  const prioritarias = encadenar(paradas.filter((p) => p.prioridad), posicion);
  const desde = prioritarias.length ? prioritarias[prioritarias.length - 1].punto : posicion;
  return [...prioritarias, ...encadenar(paradas.filter((p) => !p.prioridad), desde)];
}

// Cuántos km (en línea recta) recorre una ruta que parte de `posicion`; sin posición, desde la primera parada.
export function kmDeRuta(paradas, posicion = null) {
  let total = 0;
  let anterior = valida(posicion) ? posicion : null;
  for (const p of paradas) {
    if (anterior) total += distanciaKm(anterior, p.punto);
    anterior = p.punto;
  }
  return total;
}

const coma = (p) => `${p.lat},${p.lng}`;

// Los enlaces de Google Maps de una ruta, uno por tanda: [{ url, desde, hasta, cantidad }] (desde y hasta son números de parada, de 1).
export function enlacesDeRuta(paradas, maximo = MAX_PARADAS_POR_RUTA) {
  const enlaces = [];
  for (let inicio = 0; inicio < paradas.length; inicio += maximo) {
    const tanda = paradas.slice(inicio, inicio + maximo);
    const destino = tanda[tanda.length - 1];
    const intermedias = tanda.slice(0, -1);
    const partes = ['api=1'];
    if (inicio > 0) partes.push(`origin=${coma(paradas[inicio - 1].punto)}`);
    if (intermedias.length) partes.push(`waypoints=${intermedias.map((p) => coma(p.punto)).join('%7C')}`);
    partes.push(`destination=${coma(destino.punto)}`, 'travelmode=driving');
    enlaces.push({ url: `https://www.google.com/maps/dir/?${partes.join('&')}`, desde: inicio + 1, hasta: inicio + tanda.length, cantidad: tanda.length });
  }
  return enlaces;
}
