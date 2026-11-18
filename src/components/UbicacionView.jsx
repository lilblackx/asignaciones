import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, LocateFixed, MapPin, Maximize2, Minimize2, Settings } from 'lucide-react';
import Boton from './Boton';
import MapaTecnicos from './MapaTecnicos';
import { CENTRADO_AMPLIO } from './Modal';
import { TARJETA, TEXTO_SUAVE } from './estilos';
import { useUbicacionTecnicos } from '../hooks/useUbicacionTecnicos';
import { kmDeRuta, ordenSugerido, paradasDeRuta } from '../utils/rutaDelDia';
import { ESTADOS, MOTIVOS_PUNTO, enlaceGoogleMaps, estadoUbicacion, haceCuanto, idDeTecnico, posicionesHuerfanas, solicitudVigente, tiempoRestante, ultimaVigente, ultimasViejas } from '../utils/ubicacionTecnico';
import Aviso from './Aviso';

// El módulo Ubicación del administrador (menú lateral): pide la ubicación de un técnico en la calle y la ve en un mapa completo (ver utils/ubicacionTecnico.js). El técnico no recibe ningún aviso: su app la envía
// sola cuando la abra, durante los 30 minutos de la solicitud. Además muestra la última ubicación conocida (un punto al marcar En camino, Llegué o pre-finalizar). Solo escucha con el módulo abierto y la función encendida.
const INSIGNIA = {
  [ESTADOS.NINGUNA]: { texto: 'Sin solicitud', clase: 'bg-secondary text-secondary-foreground' },
  [ESTADOS.ESPERANDO]: { texto: 'Esperando su teléfono', clase: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300' },
  [ESTADOS.EN_VIVO]: { texto: 'En vivo', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  [ESTADOS.SIN_SENAL]: { texto: 'Sin señal reciente', clase: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300' },
  [ESTADOS.DENEGADO]: { texto: 'Sin permiso de ubicación', clase: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' },
  [ESTADOS.SIN_GPS]: { texto: 'No se pudo leer el GPS', clase: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' },
  [ESTADOS.DETENIDA]: { texto: 'Detenida', clase: 'bg-secondary text-secondary-foreground' },
  [ESTADOS.VENCIDA]: { texto: 'Terminó el tiempo', clase: 'bg-secondary text-secondary-foreground' },
};
const EXPLICACION = {
  [ESTADOS.NINGUNA]: 'Nadie ha pedido su ubicación.',
  [ESTADOS.ESPERANDO]: 'Aparecerá en cuanto abra la app (la solicitud dura 30 minutos). Con la app cerrada o el teléfono bloqueado no se puede leer.',
  [ESTADOS.DENEGADO]: 'Su teléfono tiene negado el permiso de ubicación para esta app.',
  [ESTADOS.SIN_GPS]: 'Su teléfono no entregó la ubicación (sin señal de GPS o el GPS apagado).',
  [ESTADOS.SIN_SENAL]: 'Su teléfono dejó de enviar: la app se cerró, el teléfono se bloqueó o no hay conexión.',
  [ESTADOS.DETENIDA]: 'Se detuvo y su teléfono ya no la comparte.',
  [ESTADOS.VENCIDA]: 'Pasaron los 30 minutos y su teléfono dejó de compartirla.',
};
const CON_PUNTO = [ESTADOS.EN_VIVO, ESTADOS.SIN_SENAL];
// El color de cada técnico en el mapa (su etiqueta y su ruta), por orden de la lista.
const COLORES_TECNICO = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#65a30d', '#b45309'];

// Borra una vez cada documento que sobra (`ids`: JSON de la lista) y olvida los que ya no están. Solo mientras haya datos cargados.
function useDescarte(ids, presentes, cargado, descartar, coleccion) {
  const hechos = useRef(new Set());
  useEffect(() => {
    if (!cargado) return;
    for (const id of hechos.current) if (!presentes[id]) hechos.current.delete(id);
    for (const id of JSON.parse(ids)) if (!hechos.current.has(id)) { hechos.current.add(id); descartar(id, coleccion); }
  }, [cargado, ids, presentes, descartar, coleccion]);
}

// `tickets`: las órdenes activas, para dibujar las rutas del día; `rutasActivas`: la función Ruta del día de Configuración (sin ella no hay casilla de rutas).
export default function UbicacionView({ firebaseUser, technicians, tickets, usuario, encendida, cargada, rutasActivas, setToastMsg }) {
  const { solicitudes, ubicaciones, ultimas, cargado, error, pedir, detener, descartar } = useUbicacionTecnicos(firebaseUser, encendida, usuario);
  // Un reloj de un segundo, solo con el módulo abierto: el "hace 12 s" y el tiempo que falta.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => { if (!encendida) return undefined; const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, [encendida]);
  const [ocupado, setOcupado] = useState(null);

  // Lo que no debe quedar guardado se borra al abrir el módulo: una posición sin solicitud (el teléfono se cerró antes de borrarla) y una última ubicación de más de 24 horas.
  useDescarte(JSON.stringify(posicionesHuerfanas(solicitudes, ubicaciones, ahora)), ubicaciones, cargado, descartar, 'ubicaciones');
  useDescarte(JSON.stringify(ultimasViejas(ultimas, ahora)), ultimas, cargado, descartar, 'ultimaUbicacion');
  const [enfoque, setEnfoque] = useState({ id: null, vez: 0 });
  const [centrarVez, setCentrarVez] = useState(0);
  const [verRutas, setVerRutas] = useState(false);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  // Pantalla completa del mapa: Escape la cierra y la página de abajo no se desplaza mientras tanto.
  useEffect(() => {
    if (!pantallaCompleta) return undefined;
    const tecla = (e) => { if (e.key === 'Escape') setPantallaCompleta(false); };
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', tecla);
    return () => { document.body.style.overflow = antes; document.removeEventListener('keydown', tecla); };
  }, [pantallaCompleta]);

  const filas = useMemo(() => technicians
    .filter((t) => t.activo !== false)
    .map((t) => ({ nombre: t.name, id: idDeTecnico(t.name) }))
    .filter((t) => t.id)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((f, i) => {
      const estado = estadoUbicacion(solicitudes[f.id], ubicaciones[f.id], ahora);
      const ubic = ubicaciones[f.id];
      const ultima = ultimas[f.id];
      // El punto que se dibuja: la posición en vivo si hay; si no, la última ubicación conocida (de una acción del técnico).
      const punto = CON_PUNTO.includes(estado) && Number.isFinite(ubic?.lat)
        ? { ...ubic, tipo: estado === ESTADOS.EN_VIVO ? 'vivo' : 'sin-senal' }
        : ultimaVigente(ultima, ahora) ? { ...ultima, tipo: 'ultima' } : null;
      return { ...f, color: COLORES_TECNICO[i % COLORES_TECNICO.length], estado, solicitud: solicitudes[f.id], punto, vigente: solicitudVigente(solicitudes[f.id], ahora) };
    }), [technicians, solicitudes, ubicaciones, ultimas, ahora]);

  // Los puntos del mapa: solo cambian cuando llega una posición nueva o cambia el estado (no con el reloj de cada segundo).
  const firmaPuntos = filas.map((f) => (f.punto ? `${f.id}|${f.punto.lat}|${f.punto.lng}|${f.punto.precision}|${f.punto.tipo}` : '')).join(';');
  const puntos = useMemo(() => filas
    .filter((f) => f.punto)
    .map((f) => ({ id: f.id, nombre: f.nombre, color: f.color, lat: f.punto.lat, lng: f.punto.lng, precision: f.punto.precision || 0, tipo: f.punto.tipo })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [firmaPuntos]);
  const enVivo = puntos.filter((p) => p.tipo === 'vivo').length;
  const ultimasConocidas = puntos.filter((p) => p.tipo === 'ultima').length;
  const sinSenal = puntos.length - enVivo - ultimasConocidas;

  // Las rutas del día de cada técnico (las mismas que ve en su teléfono: sus órdenes pendientes de hoy con ubicación, la prioridad alta primero y luego de la más cercana a la más lejana desde donde está).
  // Solo se calculan con la casilla marcada y la función Ruta del día encendida; el mapa se redibuja solo cuando algo cambia de verdad (firma), no con el reloj.
  const mostrarRutas = Boolean(rutasActivas) && verRutas;
  const firmaRutas = mostrarRutas ? JSON.stringify(filas.map((f) => {
    const paradas = paradasDeRuta((tickets || []).filter((t) => String(t.tecnico || '').toUpperCase() === f.nombre.toUpperCase())).paradas;
    if (paradas.length === 0) return null;
    const desde = f.punto ? { lat: f.punto.lat, lng: f.punto.lng } : null;
    const orden = ordenSugerido(paradas, desde);
    return { id: f.id, nombre: f.nombre, color: f.color, desde, km: Math.round(kmDeRuta(orden, desde)), paradas: orden.map((p, i) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, lat: p.punto.lat, lng: p.punto.lng, n: i + 1, prioridad: p.prioridad })) };
  }).filter(Boolean)) : '[]';
  const rutas = useMemo(() => JSON.parse(firmaRutas), [firmaRutas]);
  const cambiarRutas = (marcada) => { setVerRutas(marcada); if (marcada) setCentrarVez((n) => n + 1); };

  const accion = async (fila, hacer, exito, fallo) => {
    setOcupado(fila.id);
    const ok = await hacer(fila.nombre);
    setOcupado(null);
    setToastMsg?.(ok ? { type: 'success', text: exito } : { type: 'error', text: fallo });
    return ok;
  };
  const pedirA = (fila) => accion(fila, pedir, `Ubicación pedida a ${fila.nombre}. Aparecerá cuando abra la app.`, 'No se pudo pedir la ubicación. Revisa tu conexión e inténtalo de nuevo.');
  const detenerA = (fila) => accion(fila, detener, `Se detuvo la ubicación de ${fila.nombre}.`, 'No se pudo detener. Inténtalo de nuevo.');
  const irA = (fila) => setEnfoque((e) => ({ id: fila.id, vez: e.vez + 1 }));

  if (!encendida) {
    return (
      <div className={`p-4 ${CENTRADO_AMPLIO}`}>
        <div className={`${TARJETA} p-4 max-w-xl flex items-start gap-3`}>
          <Settings className="w-5 h-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
          <p className="text-sm text-foreground">{cargada ? 'La ubicación de técnicos está apagada. Enciéndela en Configuración, en "Ubicación de técnicos en la calle".' : 'Cargando...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${CENTRADO_AMPLIO}`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] items-start">
        <section aria-label="Técnicos" className="order-2 lg:order-1 space-y-3 min-w-0">
          <p className={TEXTO_SUAVE}>Pide la ubicación de un técnico: no recibe ningún aviso. Su teléfono la envía sola en cuanto abra la app, durante 30 minutos (al abrirla cada 30 segundos y luego cada 2 minutos). Además, al marcar En camino, Llegué o pre-finalizar queda un punto: la última ubicación conocida, por 24 horas.</p>
          {error && <Aviso nivel="error" compact>No se pudo leer la ubicación. Lo que ves puede estar desactualizado.</Aviso>}
          {!cargado && !error && <p role="status" className={TEXTO_SUAVE}>Cargando...</p>}
          {cargado && filas.length === 0 && <p className="text-sm text-card-foreground">No hay técnicos activos.</p>}

          <ul className="space-y-2">
            {filas.map((fila) => {
              const { texto, clase } = INSIGNIA[fila.estado];
              const conPunto = Boolean(fila.punto);
              const enLinea = fila.punto?.tipo === 'vivo' || fila.punto?.tipo === 'sin-senal';
              return (
                <li key={fila.id} className={`${TARJETA} p-3 ${enfoque.id === fila.id && conPunto ? 'border-red-500 dark:border-red-500' : ''}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <p className="min-w-0 flex-1 text-sm font-black text-foreground truncate">{fila.nombre}</p>
                    <span className={`whitespace-nowrap text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded ${clase}`}>{texto}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {enLinea ? `Última lectura ${haceCuanto(fila.punto.en, ahora)}${fila.punto.precision ? ` · precisión de ${fila.punto.precision} m` : ''}` : EXPLICACION[fila.estado]}
                    {fila.vigente && ` · termina en ${tiempoRestante(fila.solicitud, ahora)}`}
                  </p>
                  {fila.punto?.tipo === 'ultima' && (
                    <p className="mt-0.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                      Última ubicación conocida {haceCuanto(fila.punto.en, ahora)} · {MOTIVOS_PUNTO[fila.punto.motivo]}{fila.punto.codigo ? ` (${fila.punto.codigo})` : ''}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fila.vigente
                      ? <Boton variante="peligro" tamano="compacto" className="max-lg:min-h-11" disabled={ocupado === fila.id} onClick={() => detenerA(fila)}>Detener</Boton>
                      : <Boton variante="principal" tamano="compacto" className="max-lg:min-h-11" icono={LocateFixed} disabled={ocupado === fila.id || !cargado} onClick={() => pedirA(fila)}>{fila.estado === ESTADOS.NINGUNA ? 'Pedir ubicación' : 'Pedir de nuevo'}</Boton>}
                    {conPunto && <Boton variante="secundario" tamano="compacto" className="max-lg:min-h-11" icono={Crosshair} onClick={() => irA(fila)}>Ver en el mapa</Boton>}
                    {conPunto && (
                      <a href={enlaceGoogleMaps(fila.punto)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2 text-xs font-black text-sky-700 dark:text-sky-400 underline max-lg:min-h-11">
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Google Maps
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Mapa" className={pantallaCompleta ? 'fixed inset-0 z-[60] bg-fondo p-3 flex flex-col gap-2' : 'order-1 lg:order-2 min-w-0 lg:sticky lg:top-4 space-y-2'}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-foreground mr-auto">{puntos.length === 0 ? 'Sin ubicaciones por ahora' : [`${enVivo} en vivo`, sinSenal > 0 && `${sinSenal} sin señal`, ultimasConocidas > 0 && `${ultimasConocidas} última${ultimasConocidas === 1 ? '' : 's'} conocida${ultimasConocidas === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</p>
            {rutasActivas && (
              <label htmlFor="ubicacion-rutas" className="inline-flex items-center gap-2 text-xs font-black text-foreground cursor-pointer max-lg:min-h-11">
                <input id="ubicacion-rutas" type="checkbox" checked={verRutas} onChange={(e) => cambiarRutas(e.target.checked)} className="w-4 h-4 accent-primary cursor-pointer" />
                Ver las rutas del día
              </label>
            )}
            <Boton variante="secundario" tamano="compacto" className="max-lg:min-h-11" icono={Crosshair} disabled={puntos.length === 0 && rutas.length === 0} onClick={() => setCentrarVez((n) => n + 1)}>Centrar en todos</Boton>
            <Boton variante="secundario" tamano="compacto" className="max-lg:min-h-11" icono={pantallaCompleta ? Minimize2 : Maximize2} aria-pressed={pantallaCompleta} onClick={() => setPantallaCompleta((v) => !v)}>{pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}</Boton>
          </div>
          {mostrarRutas && (
            <div className="space-y-1">
              {rutas.length === 0
                ? <p className={TEXTO_SUAVE}>Ningún técnico tiene hoy paradas con ubicación del cliente o de la NAP.</p>
                : (
                  <ul className="flex flex-wrap gap-1.5">
                    {rutas.map((r) => (
                      <li key={r.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs font-bold text-foreground">
                        <span aria-hidden="true" className="w-3 h-3 rounded-full shrink-0" style={{ background: r.color }} />
                        {r.nombre} · {r.paradas.length} {r.paradas.length === 1 ? 'parada' : 'paradas'}{r.km > 0 ? ` · ~${r.km} km` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              <p className={TEXTO_SUAVE}>Líneas rectas (no son calles) desde donde está cada técnico hasta sus paradas, en el orden de su ruta del día. Borde amarillo: prioridad alta.</p>
            </div>
          )}
          <div className={pantallaCompleta ? 'flex-1 min-h-0' : 'h-[52dvh] lg:h-[calc(100dvh-62px-32px-5.5rem)] lg:min-h-[28rem]'}>
            <MapaTecnicos puntos={puntos} rutas={rutas} enfocarId={enfoque.id} enfocarVez={enfoque.vez} centrarVez={centrarVez} />
          </div>
        </section>
      </div>
    </div>
  );
}
