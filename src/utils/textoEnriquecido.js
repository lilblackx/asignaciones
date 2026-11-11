// Un texto de un documento de reporte con algunos fragmentos en negrita. El bloque { tipo: 'texto', texto, negritas: ['...'] } (ver modelosReporte.js) lleva el texto plano y la lista
// de fragmentos que van en negrita; el PDF y el Word lo parten con esto. Módulo sin dependencias: lo usan los exportadores y las pruebas.

// [{ texto, negrita }] en el orden del texto. Cada fragmento de `negritas` se busca tal cual (sin importar nada más) y, si hay varios, gana el que aparece primero (el más largo si empiezan igual).
// Lo que no se encuentra se ignora; sin `negritas` todo el texto va normal.
export function partirNegritas(texto, negritas = []) {
  const completo = String(texto ?? '');
  const buscados = (Array.isArray(negritas) ? negritas : []).map((n) => String(n ?? '')).filter(Boolean);
  const partes = [];
  let resto = completo;
  while (resto) {
    let mejor = null;
    for (const n of buscados) {
      const i = resto.indexOf(n);
      if (i >= 0 && (!mejor || i < mejor.i || (i === mejor.i && n.length > mejor.n.length))) mejor = { i, n };
    }
    if (!mejor) { partes.push({ texto: resto, negrita: false }); break; }
    if (mejor.i > 0) partes.push({ texto: resto.slice(0, mejor.i), negrita: false });
    partes.push({ texto: mejor.n, negrita: true });
    resto = resto.slice(mejor.i + mejor.n.length);
  }
  return partes.length ? partes : [{ texto: '', negrita: false }];
}
