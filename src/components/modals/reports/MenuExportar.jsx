import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, FileType, Loader2, X } from 'lucide-react';
import { claseBoton, claseSelector } from '../../estilos';
import SelectMenu from '../../SelectMenu';

const OPCIONES = {
  pdf: { etiqueta: 'PDF', corta: 'PDF', detalle: 'Para presentar o imprimir', Icono: FileText },
  docx: { etiqueta: 'Word', corta: 'Word', detalle: 'Documento editable (.docx)', Icono: FileType },
  csv: { etiqueta: 'Excel (CSV)', corta: 'Excel', detalle: 'Solo los datos, para analizar', Icono: FileSpreadsheet },
};

// El menú de la lista nunca se sale de la pantalla: si al abrirse pasa del borde (en el celular el botón no siempre está pegado a un lado), se corre lo justo.
// Se hace al montarse el menú, antes de pintarlo, directo sobre el elemento. En el celular se mide la pantalla que se ve (visualViewport), no la de la página.
const MARGEN_PANTALLA = 8;
function mantenerEnPantalla(menu) {
  if (!menu) return;
  menu.style.transform = '';
  const pantalla = window.visualViewport ?? { width: window.innerWidth, offsetLeft: 0 };
  const { left, right } = menu.getBoundingClientRect();
  const sobra = Math.max(0, right - (pantalla.offsetLeft + pantalla.width - MARGEN_PANTALLA));
  const falta = Math.max(0, pantalla.offsetLeft + MARGEN_PANTALLA - (left - sobra));
  if (sobra || falta) menu.style.transform = `translateX(${falta - sobra}px)`;
}

// El botón "Exportar".
//   formatos: ['pdf', 'docx', 'csv'] (los que tiene el reporte): se abre una lista con un toque por formato. ocupado: el formato que se está armando, o null.
//   grupos: cuando la pantalla tiene más de un reporte para bajar, en vez de `formatos`: [{ clave, titulo, detalle, formatos }]. Se abre un panel con dos pasos: el reporte (desplegable) y el formato
//     (botones grandes: al tocar uno se descarga). `onElegir` recibe el formato y la clave del reporte. En el celular el panel sale pegado abajo y ocupa el ancho de la pantalla.
//   extra: clases que se suman al botón; alinear: de qué lado se abre ('derecha' por defecto: pegado al borde derecho del botón).
export default function MenuExportar({ formatos, grupos, onElegir, ocupado, extra = '', alinear = 'derecha' }) {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState(grupos?.[0]?.clave);
  const raiz = useRef(null);
  const idReporte = useId();
  const conPanel = Boolean(grupos);
  const grupo = conPanel ? (grupos.find((g) => g.clave === clave) || grupos[0]) : null;

  useEffect(() => {
    if (!abierto) return undefined;
    // La lista del desplegable de reportes se pinta aparte (en un portal): tocarla no es tocar fuera del panel.
    const fuera = (e) => { if (raiz.current && !raiz.current.contains(e.target) && !e.target.closest?.('[role="listbox"]')) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape' && conPanel) setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, conPanel]);

  const elegir = (formato, claveDelReporte) => {
    setAbierto(false);
    onElegir(formato, claveDelReporte);
  };

  return (
    <div className="relative" ref={raiz}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={Boolean(ocupado)}
        aria-haspopup={conPanel ? 'dialog' : 'menu'}
        aria-expanded={abierto}
        className={`${claseBoton('secundario', 'normal')} ${extra}`}
      >
        {ocupado ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
        {ocupado ? 'Generando...' : 'Exportar'}
        {!ocupado && <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
      </button>

      {abierto && conPanel && (
        <div
          role="dialog"
          aria-label="Exportar un reporte"
          className={`max-sm:fixed max-sm:inset-x-2 max-sm:bottom-3 sm:absolute ${alinear === 'izquierda' ? 'sm:left-0' : 'sm:right-0'} sm:mt-2 sm:w-80 z-40 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl p-4 space-y-4`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-bold text-zinc-900 dark:text-white">Exportar</p>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="-mr-1 p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={idReporte} className="block text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">1. Reporte</label>
            <SelectMenu id={idReporte} ariaLabel="Reporte a exportar" value={grupo.clave} onChange={setClave} items={grupos.map((g) => ({ value: g.clave, label: g.titulo }))} className={`${claseSelector('normal')} w-full aria-expanded:border-red-600`} />
            {grupo.detalle && <p className="text-xs text-zinc-600 dark:text-zinc-300">{grupo.detalle}</p>}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">2. Formato</p>
            <div className="grid grid-cols-3 gap-2">
              {grupo.formatos.map((f) => {
                const { etiqueta, corta, detalle, Icono } = OPCIONES[f];
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => elegir(f, grupo.clave)}
                    aria-label={`${etiqueta}: ${detalle}`}
                    className="flex flex-col items-center justify-center gap-1.5 min-h-16 px-2 py-3 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 text-sm font-bold text-zinc-900 dark:text-white hover:border-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Icono className="w-6 h-6 text-red-600" aria-hidden="true" />
                    {corta}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {abierto && !conPanel && (
        <div role="menu" ref={mantenerEnPantalla} className={`absolute ${alinear === 'izquierda' ? 'left-0' : 'right-0'} mt-2 w-64 max-w-[calc(100vw-1rem)] z-20 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden`}>
          {formatos.map((f) => {
            const { etiqueta, detalle, Icono } = OPCIONES[f];
            return (
              <button
                key={f}
                role="menuitem"
                type="button"
                onClick={() => elegir(f)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-b last:border-b-0 border-zinc-100 dark:border-zinc-800"
              >
                <Icono className="w-5 h-5 shrink-0 text-red-600" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-zinc-900 dark:text-white">{etiqueta}</span>
                  <span className="block text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400">{detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
