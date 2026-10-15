import { useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { claveNombre } from '../utils/promotora';
import { promotoraDeOrden } from '../utils/whatsapp';
import { esInstalacion } from '../utils/instalacion';

// Las instalaciones creadas antes de que la promotora se guardara en la orden no tienen `promotoraClave`, y sin ella
// la promotora a quien pertenecen no las vería. Cuando un ADMIN abre la app, a cada una se le saca la promotora de su
// plantilla y se le guarda (son pocas: el cierre del día saca las ya terminadas). Si la plantilla no dice quién fue,
// la clave queda vacía y se puede escribir a mano desde Editar. Solo escribe el ADMIN, para no repetirlo entre varios.
export function useCompletarPromotoras(firebaseUser, role, tickets) {
  const intentadas = useRef(new Set());

  useEffect(() => {
    if (!firebaseUser || role !== 'ADMIN') return;
    for (const t of tickets) {
      if (!esInstalacion(t.tipoTrabajo) || t.promotoraClave !== undefined || intentadas.current.has(t.id)) continue;
      intentadas.current.add(t.id);
      const promotora = promotoraDeOrden(t);
      updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', t.id), { promotora, promotoraClave: claveNombre(promotora) })
        .catch((err) => { intentadas.current.delete(t.id); console.error('No se pudo guardar la promotora de la orden:', err); });
    }
  }, [firebaseUser, role, tickets]);
}
