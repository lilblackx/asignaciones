import { lazy, Suspense } from 'react';
import { ROLES } from './constants';
import { useAuth } from './hooks/useAuth';
import App from './App.jsx';

// Cada rol de solo lectura tiene su propia pantalla, que se descarga solo si ese rol inicia sesión. Con esos roles la
// app de oficina y técnicos ni se monta (no consulta datos que las reglas les niegan) y su código no cambia.
const AlmacenApp = lazy(() => import('./components/AlmacenApp'));
const PromotoraApp = lazy(() => import('./components/PromotoraApp'));
const FinanzasApp = lazy(() => import('./components/FinanzasApp'));

const PANTALLAS = { [ROLES.ALMACEN]: AlmacenApp, [ROLES.PROMOTORA]: PromotoraApp, [ROLES.FINANZAS]: FinanzasApp };

export default function Root() {
  const auth = useAuth();
  const Pantalla = PANTALLAS[auth.role];
  if (Pantalla) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
        <Pantalla auth={auth} />
      </Suspense>
    );
  }
  return <App auth={auth} />;
}
