import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ImageOff, ImagePlus, RefreshCw, X } from 'lucide-react';
import Spinner from './Spinner';
import { urlDeFoto } from '../lib/fotosOrden';
import { MAX_FOTOS, MIN_FOTOS } from '../utils/detallesOrden';

// Los "Detalles de la orden": el técnico elige de 2 a 7 fotos de su trabajo (del celular, con la cámara o de la galería) y las sube. Aquí solo se eligen y se muestran; reducirlas y subirlas lo hace `onSubir`.
// Cada foto se puede quitar o cambiar por otra. `iniciales` son las fotos que la orden ya tiene guardadas (para corregirlas: se ven, se quitan o se cambian, y se agregan nuevas).
// `onSubir(fotos, onProgreso)` recibe la lista final en orden: { tipo: 'guardada', ruta, bytes } (ya está en el bucket) o { tipo: 'nueva', archivo } (hay que subirla); devuelve { ok: true } o { error }.
// Las fotos elegidas se conservan si falla, para volver a intentar.
let contador = 0;
const nuevoId = () => { contador += 1; return `foto-${contador}`; };

// Una foto ya guardada: se pide a Cloud Storage con la sesión de quien mira. A los 60 días el bucket la borra: se ve "Foto vencida" (y se puede cambiar o quitar).
function MiniaturaGuardada({ ruta, numero }) {
  const [estado, setEstado] = useState({ url: '', vencida: false });
  useEffect(() => {
    let vigente = true;
    urlDeFoto(ruta)
      .then((url) => { if (vigente) setEstado({ url, vencida: false }); })
      .catch(() => { if (vigente) setEstado({ url: '', vencida: true }); });
    return () => { vigente = false; };
  }, [ruta]);
  if (estado.vencida) {
    return <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-center p-1"><ImageOff className="w-5 h-5 text-zinc-500" aria-hidden="true" /><span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Foto vencida</span></div>;
  }
  return estado.url ? <img src={estado.url} alt={`Foto ${numero} guardada`} className="w-full h-full object-cover" /> : <div className="w-full h-full animate-pulse" />;
}

export default function DetallesOrdenCampo({ onSubir, iniciales = [], textoGuardar = 'Guardar los detalles de la orden' }) {
  const entrada = useRef(null);
  const cambiando = useRef(null);
  // La lista en el orden en que se ve: lo ya guardado y lo recién elegido (con su miniatura local, sin subirlo; se libera al quitarla o al cerrar).
  const [fotos, setFotos] = useState(() => iniciales.map((f) => ({ id: nuevoId(), tipo: 'guardada', ruta: f.ruta, bytes: f.bytes })));
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const vigentes = useRef([]);
  useEffect(() => { vigentes.current = fotos; });
  useEffect(() => () => vigentes.current.forEach((f) => { if (f.url) URL.revokeObjectURL(f.url); }), []);

  const cambiar = (siguiente) => {
    fotos.filter((f) => f.url && !siguiente.includes(f)).forEach((f) => URL.revokeObjectURL(f.url));
    setFotos(siguiente);
  };
  const crear = (archivo) => ({ id: nuevoId(), tipo: 'nueva', archivo, url: URL.createObjectURL(archivo) });

  const agregar = (evento) => {
    const elegidas = Array.from(evento.target.files || []);
    evento.target.value = '';
    if (!elegidas.length) return;
    const imagenes = elegidas.filter((a) => a.type.startsWith('image/'));
    const indice = cambiando.current;
    cambiando.current = null;
    // Cambiar una foto: la nueva ocupa su lugar.
    if (indice !== null && imagenes.length) {
      setError(imagenes.length < elegidas.length ? 'Solo se pueden subir fotos.' : '');
      cambiar(fotos.map((f, i) => (i === indice ? crear(imagenes[0]) : f)));
      return;
    }
    const sobran = fotos.length + imagenes.length - MAX_FOTOS;
    setError(imagenes.length < elegidas.length ? 'Solo se pueden subir fotos.' : sobran > 0 ? `Son ${MAX_FOTOS} fotos como máximo: se quedaron las primeras.` : '');
    cambiar([...fotos, ...imagenes.map(crear)].slice(0, MAX_FOTOS));
  };

  const elegir = (indice = null) => {
    cambiando.current = indice;
    if (entrada.current) {
      entrada.current.multiple = indice === null;
      entrada.current.click();
    }
  };

  // Hay algo que guardar: una foto nueva, o una de las ya guardadas que se quitó.
  const huboCambios = fotos.some((f) => f.tipo === 'nueva') || fotos.length !== iniciales.length;

  const subir = async () => {
    if (fotos.length < MIN_FOTOS) { setError(`Sube al menos ${MIN_FOTOS} fotos.`); return; }
    setError('');
    setProgreso(0);
    setSubiendo(true);
    try {
      const r = await onSubir(fotos.map(({ tipo, ruta, bytes, archivo }) => (tipo === 'guardada' ? { tipo, ruta, bytes } : { tipo, archivo })), (hechas) => setProgreso(hechas));
      if (r?.error) setError(r.error);
    } catch (e) {
      console.error('No se pudieron subir los detalles de la orden:', e);
      setError('No se pudieron subir las fotos. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSubiendo(false);
    }
  };

  const faltan = Math.max(0, MIN_FOTOS - fotos.length);
  const lleno = fotos.length >= MAX_FOTOS;
  const aSubir = fotos.filter((f) => f.tipo === 'nueva').length;

  return (
    <div className="space-y-3">
      <input ref={entrada} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={agregar} />

      {fotos.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-label="Fotos de la orden">
          {fotos.map((f, i) => (
            <li key={f.id} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
              {f.tipo === 'nueva' ? <img src={f.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" /> : <MiniaturaGuardada ruta={f.ruta} numero={i + 1} />}
              <span className="absolute left-1 bottom-1 text-[11px] font-black text-white bg-black/70 rounded px-1.5 py-0.5">{i + 1}</span>
              {!subiendo && (
                <>
                  <button type="button" onClick={() => cambiar(fotos.filter((_, k) => k !== i))} aria-label={`Quitar la foto ${i + 1}`} className="absolute right-1 top-1 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/70 text-white hover:bg-red-700 transition-colors">
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => elegir(i)} aria-label={`Cambiar la foto ${i + 1} por otra`} className="absolute right-1 bottom-1 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/70 text-white hover:bg-sky-700 transition-colors">
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => elegir()}
        disabled={subiendo || lleno}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-zinc-400 dark:border-zinc-600 text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
      >
        {fotos.length ? <ImagePlus className="w-5 h-5" aria-hidden="true" /> : <Camera className="w-5 h-5" aria-hidden="true" />}
        {fotos.length ? 'Agregar más fotos' : 'Tomar o elegir fotos'}
      </button>

      <p className="text-xs font-bold text-center text-zinc-600 dark:text-zinc-400" aria-live="polite">
        {fotos.length} de {MAX_FOTOS} fotos{faltan > 0 ? ` · faltan ${faltan} como mínimo` : lleno ? ' · máximo alcanzado' : ''}
      </p>

      {error && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400 text-center">{error}</p>}

      <button
        type="button"
        onClick={subir}
        disabled={subiendo || fotos.length < MIN_FOTOS || !huboCambios}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black text-sm transition-colors"
      >
        {subiendo ? <Spinner /> : <CheckCircle2 className="w-5 h-5" aria-hidden="true" />}
        {subiendo ? (aSubir > 0 ? `Subiendo ${progreso} de ${aSubir}...` : 'Guardando...') : textoGuardar}
      </button>
    </div>
  );
}
