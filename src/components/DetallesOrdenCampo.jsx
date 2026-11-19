import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ImageOff, ImagePlus, RefreshCw, X } from 'lucide-react';
import Spinner from './Spinner';
import { comprimirFoto, urlDeFoto } from '../lib/fotosOrden';
import { MAX_FOTOS, MIN_FOTOS, noEsImagen } from '../utils/detallesOrden';

// Los "Detalles de la orden": el técnico agrega 7 fotos de su trabajo (exactamente 7) y las sube. Puede tomarlas en el momento con la cámara ("Tomar foto", una por toque) o elegirlas de la galería o de otra app ("Galería",
// varias a la vez). Cada foto se reduce apenas se elige (así se ve enseguida si el teléfono no la puede abrir, y se sube liviana); `onSubir` solo las sube.
// Cada foto se puede quitar o cambiar por otra. `iniciales` son las fotos que la orden ya tiene guardadas (para corregirlas: se ven, se quitan o se cambian, y se agregan nuevas).
// `onSubir(fotos, onProgreso)` recibe la lista final en orden: { tipo: 'guardada', ruta, bytes } (ya está en el bucket) o { tipo: 'nueva', blob } (hay que subirla); devuelve { ok: true } o { error }.
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
    return <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-center p-1"><ImageOff className="w-5 h-5 text-zinc-500" aria-hidden="true" /><span className="text-etiqueta font-bold text-muted-foreground">Foto vencida</span></div>;
  }
  return estado.url ? <img src={estado.url} alt={`Foto ${numero} guardada`} className="w-full h-full object-cover" /> : <div className="w-full h-full animate-pulse" />;
}

export default function DetallesOrdenCampo({ onSubir, iniciales = [], textoGuardar = 'Guardar los detalles de la orden' }) {
  const entradaGaleria = useRef(null);
  const entradaCamara = useRef(null);
  const cambiando = useRef(null);
  // La lista en el orden en que se ve: lo ya guardado y lo recién elegido. Una foto nueva pasa de 'preparando' (se está reduciendo) a 'lista' (ya reducida, con su miniatura local) o a 'error' (el teléfono no la pudo abrir).
  const [fotos, setFotos] = useState(() => iniciales.map((f) => ({ id: nuevoId(), tipo: 'guardada', ruta: f.ruta, bytes: f.bytes })));
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const vigentes = useRef([]);
  const cola = useRef(Promise.resolve());
  const montado = useRef(true);
  useEffect(() => { vigentes.current = fotos; });
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; vigentes.current.forEach((f) => { if (f.url) URL.revokeObjectURL(f.url); }); };
  }, []);

  const cambiar = (siguiente) => {
    fotos.filter((f) => f.url && !siguiente.some((s) => s.id === f.id)).forEach((f) => URL.revokeObjectURL(f.url));
    setFotos(siguiente);
  };

  // Reduce una foto recién elegida, de a una (en un teléfono modesto, varias a la vez agotan la memoria), y deja su miniatura liviana. Si la quitaron mientras tanto, se descarta.
  const preparar = (id, archivo) => {
    cola.current = cola.current.then(async () => {
      let resultado;
      try {
        const blob = await comprimirFoto(archivo);
        resultado = { estado: 'lista', blob, url: URL.createObjectURL(blob), archivo: null, mensaje: '' };
      } catch (e) {
        console.error('No se pudo preparar una foto:', e);
        resultado = { estado: 'error', archivo: null, mensaje: e?.message?.startsWith('No se pudo') ? e.message : 'No se pudo leer esta foto. Quítala y toma otra.' };
      }
      if (!montado.current || !vigentes.current.some((f) => f.id === id)) { if (resultado.url) URL.revokeObjectURL(resultado.url); return; }
      setFotos((actuales) => actuales.map((f) => (f.id === id ? { ...f, ...resultado } : f)));
    });
  };
  const crear = (archivo) => {
    const foto = { id: nuevoId(), tipo: 'nueva', estado: 'preparando', archivo };
    preparar(foto.id, archivo);
    return foto;
  };

  const agregar = (evento) => {
    const elegidas = Array.from(evento.target.files || []);
    evento.target.value = '';
    if (!elegidas.length) return;
    // Solo se rechaza lo que dice no ser una imagen (un PDF, un video): hay apps que entregan la foto sin tipo y esas se intentan abrir.
    const imagenes = elegidas.filter((a) => !noEsImagen(a));
    const indice = cambiando.current;
    cambiando.current = null;
    const avisoNoImagen = imagenes.length < elegidas.length ? 'Solo se pueden subir fotos.' : '';
    // Cambiar una foto: la nueva ocupa su lugar.
    if (indice !== null && imagenes.length) {
      setError(avisoNoImagen);
      cambiar(fotos.map((f, i) => (i === indice ? crear(imagenes[0]) : f)));
      return;
    }
    const sobran = fotos.length + imagenes.length - MAX_FOTOS;
    setError(avisoNoImagen || (sobran > 0 ? `Son ${MAX_FOTOS} fotos y ya estaban completas: se quedaron las primeras.` : ''));
    const aceptadas = imagenes.slice(0, Math.max(0, MAX_FOTOS - fotos.length));
    cambiar([...fotos, ...aceptadas.map(crear)]);
  };

  const elegir = (indice = null) => {
    cambiando.current = indice;
    if (entradaGaleria.current) {
      entradaGaleria.current.multiple = indice === null;
      entradaGaleria.current.click();
    }
  };
  const tomar = () => {
    cambiando.current = null;
    entradaCamara.current?.click();
  };

  const faltan = Math.max(0, MIN_FOTOS - fotos.length);
  const preparando = fotos.some((f) => f.estado === 'preparando');
  const conError = fotos.filter((f) => f.estado === 'error').length;
  // Hay algo que guardar: una foto nueva, o una de las ya guardadas que se quitó.
  const huboCambios = fotos.some((f) => f.tipo === 'nueva') || fotos.length !== iniciales.length;

  const subir = async () => {
    // El botón no se apaga con pocas fotos (parecería que no hace nada): al tocarlo dice qué falta.
    if (conError > 0) { setError(`${conError === 1 ? 'Una foto no se pudo abrir' : `${conError} fotos no se pudieron abrir`}: quítala${conError === 1 ? '' : 's'} (con la X) o cámbiala${conError === 1 ? '' : 's'} por otra.`); return; }
    if (fotos.length < MIN_FOTOS) { setError(`${faltan === 1 ? 'Falta 1 foto' : `Faltan ${faltan} fotos`}: toca «Tomar foto» o «Galería» y agrega ${faltan === 1 ? 'otra' : 'más'}. Son exactamente ${MIN_FOTOS}.`); return; }
    setError('');
    setProgreso(0);
    setSubiendo(true);
    try {
      const r = await onSubir(fotos.map(({ tipo, ruta, bytes, blob }) => (tipo === 'guardada' ? { tipo, ruta, bytes } : { tipo, blob })), (hechas) => setProgreso(hechas));
      if (r?.error) setError(r.error);
    } catch (e) {
      console.error('No se pudieron subir los detalles de la orden:', e);
      setError('No se pudo subir las fotos. Revisa tu conexión e inténtalo de nuevo (las fotos se conservan).');
    } finally {
      if (montado.current) setSubiendo(false);
    }
  };

  const lleno = fotos.length >= MAX_FOTOS;
  const aSubir = fotos.filter((f) => f.tipo === 'nueva').length;
  const apremia = fotos.length > 0 && faltan > 0;
  const BOTON_AGREGAR = `inline-flex items-center justify-center gap-2 h-12 rounded-campo border-2 border-dashed text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-50 transition-colors ${apremia ? 'border-amber-500' : 'border-zinc-400 dark:border-zinc-600'}`;

  return (
    <div className="space-y-3">
      {/* La galería (y las otras apps) deja elegir varias; la cámara toma una por toque, directo con la cámara trasera. */}
      <input ref={entradaGaleria} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-label="Elegir fotos de la galería" onChange={agregar} />
      <input ref={entradaCamara} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Tomar una foto con la cámara" onChange={agregar} />

      {fotos.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-label="Fotos de la orden">
          {fotos.map((f, i) => (
            <li key={f.id} className={`relative aspect-square rounded-campo overflow-hidden border bg-secondary ${f.estado === 'error' ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
              {f.tipo === 'guardada' ? <MiniaturaGuardada ruta={f.ruta} numero={i + 1} />
                : f.estado === 'error' ? (
                  <div data-error={f.mensaje} className="w-full h-full flex flex-col items-center justify-center gap-1 text-center p-1.5 pr-9">
                    <AlertTriangle className="w-6 h-6 text-red-700 dark:text-red-400 shrink-0" aria-hidden="true" />
                    <span className="text-etiqueta leading-tight font-bold text-red-700 dark:text-red-300">No se pudo abrir</span>
                  </div>
                )
                  : f.estado === 'preparando' ? <div className="w-full h-full flex items-center justify-center" role="status" aria-label={`Preparando la foto ${i + 1}`}><Spinner className="w-6 h-6" /></div>
                    : <img src={f.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />}
              <span className="absolute left-1 bottom-1 text-etiqueta font-black text-white bg-black/70 rounded px-1.5 py-0.5">{i + 1}</span>
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

      {/* Qué pasó con cada foto que el teléfono no pudo abrir (el recuadro de la foto solo cabe en pocas palabras). */}
      {fotos.some((f) => f.estado === 'error') && (
        <ul role="alert" className="space-y-1 text-xs font-bold text-red-700 dark:text-red-400">
          {fotos.map((f, i) => (f.estado === 'error' ? <li key={f.id}>Foto {i + 1}: {f.mensaje}</li> : null))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={tomar} disabled={subiendo || lleno} className={BOTON_AGREGAR}>
          <Camera className="w-5 h-5 shrink-0" aria-hidden="true" /> Tomar foto
        </button>
        <button type="button" onClick={() => elegir()} disabled={subiendo || lleno} className={BOTON_AGREGAR}>
          <ImagePlus className="w-5 h-5 shrink-0" aria-hidden="true" /> Galería
        </button>
      </div>

      <p className={`text-xs font-bold text-center ${apremia ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`} aria-live="polite">
        {fotos.length} de {MAX_FOTOS} fotos{faltan > 0 ? ` · faltan ${faltan}` : ' · completas'}
      </p>

      {error && <p role="alert" className="text-xs font-bold text-red-700 dark:text-red-400 text-center">{error}</p>}

      <button
        type="button"
        onClick={subir}
        disabled={subiendo || preparando || !huboCambios}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-boton bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black text-sm transition-colors"
      >
        {subiendo || preparando ? <Spinner /> : <CheckCircle2 className="w-5 h-5" aria-hidden="true" />}
        {subiendo ? (aSubir > 0 ? `Subiendo ${progreso} de ${aSubir}...` : 'Guardando...') : preparando ? 'Preparando las fotos...' : textoGuardar}
      </button>
    </div>
  );
}
