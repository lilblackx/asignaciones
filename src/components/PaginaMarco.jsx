import EncabezadoSimple from './EncabezadoSimple';
import PieVersion from './PieVersion';

// Un módulo del administrador como página dentro del marco, a la derecha del menú lateral: el encabezado de la app (con el botón ☰ en el celular), el contenido y el pie de versión.
//   encabezado: { nombre, rol, isDarkMode, setIsDarkMode, handleLogout, onAbrirMenu }
export default function PaginaMarco({ titulo, Icono, encabezado, children }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-screen">
      <EncabezadoSimple titulo={titulo} icono={Icono} {...encabezado} />
      <main className="flex-1 w-full">{children}</main>
      <PieVersion />
    </div>
  );
}
