// Una orden pre-finalizada por el técnico espera que la oficina la revise y la apruebe (la ortografía "PRE-FINALIZADA" viene de órdenes viejas).
export const esPreFinalizada = (t) => t?.estado === 'PRE-FINALIZADO' || t?.estado === 'PRE-FINALIZADA';

// Las pre-finalizadas primero, para que la oficina las tenga arriba y las apruebe sin buscarlas; entre ellas y entre las demás se conserva el orden que traían.
export const preFinalizadasPrimero = (lista) => [...lista.filter(esPreFinalizada), ...lista.filter((t) => !esPreFinalizada(t))];
