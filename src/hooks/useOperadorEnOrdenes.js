import { useEffect, useRef } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';

const MAX_POR_LOTE = 400;

// Las órdenes viejas solo guardan el usuario de quien las creó (`creado`). Con la lista de usuarios, que solo puede leer el ADMIN, le
// anota a cada una el nombre real (`creadoNombre`) para que la plantilla ("Operador: ...") lo muestre también a los técnicos y a los
// demás roles, que no pueden consultar esa lista. Solo agrega ese campo, y solo a las órdenes abiertas que aún no lo tienen.
export function useOperadorEnOrdenes({ firebaseUser, role, ticketsCargados, tickets, users }) {
  const intentadas = useRef(new Set());

  useEffect(() => {
    if (!firebaseUser || role !== 'ADMIN' || !ticketsCargados || users.length === 0) return;
    const nombreDe = new Map(users.filter((u) => u.username && u.nombre).map((u) => [u.username, u.nombre]));
    const pendientes = tickets
      .filter((t) => !t.creadoNombre && nombreDe.has(t.creado) && !intentadas.current.has(t.id))
      .slice(0, MAX_POR_LOTE);
    if (pendientes.length === 0) return;
    pendientes.forEach((t) => intentadas.current.add(t.id));
    const lote = writeBatch(db);
    pendientes.forEach((t) => lote.update(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', t.id), { creadoNombre: nombreDe.get(t.creado) }));
    lote.commit().catch((error) => console.warn('No se pudo anotar el nombre del operador en las órdenes:', error));
  }, [firebaseUser, role, ticketsCargados, tickets, users]);
}
