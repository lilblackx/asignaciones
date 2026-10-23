import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, FileType, Loader2 } from 'lucide-react';
import { claseBoton } from '../../estilos';

const OPCIONES = {
  pdf: { etiqueta: 'PDF', detalle: 'Para presentar o imprimir', Icono: FileText },
  docx: { etiqueta: 'Word', detalle: 'Documento editable (.docx)', Icono: FileType },
  csv: { etiqueta: 'Excel (CSV)', detalle: 'Solo los datos, para analizar', Icono: FileSpreadsheet },
};

// El botón "Exportar" con sus formatos. formatos: ['pdf', 'docx', 'csv'] (los que tiene el reporte); ocupado: el formato que se está armando, o null.
// `extra`: clases que se suman al botón; `alinear`: de qué lado se abre el menú ('derecha' por defecto: pegado al borde derecho del botón).
export default function MenuExportar({ formatos, onElegir, ocupado, extra = '', alinear = 'derecha' }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);

  return (
    <div className="relative" ref={raiz}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={Boolean(ocupado)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={`${claseBoton('secundario', 'normal')} ${extra}`}
      >
        {ocupado ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
        {ocupado ? 'Generando...' : 'Exportar'}
        {!ocupado && <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
      </button>
      {abierto && (
        <div role="menu" className={`absolute ${alinear === 'izquierda' ? 'left-0' : 'right-0'} mt-2 w-64 z-20 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden`}>
          {formatos.map((f) => {
            const { etiqueta, detalle, Icono } = OPCIONES[f];
            return (
              <button
                key={f}
                role="menuitem"
                type="button"
                onClick={() => { setAbierto(false); onElegir(f); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-b last:border-b-0 border-zinc-100 dark:border-zinc-800"
              >
                <Icono className="w-5 h-5 shrink-0 text-red-600" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-zinc-900 dark:text-white">{etiqueta}</span>
                  <span className="block text-[11px] text-zinc-600 dark:text-zinc-500">{detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
