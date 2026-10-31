import { useEffect, useRef } from 'react';
import { doc } from 'firebase/firestore';
import { writeBatch } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { ejecutarAutomatica } from '../lib/escrituraAutomatica';

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
    // Escritura automática (ver escrituraAutomatica.js): cada orden se intenta una sola vez por sesión, y respeta la pausa remota y el cortacircuitos.
    pendientes.forEach((t) => intentadas.current.add(t.id));
    ejecutarAutomatica(`operador:${pendientes[0].id}:${pendientes.length}`, () => {
      const lote = writeBatch(db);
      pendientes.forEach((t) => lote.update(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', t.id), { creadoNombre: nombreDe.get(t.creado) }));
      return lote.commit();
    });
  }, [firebaseUser, role, ticketsCargados, tickets, users]);
}
