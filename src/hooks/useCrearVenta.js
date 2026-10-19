import { useRef } from 'react';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { sendPush } from '../lib/notify';
import { armarVentaPromotora, errorVentaPromotora, TEXTO_AVISO_NUEVA_VENTA } from '../utils/ventaPromotora';

// Los técnicos registrados, una sola lectura (son pocos): solo sirven para emparejar el "Instalador:" de la plantilla.
export async function leerTecnicos() {
  const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'technicians'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Crea la venta (instalación pendiente; con el técnico de la plantilla si lo hay, si no sin técnico) de una PROMOTORA con permiso de crear ventas. Devuelve la orden
// creada, o false si algo falló (el formulario queda abierto para no perder lo escrito).
export function useCrearVenta(firebaseUser, { username, nombre, verTodas, promotoraClaves }, setToastMsg) {
  // Evita que un doble toque en "Guardar" cree dos ventas.
  const creandoRef = useRef(false);

  return async (datos) => {
    if (!firebaseUser || creandoRef.current) return false;
    const error = errorVentaPromotora(datos, { verTodas, promotoraClaves });
    if (error) {
      setToastMsg({ type: 'error', text: error });
      return false;
    }
    creandoRef.current = true;
    try {
      const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'tickets'));
      const venta = armarVentaPromotora(datos, { username, nombre });
      await setDoc(ref, venta);
      setToastMsg({ type: 'success', text: `Venta creada: ${venta.nombre}. ${venta.tecnico ? `Queda asignada a ${venta.tecnico}.` : 'La oficina le asignará el técnico.'}` });
      // Aviso a la oficina aunque tenga la app cerrada. Si no sale, la venta ya está guardada y la oficina la ve en su lista.
      sendPush(firebaseUser, { target: { type: 'oficina' }, title: TEXTO_AVISO_NUEVA_VENTA, body: '', tipo: 'nuevaVenta', ticketId: ref.id });
      return { id: ref.id, ...venta };
    } catch (err) {
      console.error('No se pudo crear la venta:', err);
      setToastMsg({ type: 'error', text: 'No se pudo crear la venta. Revisa tu conexión e intenta de nuevo.' });
      return false;
    } finally {
      creandoRef.current = false;
    }
  };
}
