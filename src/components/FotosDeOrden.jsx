import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import VisorFotos from './VisorFotos';
import { useUrlsDeFotos } from '../hooks/useUrlsDeFotos';
import { fotosDe } from '../utils/detallesOrden';

// Las fotos de los "Detalles de la orden" que subió el técnico (ver utils/detallesOrden). Cada una se pide a Cloud Storage con la sesión de quien mira; tocarla la abre grande en el visor de la propia app
// (sin salir a otra pestaña ni ofrecer descargarla), y desde ahí se pasa de una a otra. A los 60 días el bucket las borra solas: entonces se ve "Foto vencida" en lugar de una imagen rota.
// No se pide nada hasta que la sección está a punto de verse en pantalla (`useCercaDePantalla`): abrir el detalle sin bajar hasta las fotos no gasta descargas.
function useCercaDePantalla(referencia) {
  // Sin IntersectionObserver (navegador muy viejo) se cargan de una vez.
  const [cerca, setCerca] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const elemento = referencia.current;
    if (!elemento || typeof IntersectionObserver === 'undefined') return undefined;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) { setCerca(true); observador.disconnect(); }
    }, { rootMargin: '150px' });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [referencia]);
  return cerca;
}

export default function FotosDeOrden({ ticket }) {
  const fotos = fotosDe(ticket);
  const zona = useRef(null);
  const cerca = useCercaDePantalla(zona);
  const urls = useUrlsDeFotos(cerca ? fotos.map((f) => f.ruta) : []);
  const [abierta, setAbierta] = useState(null);
  if (fotos.length === 0) return null;
  const { subidoPor, subidoEn } = ticket.detallesOrden;
  // Las que se pueden mostrar en el visor, con su número en la lista.
  const disponibles = fotos.map((f, i) => ({ ruta: f.ruta, url: urls[f.ruta], titulo: `Foto ${i + 1}` })).filter((f) => f.url);
  return (
    <div ref={zona}>
      <p className="text-etiqueta text-muted-foreground mb-2">
        {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}{subidoPor ? ` · las subió ${subidoPor}` : ''}{subidoEn ? ` · ${new Date(subidoEn).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {fotos.map((f, i) => {
          const url = urls[f.ruta];
          if (url === false) {
            return (
              <div key={f.ruta} className="aspect-square rounded-campo border border-zinc-300 dark:border-zinc-700 bg-secondary flex flex-col items-center justify-center gap-1 text-center p-2">
                <ImageOff className="w-5 h-5 text-zinc-500" aria-hidden="true" />
                <span className="text-etiqueta font-bold text-muted-foreground">Foto vencida</span>
              </div>
            );
          }
          return (
            <button key={f.ruta} type="button" disabled={!url} onClick={() => setAbierta(disponibles.findIndex((d) => d.ruta === f.ruta))} aria-label={`Ver la foto ${i + 1} en grande`} className="block aspect-square rounded-campo overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-secondary cursor-zoom-in">
              {url ? <img src={url} alt={`Foto ${i + 1} del trabajo`} loading="lazy" draggable={false} className="w-full h-full object-cover" /> : <div className="w-full h-full animate-pulse" />}
            </button>
          );
        })}
      </div>
      {abierta !== null && <VisorFotos titulo="Detalles de la orden" subtitulo={`${ticket.codigo || 'S/C'}${ticket.nombre ? ` - ${ticket.nombre}` : ''}`} fotos={disponibles} indice={abierta} onCambiar={setAbierta} onClose={() => setAbierta(null)} />}
    </div>
  );
}
