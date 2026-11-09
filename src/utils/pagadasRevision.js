// Cómo Revisión de órdenes sabe qué órdenes ya se pagaron sin volver a leer todas cada vez (ver lib/revisionesEnVivo). Funciones puras, con sus pruebas en scripts/test-revision-pagos.mjs.
// Una orden pagada es una revisión con `pagoId`, y el `pagoId` de un pago es `<hora en ms, 13 dígitos>-<TECNICO>` (ver idDePago en finanzas.js): ordena por la hora en que se pagó. Así se puede pedir
// "los pagos desde tal hora" y, de lo pagado antes, usar lo que el navegador ya tiene guardado; el servidor confirma con un conteo (una lectura) que no falta ni sobra nada.

// El `pagoId` mínimo de los pagos que pueden tocar órdenes de una ventana que empieza ese día: la hora en que empieza el día en Caracas. Una orden de la ventana no se puede pagar antes de su día.
export function marcadorDeInicio(dia) {
  const ms = Date.parse(`${dia}T00:00:00-04:00`);
  return Number.isFinite(ms) ? String(ms) : '';
}

// Desde qué `pagoId` hay que pedir al servidor lo pagado: el más reciente de lo que ya se conoce (se vuelve a pedir ese mismo pago, por si de él solo se conocían algunas órdenes) o, si no se conoce
// nada, el inicio de la ventana. `conocidas`: Map de clave de la orden -> pagoId.
export function marcadorDeLectura(conocidas, inicio) {
  let mayor = '';
  for (const pagoId of conocidas.values()) if (pagoId > mayor) mayor = pagoId;
  return mayor >= inicio ? mayor || inicio : inicio;
}

// Las órdenes pagadas: las que se conocían de antes (`semilla`: de la caché del navegador o de una relectura completa) y las que llegan en vivo (`vivas`), más las revisiones sin pagar que traen un pagoId
// (`conPago`, un caso raro: una retenida que conserva su pago), menos las que hoy el servidor da por sin pagar (`sinPagar`, ids): una orden cuyo pago se anuló vuelve a "aprobada sin pagar" y eso gana
// sobre lo que la caché recuerde. Todos Map clave -> pagoId, menos `sinPagar`. Devuelve las claves.
export function idsPagadas(semilla, vivas, conPago, sinPagar, inicio = '') {
  const todas = new Map([...semilla, ...vivas]);
  for (const [id, pagoId] of conPago) if (pagoId >= inicio) todas.set(id, pagoId);
  for (const id of sinPagar) todas.delete(id);
  return [...todas.keys()];
}

// ¿Lo que se cree pagado coincide con el conteo del servidor?
export const pagadasCoinciden = (servidor, local) => Number(servidor) === Number(local);

// El aviso cuando alguna de las órdenes que se iban a cambiar ya estaba pagada (`codigos`: los códigos de esas órdenes).
export function mensajeDePagadas(codigos) {
  const lista = `${codigos.slice(0, 4).join(', ')}${codigos.length > 4 ? '...' : ''}`;
  return codigos.length === 1
    ? `La orden ${lista} ya está pagada: no se puede cambiar. Se actualizó la lista.`
    : `${codigos.length} de esas órdenes ya estaban pagadas (${lista}): no se pueden cambiar. Se actualizó la lista.`;
}
