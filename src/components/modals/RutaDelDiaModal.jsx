import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Flag, LoaderCircle, MapPin, Navigation, Route, TriangleAlert, X } from 'lucide-react';
import Modal from '../Modal';
import Boton from '../Boton';
import { FUENTE_NAP, enlacesDeRuta, kmDeRuta, ordenSugerido } from '../../utils/rutaDelDia';

// La Ruta del día del técnico (ver utils/rutaDelDia.js): sus paradas en el orden sugerido (primero la prioridad alta, luego de la más cercana a la
// más lejana desde donde está), con flechas para cambiarlo y el botón que abre el recorrido en Google Maps. Al abrirse pide la ubicación una sola vez;
// sin ella (permiso negado, sin señal GPS) el orden parte de la primera parada y lo avisa.
const ESPERA_UBICACION_MS = 8000;
const TIPO = {
  'AVERÍA': 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  'INSTALACIÓN': 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  'RECONEXIÓN': 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300',
  'MUDANZA': 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
};
const BOTON_FLECHA = 'shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl border border-zinc-400 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors';

export default function RutaDelDiaModal({ paradas, sinPunto, onClose }) {
  // undefined: buscando la ubicación; null: no se pudo saber; { lat, lng }: la del técnico.
  const [posicion, setPosicion] = useState(() => (typeof navigator !== 'undefined' && navigator.geolocation ? undefined : null));
  // El orden que el técnico armó con las flechas (null: el sugerido). El sugerido no se guarda: se calcula con la ubicación.
  const [manual, setManual] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    let vigente = true;
    navigator.geolocation.getCurrentPosition(
      (r) => { if (vigente) setPosicion({ lat: r.coords.latitude, lng: r.coords.longitude }); },
      () => { if (vigente) setPosicion(null); },
      { timeout: ESPERA_UBICACION_MS, maximumAge: 60000 },
    );
    return () => { vigente = false; };
  }, []);

  const sugerido = useMemo(() => (posicion === undefined ? [] : ordenSugerido(paradas, posicion)), [paradas, posicion]);
  const orden = manual || sugerido;
  const enlaces = useMemo(() => enlacesDeRuta(orden), [orden]);
  const prioritarias = orden.filter((p) => p.prioridad).length;
  const mover = (i, d) => { const n = [...orden]; [n[i], n[i + d]] = [n[i + d], n[i]]; setManual(n); };
  const km = orden.length > 1 ? Math.round(kmDeRuta(orden, posicion)) : 0;
  const buscando = posicion === undefined;

  return (
    <Modal onClose={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex items-center gap-3 shrink-0">
          <h2 className="text-lg font-black text-white flex items-center gap-2 min-w-0"><Route className="w-5 h-5 text-red-500 shrink-0" aria-hidden="true" /><span className="truncate">Ruta del día</span></h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto shrink-0 inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {buscando ? (
            <p role="status" className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300"><LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" /> Buscando tu ubicación...</p>
          ) : paradas.length === 0 ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Ninguna de tus órdenes de hoy tiene ubicación del cliente ni de la NAP, así que no hay ruta que armar.</p>
          ) : (
            <>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {orden.length === 1 ? '1 parada. ' : `${orden.length} paradas${km > 0 ? `, unos ${km} km en línea recta` : ''}. `}
                {posicion ? 'Primero las de prioridad alta y las demás de la más cercana a la más lejana, desde donde estás.' : 'No se pudo saber dónde estás, así que el orden parte de la primera parada. Activa la ubicación del navegador para ordenarlas desde donde estás.'}
                {orden.length > 1 && ' Puedes cambiarlo con las flechas.'}
              </p>
              {prioritarias > 0 && (
                <p className="flex items-center gap-1.5 text-xs font-black text-red-700 dark:text-red-400"><Flag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {prioritarias === 1 ? '1 orden con prioridad alta va primero' : `${prioritarias} órdenes con prioridad alta van primero`}</p>
              )}
              <ol className="space-y-2">
                {orden.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 p-2">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-black flex items-center justify-center tabular-nums">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-black text-zinc-900 dark:text-white"><span>{p.codigo}</span>{p.tipoTrabajo && <span className={`text-[11px] max-lg:text-xs font-black px-1.5 py-0.5 rounded ${TIPO[p.tipoTrabajo] || 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'}`}>{p.tipoTrabajo}</span>}</p>
                      {p.nombre && <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{p.nombre}</p>}
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {p.prioridad && <><span className="inline-flex items-center gap-1 font-black text-red-700 dark:text-red-400"><Flag className="w-3 h-3" aria-hidden="true" />Prioridad alta</span><span aria-hidden="true"> · </span></>}
                        {p.punto.fuente === FUENTE_NAP ? 'Llega a la NAP' : 'Casa del cliente'}
                      </p>
                    </div>
                    <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${p.codigo}`} className={BOTON_FLECHA}><ArrowUp className="w-4 h-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => mover(i, 1)} disabled={i === orden.length - 1} aria-label={`Bajar ${p.codigo}`} className={BOTON_FLECHA}><ArrowDown className="w-4 h-4" aria-hidden="true" /></button>
                  </li>
                ))}
              </ol>
              {orden.length > 1 && <Boton variante="secundario" tamano="normal" icono={MapPin} className="w-full" onClick={() => setManual(null)} disabled={!manual}>Volver al orden sugerido</Boton>}
            </>
          )}

          {!buscando && sinPunto.length > 0 && (
            <div role="status" className="rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1.5">
              <p className="flex items-start gap-2 text-sm font-black text-amber-900 dark:text-amber-200"><TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> {sinPunto.length === 1 ? '1 orden no entra en la ruta' : `${sinPunto.length} órdenes no entran en la ruta`}</p>
              {sinPunto.map((e) => <p key={e.id} className="text-xs text-amber-900 dark:text-amber-200"><span className="font-bold">{e.codigo}{e.nombre ? ` · ${e.nombre}` : ''}:</span> no tiene ubicación del cliente ni de la NAP.</p>)}
            </div>
          )}
        </div>

        {!buscando && enlaces.length > 0 && (
          <div className="shrink-0 p-4 border-t border-zinc-300 dark:border-zinc-800 space-y-2">
            {enlaces.map((e) => (
              <a key={e.desde} href={e.url} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 h-11 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-bold text-white transition-colors">
                <Navigation className="w-4 h-4 shrink-0" aria-hidden="true" />
                {enlaces.length === 1 ? 'Abrir ruta en Google Maps' : `Ruta ${enlaces.indexOf(e) + 1}: paradas ${e.desde} a ${e.hasta}`}
              </a>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
