import { useCallback, useSyncExternalStore } from 'react';

const PREFIJO = 'asignaciones:preferencia:tema:';
const valores = new Map();
const oyentes = new Set();

const leer = (usuario) => {
  if (!valores.has(usuario)) {
    let guardado = true;
    try {
      const crudo = JSON.parse(localStorage.getItem(PREFIJO + usuario));
      if (typeof crudo === 'boolean') guardado = crudo;
    } catch { /* sin almacenamiento: queda el tema oscuro */ }
    valores.set(usuario, guardado);
  }
  return valores.get(usuario);
};

const escribir = (usuario, oscuro) => {
  valores.set(usuario, oscuro);
  try { localStorage.setItem(PREFIJO + usuario, JSON.stringify(oscuro)); } catch { /* sin almacenamiento: solo no se recuerda */ }
  oyentes.forEach((avisar) => avisar());
};

const suscribir = (avisar) => {
  oyentes.add(avisar);
  return () => oyentes.delete(avisar);
};

// El tema (oscuro o claro) de la app: UNO solo para cada usuario, compartido por todas las pantallas y módulos que estén abiertos a la vez (la oficina, Finanzas, Ventas, Almacén...), y recordado en este equipo
// entre visitas. Antes de iniciar sesión (`usuario` vacío) vale el de la pantalla de ingreso. Devuelve [oscuro, setOscuro] igual que un useState.
export function useTema(nombre) {
  const usuario = nombre || '';
  const oscuro = useSyncExternalStore(suscribir, () => leer(usuario));
  const setOscuro = useCallback((valor) => escribir(usuario, typeof valor === 'function' ? valor(leer(usuario)) : valor), [usuario]);
  return [oscuro, setOscuro];
}
