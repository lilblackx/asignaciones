import { useEffect, useState } from 'react';

const PREFIJO = 'asignaciones:preferencia:';

// Un valor que se recuerda en este equipo entre visitas (el tema, qué categoría se estaba viendo...). Solo se guarda en el navegador:
// no cuesta nada en Firebase y no viaja a otros equipos. Si el navegador no deja guardar, o lo guardado ya no es válido
// (`valida` lo revisa), se usa el valor por defecto.
export function usePreferencia(clave, porDefecto, valida = () => true) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(PREFIJO + clave));
      return guardado !== null && valida(guardado) ? guardado : porDefecto;
    } catch {
      return porDefecto;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(PREFIJO + clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: solo no se recuerda */ }
  }, [clave, valor]);

  return [valor, setValor];
}
