import { Inbox } from 'lucide-react';

// Lo que se ve cuando una lista no tiene nada que mostrar: un ícono en un círculo suave, una frase corta que dice qué pasa (`titulo`) y, debajo, qué hacer o por qué (`children`, opcional).
// `accion`: { etiqueta, onClick } para un botón (por ejemplo "Quitar los filtros"). `compacto`: menos aire, para dentro de una tarjeta o una ventana. Los errores de carga no van aquí: son un `Aviso` de error.
export default function EstadoVacio({ icono: Icono = Inbox, titulo, children, accion, compacto = false, className = '' }) {
  return (
    <div role="status" className={`flex flex-col items-center text-center ${compacto ? 'py-6' : 'py-10'} px-4 ${className}`}>
      <span className="w-12 h-12 rounded-full bg-secondary text-muted-foreground flex items-center justify-center">
        <Icono className="w-6 h-6" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-bold text-foreground">{titulo}</p>
      {children && <p className="mt-1 text-sm text-muted-foreground max-w-md">{children}</p>}
      {accion && (
        <button type="button" onClick={accion.onClick} className="mt-3 inline-flex items-center justify-center h-9 max-lg:h-11 px-4 rounded-boton border border-input bg-card text-sm font-bold text-foreground hover:bg-secondary transition-colors">{accion.etiqueta}</button>
      )}
    </div>
  );
}
