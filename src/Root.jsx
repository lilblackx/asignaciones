import { lazy, Suspense } from 'react';
import { ROLES } from './constants';
import { useAuth } from './hooks/useAuth';
import App from './App.jsx';

// Cada rol de solo lectura tiene su propia pantalla, que se descarga solo si ese rol inicia sesión. Con esos roles la
// app de oficina y técnicos ni se monta (no consulta datos que las reglas les niegan) y su código no cambia.
const AlmacenApp = lazy(() => import('./components/AlmacenApp'));
const PromotoraApp = lazy(() => import('./components/PromotoraApp'));

export default function Root() {
  const auth = useAuth();
  if (auth.role === ROLES.ALMACEN || auth.role === ROLES.PROMOTORA) {
    const Pantalla = auth.role === ROLES.ALMACEN ? AlmacenApp : PromotoraApp;
    return (
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
        <Pantalla auth={auth} />
      </Suspense>
    );
  }
  return <App auth={auth} />;
}
