// Cuánto pesan y cuánto consumen las fotos de los "Detalles de la orden" (ver utils/detallesOrden), con las órdenes reales: cada foto guarda su peso (`bytes`) al subirse, así que no hace falta pedir nada a Storage.
// Lo usa scripts/medir-fotos-reales.mjs. Devuelve los números y, en `recomendaciones`, qué conviene hacer (nada, bajar el tamaño de las fotos o implementar las miniaturas: docs/PLAN-MINIATURAS.md).

// Los cupos gratis de Cloud Storage for Firebase en el plan Blaze (buckets *.firebasestorage.app de us-central1, us-east1 y us-west1).
export const CUPOS_STORAGE = { almacenamientoGB: 5, descargasGBMes: 100, subidasMes: 5000, lecturasMes: 50000 };
// Cuántas veces se abre en promedio una orden con fotos en la oficina, y cuánto bajaría el peso al pasar a 1280 px y calidad 60 % (medido con fotos de muestra: entre 0,45 y 0,55).
export const VISTAS_POR_ORDEN = 2;
const FACTOR_1280_60 = 0.55;
const KB = 1024;
const GB = 1024 * 1024 * 1024;
const redondear = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

function percentil(ordenados, p) {
  if (ordenados.length === 0) return 0;
  const i = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[Math.max(0, i)];
}

// `ordenes`: [{ id, detallesOrden: { fotos: [{ bytes }], subidoEn } }] (las de la lista y las archivadas en los cierres). Solo cuentan las subidas dentro de los últimos `dias` (los 60 de la retención del bucket).
export function resumirFotos(ordenes, { dias = 60, vistasPorOrden = VISTAS_POR_ORDEN, ahora = Date.now() } = {}) {
  const desde = ahora - dias * 24 * 3600 * 1000;
  const unicas = new Map();
  for (const o of ordenes || []) {
    const d = o?.detallesOrden;
    if (!d || !Array.isArray(d.fotos) || d.fotos.length === 0) continue;
    if (!(Number(d.subidoEn) >= desde)) continue;
    unicas.set(String(o.id), d);
  }
  const lista = [...unicas.values()];
  const pesos = lista.flatMap((d) => d.fotos.map((f) => Number(f.bytes) || 0)).filter((b) => b > 0).sort((a, b) => a - b);
  const totalBytes = pesos.reduce((a, b) => a + b, 0);
  const resultado = {
    dias,
    ordenes: lista.length,
    fotos: pesos.length,
    recomendaciones: [],
  };
  if (pesos.length === 0) {
    resultado.recomendaciones.push('Todavía no hay fotos subidas en ese período: no hay nada que medir.');
    return resultado;
  }
  const porOrdenKB = totalBytes / lista.length / KB;
  const ordenesMes = (lista.length / dias) * 30;
  const vistasMes = ordenesMes * vistasPorOrden;
  Object.assign(resultado, {
    fotoKB: { promedio: redondear(totalBytes / pesos.length / KB, 0), mediana: redondear(percentil(pesos, 50) / KB, 0), p95: redondear(percentil(pesos, 95) / KB, 0), max: redondear(pesos[pesos.length - 1] / KB, 0) },
    fotosPorOrden: redondear(pesos.length / lista.length),
    ordenKB: redondear(porOrdenKB, 0),
    ordenesPorDia: redondear(lista.length / dias),
    // Lo guardado: todo lo subido en el período (el bucket borra lo de más de 60 días).
    almacenamientoGB: redondear(totalBytes / GB, 2),
    subidasMes: Math.round(ordenesMes * (pesos.length / lista.length)),
    descargasGBMes: redondear((vistasMes * porOrdenKB * KB) / GB, 2),
    lecturasMes: Math.round(vistasMes * (pesos.length / lista.length)),
  });

  const r = resultado.recomendaciones;
  if (resultado.fotoKB.mediana > 400) {
    r.push(`Las fotos pesan ${resultado.fotoKB.mediana} KB de mediana (más de lo esperado, ~300 KB): bajar LADO_MAXIMO_FOTO a 1280 y CALIDAD_FOTO a 0.6 en src/utils/detallesOrden.js las dejaría en unos ${Math.round(resultado.fotoKB.mediana * FACTOR_1280_60)} KB. Revisa antes que sigan leyéndose bien los seriales y etiquetas.`);
  }
  if (resultado.almacenamientoGB > CUPOS_STORAGE.almacenamientoGB * 0.8) {
    r.push(`El almacenamiento (${resultado.almacenamientoGB} GB) está cerca del cupo gratis de ${CUPOS_STORAGE.almacenamientoGB} GB: se paga unos $0,02 por GB al mes de más, pero conviene vigilarlo o bajar el tamaño de las fotos.`);
  }
  if (resultado.descargasGBMes > CUPOS_STORAGE.descargasGBMes * 0.5) {
    r.push(`Las descargas estimadas (${resultado.descargasGBMes} GB al mes) pasan de la mitad del cupo gratis de ${CUPOS_STORAGE.descargasGBMes} GB: es hora de implementar las miniaturas (docs/PLAN-MINIATURAS.md).`);
  }
  if (resultado.subidasMes > CUPOS_STORAGE.subidasMes) {
    r.push(`Las subidas (${resultado.subidasMes} al mes) pasan el cupo gratis de ${CUPOS_STORAGE.subidasMes}: el exceso cuesta centavos ($0,05 por cada 10 mil). Con miniaturas se duplicarían.`);
  }
  if (r.length === 0) r.push('Todo dentro de los cupos gratis y con fotos del peso esperado: no hace falta cambiar nada.');
  return resultado;
}
