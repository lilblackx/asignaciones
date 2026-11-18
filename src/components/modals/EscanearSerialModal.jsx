import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScanLine, Zap } from 'lucide-react';
import Modal from '../Modal';
import BotonCerrar from '../BotonCerrar';
import Aviso from '../Aviso';
import { BOTON, BOTON_PRINCIPAL } from '../estilos';
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

// Botones de la barra de abajo: los estándar de la app, a lo ancho y de 44 px (el dedo).
const SECUNDARIO = `${BOTON.replace('h-9', 'h-11')} flex-1`;
const PRINCIPAL = `${BOTON_PRINCIPAL.replace('h-9', 'h-11')} flex-1`;

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
      <div role="dialog" aria-label="Escanear serial" className="w-full max-w-md h-[min(92dvh,720px)] bg-card rounded-card border border-border shadow-2xl flex flex-col overflow-hidden">
        <div className="encabezado-d bg-black shrink-0 flex items-center gap-3 px-4 py-3 border-b-2 border-red-600">
          <h2 className="text-sm font-black text-white flex items-center gap-2"><ScanLine className="w-4 h-4 text-red-700 dark:text-red-400" aria-hidden="true" /> Escanear serial</h2>
          <BotonCerrar onClick={onClose} className="ml-auto" />
        </div>

        <div className="relative flex-1 min-h-0 bg-black overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted aria-hidden="true" />
          <canvas ref={canvasRef} className="hidden" />
          {fase !== 'sin-camara' && (
            <>
              <div ref={marcoRef} className={`absolute left-[6%] right-[6%] top-1/2 h-[26%] -translate-y-1/2 rounded-campo border-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-colors ${marcoColor}`} aria-hidden="true">
                {fase === 'escaneando' && !rechazo && <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />}
              </div>
              <p role="status" className={`absolute top-4 left-1/2 -translate-x-1/2 max-w-[90%] text-center text-sm font-bold text-white px-3.5 py-1.5 rounded-full shadow-card ${pista.clase}`}>{pista.texto}</p>
            </>
          )}
        </div>

        <div className="shrink-0 bg-card border-t border-border p-4 space-y-3">
          {fase === 'sin-camara' && (
            <>
              <Aviso nivel="error" titulo="No se pudo usar la cámara">{errorCamara}</Aviso>
              <div className="flex gap-3"><button type="button" onClick={onClose} className={PRINCIPAL}><Keyboard className="w-4 h-4" aria-hidden="true" /> Escribirlo</button></div>
            </>
          )}

          {fase === 'leido' && leido && (
            <>
              <div className="rounded-campo border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2.5 text-center">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{leido.etiqueta}</p>
                <p className="text-2xl font-black text-foreground tracking-wide break-all">{leido.serial}</p>
              </div>
              <p className="text-sm text-muted-foreground text-center">Revisa que coincida con la etiqueta de la caja.</p>
              <div className="flex gap-3">
                <button type="button" onClick={escanearOtraVez} className={SECUNDARIO}>Escanear otra vez</button>
                <button type="button" onClick={usar} className={PRINCIPAL}>Usar este serial</button>
              </div>
            </>
          )}

          {(fase === 'escaneando' || fase === 'abriendo') && rechazo && (
            <>
              <Aviso nivel="error" titulo={rechazo.mensaje}>Apunta al código que dice <b>PON S/N</b> o <b>GPON SN</b>. No se guarda nada hasta que lea el correcto.</Aviso>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className={SECUNDARIO}><Keyboard className="w-4 h-4" aria-hidden="true" /> Escribirlo</button>
                <button type="button" onClick={() => { rechazoEnRef.current = 0; setRechazo(null); }} className={PRINCIPAL}>Seguir escaneando</button>
              </div>
            </>
          )}

          {(fase === 'escaneando' || fase === 'abriendo') && !rechazo && (
            <>
              <p className="text-sm text-muted-foreground text-center">Busca el código que dice <b className="text-foreground">PON S/N</b> (V-SOL, BT-PON…) o <b className="text-foreground">GPON SN</b> (TP-Link…). La MAC y el S/N de fábrica no sirven.</p>
              <div className="flex gap-3">
                {linterna.disponible && (
                  <button type="button" onClick={alternarLinterna} aria-pressed={linterna.encendida} className={`${SECUNDARIO} ${linterna.encendida ? 'border-amber-500 text-amber-700 dark:text-amber-300' : ''}`}><Zap className="w-4 h-4" aria-hidden="true" /> Linterna</button>
                )}
                <button type="button" onClick={onClose} className={SECUNDARIO}><Keyboard className="w-4 h-4" aria-hidden="true" /> Escribirlo</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
