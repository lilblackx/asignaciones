import { useState } from 'react';
import { Camera } from 'lucide-react';
import VisorFotos from './VisorFotos';
import Spinner from './Spinner';
import { useUrlsDeFotos } from '../hooks/useUrlsDeFotos';
import { fotosDe } from '../utils/detallesOrden';

// Botón discreto "Ver detalles (N fotos)" para listas donde no conviene mostrar las fotos de entrada (como la Revisión de órdenes): no se pide nada hasta que se toca, y entonces se abren todas en el visor de la app.
// Sin fotos en la orden no se muestra. Las que el bucket ya borró (a los 60 días) se avisan en el botón.
export default function VerFotosOrden({ orden, className = '' }) {
  const fotos = fotosDe(orden);
  const [pedidas, setPedidas] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const urls = useUrlsDeFotos(pedidas ? fotos.map((f) => f.ruta) : []);
  if (fotos.length === 0) return null;

  const resueltas = fotos.filter((f) => urls[f.ruta] !== undefined);
  const cargando = pedidas && resueltas.length < fotos.length;
  const disponibles = fotos.map((f, i) => ({ url: urls[f.ruta], titulo: `Foto ${i + 1}` })).filter((f) => f.url);
  const vencidas = pedidas && !cargando && disponibles.length === 0;
  // Al terminar de cargar se abre el visor: lo decide lo que se ve, sin efectos.
  const visible = pedidas && !cargando && disponibles.length > 0 && abierta !== -1;

  return (
    <>
      <button
        type="button"
        onClick={() => { setAbierta(0); setPedidas(true); }}
        disabled={cargando}
        className={`inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-zinc-900 dark:hover:text-white underline-offset-2 hover:underline disabled:opacity-60 transition-colors ${className}`}
      >
        {cargando ? <Spinner className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" aria-hidden="true" />}
        {vencidas ? 'Las fotos ya vencieron' : `Ver detalles (${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'})`}
      </button>
      {visible && abierta !== null && (
        <VisorFotos
          titulo="Detalles de la orden"
          subtitulo={`${orden.codigo || 'S/C'}${orden.nombre ? ` - ${orden.nombre}` : ''}`}
          fotos={disponibles}
          indice={Math.min(abierta, disponibles.length - 1)}
          onCambiar={setAbierta}
          onClose={() => setAbierta(-1)}
        />
      )}
    </>
  );
}
