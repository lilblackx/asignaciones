import { CheckCircle2, Copy } from 'lucide-react';
import Modal from '../Modal';
import { claseArea } from '../estilos';
import BotonCerrar from '../BotonCerrar';

export default function WhatsAppMessageModal({ mensaje, onCopy, onClose }) {
  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-card rounded-card shadow-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto border border-border">
        <div className="encabezado-d bg-black px-4 py-3 border-b-2 border-green-600 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-black text-white leading-tight">Orden creada</h2>
              <p className="text-etiqueta font-medium text-green-400 leading-tight">Mensaje listo para el cliente</p>
            </div>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>
        <div className="p-4 space-y-3">
          <textarea
            readOnly
            value={mensaje}
            rows="10"
            className={`${claseArea('compacto')} whitespace-pre-wrap`}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-card-foreground font-bold bg-card border-2 border-input hover:bg-secondary rounded-card text-xs transition-colors shadow-card">Cerrar</button>
            <button type="button" onClick={onCopy} className="px-4 py-1.5 flex items-center gap-1.5 text-white font-bold bg-green-700 hover:bg-green-800 rounded-boton text-xs shadow-md transition-colors"><Copy className="w-3.5 h-3.5" /> Copiar mensaje</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
