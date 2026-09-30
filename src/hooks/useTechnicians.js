import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { playTecnicoStatusSound } from '../utils/notificationSound';
import { estiloTecnico } from '../constants';

export function useTechnicians(firebaseUser, setToastMsg, role, tecnicoAsociado, currentUser, onNotify) {
  const [technicians, setTechnicians] = useState([]);
  const estadoAnteriorRef = useRef(null);

  useEffect(() => {
    if (!firebaseUser) return;
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
  }, [firebaseUser, role, tecnicoAsociado, setToastMsg, onNotify]);

  const getTecnicoColor = (tecnicoNombre) => {
    const tech = technicians.find(t => t.name.toUpperCase() === (tecnicoNombre || '').toUpperCase());
    return tech ? estiloTecnico(tech.color) : 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200';
  };

  const handleAddTech = async (newTech) => {
    if (!firebaseUser || newTech.name.trim() === '') return;
    const upperName = newTech.name.toUpperCase();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'technicians', upperName), { name: upperName, color: newTech.color, activo: true });
    setToastMsg({ type: 'success', text: 'Técnico agregado exitosamente.' });
  };

  const handleDeleteTech = async (techId) => {
    if (!firebaseUser) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'technicians', techId));
    setToastMsg({ type: 'success', text: 'Técnico eliminado.' });
  };

  const toggleTechnicoActivo = async (techId, activo) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'technicians', techId), {
      activo,
      activoUpdatedBy: currentUser || null,
      activoUpdatedByRole: role || null,
      activoUpdatedAt: Date.now()
    });
    setToastMsg({ type: activo ? 'success' : 'error', text: activo ? 'Técnico marcado como activo.' : 'Técnico marcado como inactivo.' });
  };

  return { technicians, getTecnicoColor, handleAddTech, handleDeleteTech, toggleTechnicoActivo };
}
