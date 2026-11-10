import { useEffect, useRef, useState } from 'react';
import { Keyboard, X, Zap } from 'lucide-react';
import Modal from '../Modal';
import { abrirCamara, camaraDisponible, crearLector, recortarMarco } from '../../lib/lectorCodigos';
import { mejorLectura } from '../../utils/lecturaSerial';

const MS_ENTRE_LECTURAS = 150;
const MS_AVISO_RECHAZO = 3000;

const mensajeDeError = (error) => {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'No hay permiso para usar la cámara. Actívalo en los ajustes del navegador, o escribe el serial a mano.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Este teléfono no tiene una cámara disponible. Escribe el serial a mano.';
    case 'NotReadableError':
      return 'La cámara la está usando otra aplicación. Ciérrala e inténtalo de nuevo, o escribe el serial a mano.';
    default:
      return 'No se pudo abrir la cámara. Escribe el serial a mano.';
  }
};

const BOTON = 'flex-1 min-h-[48px] px-3 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold transition-colors';
const BOTON_PRINCIPAL = 'flex-1 min-h-[48px] px-3 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black transition-colors';

// Escanea con la cámara el código de barras de la etiqueta de la caja y devuelve el serial (onLeido). Solo acepta el PON S/N o el GPON SN (ver utils/lecturaSerial): la MAC, el S/N de fábrica
// y cualquier otro código se rechazan diciendo qué se leyó. Un recuadro guía marca dónde apuntar; solo se lee lo que cae dentro.
export default function EscanearSerialModal({ onLeido, onClose }) {
  const videoRef = useRef(null);
  const marcoRef = useRef(null);
  const canvasRef = useRef(null);
  const camaraRef = useRef(null);
  const pausadoRef = useRef(false);
  const rechazoEnRef = useRef(0);
  const [fase, setFase] = useState('abriendo'); // abriendo | escaneando | leido | sin-camara
  const [errorCamara, setErrorCamara] = useState('');
  const [leido, setLeido] = useState(null);
  const [rechazo, setRechazo] = useState(null);
  const [linterna, setLinterna] = useState({ disponible: false, encendida: false });

  useEffect(() => {
    let vivo = true;
    let temporizador = null;
    (async () => {
      if (!camaraDisponible()) {
        setErrorCamara('La cámara solo se puede usar con la app abierta desde su dirección segura (https). Escribe el serial a mano.');
        setFase('sin-camara');
        return;
      }
      try {
        const camara = await abrirCamara(videoRef.current);
        if (!vivo) { camara.cerrar(); return; }
        camaraRef.current = camara;
        setLinterna({ disponible: camara.linterna, encendida: false });
        const leer = await crearLector();
        if (!vivo) return;
        setFase('escaneando');
        const ciclo = async () => {
          if (!vivo) return;
          if (!pausadoRef.current && recortarMarco(videoRef.current, marcoRef.current, canvasRef.current)) {
            const mejor = mejorLectura(await leer(canvasRef.current));
            if (vivo && !pausadoRef.current && mejor) {
              if (mejor.tipo === 'ok') {
                pausadoRef.current = true;
                rechazoEnRef.current = 0;
                navigator.vibrate?.(80);
                setRechazo(null);
                setLeido(mejor);
                setFase('leido');
              } else {
                rechazoEnRef.current = Date.now();
                setRechazo((previo) => (previo?.leido === mejor.leido ? previo : mejor));
              }
            }
          }
          // El aviso de "ese no es" se quita solo si deja de verse ese código.
          if (rechazoEnRef.current && Date.now() - rechazoEnRef.current > MS_AVISO_RECHAZO) { rechazoEnRef.current = 0; setRechazo(null); }
          temporizador = setTimeout(ciclo, MS_ENTRE_LECTURAS);
        };
        ciclo();
      } catch (error) {
        if (!vivo) return;
        setErrorCamara(mensajeDeError(error));
        setFase('sin-camara');
      }
    })();
    return () => {
      vivo = false;
      clearTimeout(temporizador);
      camaraRef.current?.cerrar();
      camaraRef.current = null;
    };
  }, []);

  const escanearOtraVez = () => { pausadoRef.current = false; setLeido(null); setFase('escaneando'); };
  const alternarLinterna = async () => {
    const quiere = !linterna.encendida;
    if (await camaraRef.current?.encenderLinterna(quiere)) setLinterna((l) => ({ ...l, encendida: quiere }));
  };
  const usar = () => { if (leido) { onLeido(leido.serial); onClose(); } };

  const marcoColor = fase === 'leido' ? 'border-emerald-500' : rechazo ? 'border-red-500' : 'border-white';
  const pista = fase === 'abriendo' ? { texto: 'Abriendo la cámara…', clase: 'bg-black/80' }
    : fase === 'leido' ? { texto: 'Código leído', clase: 'bg-emerald-700' }
      : rechazo ? { texto: 'Ese no es el PON S/N', clase: 'bg-red-700' }
        : { texto: 'Centra el código de barras en el recuadro', clase: 'bg-black/80' };

  return (
    <Modal onClose={onClose} zIndexClass="z-[130]">
      <div role="dialog" aria-label="Escanear serial" className="w-full max-w-md h-[min(92dvh,720px)] bg-black rounded-2xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b-2 border-amber-500">
          <h2 className="text-base font-black text-white">Escanear serial</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="relative flex-1 min-h-0 bg-zinc-900 overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted aria-hidden="true" />
          <canvas ref={canvasRef} className="hidden" />
          {fase !== 'sin-camara' && (
            <>
              <div ref={marcoRef} className={`absolute left-[6%] right-[6%] top-1/2 h-[26%] -translate-y-1/2 rounded-xl border-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-colors ${marcoColor}`} aria-hidden="true">
                {fase === 'escaneando' && !rechazo && <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />}
              </div>
              <p role="status" className={`absolute top-4 left-1/2 -translate-x-1/2 max-w-[90%] text-center text-xs font-black text-white px-3 py-1.5 rounded-full ${pista.clase}`}>{pista.texto}</p>
            </>
          )}
        </div>

        <div className="shrink-0 bg-black border-t border-zinc-800 p-4 space-y-3">
          {fase === 'sin-camara' && (
            <>
              <p role="alert" className="text-sm text-zinc-200 text-center">{errorCamara}</p>
              <div className="flex gap-3"><button type="button" onClick={onClose} className={BOTON_PRINCIPAL}><Keyboard className="w-4 h-4" aria-hidden="true" /> Escribirlo</button></div>
            </>
          )}

          {fase === 'leido' && leido && (
            <>
              <div className="rounded-xl border border-emerald-600 bg-emerald-950/40 px-3 py-2.5 text-center">
                <p className="text-[11px] font-black tracking-wide text-emerald-300">{leido.etiqueta}</p>
                <p className="text-2xl font-black text-white tracking-wide break-all">{leido.serial}</p>
              </div>
              <p className="text-sm text-zinc-300 text-center">Revisa que coincida con la etiqueta de la caja.</p>
              <div className="flex gap-3">
                <button type="button" onClick={escanearOtraVez} className={BOTON}>Escanear otra vez</button>
                <button type="button" onClick={usar} className={BOTON_PRINCIPAL}>Usar este serial</button>
              </div>
            </>
          )}

          {(fase === 'escaneando' || fase === 'abriendo') && rechazo && (
            <>
              <div role="alert" className="rounded-xl border border-red-600 bg-red-950/40 px-3 py-2.5">
                <p className="text-sm font-black text-red-300">{rechazo.mensaje}</p>
                <p className="text-sm text-zinc-300 mt-1">Apunta al código que dice <b className="text-white">PON S/N</b> o <b className="text-white">GPON SN</b>. No se guarda nada hasta que lea el correcto.</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className={BOTON}><Keyboard className="w-4 h-4" aria-hidden="true" /> Escribirlo</button>
                <button type="button" onClick={() => { rechazoEnRef.current = 0; setRechazo(null); }} className={BOTON_PRINCIPAL}>Seguir escaneando</button>
              </div>
            </>
          )}

          {(fase === 'escaneando' || fase === 'abriendo') && !rechazo && (
            <>
              <p className="text-sm text-zinc-300 text-center">Busca el código que dice <b className="text-white">PON S/N</b> (V-SOL, BT-PON…) o <b className="text-white">GPON SN</b> (TP-Link…). La MAC y el S/N de fábrica no sirven.</p>
              <div className="flex gap-3">
                {linterna.disponible && (
                  <button type="button" onClick={alternarLinterna} aria-pressed={linterna.encendida} className={`${BOTON} ${linterna.encendida ? 'border-amber-500 text-amber-300' : ''}`}><Zap className="w-4 h-4" aria-hidden="true" /> Linterna</button>
                )}
                <button type="button" onClick={onClose} className={BOTON}><Keyboard className="w-4 h-4" aria-hidden="true" /> Escribirlo</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
