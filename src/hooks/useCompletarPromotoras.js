import { useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { ejecutarAutomatica } from '../lib/escrituraAutomatica';
import { claveNombre } from '../utils/promotora';
import { promotoraDeOrden } from '../utils/whatsapp';
import { esInstalacion } from '../utils/instalacion';

// Las instalaciones creadas antes de que la promotora se guardara en la orden no tienen `promotoraClave`, y sin ella
// la promotora a quien pertenecen no las vería. Cuando un ADMIN abre la app, a cada una se le saca la promotora de su
// plantilla y se le guarda (son pocas: el cierre del día saca las ya terminadas). Si la plantilla no dice quién fue,
// la clave queda vacía y se puede escribir a mano desde Editar. Solo escribe el ADMIN, para no repetirlo entre varios.
// Es una escritura automática: si el servidor la rechaza, se reintenta pocas veces y con espera (ver escrituraAutomatica.js).
export function useCompletarPromotoras(firebaseUser, role, tickets) {
  useEffect(() => {
    if (!firebaseUser || role !== 'ADMIN') return;
    for (const t of tickets) {
      if (!esInstalacion(t.tipoTrabajo) || t.promotoraClave !== undefined) continue;
      ejecutarAutomatica(`promotora:${t.id}`, () => {
        const promotora = promotoraDeOrden(t);
        return updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', t.id), { promotora, promotoraClave: claveNombre(promotora) });
      });
    }
  }, [firebaseUser, role, tickets]);
}
