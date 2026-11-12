import { useCallback, useEffect, useState } from 'react';

// Lo que necesita "Estado del sistema" de Configuración (ver utils/estadoSistema.js): una sola petición a /version.json (30 bytes, del hosting: no es Firestore),
// la misma que la app ya hace cada minuto en segundo plano. Se hace al abrir y con "Actualizar", sin temporizadores. Nada se lee de Firestore ni se escribe.
// Con la pantalla cerrada el hook no está montado y no cuesta nada.
export function useEstadoSistema() {
  const [estado, setEstado] = useState({ versionServidor: null, cargado: false, leidoEn: 0 });
  const [pedido, setPedido] = useState(0);

  useEffect(() => {
    let vigente = true;
    fetch('/version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((datos) => {
        if (vigente) setEstado({ versionServidor: typeof datos?.v === 'string' ? datos.v : null, cargado: true, leidoEn: Date.now() });
      });
    return () => { vigente = false; };
  }, [pedido]);

  const actualizar = useCallback(() => {
    setEstado((e) => ({ ...e, cargado: false }));
    setPedido((n) => n + 1);
  }, []);
  return { ...estado, actualizar };
}
