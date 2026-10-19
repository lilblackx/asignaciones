import { useEffect, useLayoutEffect, useRef } from 'react';
import { salidaAnimada } from '../hooks/usePresencia';
import '../utils/sacudidaErrores';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Los módulos del menú (cierre, reportes, historial, técnicos, usuarios, tasa, materiales, inventario) ocupan toda la pantalla en PC
// (lg: 1024 px o más); en pantallas menores siguen siendo la ventana de siempre. Se usan juntos:
//   <Modal completa> + PANEL_COMPLETO en el panel + un CENTRADO_* en el cuerpo, para que el contenido no se estire en pantallas anchas.
export const PANEL_COMPLETO = 'lg:max-w-none lg:h-dvh lg:max-h-dvh lg:rounded-none lg:border-0';
// Rellena los costados del cuerpo para centrar el contenido con un ancho máximo (80 rem / 48 rem), sin tocar el relleno en móvil.
export const CENTRADO_AMPLIO = 'lg:px-[max(1.5rem,calc((100%-80rem)/2))]';
export const CENTRADO_ESTRECHO = 'lg:px-[max(1.5rem,calc((100%-48rem)/2))]';

const DURACION_SALIDA_MS = 150;
// Menos que esto desde que se montó no puede ser un cierre del usuario: es el montaje y desmontaje de prueba de StrictMode (solo en desarrollo).
const MINIMO_PARA_ANIMAR_MS = 50;

// Los padres quitan el modal de golpe (`{abierto && <Modal>}`), también al guardar o confirmar, así que no hay forma de animar su salida
// desde dentro. Al desmontarse se deja una copia de lo que se veía, inerte, que se desvanece y se borra. Va en el mismo contenedor
// para heredar el modo oscuro (una clase en un div de la app, no en <html>).
function animarSalida(overlay) {
  const contenedor = overlay.parentNode;
  const fantasma = overlay.cloneNode(true);
  fantasma.classList.remove('lg:animate-modal-fondo');
  fantasma.classList.add('animate-modal-fondo-salida', 'pointer-events-none');
  fantasma.setAttribute('aria-hidden', 'true');
  fantasma.inert = true;
  const panel = fantasma.querySelector('[role="dialog"]');
  panel?.classList.remove('lg:animate-modal-panel');
  panel?.removeAttribute('role');
  panel?.classList.add('animate-modal-panel-salida');
  // Los ids repetidos romperían los label y los focus de un modal que se abra a la vez.
  fantasma.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  // cloneNode conserva lo escrito en los campos, pero no lo desplazado: se copia después de insertar, cuando ya hay diseño.
  const originales = overlay.querySelectorAll('*');
  contenedor.appendChild(fantasma);
  fantasma.querySelectorAll('*').forEach((el, i) => {
    el.scrollTop = originales[i].scrollTop;
    el.scrollLeft = originales[i].scrollLeft;
  });
  setTimeout(() => fantasma.remove(), DURACION_SALIDA_MS + 50);
}

// Las ventanas abiertas, la de arriba al final: el botón "atrás" del navegador solo le toca a la de arriba.
let pila = [];
// Cuántos "popstate" son nuestros (los provoca history.back() al cerrar) y no deben tratarse como un "atrás" del usuario.
let popstatePropios = 0;
let siguienteId = 0;
// Quién atiende el "atrás" de cada ventana abierta (por id). Un solo oyente para todas, que vive siempre: así un popstate propio
// que llega cuando ya no queda ninguna ventana abierta se descuenta igual.
const alAtras = new Map();
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (popstatePropios > 0) { popstatePropios -= 1; return; }
    alAtras.get(pila[pila.length - 1])?.();
  });
}

// `onVolver`: si la ventana tiene niveles (p. ej. el detalle de un cierre dentro de Cierre), "atrás" y Escape suben un nivel en vez de
// cerrar; sin él, cierran. El "atrás" del navegador cierra la ventana en vez de sacar al usuario de la app.
export default function Modal({ onClose, onVolver, zIndexClass = 'z-50', completa = false, children }) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const onVolverRef = useRef(onVolver);

  useEffect(() => {
    onCloseRef.current = onClose;
    onVolverRef.current = onVolver;
  });

  useEffect(() => {
    siguienteId += 1;
    const id = siguienteId;
    let montada = true;
    let entradaPropia = true;
    window.history.pushState({ modalId: id }, '');
    pila.push(id);
    alAtras.set(id, () => {
      entradaPropia = false;
      (onVolverRef.current || onCloseRef.current)();
      // Si la ventana sigue abierta (subió un nivel, o no se pudo cerrar), repone su entrada para que el siguiente "atrás" siga siendo suyo.
      setTimeout(() => {
        if (montada && !entradaPropia) {
          window.history.pushState({ modalId: id }, '');
          entradaPropia = true;
        }
      }, 50);
    });
    return () => {
      montada = false;
      alAtras.delete(id);
      pila = pila.filter((x) => x !== id);
      // Se cerró por otro lado (X, Escape...): quita su entrada del historial, si sigue siendo la última.
      if (entradaPropia) {
        setTimeout(() => {
          if (window.history.state?.modalId === id) {
            popstatePropios += 1;
            window.history.back();
          }
        }, 0);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const montadoEn = performance.now();
    return () => {
      if (overlay?.isConnected && performance.now() - montadoEn > MINIMO_PARA_ANIMAR_MS && salidaAnimada()) animarSalida(overlay);
    };
  }, []);

  // Runs once per mount: initial focus + key handling. Reading onClose via a ref
  // avoids re-binding (and re-stealing focus) whenever the parent re-renders
  // with a new inline onClose function, e.g. on every keystroke in a sibling input.
  useEffect(() => {
    const panel = panelRef.current;
    const focusables = panel ? panel.querySelectorAll(FOCUSABLE_SELECTOR) : [];
    if (focusables.length > 0) focusables[0].focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        (onVolverRef.current || onCloseRef.current)();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;

      const nodes = panel.querySelectorAll(FOCUSABLE_SELECTOR);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div ref={overlayRef} className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center ${zIndexClass} p-4${completa ? ' lg:p-0' : ''} lg:animate-modal-fondo`} role="presentation">
      <div ref={panelRef} role="dialog" aria-modal="true" className="flex w-full min-w-0 justify-center lg:animate-modal-panel">
        {children}
      </div>
    </div>
  );
}
