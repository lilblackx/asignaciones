import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { avisoDeAdelanto, avisoDeAjuste, avisoDeAnulacion, avisoDePago } from '../utils/finanzas';
import { playAprobadoSound } from '../utils/notificationSound';

// El técnico se entera, con la app abierta, de un pago, un adelanto o un descuento o bono por una orden corregida que le registraron (con la app cerrada le llega la push): aviso en pantalla, en la campana y
// con sonido, como el resto. Escucha solo lo suyo (las reglas se lo exigen) y solo avisa de lo que Finanzas marcó "Notificar al técnico"; lo que ya existía al abrir
// la app es la base y no se avisa de nuevo.
export function useAvisosPagos({ firebaseUser, tecnico, onNotify, setToastMsg }) {
  const avisarRef = useRef(null);
  useEffect(() => {
    avisarRef.current = (tipo, { title, body }) => {
      const texto = `${title}: ${body}`;
      setToastMsg({ type: tipo, text: texto, duration: 9000 });
      onNotify?.({ type: tipo, text: texto });
      playAprobadoSound();
    };
  });

  useEffect(() => {
    if (!firebaseUser || !tecnico) return undefined;
    const datos = (nombre) => query(collection(db, 'artifacts', appId, 'public', 'data', nombre), where('tecnico', '==', tecnico));
    const escuchar = (nombre, tipo, aviso) => {
      let base = true;
      return onSnapshot(datos(nombre), (snap) => {
        if (!base) {
          snap.docChanges().filter((c) => c.type === 'added').forEach((c) => {
            const d = c.doc.data();
            if (d.notificado === true && d.anulado !== true) avisarRef.current?.(tipo, aviso({ id: c.doc.id, ...d }));
          });
        }
        base = false;
      }, (error) => console.error(`No se pudieron leer los avisos de ${nombre}:`, error));
    };
    // Un pago anulado después de avisarle al técnico: se le avisa una sola vez.
    const anuladosAvisados = new Set();
    const escucharAnulaciones = () => onSnapshot(datos('pagosTecnicos'), (snap) => {
      snap.docChanges().filter((c) => c.type === 'modified').forEach((c) => {
        const d = c.doc.data();
        if (d.anulado === true && d.notificado === true && !anuladosAvisados.has(c.doc.id)) {
          anuladosAvisados.add(c.doc.id);
          avisarRef.current?.('pagoTecnico', avisoDeAnulacion(d));
        }
      });
    }, (error) => console.error('No se pudieron leer las anulaciones de pagos:', error));
    const bajas = [
      escucharAnulaciones(),
      escuchar('pagosTecnicos', 'pagoTecnico', avisoDePago),
      escuchar('adelantosTecnicos', 'adelantoTecnico', avisoDeAdelanto),
      // Un descuento o un bono por una orden que el administrador pasó de un técnico a otro (se avisa al aprobarla).
      escuchar('ajustesTecnicos', 'ajusteTecnico', avisoDeAjuste),
    ];
    return () => bajas.forEach((baja) => baja());
  }, [firebaseUser, tecnico]);
}
