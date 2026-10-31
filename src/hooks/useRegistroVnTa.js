import { useEffect, useMemo, useState } from 'react';
import { collection, doc, query, where } from 'firebase/firestore';
import { onSnapshot, updateDoc, deleteDoc, runTransaction } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { codigoDe, idContador, ordenarRegistros, parseRegistro } from '../utils/registroVnTa';

const datos = (...ruta) => doc(db, 'artifacts', appId, 'public', 'data', ...ruta);

// El registro de VN y TA del periodo (ver utils/registroVnTa): las filas que la oficina escribe a mano. Solo escucha mientras `activo` (cuando se
// está viendo ese reporte), para no gastar lecturas de más.
//   registros: las filas con fecha dentro del periodo, ya en el orden de la hoja
//   agregar({ trabajo, tecnico, fecha, observacion }): numera y guarda una fila nueva (VAN01, TA01... por mes, sin repetir aunque dos personas
//     registren a la vez); devuelve { ok: true } o { ok: false, error }
//   actualizar(id, parcial): corrige técnico, fecha u observación de una fila
//   eliminar(id)
export function useRegistroVnTa({ firebaseUser, activo, rango, usuario, nombre }) {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const { desde, hasta } = rango;

  useEffect(() => {
    if (!firebaseUser || !activo) return undefined;
    const consulta = query(collection(db, 'artifacts', appId, 'public', 'data', 'registroVnTa'), where('fecha', '>=', desde), where('fecha', '<=', hasta));
    const parar = onSnapshot(consulta, (snapshot) => {
      setFilas(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCargando(false);
      setError('');
    }, (fallo) => {
      console.error('No se pudo cargar el registro de VN y TA:', fallo);
      setCargando(false);
      setError('No se pudo cargar el registro de VN y TA. Revisa tu conexión.');
    });
    return parar;
  }, [firebaseUser, activo, desde, hasta]);

  const registros = useMemo(() => ordenarRegistros(filas), [filas]);

  const agregar = async (entrada) => {
    if (!firebaseUser || !usuario) return { ok: false, error: 'No hay una sesión activa.' };
    const revisado = parseRegistro(entrada);
    if (revisado.error) return { ok: false, error: revisado.error, campo: revisado.campo };
    const { trabajo, tecnico, fecha, observacion } = revisado.valor;
    const contador = datos('counters', idContador(trabajo, fecha));
    const nueva = doc(collection(db, 'artifacts', appId, 'public', 'data', 'registroVnTa'));
    try {
      // El número se toma y la fila se guarda en la misma transacción: dos personas que registran a la vez reciben números distintos.
      await runTransaction(db, async (transaccion) => {
        const actual = await transaccion.get(contador);
        const numero = (actual.exists() ? Number(actual.data().ultimo) || 0 : 0) + 1;
        const ahora = Date.now();
        transaccion.set(contador, { ultimo: numero, actualizadoEn: ahora });
        transaccion.set(nueva, { codigo: codigoDe(trabajo, numero), trabajo, tecnico, fecha, observacion, operador: String(nombre || usuario).slice(0, 100), creadoPor: usuario, creadoEn: ahora, actualizadoEn: ahora });
      });
      return { ok: true };
    } catch (fallo) {
      console.error('No se pudo guardar la fila del registro de VN y TA:', fallo);
      return { ok: false, error: 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.' };
    }
  };

  const actualizar = async (id, parcial) => {
    const anterior = filas.find((f) => f.id === id);
    if (!anterior) return { ok: false, error: 'La fila ya no existe.' };
    const revisado = parseRegistro({ trabajo: anterior.trabajo, tecnico: parcial.tecnico ?? anterior.tecnico, fecha: parcial.fecha ?? anterior.fecha, observacion: parcial.observacion ?? anterior.observacion });
    if (revisado.error) return { ok: false, error: revisado.error, campo: revisado.campo };
    try {
      await updateDoc(datos('registroVnTa', id), { tecnico: revisado.valor.tecnico, fecha: revisado.valor.fecha, observacion: revisado.valor.observacion, actualizadoEn: Date.now() });
      return { ok: true };
    } catch (fallo) {
      console.error('No se pudo corregir la fila del registro de VN y TA:', fallo);
      return { ok: false, error: 'No se pudo guardar el cambio. Intenta de nuevo.' };
    }
  };

  const eliminar = async (id) => {
    try {
      await deleteDoc(datos('registroVnTa', id));
      return { ok: true };
    } catch (fallo) {
      console.error('No se pudo borrar la fila del registro de VN y TA:', fallo);
      return { ok: false, error: 'No se pudo borrar la fila (solo la borra su autor o un administrador).' };
    }
  };

  return { registros, cargando, error, agregar, actualizar, eliminar };
}
