import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// La versión de la app (package.json) y de qué compilación es (fecha y commit), para el pie discreto de la app.
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' } })()

// Identificador de esta compilación. Va dentro de la app (__APP_BUILD__) y en /version.json: la app compara los dos cada minuto
// y solo pide el Service Worker cuando difieren (ver main.jsx).
const build = `${Date.now().toString(36)}-${commit}`

// Escribe version.json junto a los demás archivos de la compilación.
const versionJson = () => ({
  name: 'version-json',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: build }) })
  },
})

export default defineConfig({
  // `npm run dev` escucha en toda la red local (no solo en localhost) para abrir la app desde otra PC o desde el celular con la IP de esta PC (http://<IP>:5173).
  // Los emuladores ya escuchan en 0.0.0.0 y la app los busca en el mismo nombre con el que se abrió la página (ver src/lib/firebase.js).
  server: { host: true, port: 5173, strictPort: true },
  // `@/` apunta a src/ (lo usan los componentes de shadcn/ui, ver components.json).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_BUILD__: JSON.stringify(build),
    __APP_COMPILACION__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  build: {
    rolldownOptions: {
      output: {
        // Separa las librerías de terceros del código propio en chunks aparte.
        // No baja el peso total, pero react/firebase casi no cambian entre
        // deploys: con esto el navegador los sigue teniendo cacheados y en
        // cada actualización solo baja a descargar el chunk de la app.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor-firebase', test: /node_modules[\\/]@?firebase/ },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react[\\/]/ },
          ]
        }
      }
    }
  },
  plugins: [
    react(),
    versionJson(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // sw propio (src/sw.js) en vez de uno generado: necesitamos que el mismo
      // Service Worker precachee (Workbox) Y reciba pushes de FCM en segundo plano.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        injectionPoint: 'self.__WB_MANIFEST',
        // Fuente Inter (solo latin y latin-ext) en caché para que funcione sin conexión.
        globPatterns: ['**/*.{js,css,html}', '**/inter-latin*.woff2'],
        // Las librerías que arman los PDF y Word de los reportes pesan y solo las usa quien exporta: se bajan en ese momento, no con la instalación de la app.
        // Lo mismo con el mapa del módulo Ubicación (Leaflet y su vista): solo lo abre el administrador, así que los técnicos no lo bajan con la instalación.
        globIgnores: ['**/exportarPdf-*.js', '**/exportarDocx-*.js', '**/html2canvas*.js', '**/purify*.js', '**/index.es-*.js', '**/esm-*.js', '**/leaflet*.js', '**/leaflet*.css', '**/UbicacionView-*.js'],
      },
      // Agregamos los íconos de la PWA para que el Service Worker los cachee
      includeAssets: ['favicon.ico', 'icon-192x192.png', 'icon-512x512.png', 'badge-96x96.png'],
      manifest: {
        name: 'Asignaciones NS',
        short_name: 'Asignaciones',
        description: 'Sistema de control y seguimiento de asignaciones',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})