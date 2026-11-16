// El título grande de la lista de órdenes en el celular (estilo D): qué se está viendo, el día y cuántas órdenes están pendientes. En PC no se muestra (ahí el encabezado ya dice dónde estás).
export default function TituloLista({ titulo, ahora, pendientes = 0 }) {
  const dia = new Date(ahora).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Caracas' });
  return (
    <div className="lg:hidden mb-4 px-1">
      <h2 className="text-3xl font-black tracking-tight text-foreground">{titulo}</h2>
      <p className="mt-1 text-sm font-medium text-muted-foreground first-letter:uppercase">
        {dia} · {pendientes === 1 ? '1 pendiente' : `${pendientes} pendientes`}
      </p>
      {/* La línea roja de la marca, corta y redonda (la misma del login). */}
      <div className="mt-3 h-1.5 w-14 rounded-full bg-primary" aria-hidden="true" />
    </div>
  );
}
