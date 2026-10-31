import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, doc, deleteDoc, deleteField, updateDoc, query, where, writeBatch } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { playTecnicoStatusSound } from '../utils/notificationSound';
import { estiloTecnico } from '../constants';
import { eventoActivacion } from '../utils/logTecnico';

// Registro de cuándo se activa o desactiva cada técnico (para el reporte de actividad).
const logRef = () => collection(db, 'artifacts', appId, 'public', 'data', 'technicianLog');

export function useTechnicians(firebaseUser, setToastMsg, role, tecnicoAsociado, currentUser, onNotify) {
  const [technicians, setTechnicians] = useState([]);
  const estadoAnteriorRef = useRef(null);
  // El escuchador no depende de setToastMsg ni de onNotify (si cambiaran en cada render se volvería a suscribir y releería todo): van por referencias.
  const setToastRef = useRef(setToastMsg);
  const onNotifyRef = useRef(onNotify);
  useEffect(() => { setToastRef.current = setToastMsg; onNotifyRef.current = onNotify; });

  useEffect(() => {
    if (!firebaseUser) return;
    const setToastMsg = (...args) => setToastRef.current?.(...args);
    const onNotify = (...args) => onNotifyRef.current?.(...args);
    const techsRef = collection(db, 'artifacts', appId, 'public', 'data', 'technicians');
    // TECNICO solo puede leer su propio técnico vinculado (regla de Firestore lo
    // exige: un query sin este where es rechazado completo para ese rol).
    const techsQuery = (role === 'TECNICO' && tecnicoAsociado)
      ? query(techsRef, where('name', '==', tecnicoAsociado))
      : techsRef;
    const unsubTechs = onSnapshot(techsQuery, (snapshot) => {
      const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTechnicians(loaded);

      // Avisa a ADMIN/USUARIO cuando un TECNICO activa/desactiva su propio badge.
      if (estadoAnteriorRef.current && (role === 'ADMIN' || role === 'USUARIO')) {
        for (const t of loaded) {
          const prevActivo = estadoAnteriorRef.current.get(t.id);
          const activoAhora = t.activo !== false;
          if (t.activoUpdatedByRole === 'TECNICO' && prevActivo !== undefined && prevActivo !== activoAhora) {
            const texto = `${t.name} se marcó como ${activoAhora ? 'ACTIVO' : 'INACTIVO'}.`;
            setToastMsg({ type: 'tecnicoStatus', text: texto, duration: 6000 });
            onNotify?.({ type: 'tecnicoStatus', text: texto });
            playTecnicoStatusSound();
          }
        }
      }
      estadoAnteriorRef.current = new Map(loaded.map(t => [t.id, t.activo !== false]));
    }, (error) => {
      console.error('No se pudieron cargar técnicos:', error);
      setToastMsg({ type: 'error', text: 'No se pudieron cargar los técnicos.' });
    });
    return () => unsubTechs();
  }, [firebaseUser, role, tecnicoAsociado]);

  const getTecnicoColor = (tecnicoNombre) => {
    const tech = technicians.find(t => t.name.toUpperCase() === (tecnicoNombre || '').toUpperCase());
    return tech ? estiloTecnico(tech.color) : 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200';
  };

  const handleAddTech = async (newTech) => {
    if (!firebaseUser || newTech.name.trim() === '') return;
    const upperName = newTech.name.toUpperCase();
    const lote = writeBatch(db);
    lote.set(doc(db, 'artifacts', appId, 'public', 'data', 'technicians', upperName), { name: upperName, color: newTech.color, activo: true });
    lote.set(doc(logRef()), eventoActivacion({ tecnicoId: upperName, tecnico: upperName, activo: true, por: currentUser, rol: role }));
    await lote.commit();
    setToastMsg({ type: 'success', text: 'Técnico agregado exitosamente.' });
  };

  const handleDeleteTech = async (techId) => {
    if (!firebaseUser) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'technicians', techId));
    setToastMsg({ type: 'success', text: 'Técnico eliminado.' });
  };

  const toggleTechnicoActivo = async (techId, activo) => {
    if (!firebaseUser) return;
    const ahora = Date.now();
    const tecnico = technicians.find(t => t.id === techId)?.name || techId;
    // El cambio y su asiento en el registro se guardan juntos: si uno falla, el otro tampoco queda.
    const lote = writeBatch(db);
    lote.update(doc(db, 'artifacts', appId, 'public', 'data', 'technicians', techId), {
      activo,
      activoUpdatedBy: currentUser || null,
      activoUpdatedByRole: role || null,
      activoUpdatedAt: ahora
    });
    lote.set(doc(logRef()), eventoActivacion({ tecnicoId: techId, tecnico, activo, por: currentUser, rol: role }, ahora));
    await lote.commit();
    setToastMsg({ type: activo ? 'success' : 'error', text: activo ? 'Técnico marcado como activo.' : 'Técnico marcado como inactivo.' });
  };

  // Con qué nombre conoce el inventario del almacén a este técnico (solo lo elige el usuario del módulo de envíos; las reglas lo exigen).
  // Sin nombre ('') se quita la elección y las órdenes del técnico dejan de enviarse hasta que se elija otro.
  const vincularTecnicoInventario = async (techId, nombre) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'technicians', techId), { tecnicoInventario: nombre ? nombre : deleteField() });
    setToastMsg({ type: 'success', text: nombre ? 'Nombre en el inventario guardado.' : 'Se quitó el nombre en el inventario.' });
  };

  return { technicians, getTecnicoColor, handleAddTech, handleDeleteTech, toggleTechnicoActivo, vincularTecnicoInventario };
}
