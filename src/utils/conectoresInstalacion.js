// Conectores usados en una instalación, por tipo (externo o interno) y color, igual que en los recableados y las
// visitas de conector. El conector externo solo existe en verde; el interno, en verde o azul. El técnico escribe
// cuántos usó de cada uno al pre-finalizar y es obligatorio (al menos 1 en total).
// Se guarda en `ticket.instalacion.conectores`:
//   { externo: { verde }, interno: { verde, azul } }
// Las instalaciones anteriores a que se pidiera no lo tienen y cuentan 0 conectores (nunca se les exige).
// En Materiales (utils/consumoMateriales) los conectores se cuentan solo por color, sin distinguir externo de interno;
// el tipo se ve en la revisión de la oficina y en el historial.
// Este archivo no importa de tipoVisita ni de instalacion (ella lo importa a él): así no hay dependencias circulares.

// Mismo tope por color que MAX_CONECTORES_POR_COLOR de tipoVisita: evita un error de dedo (un "20" por un "2").
export const MAX_CONECTORES_INSTALACION_POR_COLOR = 10;

const entero = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(v, MAX_CONECTORES_INSTALACION_POR_COLOR) : 0);

// Lo guardado (o cualquier cosa) en la forma { externo: { verde }, interno: { verde, azul } } con enteros de 0 a 10.
export function normalizarConectoresInstalacion(c) {
  return {
    externo: { verde: entero(c?.externo?.verde) },
    interno: { verde: entero(c?.interno?.verde), azul: entero(c?.interno?.azul) },
  };
}

// Conectores de la instalación sumados por color: { verde, azul } ({ verde: 0, azul: 0 } si no los registró).
export function conectoresDeInstalacion(ticket) {
  const { externo, interno } = normalizarConectoresInstalacion(ticket?.instalacion?.conectores);
  return { verde: externo.verde + interno.verde, azul: interno.azul };
}

// Cantidades escritas por el técnico (texto) -> { valor } con la forma guardada, o { error, campo }.
// Un campo vacío cuenta como 0. `campo` es 'externoVerde', 'internoVerde' o 'internoAzul' (para llevar el cursor).
export function parseConectoresInstalacion({ externoVerde, internoVerde, internoAzul } = {}) {
  const leer = (raw, nombre, campo) => {
    const txt = String(raw ?? '').trim();
    if (txt === '') return { valor: 0 };
    if (!/^\d{1,2}$/.test(txt)) return { error: `Escribe la cantidad de ${nombre} como un número entero. Ejemplo: 2`, campo };
    const n = parseInt(txt, 10);
    if (n > MAX_CONECTORES_INSTALACION_POR_COLOR) return { error: `Máximo ${MAX_CONECTORES_INSTALACION_POR_COLOR} ${nombre}.`, campo };
    return { valor: n };
  };
  const ev = leer(externoVerde, 'conectores externos verdes', 'externoVerde');
  if (ev.error) return ev;
  const iv = leer(internoVerde, 'conectores internos verdes', 'internoVerde');
  if (iv.error) return iv;
  const ia = leer(internoAzul, 'conectores internos azules', 'internoAzul');
  if (ia.error) return ia;
  if (ev.valor + iv.valor + ia.valor < 1) {
    return { error: 'Indica cuántos conectores usaste en la instalación: externos, internos o ambos.', campo: 'externoVerde' };
  }
  return { valor: { externo: { verde: ev.valor }, interno: { verde: iv.valor, azul: ia.valor } } };
}

// Mensaje de error de lo ya guardado/numérico (la segunda comprobación al guardar), o '' si está bien. Una orden sin
// el campo (no es un objeto) da error: al pre-finalizar una instalación el técnico siempre debe indicarlos.
export function errorConectoresInstalacion(conectores) {
  if (!conectores || typeof conectores !== 'object') return 'Indica los conectores usados en la instalación.';
  const texto = (n) => (n == null ? '' : String(n));
  return parseConectoresInstalacion({
    externoVerde: texto(conectores.externo?.verde),
    internoVerde: texto(conectores.interno?.verde),
    internoAzul: texto(conectores.interno?.azul),
  }).error || '';
}

const cantidad = (n, color) => `${n} ${color}${n === 1 ? '' : color === 'azul' ? 'es' : 's'}`;

// "Externo: 1 verde · Interno: 2 verdes, 1 azul" ('' si no hay ninguno). Solo menciona lo que se usó.
export function textoConectoresInstalacion(conectores) {
  const { externo, interno } = normalizarConectoresInstalacion(conectores);
  const partesInterno = [interno.verde > 0 && cantidad(interno.verde, 'verde'), interno.azul > 0 && cantidad(interno.azul, 'azul')].filter(Boolean);
  return [
    externo.verde > 0 && `Externo: ${cantidad(externo.verde, 'verde')}`,
    partesInterno.length > 0 && `Interno: ${partesInterno.join(', ')}`,
  ].filter(Boolean).join(' · ');
}
