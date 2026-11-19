import { useState } from 'react';
import Segmentado from '../Segmentado';
import CobrosEmitidos from './CobrosEmitidos';
import HistorialPagosClientes from './HistorialPagosClientes';

const VISTAS = [{ id: 'COBROS', etiqueta: 'Cobros emitidos' }, { id: 'HISTORIAL', etiqueta: 'Historial de pagos' }];

// La sección "Pagos de clientes" de Finanzas, en dos vistas: los cobros que se emiten al finalizarse las órdenes (y si Administración ya los subió al portal) y el historial de los pagos que los técnicos
// registraban antes de ese cambio. Las dos son de solo lectura y usan el período y el técnico de la barra de arriba.
export default function PagosClientes({ cobros, pagos, rango, tecnico }) {
  const [vista, setVista] = useState('COBROS');
  return (
    <div className="space-y-4">
      <Segmentado ariaLabel="Qué ver" opciones={VISTAS} valor={vista} onCambiar={setVista} />
      {vista === 'COBROS'
        ? <CobrosEmitidos cobros={cobros.cobros} rango={rango} tecnico={tecnico} cargado={cobros.cargado} error={cobros.error} />
        : <HistorialPagosClientes pagos={pagos.pagos} rango={rango} tecnico={tecnico} cargado={pagos.cargado} error={pagos.error} />}
    </div>
  );
}
