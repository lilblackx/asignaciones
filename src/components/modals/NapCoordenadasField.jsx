import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { normalizarCoordenadasNap } from '../../utils/ubicacion';
import { extraerCodigoNap } from '../../utils/whatsapp';
import { buscarNapTomodat } from '../../lib/tomodat';

const ESTILOS = {
  create: {
    label: 'text-[10px] font-bold text-zinc-500 ml-1',
    input: 'w-full bg-white dark:bg-zinc-950 border px-2 py-1.5 rounded text-xs',
    ok: 'border-zinc-200 dark:border-zinc-700',
  },
  edit: {
    label: 'text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1',
    input: 'w-full bg-white dark:bg-zinc-950 border px-3 py-1.5 rounded-lg focus:ring-0 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors',
    ok: 'border-zinc-300 dark:border-zinc-700 focus:border-red-600',
  },
};

async function consultar(codigo, signal, aplicar, setEstado) {
  setEstado({ tipo: 'buscando', codigo });
  try {
    let resultados = await buscarNapTomodat(codigo, signal);
    // "D13P01-5" puede ser una caja gemela ("-2") o el puerto pegado con guion:
    // si la caja con sufijo no existe, se prueba con el código base.
    const base = codigo.replace(/-\d$/, '');
    if (resultados.length === 0 && base !== codigo) resultados = await buscarNapTomodat(base, signal);
    if (resultados.length === 0) {
      setEstado({ tipo: 'vacio', codigo });
    } else if (resultados.length === 1) {
      aplicar(resultados[0]);
      setEstado({ tipo: 'listo', codigo, nombre: resultados[0].nombre });
    } else {
      setEstado({ tipo: 'opciones', codigo, opciones: resultados });
    }
  } catch (err) {
    if (err.name !== 'AbortError') setEstado({ tipo: 'error', codigo, mensaje: err.message });
  }
}

// Coordenadas de la NAP. Al pegar "Lat: X / Lng: Y" el campo queda solo con
// "X, Y". Si el campo NAP trae un código (ej. N10D14), las coordenadas se piden
// a Tomodat: solas al crear (autoBuscar, si el campo está vacío) o con el botón.
export default function NapCoordenadasField({ variant, idPrefix, wrapperClassName, nap, value, onChange, autoBuscar = false }) {
  const estilo = ESTILOS[variant];
  const codigo = extraerCodigoNap(nap);
  // Cajas sin código en su nombre ("NAP EDIF A-3", "NAP EBANO"): se busca el texto
  // tal cual, solo con el botón (nunca sola, para no consultar mientras se escribe).
  const textoLibre = String(nap || '').trim();
  const consulta = codigo || (textoLibre.replace(/[^A-Za-z0-9]/g, '').length >= 5 && textoLibre.length <= 40 ? textoLibre : null);
  const parseada = normalizarCoordenadasNap(value);
  const [estado, setEstado] = useState(null);
  const onChangeRef = useRef(onChange);
  const manualRef = useRef(null);

  useEffect(() => { onChangeRef.current = onChange; });

  const aplicar = (p) => onChangeRef.current(`${p.lat}, ${p.lng}`);

  // Busca sola cuando hay código de NAP y el campo está vacío. Si la búsqueda no
  // encuentra nada o falla, no se repite hasta que cambie el código.
  useEffect(() => {
    if (!autoBuscar || !codigo || value) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      consultar(codigo, controller.signal, (p) => onChangeRef.current(`${p.lat}, ${p.lng}`), setEstado);
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [autoBuscar, codigo, value]);

  const buscarAhora = () => {
    manualRef.current?.abort();
    manualRef.current = new AbortController();
    consultar(consulta, manualRef.current.signal, aplicar, setEstado);
  };

  const handleChange = (e) => {
    const { valor } = normalizarCoordenadasNap(e.target.value);
    onChange(valor ?? e.target.value);
  };

  const mensaje = estado && estado.codigo === consulta ? estado : null;

  return (
    <div className={wrapperClassName}>
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={`${idPrefix}-nap-coords`} className={estilo.label}>COORDENADAS NAP <span className="font-normal normal-case text-zinc-400">(Lat / Lng, opcional)</span></label>
        {consulta && (
          <button type="button" onClick={buscarAhora} disabled={mensaje?.tipo === 'buscando'} className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 dark:text-violet-400 hover:underline disabled:opacity-60">
            {mensaje?.tipo === 'buscando' ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Search className="w-3 h-3" aria-hidden="true" />} Buscar {consulta} en Tomodat
          </button>
        )}
      </div>
      <input id={`${idPrefix}-nap-coords`} type="text" maxLength="100" name="napCoordenadas" placeholder="Lat: 10.6616 / Lng: -71.7061" value={value || ''} onChange={handleChange} aria-invalid={!!parseada.error} className={`${estilo.input} ${parseada.error ? 'border-red-500' : estilo.ok}`} />
      {parseada.error && <p role="alert" className="text-[10px] font-bold text-red-600 dark:text-red-400 ml-1">{parseada.error}</p>}
      {mensaje?.tipo === 'buscando' && <p role="status" className="text-[10px] text-zinc-500 ml-1">Buscando {consulta} en Tomodat...</p>}
      {mensaje?.tipo === 'listo' && value && <p role="status" className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 ml-1">Coordenadas tomadas de Tomodat ({mensaje.nombre}).</p>}
      {mensaje?.tipo === 'vacio' && <p role="status" className="text-[10px] font-bold text-amber-700 dark:text-amber-400 ml-1">No se encontró {consulta} en Tomodat. Pega las coordenadas a mano.</p>}
      {mensaje?.tipo === 'error' && <p role="alert" className="text-[10px] font-bold text-red-600 dark:text-red-400 ml-1">{mensaje.mensaje} Pega las coordenadas a mano.</p>}
      {mensaje?.tipo === 'opciones' && (
        <div role="group" aria-label="Varias cajas coinciden, elige una" className="flex flex-wrap gap-1 ml-1">
          <span className="w-full text-[10px] font-bold text-amber-700 dark:text-amber-400">Varias cajas coinciden, elige una:</span>
          {mensaje.opciones.map((p) => (
            <button key={`${p.nombre}-${p.lat}-${p.lng}`} type="button" onClick={() => { aplicar(p); setEstado({ tipo: 'listo', codigo: consulta, nombre: p.nombre }); }} className="text-[10px] font-bold px-2 py-1 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors">
              {p.nombre} · {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
            </button>
          ))}
        </div>
      )}
      {parseada.enlace && <a href={parseada.enlace} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-400 hover:underline ml-1"><MapPin className="w-3 h-3" aria-hidden="true" /> Ver NAP en el mapa</a>}
    </div>
  );
}
