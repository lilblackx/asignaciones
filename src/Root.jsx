import { lazy, Suspense, useState } from 'react';
import { ROLES } from './constants';
import { useAuth } from './hooks/useAuth';
import App from './App.jsx';

// Cada rol de solo lectura tiene su propia pantalla, que se descarga solo si ese rol inicia sesión. Con esos roles la
// app de oficina y técnicos ni se monta (no consulta datos que las reglas les niegan) y su código no cambia.
const AlmacenApp = lazy(() => import('./components/AlmacenApp'));
const PromotoraApp = lazy(() => import('./components/PromotoraApp'));
const FinanzasApp = lazy(() => import('./components/FinanzasApp'));
const InfraestructuraApp = lazy(() => import('./components/InfraestructuraApp'));
const AdministracionApp = lazy(() => import('./components/AdministracionApp'));

const PANTALLAS = { [ROLES.ALMACEN]: AlmacenApp, [ROLES.PROMOTORA]: PromotoraApp, [ROLES.FINANZAS]: FinanzasApp, [ROLES.INFRAESTRUCTURA]: InfraestructuraApp, [ROLES.ADMINISTRACION]: AdministracionApp };

// Los módulos que el ADMINISTRADOR abre desde el menú lateral de la oficina: se ven dentro del marco, a la derecha del menú (la oficina sigue montada, oculta, con su estado). Almacén no
// está aquí: App lo pinta con el módulo de Materiales que ya tiene cargado.
const MODULOS_ADMIN = { FINANZAS: FinanzasApp, PROMOTORA: PromotoraApp, INFRAESTRUCTURA: InfraestructuraApp, ADMINISTRACION: AdministracionApp };

export default function Root() {
  const auth = useAuth();
  const [modulo, setModulo] = useState(null);
  const Pantalla = PANTALLAS[auth.role];
  if (Pantalla) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
        <Pantalla auth={auth} />
      </Suspense>
    );
  }
  const esAdmin = auth.role === ROLES.ADMIN;
  // El administrador ve Ventas como la ve "ver todas": las instalaciones de todas las promotoras y las averías LOS, solo lectura (sin "Nueva venta").
  const authDe = (id) => (id === 'PROMOTORA' ? { ...auth, verTodasInstalaciones: true, puedeCrearVentas: false, promotoraClaves: [], promotoraNombres: [] } : auth);
  const renderModulo = (id, { onAbrirMenu }) => {
    const Modulo = MODULOS_ADMIN[id];
    return Modulo ? (
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
        <Modulo auth={authDe(id)} onAbrirMenu={onAbrirMenu} />
      </Suspense>
    ) : null;
  };
  return <App auth={auth} moduloActivo={esAdmin ? modulo : null} onAbrirModulo={setModulo} renderModulo={renderModulo} />;
}
