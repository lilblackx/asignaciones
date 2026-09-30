# Asignaciones NS

PWA para el control y seguimiento de asignaciones (instalaciones, reconexiones, averías, garantías y validaciones de NAP) de una red de fibra. Las operadoras crean las órdenes, los técnicos las ejecutan y los administradores las aprueban. Cada orden genera su mensaje de WhatsApp con el formato de la plantilla.

## Funciones principales

- Órdenes con correlativo automático por tipo de trabajo, estados (pendiente, pre-finalizada, finalizada) e historial de cambios.
- Roles `ADMIN`, `USUARIO` y `TECNICO`, con permisos aplicados en `firestore.rules`.
- Autocompletado de instalaciones a partir de la plantilla que pega la promotora (`parseInstalacionTemplate` en `src/utils/whatsapp.js`).
- Mensaje de WhatsApp por orden. Si la orden tiene coordenadas de la NAP, el mensaje termina con `*Ubicación NAP:* <enlace de Maps>`. Esto aplica a todos los tipos de orden.
- Consulta de coordenadas de NAP en Tomodat por código de NAP.
- Ubicación del cliente y enlace "cómo llegar" a la NAP.
- Tasa BCV del día y monto en Bs para el aviso de cobro.
- Reportes y exportación, carga de trabajo por técnico, detección de reincidencias.
- Notificaciones push (FCM) con la app cerrada.
- Instalable como PWA. Se actualiza sola: revisa versión nueva cada 15 min y la aplica al volver a la app o si está en segundo plano.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `src/` | App React (componentes, hooks, `lib/` para Firebase y Tomodat, `utils/` con la lógica de negocio) |
| `src/sw.js` | Service Worker propio: precache (Workbox) y push de FCM en segundo plano |
| `cf-worker/` | Cloudflare Worker `asignaciones-notify`: envía los pushes de FCM |
| `cf-worker-tomodat/` | Cloudflare Worker `asignaciones-tomodat`: consulta NAP en Tomodat |
| `firestore.rules` | Reglas de seguridad de Firestore |
| `scripts/` | Seed del emulador y pruebas de las reglas |

## Stack

React 19, Vite 8, Tailwind CSS 4, Firebase (Auth, Firestore, Hosting, Cloud Messaging), `vite-plugin-pwa` con Workbox, Cloudflare Workers.

## Requisitos

- Node.js 20.19 o superior (o 22.12+)
- Firebase CLI (`npx firebase`) con acceso al proyecto `seguimientons-f2026`
- Wrangler (se instala con las dependencias de cada worker) para desplegar los workers

## Desarrollo

```bash
npm install
npm run dev
```

La app corre en `http://localhost:5173`. Ese origen ya está permitido en los workers.

### Emuladores de Firebase

Por defecto la app apunta al proyecto real. Para usar los emuladores:

1. Crea `.env.development.local` con `VITE_USE_EMULATORS=true`. Este archivo no se sube al repo.
2. Inicia los emuladores: `npm run emulators`
3. Carga datos de prueba: `npm run seed:emulator`

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build local |
| `npm run lint` | ESLint |
| `npm run emulators` | Emuladores de Auth y Firestore |
| `npm run seed:emulator` | Datos de prueba en el emulador |
| `npm run test:rules` | Pruebas de `firestore.rules` |

## Despliegue

### App (Firebase Hosting)

```bash
npm run build
npx firebase deploy --only hosting
```

URL: https://seguimientons-f2026.web.app

Para publicar las reglas de Firestore: `npx firebase deploy --only firestore:rules`.

### Workers (Cloudflare)

Cada worker se despliega desde su carpeta:

```bash
cd cf-worker            # o cf-worker-tomodat
npm install
npx wrangler deploy
```

Secretos. No van en el repo ni en `wrangler.toml`:

| Worker | Secreto | Comando |
| --- | --- | --- |
| `cf-worker` | `FIREBASE_SERVICE_ACCOUNT_JSON` | `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON` |
| `cf-worker-tomodat` | `TOMODAT_TOKEN` | `npx wrangler secret put TOMODAT_TOKEN` |

Las variables no secretas (`ALLOWED_ORIGINS`, `FIREBASE_PROJECT_ID`, etc.) están en cada `wrangler.toml`. Si cambia el dominio de la app, actualiza `ALLOWED_ORIGINS` en ambos workers.

Las URLs de los workers y la configuración web de Firebase están en `src/lib/firebase.js`. La configuración web de Firebase y la clave VAPID son públicas por diseño.

## Actualización en los dispositivos

`src/main.jsx` registra el Service Worker con `registerType: 'autoUpdate'`. Al detectar una versión nueva manda `SKIP_WAITING` al SW nuevo (manejado en `src/sw.js`) y recarga la página cuando la app pasa a segundo plano o vuelve a primer plano. No hace falta un hard reload.
