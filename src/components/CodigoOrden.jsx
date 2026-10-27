import { esCodigoSinNumero } from '../utils/correlativo';

// El número de la orden. En la oficina, al tocarlo se copia el mensaje para el cliente (el de "Orden creada").
// Sin onCopiar o sin número todavía (instalación "IS" sin técnico) es solo texto.
// En celular no hay "pasar el mouse": el subrayado punteado (el mismo de la cédula) avisa que se toca, y la caja mide 44 px.
export default function CodigoOrden({ ticket, onCopiar, className = '', vacio = '' }) {
  const codigo = ticket.codigo || vacio;
  if (!onCopiar || !ticket.codigo || esCodigoSinNumero(ticket.codigo)) return <span className={className}>{codigo}</span>;
  return (
    <button
      type="button"
      onClick={() => onCopiar(ticket)}
      title="Copiar mensaje para el cliente"
      aria-label={`Copiar el mensaje para el cliente de la orden ${ticket.codigo}`}
      className={`${className} cursor-pointer hover:underline max-lg:inline-flex max-lg:items-center max-lg:min-h-11 max-lg:min-w-11 max-lg:underline max-lg:decoration-dotted max-lg:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 rounded-sm`}
    >
      {codigo}
    </button>
  );
}
