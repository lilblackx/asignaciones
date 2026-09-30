// main.jsx llena esto apenas vite-plugin-pwa registra el Service Worker.
// getToken(messaging) necesita ese registration exacto (no sirve pedirlo de
// nuevo con navigator.serviceWorker.register: crearía un segundo registro).
let resolveRegistration;
export const swRegistrationReady = new Promise((resolve) => {
  resolveRegistration = resolve;
});

export function setSwRegistration(registration) {
  resolveRegistration(registration);
}
