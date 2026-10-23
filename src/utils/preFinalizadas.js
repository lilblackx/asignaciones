// Una orden pre-finalizada por el técnico espera que la oficina la revise y la apruebe (la ortografía "PRE-FINALIZADA" viene de órdenes viejas).
export const esPreFinalizada = (t) => t?.estado === 'PRE-FINALIZADO' || t?.estado === 'PRE-FINALIZADA';

// Las pre-finalizadas primero, para que la oficina las tenga arriba y las apruebe sin buscarlas; entre ellas y entre las demás se conserva el orden que traían.
export const preFinalizadasPrimero = (lista) => [...lista.filter(esPreFinalizada), ...lista.filter((t) => !esPreFinalizada(t))];

// Los ids de las órdenes que acaban de quedar pre-finalizadas: ya estaban en la lista (una orden que llega nueva no cuenta) y antes no lo estaban.
//   previas: Map id -> true si ya estaba pre-finalizada la última vez que se miró la lista.
export const nuevasPreFinalizadas = (previas, lista) => lista.filter((t) => esPreFinalizada(t) && previas.has(t.id) && previas.get(t.id) === false).map((t) => t.id);
