import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
      },
      // Agregamos los íconos de la PWA para que el Service Worker los cachee
      includeAssets: ['favicon.ico', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'Asignaciones NS',
        short_name: 'Asignaciones',
        description: 'Sistema de control y seguimiento de asignaciones',
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