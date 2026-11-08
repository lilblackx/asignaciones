import { useState } from 'react';
import { Plus } from 'lucide-react';
import Spinner from '../Spinner';
import Boton from '../Boton';
import { BOTON_FILA, BOTON_GRANDE, CAMPO, ETIQUETA, TARJETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { stripEmojis } from '../../utils/sanitizeInput';
import { aBs, bolivares } from '../../utils/finanzas';
import { MAX_ITEMS_ADICIONALES, MAX_NOMBRE_ADICIONAL, idItemAdicional, parseCatalogoAdicionales, parsePrecioAdicional } from '../../utils/adicionales';

// Los ítems de pagos adicionales del tabulador: un nombre y un precio en dólares (con su equivalente en bolívares a la tasa BCV de hoy). Con cada ítem, Finanzas le suma un pago adicional
// a cualquier técnico desde su pantalla (botón "Pago adicional"). Cambiar el precio aquí no mueve lo ya registrado a un técnico.
const enTexto = (valor) => String(valor).replace('.', ',');
const normal = (f) => `${String(f.nombre).replace(/\s+/g, ' ').trim()}|${String(f.precio).trim()}`;

function Formulario({ items, tasa, ocupado, onGuardar }) {
  const [filas, setFilas] = useState(() => items.map((i) => ({ id: i.id, nombre: i.nombre, precio: enTexto(i.precio) })));
  const [error, setError] = useState(null);
  const originales = new Map(items.map((i) => [i.id, normal({ nombre: i.nombre, precio: enTexto(i.precio) })]));
  const cambiado = filas.length !== items.length || filas.some((f) => originales.get(f.id) !== normal(f));

  const cambiar = (id, campo, valor) => { setFilas((lista) => lista.map((f) => (f.id === id ? { ...f, [campo]: stripEmojis(valor) } : f))); setError(null); };
  const agregar = () => { setFilas((lista) => [...lista, { id: idItemAdicional(), nombre: '', precio: '' }]); setError(null); };
  const quitar = (id) => { setFilas((lista) => lista.filter((f) => f.id !== id)); setError(null); };
  const guardar = () => {
    const r = parseCatalogoAdicionales(filas);
    if (r.error) { setError({ texto: r.error, id: r.id, campo: r.campo }); return; }
    onGuardar(r.valor);
  };
  const aqui = (id, campo) => error?.id === id && error?.campo === campo;

  return (
    <section aria-label="Pagos adicionales" className="max-w-4xl space-y-4">
      <div>
        <h2 className={TITULO_SECCION}>Pagos adicionales</h2>
        <p className={`${TEXTO_SUAVE} mt-1`}>Ítems con su precio en dólares que no salen de una orden, por ejemplo un domingo trabajado. Con cada uno, Finanzas le suma un pago adicional a cualquier técnico desde su pantalla, con el botón «Pago adicional». Cambiar el precio aquí no mueve lo que ya se registró.</p>
      </div>

      {filas.length === 0 ? (
        <p className={`${TARJETA} px-4 py-4 text-sm text-zinc-700 dark:text-zinc-200`}>Todavía no hay ítems. Agrega el primero.</p>
      ) : (
        <ul className={`${TARJETA} px-4 divide-y divide-zinc-200 dark:divide-zinc-800`}>
          {filas.map((f, i) => {
            const precio = parsePrecioAdicional(f.precio).valor;
            return (
              <li key={f.id} className="py-3 grid grid-cols-1 sm:grid-cols-[1fr_11rem_auto] items-start gap-x-4 gap-y-2">
                <div>
                  <label htmlFor={`adicional-nombre-${f.id}`} className={`${ETIQUETA} sm:sr-only`}>Nombre del ítem</label>
                  <input id={`adicional-nombre-${f.id}`} value={f.nombre} onChange={(e) => cambiar(f.id, 'nombre', e.target.value)} maxLength={MAX_NOMBRE_ADICIONAL} autoComplete="off" placeholder={`Nombre, por ejemplo: Domingo trabajado`} aria-invalid={aqui(f.id, 'nombre')} className={`${CAMPO} mt-1 sm:mt-0 text-sm font-bold`} />
                  {aqui(f.id, 'nombre') && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{error.texto}</p>}
                </div>
                <div>
                  <label htmlFor={`adicional-precio-${f.id}`} className={`${ETIQUETA} sm:sr-only`}>Precio en dólares</label>
                  <div className="relative mt-1 sm:mt-0">
                    <input id={`adicional-precio-${f.id}`} value={f.precio} onChange={(e) => cambiar(f.id, 'precio', e.target.value)} inputMode="decimal" autoComplete="off" placeholder="0,00" aria-invalid={aqui(f.id, 'precio')} className={`${CAMPO} pr-9 text-sm font-bold text-right tabular-nums`} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base font-bold text-zinc-600 dark:text-zinc-300 pointer-events-none">$</span>
                  </div>
                  {aqui(f.id, 'precio') ? <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{error.texto}</p> : (precio > 0 && tasa > 0 && <p className={`${TEXTO_SUAVE} text-right font-semibold tabular-nums mt-1`}>{bolivares(aBs(precio, tasa))}</p>)}
                </div>
                <button type="button" onClick={() => quitar(f.id)} disabled={ocupado} aria-label={`Quitar el ítem ${f.nombre || i + 1}`} className={`${BOTON_FILA} sm:mt-0.5`}>Quitar</button>
              </li>
            );
          })}
        </ul>
      )}

      {error && !error.id && <p role="alert" className="text-sm text-red-600 dark:text-red-400 font-bold">{error.texto}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <Boton variante="secundario" tamano="normal" icono={Plus} onClick={agregar} disabled={ocupado || filas.length >= MAX_ITEMS_ADICIONALES}>Agregar ítem</Boton>
        <button type="button" onClick={guardar} disabled={ocupado || !cambiado} className={`${BOTON_GRANDE} bg-red-600 hover:bg-red-700 text-white`}>
          {ocupado && <Spinner />}Guardar ítems
        </button>
        <span className={`${ETIQUETA} text-sm`}>{cambiado ? 'Hay cambios sin guardar' : 'Ítems al día'}</span>
      </div>
    </section>
  );
}

// El formulario se vuelve a armar (key) cuando cambian los ítems guardados.
export default function TabuladorAdicionales({ items, tasa = null, cargado, ocupado, onGuardar }) {
  if (!cargado) return null;
  return <Formulario key={JSON.stringify(items)} items={items} tasa={tasa} ocupado={ocupado} onGuardar={onGuardar} />;
}
