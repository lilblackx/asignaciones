// Cámara y lectura de códigos de barras para escanear el serial de la caja (ver utils/lecturaSerial y components/modals/EscanearSerialModal).
// Lee con el lector del propio navegador (BarcodeDetector: Chrome y Brave en Android) y, donde no lo hay (iPhone, PC), con la librería ZXing, que se baja solo al abrir el escáner.
// Solo se lee lo que cae dentro del recuadro guía, para que el técnico apunte al código correcto y no al de al lado.

const FORMATOS = ['code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e', 'qr_code', 'data_matrix', 'pdf417'];

export const camaraDisponible = () => Boolean(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) && (typeof window === 'undefined' || window.isSecureContext !== false);

// Abre la cámara trasera y la muestra en `video`. Devuelve { linterna, encenderLinterna(bool), cerrar() } o lanza el error del navegador (name: NotAllowedError, NotFoundError...).
export async function abrirCamara(video) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  const pista = stream.getVideoTracks()[0];
  // Enfoque continuo (donde el teléfono lo permita): sin él las etiquetas pequeñas salen borrosas.
  try { await pista.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch { /* el teléfono no lo permite: se queda como está */ }
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  await video.play().catch(() => {});
  const linterna = Boolean(pista.getCapabilities?.().torch);
  return {
    linterna,
    encenderLinterna: async (encendida) => { try { await pista.applyConstraints({ advanced: [{ torch: encendida }] }); return true; } catch { return false; } },
    // Solo suelta la imagen si sigue siendo la suya: otro intento de abrir la cámara (React monta dos veces en desarrollo; o se cierra y se abre rápido) puede haber puesto la suya en el mismo video.
    cerrar: () => { stream.getTracks().forEach((t) => t.stop()); if (video.srcObject === stream) video.srcObject = null; },
  };
}

// Un lector de códigos: recibe un canvas y devuelve los textos que lee (puede haber varios a la vez). Nunca lanza: si no lee nada, devuelve [].
export async function crearLector() {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const soportados = await window.BarcodeDetector.getSupportedFormats();
      const formatos = FORMATOS.filter((f) => soportados.includes(f));
      if (formatos.length > 0) {
        const detector = new window.BarcodeDetector({ formats: formatos });
        return async (canvas) => { try { return (await detector.detect(canvas)).map((c) => c.rawValue); } catch { return []; } };
      }
    } catch { /* se cae a ZXing */ }
  }
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const pistas = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.CODABAR, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.ITF, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX]], [DecodeHintType.TRY_HARDER, true]]);
  const lector = new BrowserMultiFormatReader(pistas);
  return async (canvas) => { try { return [lector.decodeFromCanvas(canvas).getText()]; } catch { return []; } };
}

// Copia a `canvas` lo que hay dentro del recuadro guía (`marco`, un elemento sobre el `video`). El video llena su caja recortado (object-fit: cover), así que se pasa del recuadro en pantalla al
// recuadro en la imagen de la cámara. Devuelve false si todavía no hay imagen.
export function recortarMarco(video, marco, canvas) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;
  const caja = video.getBoundingClientRect();
  const m = marco.getBoundingClientRect();
  const escala = Math.max(caja.width / vw, caja.height / vh);
  const desdeX = (caja.width - vw * escala) / 2;
  const desdeY = (caja.height - vh * escala) / 2;
  const sx = Math.max(0, (m.left - caja.left - desdeX) / escala);
  const sy = Math.max(0, (m.top - caja.top - desdeY) / escala);
  const sw = Math.min(vw - sx, m.width / escala);
  const sh = Math.min(vh - sy, m.height / escala);
  if (sw < 20 || sh < 20) return false;
  const ancho = Math.min(1280, Math.round(sw));
  canvas.width = ancho;
  canvas.height = Math.round((sh / sw) * ancho);
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return true;
}
