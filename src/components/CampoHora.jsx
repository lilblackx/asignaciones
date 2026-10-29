import SelectMenu from './SelectMenu';

// El campo de hora de la app (el reloj del navegador se ve distinto en cada equipo): tres controles con el estilo de la app, la hora (1 a 12), los minutos (00 a 59) y a. m. o p. m.
// En pantallas angostas los selectores se reparten el ancho (y los botones de a. m. / p. m. se achican un poco) para que todo quede en una sola fila desde 320 px; si aun así no cabe, a. m. / p. m. pasa a la línea de abajo. Desde `sm` miden lo de siempre.
// `valor`/`onChange("HH:MM")`: la hora en formato de 24 horas, como la guarda la app ('' si no hay: se muestra 12:00 a. m. hasta que se elija).
const dos = (n) => String(n).padStart(2, '0');
const HORAS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: dos(i + 1) }));
const MINUTOS = Array.from({ length: 60 }, (_, i) => ({ value: String(i), label: dos(i) }));

const CLASE_SELECTOR = 'w-full h-10 bg-white dark:bg-zinc-950 border-2 border-zinc-400 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-lg pl-3 pr-8 text-sm font-bold text-zinc-900 dark:text-white focus:ring-0 focus:border-red-600 outline-none disabled:opacity-60';

export default function CampoHora({ id, valor, onChange, ariaLabel = 'Hora', claseSelector = CLASE_SELECTOR, claseBoton = 'px-2.5 min-[380px]:px-3 text-sm', alto = 'h-10', disabled = false }) {
  const m = /^(\d{2}):(\d{2})$/.exec(valor || '');
  const hora24 = m ? Number(m[1]) : 0;
  const minuto = m ? Number(m[2]) : 0;
  const pm = hora24 >= 12;
  const hora12 = hora24 % 12 === 0 ? 12 : hora24 % 12;

  const cambiar = (nueva12, nuevoMinuto, nuevoPm) => {
    const h = (nueva12 % 12) + (nuevoPm ? 12 : 0);
    onChange(`${dos(h)}:${dos(nuevoMinuto)}`);
  };

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5 min-[380px]:gap-2">
      <div className="flex-1 min-w-[3.5rem] sm:flex-none sm:w-24"><SelectMenu id={id} ariaLabel={`${ariaLabel}: hora`} disabled={disabled} className={claseSelector} value={String(hora12)} onChange={(v) => cambiar(Number(v), minuto, pm)} items={HORAS} /></div>
      <span className="font-black text-zinc-700 dark:text-zinc-200" aria-hidden="true">:</span>
      <div className="flex-1 min-w-[3.5rem] sm:flex-none sm:w-24"><SelectMenu ariaLabel={`${ariaLabel}: minutos`} disabled={disabled} className={claseSelector} value={String(minuto)} onChange={(v) => cambiar(hora12, Number(v), pm)} items={MINUTOS} /></div>
      <div className={`inline-flex ${alto} rounded-lg border-2 border-zinc-400 dark:border-zinc-700 overflow-hidden shrink-0`}>
        {[['a. m.', false], ['p. m.', true]].map(([texto, esPm]) => (
          <button
            key={texto}
            type="button"
            disabled={disabled}
            aria-pressed={pm === esPm}
            onClick={() => cambiar(hora12, minuto, esPm)}
            className={`${claseBoton} h-full font-bold whitespace-nowrap transition-colors disabled:opacity-60 ${pm === esPm ? 'bg-red-600 text-white' : 'bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >{texto}</button>
        ))}
      </div>
    </div>
  );
}
